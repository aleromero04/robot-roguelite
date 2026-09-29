import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { Projectile } from '../entities/Projectile'


export class GameScene extends Phaser.Scene {
  private player!: Player
  private enemy!: Enemy
  private lastShotTime = 0
  private readonly shotCooldown = 500
  private projectiles!: Phaser.GameObjects.Group

  constructor() {
    super('GameScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#151922')

    const graphics = this.make.graphics({ x: 0, y: 0 }, false)
    graphics.fillStyle(0x4ade80)
    graphics.fillRect(0, 0, 40, 40)
    graphics.generateTexture('player', 40, 40)
    graphics.destroy()

    const enemyGraphics = this.make.graphics({ x: 0, y: 0 }, false)
    enemyGraphics.fillStyle(0xef4444)
    enemyGraphics.fillRect(0, 0, 40, 40)
    enemyGraphics.generateTexture('enemy', 40, 40)
    enemyGraphics.destroy()

    const projectileGraphics = this.make.graphics({ x: 0, y: 0 }, false)
    projectileGraphics.fillStyle(0xfacc15)
    projectileGraphics.fillCircle(5, 5, 5)
    projectileGraphics.generateTexture('projectile', 10, 10)
    projectileGraphics.destroy()

    this.physics.world.setBounds(0, 0, 800, 600)
    this.player = new Player(this, 400, 300)
    this.enemy = new Enemy(this, 650, 300)
    this.projectiles = this.add.group()
    this.physics.add.overlap(
        this.projectiles,
        this.enemy,
        (projectile) => {
            projectile.destroy()
            this.enemy.takeDamage(1)
        },
    )
  }

  update(time: number) {
    this.player.update()

        if (this.player.isMoving()) {
            return
        }

        if (!this.enemy.active) {
            return
        }

        if (time - this.lastShotTime < this.shotCooldown) {
            return
        }

        const projectile = new Projectile(
            this,
            this.player.x,
            this.player.y,
            this.enemy.x,
            this.enemy.y,
        )

        this.projectiles.add(projectile)

        this.lastShotTime = time
        }
}
