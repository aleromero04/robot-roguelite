import Phaser from 'phaser'

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  private readonly speed = 500

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    targetX: number,
    targetY: number,
  ) {
    super(scene, x, y, 'projectile')

    scene.add.existing(this)
    scene.physics.add.existing(this)

    const direction = new Phaser.Math.Vector2(
      targetX - x,
      targetY - y,
    ).normalize()

    this.setVelocity(
      direction.x * this.speed,
      direction.y * this.speed,
    )
  }
}