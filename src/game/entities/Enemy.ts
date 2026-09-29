import Phaser from 'phaser'

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private health = 3
  private readonly speed = 90
  private burnTicksRemaining = 0
  private nextBurnTick = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy')

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.setDisplaySize(40, 40)
    this.setImmovable(true)
  }

  chase(targetX: number, targetY: number) {
    const direction = new Phaser.Math.Vector2(targetX - this.x, targetY - this.y)
      .normalize()
      .scale(this.speed)

    this.setVelocity(direction.x, direction.y)
  }

  applyBurn() {
    if (!this.active) return
    this.burnTicksRemaining = 4
    this.nextBurnTick = this.scene.time.now + 500
  }

  clearBurn() {
    this.burnTicksRemaining = 0
  }

  updateBurn(time: number) {
    while (this.active && this.burnTicksRemaining > 0 && time >= this.nextBurnTick) {
      this.burnTicksRemaining--
      this.nextBurnTick += 500
      this.takeDamage(0.25)
    }
  }

  takeDamage(amount: number) {
    if (!this.active) return
    this.health -= amount

    if (this.health <= 0) {
      this.clearBurn()
      this.destroy()
    }
  }
}
