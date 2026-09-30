import Phaser from 'phaser'
import { Enemy } from './Enemy'

export class Boss extends Enemy {
  private phase: 'NORMAL' | 'CHARGE' | 'SHOOT' = 'NORMAL'
  private nextSpecial: number
  private chargeEnds = 0
  private chargeX = 0
  private chargeY = 0
  private shotsRemaining = 0
  private nextShot = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, { health: 40, speed: 75, contactDamage: 2, texture: 'enemy-boss', size: 80 })
    this.setCollideWorldBounds(true)
    this.nextSpecial = scene.time.now + 4000
  }

  override updateBehavior(targetX: number, targetY: number, fire: () => void) {
    if (!this.active) return
    const now = this.scene.time.now
    if (this.phase === 'NORMAL' && now >= this.nextSpecial) {
      if (Phaser.Math.Between(0, 1) === 0) {
        this.phase = 'CHARGE'
        const direction = new Phaser.Math.Vector2(targetX - this.x, targetY - this.y).normalize()
        this.chargeX = direction.x * 230
        this.chargeY = direction.y * 230
        this.chargeEnds = now + 1200
      } else {
        this.phase = 'SHOOT'
        this.shotsRemaining = 3
        this.nextShot = now
      }
    }

    if (this.phase === 'CHARGE') {
      if (now < this.chargeEnds) {
        this.setVelocity(this.chargeX, this.chargeY)
        return
      }
      this.finishSpecial(now)
    }

    if (this.phase === 'SHOOT') {
      this.setVelocity(0, 0)
      if (now >= this.nextShot) {
        fire()
        this.shotsRemaining--
        this.nextShot = now + 200
        if (this.shotsRemaining === 0) this.finishSpecial(now)
      }
      return
    }

    const direction = new Phaser.Math.Vector2(targetX - this.x, targetY - this.y).normalize().scale(75)
    this.setVelocity(direction.x, direction.y)
  }

  private finishSpecial(now: number) {
    this.phase = 'NORMAL'
    this.nextSpecial = now + 4000
  }
}
