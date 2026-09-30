import Phaser from 'phaser'
import { preloadArena, createArena } from '../environment/ArenaVisuals'
import { CHARACTERS, getCharacterSpawnMargin } from '../visuals/characters'
import { Player } from '../entities/Player'
import { Boss } from '../entities/Boss'
import { Enemy } from '../entities/Enemy'
import type { EnemyType } from '../entities/Enemy'
import { EnemyProjectile } from '../entities/EnemyProjectile'
import { Projectile } from '../entities/Projectile'
import { generateUpgradeOptions } from '../data/upgrades'
import { WAVES } from '../data/waves'
import type { WaveNumber } from '../data/waves'

type GameState = 'START' | 'COMBAT' | 'UPGRADE_SELECTION' | 'COUNTDOWN' | 'WAVE_COMPLETE' | 'GAME_OVER' | 'VICTORY'

export class GameScene extends Phaser.Scene {
  private player!: Player
  private enemies!: Phaser.GameObjects.Group
  private lastShotTime = 0
  private enemyProjectiles!: Phaser.GameObjects.Group
  private projectiles!: Phaser.GameObjects.Group
  private enemyHealthBars!: Phaser.GameObjects.Graphics
  private healthText!: Phaser.GameObjects.Text
  private abilityText!: Phaser.GameObjects.Text
  private waveText!: Phaser.GameObjects.Text
  private state: GameState = 'START'
  private currentWave: WaveNumber | 7 = 1
  private nextGroupIndex = 0

  constructor() {
    super('GameScene')
  }

  preload() {
    preloadArena(this)
    for (const key of Object.keys(CHARACTERS)) {
      if (!this.textures.exists(key)) this.load.image(key, `assets/characters/${key}.png`)
    }
  }

