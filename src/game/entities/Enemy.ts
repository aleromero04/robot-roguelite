import Phaser from 'phaser'
import { blocksPath, findLocalDetour } from '../environment/ArenaObstacles'
import type { Point, Detour } from '../environment/ArenaObstacles'
import { configureCharacter } from '../visuals/characters'

export type EnemyType = 'basic' | 'runner' | 'shooter'

export interface EnemyStats {
  health: number
  speed: number
  contactDamage: number
  texture: string
  size?: number
}

const ENEMY_STATS = {
  basic: { health: 3, speed: 90, contactDamage: 1, texture: 'enemy-basic' },
  runner: { health: 1.5, speed: 160, contactDamage: 1, texture: 'enemy-runner' },
  shooter: { health: 2, speed: 70, contactDamage: 1, texture: 'enemy-shooter' },
} satisfies Record<EnemyType, { health: number; speed: number; contactDamage: number; texture: string }>


export class Enemy extends Phaser.Physics.Arcade.Sprite {
  protected detour?: Detour
  private readonly navigationHalfSize: number
  private readonly enemyType: EnemyType
  private readonly shotCooldown = 1500
  private nextShotTime: number
  private rangeMovement: 'approach' | 'hold' | 'retreat' = 'hold'
  private health: number
  private readonly maxHealth: number
  private flashUntil = 0
  private readonly speed: number
  readonly contactDamage: number
  private readonly lateralStrength = 0.25
  private lateralBias = 0
  private targetLateralBias = 0
  private nextLateralChange = 0
  private lastChaseTime = 0
  private burnTicksRemaining = 0
  private nextBurnTick = 0

  constructor(scene: Phaser.Scene, x: number, y: number, type: EnemyType | EnemyStats = 'basic') {
    const stats: EnemyStats = typeof type === 'string' ? ENEMY_STATS[type] : type
    super(scene, x, y, stats.texture)
    this.enemyType = typeof type === 'string' ? type : 'basic'
    this.nextShotTime = scene.time.now + this.shotCooldown
    this.navigationHalfSize = (stats.size ?? 40) / 2
    this.health = stats.health
    this.maxHealth = stats.health
    this.speed = stats.speed
    this.contactDamage = stats.contactDamage

    scene.add.existing(this)
    scene.physics.add.existing(this)

    configureCharacter(this, stats.size ?? 40)
  }

  updateBehavior(targetX: number, targetY: number, fire: () => void) {
    if (!this.active) return
    if (this.enemyType !== 'shooter') {
      this.chase(targetX, targetY)
      return
    }

    const dx = targetX - this.x
    const dy = targetY - this.y
    const distance = Math.hypot(dx, dy)
    if (distance < 200) this.rangeMovement = 'retreat'
    else if (distance > 300) this.rangeMovement = 'approach'
    else if (this.rangeMovement === 'approach' && distance <= 280 ||
             this.rangeMovement === 'retreat' && distance >= 220) {
      this.rangeMovement = 'hold'
    }

    if (this.rangeMovement === 'hold') {
      this.moveAroundObstacles(0, 0)
      if (this.scene.time.now >= this.nextShotTime) {
        this.nextShotTime = this.scene.time.now + this.shotCooldown
        fire()
      }
    } else {
      const sign = this.rangeMovement === 'approach' ? 1 : -1
      // At coincident positions, choose a stable escape direction.
      const x = distance > 0 ? dx / distance : 1
      const y = distance > 0 ? dy / distance : 0
      this.moveAroundObstacles(x * this.speed * sign, y * this.speed * sign,
        sign === 1 ? { x: targetX, y: targetY } : {
          x: this.x - x * (220 - distance), y: this.y - y * (220 - distance),
        })
    }
  }

  chase(targetX: number, targetY: number) {
    const now = this.scene.time.now
    const elapsed = Math.max(0, now - this.lastChaseTime)
    this.lastChaseTime = now

    if (now >= this.nextLateralChange) {
      this.targetLateralBias = Phaser.Math.Between(0, 1) === 0
        ? -this.lateralStrength
        : this.lateralStrength
      this.nextLateralChange = now + Phaser.Math.Between(700, 1300)
    }

    // Smooth changes of side independently of the frame rate (150 ms response).
    this.lateralBias += (this.targetLateralBias - this.lateralBias) *
      (1 - Math.exp(-elapsed / 150))

    const direction = new Phaser.Math.Vector2(targetX - this.x, targetY - this.y)
    if (direction.lengthSq() < 1) {
      this.moveAroundObstacles(0, 0)
      return
    }

    direction.normalize()
    const directX = direction.x
    const directY = direction.y
    direction.set(
      directX - directY * this.lateralBias,
      directY + directX * this.lateralBias,
    ).normalize().scale(this.speed)

    this.moveAroundObstacles(direction.x, direction.y, { x: targetX, y: targetY })
  }

  protected moveAroundObstacles(vx: number, vy: number, target?: Point) {
    const speed = Math.hypot(vx, vy)
    if (!speed) { this.detour = undefined; this.setVelocity(0, 0); return }
    // Persist while blocked, but release immediately when the body's direct route clears.
    if (this.detour && (
      (target && !blocksPath(this, target, this.navigationHalfSize, this.detour.obstacle)) ||
      Math.hypot(this.detour.x - this.x, this.detour.y - this.y) <= 3
    )) {
      this.detour = undefined
    }
    this.detour ??= findLocalDetour(this, { x: vx, y: vy }, this.navigationHalfSize, target, {
      x: Math.max(this.navigationHalfSize, (this.displayWidth || 0) / 2),
      y: Math.max(this.navigationHalfSize, (this.displayHeight || 0) / 2),
    })
    if (this.detour) {
      const dx = this.detour.x - this.x, dy = this.detour.y - this.y
      const distance = Math.hypot(dx, dy)
      // Aim at the corner while preserving the enemy's total speed.
      this.setVelocity(dx / distance * speed, dy / distance * speed)
    } else {
      this.setVelocity(vx, vy)
    }
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

  getHealth(): number { return this.health }

  getMaxHealth(): number { return this.maxHealth }

  override preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta)
    if (this.flashUntil && this.scene.time.now >= this.flashUntil) {
      this.clearTint()
      this.flashUntil = 0
    }
  }

  takeDamage(amount: number) {
    if (!this.active) return
    this.health -= amount
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
    this.flashUntil = this.scene.time.now + 80

    if (this.health <= 0) {
      this.clearBurn()
      this.destroy()
    }
  }
}
