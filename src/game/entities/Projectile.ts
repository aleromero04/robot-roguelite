import Phaser from 'phaser'
import type { Enemy } from './Enemy'

export interface ProjectileAbilities {
  piercing: boolean
  ricochet: boolean
  flame: boolean
}

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  private readonly speed = 500
  private readonly hitEnemies = new Set<Enemy>()
  private hasRicocheted = false
  private readonly abilities: ProjectileAbilities

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    abilities: ProjectileAbilities = { piercing: false, ricochet: false, flame: false },
  ) {
    super(scene, x, y, 'projectile')
    this.abilities = abilities

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.aimAt(targetX, targetY)
  }

  hasHit(enemy: Enemy): boolean {
    return this.hitEnemies.has(enemy)
  }

  canRicochet(): boolean {
    return this.abilities.ricochet && !this.hasRicocheted && this.hitEnemies.size < 2
  }

  hit(enemy: Enemy, damage: number): boolean {
    if (!this.active || !enemy.active || this.hasHit(enemy)) return false
    this.hitEnemies.add(enemy)
    enemy.takeDamage(damage)
    if (this.abilities.flame && enemy.active) enemy.applyBurn()
    return true
  }

  finishHit(ricochetTarget?: Enemy) {
    const maxHits = this.abilities.piercing || this.abilities.ricochet ? 2 : 1
    if (this.hitEnemies.size >= maxHits) {
      this.destroy()
    } else if (this.canRicochet() && ricochetTarget) {
      this.hasRicocheted = true
      this.aimAt(ricochetTarget.x, ricochetTarget.y)
    } else if (!this.abilities.piercing) {
      this.destroy()
    }
  }

  private aimAt(targetX: number, targetY: number) {
    const direction = new Phaser.Math.Vector2(targetX - this.x, targetY - this.y).normalize()
    this.setVelocity(direction.x * this.speed, direction.y * this.speed)
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta)

    const bounds = this.scene.physics.world.bounds
    const halfWidth = this.displayWidth / 2
    const halfHeight = this.displayHeight / 2

    // Remove missed shots once they have completely left the arena.
    if (
      this.x + halfWidth < bounds.left ||
      this.x - halfWidth > bounds.right ||
      this.y + halfHeight < bounds.top ||
      this.y - halfHeight > bounds.bottom
    ) {
      this.destroy()
    }
  }
}
