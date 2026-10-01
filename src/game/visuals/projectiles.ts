import type Phaser from 'phaser'

export function createProjectileTextures(scene: Phaser.Scene) {
  for (const [key, color] of [['projectile', 0x35dcff], ['enemy-projectile', 0xff354d]] as const) {
    if (scene.textures.exists(key)) continue
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(color, 0.22).fillRoundedRect(0, 1, 24, 10, 5)
    g.fillStyle(color, 0.95).fillRoundedRect(2, 3, 20, 6, 3)
    g.fillStyle(0xe9fcff).fillRect(5, 5, 15, 2)
    g.generateTexture(key, 24, 12)
    g.destroy()
  }
}

export function configureProjectile(sprite: Phaser.Physics.Arcade.Sprite, size: number) {
  // Arcade bodies stay axis-aligned when the visual rotates. Keep old 10/12px hitboxes.
  const body = sprite.body as Phaser.Physics.Arcade.Body
  body.setSize(size, size, true)
  body.updateFromGameObject()
  body.prev.copy(body.position)
  body.prevFrame.copy(body.position)
}
