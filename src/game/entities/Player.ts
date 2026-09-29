import Phaser from 'phaser'

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

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player')

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.setDisplaySize(40, 40)
    this.setCollideWorldBounds(true)

    this.cursors = scene.input.keyboard!.createCursorKeys()

    this.wasd = scene.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<string, Phaser.Input.Keyboard.Key>
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
    return this.baseDamage * (1 + 0.25 * this.powerCoreLevel)
  }

  getAttackCooldown(): number {
    return this.baseCooldown / (1 + 0.15 * this.overclockLevel)
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

  isAlive(): boolean {
    return this.health > 0
  }

  takeDamage(amount: number): boolean {
    const now = this.scene.time.now

    if (!this.isAlive() || now < this.invulnerableUntil || amount <= 0) {
      return false
    }

    this.health = Math.max(0, this.health - amount)
    this.invulnerableUntil = now + this.invulnerabilityDuration

    if (!this.isAlive()) {
      this.setVelocity(0, 0)
    }

    return true
  }

  isMoving(): boolean {
    return this.body!.velocity.lengthSq() > 0
  }
}
