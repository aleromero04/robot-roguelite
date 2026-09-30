import Phaser from 'phaser'

export class EnemyProjectile extends Phaser.Physics.Arcade.Sprite {
  readonly damage = 1
  private readonly speed = 250

  constructor(scene: Phaser.Scene, x: number, y: number, targetX: number, targetY: number) {
    super(scene, x, y, 'enemy-projectile')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    const direction = new Phaser.Math.Vector2(targetX - x, targetY - y).normalize()
    this.setVelocity(direction.x * this.speed, direction.y * this.speed)
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta)
    const bounds = this.scene.physics.world.bounds
    const halfWidth = this.displayWidth / 2
    const halfHeight = this.displayHeight / 2
    if (this.x + halfWidth < bounds.left || this.x - halfWidth > bounds.right ||
        this.y + halfHeight < bounds.top || this.y - halfHeight > bounds.bottom) {
      this.destroy()
    }
  }
}
