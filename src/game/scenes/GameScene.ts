import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { Projectile } from '../entities/Projectile'

export class GameScene extends Phaser.Scene {
  private player!: Player
  private enemies!: Phaser.GameObjects.Group
  private lastShotTime = 0
  private readonly shotCooldown = 500
  private projectiles!: Phaser.GameObjects.Group
  private healthText!: Phaser.GameObjects.Text
  private waveText!: Phaser.GameObjects.Text
  private waveComplete = false

  constructor() {
    super('GameScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#151922')

    const graphics = this.make.graphics({ x: 0, y: 0 }, false)
    graphics.fillStyle(0x4ade80)
    graphics.fillRect(0, 0, 40, 40)
    graphics.generateTexture('player', 40, 40)
    graphics.destroy()

    const enemyGraphics = this.make.graphics({ x: 0, y: 0 }, false)
    enemyGraphics.fillStyle(0xef4444)
    enemyGraphics.fillRect(0, 0, 40, 40)
    enemyGraphics.generateTexture('enemy', 40, 40)
    enemyGraphics.destroy()

    const projectileGraphics = this.make.graphics({ x: 0, y: 0 }, false)
    projectileGraphics.fillStyle(0xfacc15)
    projectileGraphics.fillCircle(5, 5, 5)
    projectileGraphics.generateTexture('projectile', 10, 10)
    projectileGraphics.destroy()

    this.physics.world.setBounds(0, 0, 800, 600)
    this.player = new Player(this, 400, 300)
    this.enemies = this.add.group()
    this.spawnWave()
    this.projectiles = this.add.group()
    this.healthText = this.add.text(16, 16, `HP: ${this.player.getHealth()}`, {
      fontSize: '24px',
      color: '#ffffff',
    }).setDepth(1)

    this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => {
      if (!(enemy instanceof Enemy) || !enemy.active || !this.player.takeDamage(1)) {
        return
      }

      this.healthText.setText(`HP: ${this.player.getHealth()}`)

      if (!this.player.isAlive()) {
        this.waveText.setVisible(false)
        for (const remainingEnemy of this.enemies.getChildren()) {
          if (remainingEnemy instanceof Enemy && remainingEnemy.active) {
            remainingEnemy.setVelocity(0, 0)
          }
        }

        this.add.text(400, 300, 'GAME OVER', {
          fontSize: '48px',
          color: '#ffffff',
        }).setOrigin(0.5).setDepth(1)
      }
    })

    this.physics.add.overlap(
      this.projectiles,
      this.enemies,
      (projectile, enemy) => {
        if (!(projectile instanceof Projectile) || !projectile.active ||
            !(enemy instanceof Enemy) || !enemy.active) {
          return
        }

        projectile.destroy()
        enemy.takeDamage(1)
      },
    )
  }

  update(time: number) {
    if (!this.player.isAlive()) {
      return
    }

    this.player.update()
    this.checkWaveComplete()

    for (const enemy of this.enemies.getChildren()) {
      if (enemy instanceof Enemy && enemy.active) {
        enemy.chase(this.player.x, this.player.y)
      }
    }

    if (this.player.isMoving()) {
      return
    }

    if (time - this.lastShotTime < this.shotCooldown) {
      return
    }

    const target = this.findNearestEnemy()

    if (!target) {
      return
    }

    const projectile = new Projectile(
      this,
      this.player.x,
      this.player.y,
      target.x,
      target.y,
    )

    this.projectiles.add(projectile)
    this.lastShotTime = time
  }

  private spawnWave() {
    const bounds = this.physics.world.bounds
    // Enemy is 40 x 40. These edges are at least 280 px from the starting player.
    const margin = 20
    const left = bounds.left + margin
    const right = bounds.right - margin
    const top = bounds.top + margin
    const bottom = bounds.bottom - margin
    const minDistance = 60
    const maxAttempts = 100
    const isSeparated = (x: number, y: number) => this.enemies.getChildren().every(
      enemy => !(enemy instanceof Enemy) ||
        Phaser.Math.Distance.BetweenPointsSquared({ x, y }, enemy) >= minDistance ** 2,
    )

    for (let i = 0; i < 5; i++) {
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

      // Bounded fallback: keep all five enemies even if random attempts fail.
      // With at most four existing enemies, this edge has enough free slots.
      if (!position) {
        for (let x = left; x <= right; x += minDistance) {
          if (isSeparated(x, top)) {
            position = { x, y: top }
            break
          }
        }
      }

      if (!position) {
        throw new Error('No valid enemy spawn position')
      }

      this.enemies.add(new Enemy(this, position.x, position.y))
    }

    this.waveText = this.add.text(400, 70, 'WAVE 1', {
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(1)

    this.time.delayedCall(1500, () => {
      if (!this.waveComplete) {
        this.waveText.setVisible(false)
      }
    })
  }

  private checkWaveComplete() {
    if (this.waveComplete || !this.player.isAlive() || this.enemies.countActive(true) > 0) {
      return
    }

    this.waveComplete = true
    this.waveText.setText('WAVE COMPLETE').setVisible(true)
  }

  private findNearestEnemy(): Enemy | undefined {
    let nearest: Enemy | undefined
    let nearestDistanceSquared = Infinity

    for (const enemy of this.enemies.getChildren()) {
      if (!(enemy instanceof Enemy) || !enemy.active) {
        continue
      }

      const distanceSquared = Phaser.Math.Distance.BetweenPointsSquared(this.player, enemy)

      if (distanceSquared < nearestDistanceSquared) {
        nearest = enemy
        nearestDistanceSquared = distanceSquared
      }
    }

    return nearest
  }
}
