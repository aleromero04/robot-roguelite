import Phaser from 'phaser'
import type { Enemy } from './Enemy'

export interface ProjectileAbilities {
  piercing: boolean
  ricochet: boolean
  flame: boolean
}

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  private readonly speed = 500
  private readonly homingTurnRate = Math.PI / 2 // 90 degrees per second.
  private homingTarget?: Enemy
  private findHomingTarget?: () => Enemy | undefined
  private readonly hitEnemies = new Set<Enemy>()
  private remainingPierces: number
  private remainingRicochets: number
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
    this.remainingPierces = abilities.piercing ? 1 : 0
    this.remainingRicochets = abilities.ricochet ? 1 : 0

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.aimAt(targetX, targetY)
  }

  hasHit(enemy: Enemy): boolean {
    return this.hitEnemies.has(enemy)
  }

  canRicochet(): boolean {
    return this.remainingRicochets > 0
  }

  hit(enemy: Enemy, damage: number): boolean {
    if (!this.active || !enemy.active || this.hasHit(enemy)) return false
    this.hitEnemies.add(enemy)
    enemy.takeDamage(damage)
    if (this.abilities.flame && enemy.active) enemy.applyBurn()
    return true
  }

  finishHit(ricochetTarget?: Enemy) {
    if (!this.active) return
    let continued = false

    // A bounce consumes only Ricochet; preserve Piercing for the next impact.
    if (this.canRicochet() && ricochetTarget?.active && !this.hasHit(ricochetTarget)) {
      this.remainingRicochets--
      this.homingTarget = ricochetTarget
      this.aimAt(ricochetTarget.x, ricochetTarget.y)
      continued = true
    }

    if (!continued && this.remainingPierces > 0) {
      this.remainingPierces--
      continued = true
    }

    if (!continued) this.destroy()
  }

  enableHoming(target: Enemy, findTarget: () => Enemy | undefined) {
    this.homingTarget = target
    this.findHomingTarget = findTarget
  }

  private updateHoming(delta: number) {
    if (!this.findHomingTarget) return
    if (!this.homingTarget?.active || this.hasHit(this.homingTarget)) {
      this.homingTarget = this.findHomingTarget()
    }
    const target = this.homingTarget
    if (!target) return
    const dx = target.x - this.x
    const dy = target.y - this.y
    if (dx * dx + dy * dy < 1) return

    const velocity = this.body!.velocity
    const current = Math.atan2(velocity.y, velocity.x)
    const desired = Math.atan2(dy, dx)
    const difference = Math.atan2(Math.sin(desired - current), Math.cos(desired - current))
    const maxTurn = this.homingTurnRate * Math.max(0, delta) / 1000
    const angle = current + Math.max(-maxTurn, Math.min(maxTurn, difference))
    this.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed)
  }

  private aimAt(targetX: number, targetY: number) {
    const direction = new Phaser.Math.Vector2(targetX - this.x, targetY - this.y).normalize()
    this.setVelocity(direction.x * this.speed, direction.y * this.speed)
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta)
    this.updateHoming(delta)

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
