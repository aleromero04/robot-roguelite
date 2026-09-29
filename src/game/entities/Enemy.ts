import Phaser from 'phaser'

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private health = 3

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy')

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.setDisplaySize(40, 40)
    this.setImmovable(true)
  }

  takeDamage(amount: number) {
    this.health -= amount

    if (this.health <= 0) {
      this.destroy()
    }
  }
}