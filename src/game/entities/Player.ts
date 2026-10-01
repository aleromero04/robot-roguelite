import Phaser from 'phaser'
import { DamageFlash, shieldBlock, ReviveEffect } from '../effects/CombatEffects'
import { configureCharacter } from '../visuals/characters'

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd: Record<string, Phaser.Input.Keyboard.Key>
  private readonly baseSpeed = 220
  private readonly baseDamage = 1
  private readonly baseCooldown = 500
  private powerCoreLevel = 0
  private overclockLevel = 0
  private turboLevel = 0
  private selectedUpgradeIds: string[] = []
  private maxHealth = 5
  private health = this.maxHealth
  private readonly invulnerabilityDuration = 1000
  private invulnerableUntil = 0
  private readonly reviveEffect = new ReviveEffect()
  private readonly damageFlash = new DamageFlash()
  private shieldField?: Phaser.GameObjects.Arc
  private combatVisualsVisible = false
  private shieldReady = false
  private reviveReady = false

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player')

    scene.add.existing(this)
    scene.physics.add.existing(this)

    configureCharacter(this, 40)
    this.setCollideWorldBounds(true)

    this.cursors = scene.input.keyboard!.createCursorKeys()

    this.wasd = scene.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<string, Phaser.Input.Keyboard.Key>
  }

  override preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta)
    this.damageFlash.update(this)
    this.reviveEffect.update(this)
    this.shieldField?.setPosition(this.x, this.y)
      .setAlpha(0.75 + 0.08 * Math.sin(this.scene.time.now / 300))
  }

  update() {
    if (!this.isAlive()) {
      this.setVelocity(0, 0)
      return
    }

    let x = 0
    let y = 0

    if (this.cursors.left.isDown || this.wasd.left.isDown) x -= 1
    if (this.cursors.right.isDown || this.wasd.right.isDown) x += 1
    if (this.cursors.up.isDown || this.wasd.up.isDown) y -= 1
    if (this.cursors.down.isDown || this.wasd.down.isDown) y += 1

    const direction = new Phaser.Math.Vector2(x, y)

    if (direction.length() > 0) {
      direction.normalize().scale(this.getMoveSpeed())
    }

    this.setVelocity(direction.x, direction.y)
  }
  getHealth(): number {
    return this.health
  }

  getMaxHealth(): number {
    return this.maxHealth
  }

  getDamage(): number {
    return this.baseDamage * (1 + 0.25 * this.powerCoreLevel + (this.hasUpgrade('power-trio') ? 0.20 : 0))
  }

  getAttackCooldown(): number {
    return this.baseCooldown / (1 + 0.15 * this.overclockLevel + (this.hasUpgrade('power-trio') ? 0.20 : 0))
  }

  getBurstSize(): number {
    if (this.hasUpgrade('triple-shot')) return 3
    return this.hasUpgrade('rapid-shot') ? 2 : 1
  }

  getMoveSpeed(): number {
    return this.baseSpeed * (1 + 0.12 * this.turboLevel)
  }

  getSelectedUpgradeIds(): readonly string[] {
    return this.selectedUpgradeIds
  }

  hasUpgrade(id: string): boolean {
    return this.selectedUpgradeIds.includes(id)
  }

  applyUpgrade(id: string) {
    if ((id === 'power-trio' || id === 'triple-shot') && this.hasUpgrade(id)) return
    if (id === 'revive' && !this.hasUpgrade(id)) this.reviveReady = true
    this.selectedUpgradeIds.push(id)

    switch (id) {
      case 'power-core':
        this.powerCoreLevel++
        break
      case 'overclock':
        this.overclockLevel++
        break
      case 'turbo':
        this.turboLevel++
        break
      case 'power-trio':
      case 'reinforced-chassis':
        this.maxHealth++
        this.health = Math.min(this.maxHealth, this.health + 1)
        break
      case 'repair':
        this.health = Math.min(this.maxHealth, this.health + 2)
        break
      // Projectile abilities read the build through hasUpgrade().
    }
  }

  startWave() {
    this.shieldReady = this.hasUpgrade('energy-shield')
    this.syncShieldField()
  }

  setCombatVisualsVisible(visible: boolean) {
    this.combatVisualsVisible = visible
    if (!visible) this.reviveEffect.clear(this)
    this.syncShieldField()
  }

  private syncShieldField() {
    if (!this.shieldReady || !this.combatVisualsVisible) {
      this.shieldField?.destroy()
      this.shieldField = undefined
      return
    }
    this.shieldField ??= this.scene.add.circle(this.x, this.y,
      Math.max(this.displayWidth, this.displayHeight) / 2 + 5, 0x39dfff, 0.07)
      .setStrokeStyle(1.5, 0x6beaff, 0.5).setDepth(0.4)
  }

  override destroy(fromScene?: boolean) {
    this.reviveEffect.clear(this)
    this.shieldField?.destroy()
    this.shieldField = undefined
    super.destroy(fromScene)
  }

  isShieldReady(): boolean {
    return this.shieldReady
  }

  isReviveReady(): boolean {
    return this.reviveReady
  }

  isAlive(): boolean {
    return this.health > 0
  }

  takeDamage(amount: number): boolean {
    const now = this.scene.time.now

    if (!this.isAlive() || now < this.invulnerableUntil || amount <= 0) {
      return false
    }

    // Accepted events (including a shield block) protect against simultaneous overlaps.
    this.invulnerableUntil = now + this.invulnerabilityDuration
    if (this.shieldReady) {
      this.shieldReady = false
      this.syncShieldField()
      shieldBlock(this)
      return true
    }

    this.damageFlash.show(this, 100, 0xff9999)

    if (amount >= this.health && this.reviveReady) {
      this.reviveReady = false
      this.health = Math.min(3, this.maxHealth)
      this.reviveEffect.start(this, this.invulnerableUntil)
      return true
    }

    this.health = Math.max(0, this.health - amount)

    if (!this.isAlive()) {
      this.setVelocity(0, 0)
    }

    return true
  }

  isMoving(): boolean {
    return this.body!.velocity.lengthSq() > 0
  }
}