  create() {
    this.state = 'START'
    this.currentWave = 1
    this.nextGroupIndex = 0
    this.lastShotTime = 0
    this.cameras.main.setBackgroundColor('#151922')
    createArena(this)

    for (const [key, config] of Object.entries(CHARACTERS)) {
      const texture = this.textures.get(key)
      const [x, y, width, height] = config.bounds
      if (!texture.has('character')) texture.add('character', 0, x, y, width, height)
    }
    this.enemyHealthBars = this.add.graphics().setDepth(1)

    const enemyShotGraphics = this.make.graphics({ x: 0, y: 0 }, false)
    enemyShotGraphics.fillStyle(0xf97316)
    enemyShotGraphics.fillCircle(6, 6, 6)
    if (!this.textures.exists('enemy-projectile')) enemyShotGraphics.generateTexture('enemy-projectile', 12, 12)
    enemyShotGraphics.destroy()

    const projectileGraphics = this.make.graphics({ x: 0, y: 0 }, false)
    projectileGraphics.fillStyle(0xfacc15)
    projectileGraphics.fillCircle(5, 5, 5)
    if (!this.textures.exists('projectile')) projectileGraphics.generateTexture('projectile', 10, 10)
    projectileGraphics.destroy()

    this.physics.world.setBounds(0, 0, 800, 600)
    this.player = new Player(this, 400, 300)
    this.enemies = this.add.group()
    this.projectiles = this.add.group()
    this.enemyProjectiles = this.add.group()
    this.healthText = this.add.text(16, 16, `HP: ${this.player.getHealth()} / ${this.player.getMaxHealth()}`, {
      fontSize: '24px',
      color: '#ffffff',
    }).setDepth(1)

    this.abilityText = this.add.text(16, 48, '', {
      fontSize: '18px', color: '#ffffff',
    }).setDepth(1)

    this.waveText = this.add.text(400, 70, '', {
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(1).setVisible(false)
    this.showStartScreen()

    this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => {
      if (enemy instanceof Enemy && enemy.active) this.damagePlayer(enemy.contactDamage)
    })
    this.physics.add.overlap(this.player, this.enemyProjectiles, (_player, projectile) => {
      if (this.state !== 'COMBAT' || !(projectile instanceof EnemyProjectile) || !projectile.active) return
      projectile.destroy()
      this.damagePlayer(projectile.damage)
    })

    this.physics.add.overlap(
      this.projectiles,
      this.enemies,
      (projectile, enemy) => {
        if (this.state !== 'COMBAT' || !(projectile instanceof Projectile) || !projectile.active ||
            !(enemy instanceof Enemy) || !enemy.active) {
          return
        }

        if (!projectile.hit(enemy, this.player.getDamage())) return
        const ricochetTarget = projectile.canRicochet()
          ? this.findNearestEnemy(projectile, candidate => !projectile.hasHit(candidate))
          : undefined
        projectile.finishHit(ricochetTarget)
      },
    )
  }

  update(time: number) {
    this.drawEnemyHealthBars()
    if (this.state !== 'COMBAT' || !this.player.isAlive()) {
      return
    }

    const alive = this.enemies.countActive(true)
    const nextGroup = this.currentWave === 7 ? undefined : WAVES[this.currentWave].groups[this.nextGroupIndex]
    if (nextGroup && nextGroup.spawnAtAlive !== null && alive <= nextGroup.spawnAtAlive) {
      this.spawnNextGroup()
    } else if (!nextGroup && alive === 0) {
      if (this.currentWave === 7) this.showVictory()
      else this.completeWave()
      return
    }

    this.player.update()

    for (const enemy of [...this.enemies.getChildren()]) {
      if (enemy instanceof Enemy && enemy.active) {
        enemy.updateBurn(this.time.now)
        if (!enemy.active) continue
        enemy.updateBehavior(this.player.x, this.player.y, () => {
          this.enemyProjectiles.add(new EnemyProjectile(
            this, enemy.x, enemy.y, this.player.x, this.player.y,
          ))
        })
      }
    }

    if (this.player.isMoving()) {
      return
    }

    if (time - this.lastShotTime < this.player.getAttackCooldown()) {
      return
    }

    if (!this.fireProjectile()) return
    this.lastShotTime = time
    const wave = this.currentWave
    const burstSize = this.player.getBurstSize()
    for (let index = 1; index < burstSize; index++) {
      this.time.delayedCall(index * 100, () => {
        if (this.state === 'COMBAT' && this.currentWave === wave) this.fireProjectile()
      })
    }
  }

  private fireProjectile(): boolean {
    if (this.state !== 'COMBAT' || !this.player.isAlive()) return false
    const target = this.findNearestEnemy()

    if (!target) {
      return false
    }

    const projectile = new Projectile(
      this,
      this.player.x,
      this.player.y,
      target.x,
      target.y,
      {
        piercing: this.player.hasUpgrade('piercing-shot'),
        ricochet: this.player.hasUpgrade('ricochet'),
        flame: this.player.hasUpgrade('flame-shot'),
      },
    )

    if (this.player.hasUpgrade('homing-shot')) {
      projectile.enableHoming(target, () =>
        this.findNearestEnemy(projectile, enemy => !projectile.hasHit(enemy)),
      )
    }
    this.projectiles.add(projectile)
    return true
  }

  private showStartScreen() {
    this.player.setVisible(false)
    this.healthText.setVisible(false)
    const title = this.add.text(400, 180, 'ROBOT ROGUELITE', {
      fontSize: '40px', color: '#ffffff',
    }).setOrigin(0.5)
    const instructions = this.add.text(400, 280,
      'WASD / Flechas para moverte\nDetente para disparar', {
        fontSize: '24px', color: '#ffffff', align: 'center',
      }).setOrigin(0.5)
    const play = this.createButton(400, 390, 'JUGAR', () => {
      if (this.state !== 'START') return
      title.destroy()
      instructions.destroy()
      play.destroy()
      this.player.setVisible(true)
      this.healthText.setVisible(true)
      this.startWave(1)
    })
  }

  private createButton(x: number, y: number, label: string, onClick: () => void) {
    return this.add.text(x, y, label, {
      fontSize: '24px', color: '#ffffff', backgroundColor: '#334155',
      padding: { x: 20, y: 12 },
    }).setOrigin(0.5).setDepth(2).setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick)
  }

  private drawEnemyHealthBars() {
    this.enemyHealthBars.clear()
    for (const enemy of this.enemies.getChildren()) {
      if (!(enemy instanceof Enemy) || !enemy.active) continue
      const boss = enemy instanceof Boss
      const width = boss ? 240 : 32
      const height = boss ? 10 : 4
      const x = boss ? 280 : enemy.x - width / 2
      const y = boss ? 24 : Math.max(2, enemy.y - enemy.displayHeight / 2 - 9)
      this.enemyHealthBars.fillStyle(0x101827, 0.9)
      this.enemyHealthBars.fillRect(x - 1, y - 1, width + 2, height + 2)
      this.enemyHealthBars.fillStyle(boss ? 0xf472b6 : 0x4ade80)
      this.enemyHealthBars.fillRect(x, y, width * Math.max(0, enemy.getHealth() / enemy.getMaxHealth()), height)
    }
  }

