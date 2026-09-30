import Phaser from 'phaser'

export type EnemyType = 'basic' | 'runner' | 'shooter'

export interface EnemyStats {
  health: number
  speed: number
  contactDamage: number
  texture: string
  size?: number
}

const ENEMY_STATS = {
  basic: { health: 3, speed: 90, contactDamage: 1, texture: 'enemy' },
  runner: { health: 1.5, speed: 160, contactDamage: 1, texture: 'runner' },
  shooter: { health: 2, speed: 70, contactDamage: 1, texture: 'shooter' },
} satisfies Record<EnemyType, { health: number; speed: number; contactDamage: number; texture: string }>


export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private readonly enemyType: EnemyType
  private readonly shotCooldown = 1500
  private nextShotTime: number
  private rangeMovement: 'approach' | 'hold' | 'retreat' = 'hold'
  private health: number
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
    this.health = stats.health
    this.speed = stats.speed
    this.contactDamage = stats.contactDamage

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.setDisplaySize(stats.size ?? 40, stats.size ?? 40)
    this.setImmovable(true)
    if (type === 'shooter') this.setCollideWorldBounds(true)
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
      this.setVelocity(0, 0)
      if (this.scene.time.now >= this.nextShotTime) {
        this.nextShotTime = this.scene.time.now + this.shotCooldown
        fire()
      }
    } else {
      const sign = this.rangeMovement === 'approach' ? 1 : -1
      // At coincident positions, choose a stable escape direction.
      const x = distance > 0 ? dx / distance : 1
      const y = distance > 0 ? dy / distance : 0
      this.setVelocity(x * this.speed * sign, y * this.speed * sign)
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
      this.setVelocity(0, 0)
      return
    }

    direction.normalize()
    const directX = direction.x
    const directY = direction.y
    direction.set(
      directX - directY * this.lateralBias,
      directY + directX * this.lateralBias,
    ).normalize().scale(this.speed)

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
