import { configureProjectile } from '../visuals/projectiles'
import Phaser from 'phaser'
import { impact } from '../effects/CombatEffects'
import { PLAYABLE_BOUNDS } from '../environment/ArenaBounds.ts'

export class EnemyProjectile extends Phaser.Physics.Arcade.Sprite {
  readonly damage = 1
  private readonly speed = 250

  constructor(scene: Phaser.Scene, x: number, y: number, targetX: number, targetY: number) {
    super(scene, x, y, 'enemy-projectile')
    scene.add.existing(this)
    scene.physics.add.existing(this)
    configureProjectile(this, 12)
    this.setCollideWorldBounds(true)
    const direction = new Phaser.Math.Vector2(targetX - x, targetY - y).normalize()
    this.setVelocity(direction.x * this.speed, direction.y * this.speed)
    this.setRotation(Math.atan2(direction.y, direction.x))
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta)
    const bounds = PLAYABLE_BOUNDS
    const halfWidth = 6
    const halfHeight = 6
    if (this.x - halfWidth <= bounds.left || this.x + halfWidth >= bounds.right ||
        this.y - halfHeight <= bounds.top || this.y + halfHeight >= bounds.bottom) {
      this.impactAndDestroy()
    }
  }

  impactAndDestroy() {
    if (!this.active) return
    impact(this.scene, this.x, this.y, true)
    this.destroy()
  }
}