  private damagePlayer(amount: number) {
    if (this.state !== 'COMBAT' || !this.player.takeDamage(amount)) return
    this.updatePlayerUI()
    if (this.player.isAlive()) return

    this.state = 'GAME_OVER'
    this.stopCombat()
    this.waveText.setVisible(false)
    for (const enemy of this.enemies.getChildren()) {
      if (enemy instanceof Enemy && enemy.active) enemy.setVelocity(0, 0)
    }
    this.add.text(400, 300, 'GAME OVER', {
      fontSize: '48px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(1)
    this.showPlayAgain()
  }

  private showVictory() {
    this.state = 'VICTORY'
    this.stopCombat()
    this.waveText.setText('VICTORY').setVisible(true)
    this.showPlayAgain()
  }

  private showPlayAgain() {
    this.createButton(400, 400, 'PLAY AGAIN', () => {
      if (this.state !== 'VICTORY' && this.state !== 'GAME_OVER') return
      this.state = 'START'
      this.scene.restart()
    })
  }

  private updatePlayerUI() {
    this.healthText.setText(`HP: ${this.player.getHealth()} / ${this.player.getMaxHealth()}`)
    const lines: string[] = []
    if (this.player.hasUpgrade('energy-shield')) {
      lines.push(`SHIELD: ${this.player.isShieldReady() ? 'READY' : 'USED'}`)
    }
    if (this.player.hasUpgrade('revive')) {
      lines.push(`REVIVE: ${this.player.isReviveReady() ? 'READY' : 'USED'}`)
    }
    this.abilityText.setText(lines.join('\n'))
  }

  private startWave(wave: WaveNumber | 7) {
    this.player.startWave()
    this.updatePlayerUI()
    this.currentWave = wave
    this.nextGroupIndex = 0
    if (wave === 7) {
      this.stopCombat()
      this.enemies.clear(true, true)
      const bounds = this.physics.world.bounds
      const margin = getCharacterSpawnMargin('enemy-boss', 80)
      const corners = [
        { x: bounds.left + margin.x, y: bounds.top + margin.y },
        { x: bounds.right - margin.x, y: bounds.top + margin.y },
        { x: bounds.left + margin.x, y: bounds.bottom - margin.y },
        { x: bounds.right - margin.x, y: bounds.bottom - margin.y },
      ]
      corners.sort((a, b) => Phaser.Math.Distance.BetweenPointsSquared(b, this.player) -
        Phaser.Math.Distance.BetweenPointsSquared(a, this.player))
      this.enemies.add(new Boss(this, corners[0].x, corners[0].y))
    } else {
      this.spawnNextGroup()
    }
    this.lastShotTime = this.time.now
    this.state = 'COMBAT'
    this.waveText.setText(`WAVE ${wave}`).setVisible(true)
    this.time.delayedCall(1500, () => {
      if (this.state === 'COMBAT' && this.currentWave === wave) {
        this.waveText.setVisible(false)
      }
    })
  }

  private stopCombat() {
    this.player.setVelocity(0, 0)
    this.projectiles.clear(true, true)
    this.enemyProjectiles.clear(true, true)
    for (const enemy of this.enemies.getChildren()) {
      if (enemy instanceof Enemy) enemy.clearBurn()
    }
  }

  private completeWave() {
    this.state = 'WAVE_COMPLETE'
    this.stopCombat()
    this.waveText.setText('WAVE COMPLETE').setVisible(true)
    this.time.delayedCall(1000, () => {
      if (this.state === 'WAVE_COMPLETE' && this.player.isAlive()) {
        this.showUpgradeSelection()
      }
    })
  }

  private showUpgradeSelection() {
    if (this.currentWave === 7) return
    this.state = 'UPGRADE_SELECTION'
    const options = generateUpgradeOptions(
      this.currentWave,
      this.player.getSelectedUpgradeIds(),
      this.player.getHealth(),
      this.player.getMaxHealth(),
    )
    const cards = options.map((upgrade, index) =>
      this.add.text(160 + index * 240, 300,
        `${upgrade.name}\n\n${upgrade.rarity}\n\n${upgrade.description}`, {
          fontSize: '18px', color: '#ffffff', backgroundColor: '#334155',
          fixedWidth: 220, fixedHeight: 240,
          padding: { x: 12, y: 16 }, wordWrap: { width: 196 }, align: 'center',
        }).setOrigin(0.5).setDepth(2).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (this.state !== 'UPGRADE_SELECTION') return
          this.state = 'COUNTDOWN'
          this.player.applyUpgrade(upgrade.id)
          this.updatePlayerUI()
          cards.forEach(card => card.destroy())
          this.startCountdown()
        }),
    )
  }

  private startCountdown() {
    const steps = ['3', '2', '1', 'GO']
    const showStep = (index: number) => {
      if (this.state !== 'COUNTDOWN' || !this.player.isAlive()) return
      if (index === steps.length) {
        if (this.currentWave === 6) {
          this.startWave(7)
        } else {
          this.startWave((this.currentWave + 1) as WaveNumber)
        }
        return
      }
      this.waveText.setText(steps[index]).setVisible(true)
      this.time.delayedCall(1000, () => showStep(index + 1))
    }
    showStep(0)
  }

  private spawnNextGroup() {
    if (this.currentWave === 7) return
    const group = WAVES[this.currentWave].groups[this.nextGroupIndex]
    if (!group) return
    const composition: EnemyType[] = []
    for (const type of ['basic', 'runner', 'shooter'] as const) {
      for (let i = 0; i < (group.enemies[type] ?? 0); i++) composition.push(type)
    }
    this.spawnGroup(composition)
    this.nextGroupIndex++
  }

  private spawnGroup(composition: readonly EnemyType[]) {
    const bounds = this.physics.world.bounds
    const minDistance = 60
    const maxAttempts = 100
    const isAwayFromPlayer = (x: number, y: number) =>
      Phaser.Math.Distance.BetweenPointsSquared({ x, y }, this.player) >= 280 ** 2
    const isSeparated = (x: number, y: number) =>
      isAwayFromPlayer(x, y) &&
      this.enemies.getChildren().every(
      enemy => !(enemy instanceof Enemy) || !enemy.active ||
        Phaser.Math.Distance.BetweenPointsSquared({ x, y }, enemy) >= minDistance ** 2,
    )

    for (const type of composition) {
      const margin = getCharacterSpawnMargin(`enemy-${type}`, 40)
      const left = bounds.left + margin.x
      const right = bounds.right - margin.x
      const top = bounds.top + margin.y
      const bottom = bounds.bottom - margin.y
      let position: { x: number; y: number } | undefined

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const edge = Phaser.Math.Between(0, 3)
        const x = edge === 2 ? left : edge === 3 ? right : Phaser.Math.Between(left, right)
        const y = edge === 0 ? top : edge === 1 ? bottom : Phaser.Math.Between(top, bottom)

        if (isSeparated(x, y)) {
          position = { x, y }
          break
        }
      }

      // Search all four edges if random attempts are exhausted.
      if (!position) {
        const candidates: { x: number; y: number }[] = []
        for (let x = left; x <= right; x += minDistance) {
          candidates.push({ x, y: top }, { x, y: bottom })
        }
        for (let y = top; y <= bottom; y += minDistance) {
          candidates.push({ x: left, y }, { x: right, y })
        }
        position = candidates.find(({ x, y }) => isSeparated(x, y)) ??
          candidates.find(({ x, y }) => isAwayFromPlayer(x, y))
      }

      if (!position) {
        throw new Error('No valid enemy spawn position')
      }

      this.enemies.add(new Enemy(this, position.x, position.y, type))
    }

  }

  private findNearestEnemy(
    origin: { x: number; y: number } = this.player,
    accepts: (enemy: Enemy) => boolean = () => true,
  ): Enemy | undefined {
    let nearest: Enemy | undefined
    let nearestDistanceSquared = Infinity

    for (const enemy of this.enemies.getChildren()) {
      if (!(enemy instanceof Enemy) || !enemy.active || !accepts(enemy)) {
        continue
      }

      const distanceSquared = Phaser.Math.Distance.BetweenPointsSquared(origin, enemy)

      if (distanceSquared < nearestDistanceSquared) {
        nearest = enemy
        nearestDistanceSquared = distanceSquared
      }
    }

    return nearest
  }
}
