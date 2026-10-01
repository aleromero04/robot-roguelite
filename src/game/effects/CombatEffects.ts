import Phaser from 'phaser'

// No gameplay timers: flashes advance in the sprite's preUpdate, even outside combat.
export class DamageFlash {
  private until = 0
  private previous?: { colors: [number, number, number, number]; mode: Phaser.TintModes }

  show(sprite: Phaser.GameObjects.Sprite, duration = 80, color = 0xffffff) {
    this.previous ??= {
      colors: [sprite.tintTopLeft, sprite.tintTopRight, sprite.tintBottomLeft, sprite.tintBottomRight],
      mode: sprite.tintMode,
    }
    sprite.setTint(color).setTintMode(Phaser.TintModes.FILL)
    this.until = sprite.scene.time.now + duration
  }

  update(sprite: Phaser.GameObjects.Sprite) {
    if (this.previous && sprite.scene.time.now >= this.until) this.restore(sprite)
  }

  restore(sprite: Phaser.GameObjects.Sprite) {
    if (!this.previous) return
    sprite.setTint(...this.previous.colors).setTintMode(this.previous.mode)
    this.previous = undefined
  }
}

// Bound simultaneous transient visuals, including burst/piercing impacts.
const activeEffects = new WeakMap<Phaser.Scene, number>()
function animate(scene: Phaser.Scene, make: () => Phaser.GameObjects.Image | Phaser.GameObjects.Arc,
  duration: number, scale: number) {
  if ((activeEffects.get(scene) ?? 0) >= 48) return
  const visual = make().setDepth(0.5)
  activeEffects.set(scene, (activeEffects.get(scene) ?? 0) + 1)
  const tween = scene.tweens.add({
    targets: visual, alpha: 0, scaleX: visual.scaleX * scale, scaleY: visual.scaleY * scale,
    duration, onComplete: () => visual.destroy(),
  })
  // Also runs on scene shutdown; no callbacks or references survive a restart.
  visual.once('destroy', () => {
    tween.remove()
    activeEffects.set(scene, Math.max(0, (activeEffects.get(scene) ?? 1) - 1))
  })
}

export function impact(scene: Phaser.Scene, x: number, y: number, hostile = false) {
  animate(scene, () => scene.add.circle(x, y, 4, hostile ? 0xff783d : 0x62eaff, 0.9), 140, 2.4)
}

export function shieldBlock(sprite: Phaser.GameObjects.Sprite) {
  animate(sprite.scene, () => sprite.scene.add.circle(sprite.x, sprite.y,
    Math.max(sprite.displayWidth, sprite.displayHeight) / 2 + 3)
    .setStrokeStyle(3, 0x62eaff), 320, 1.6)
}

export function death(sprite: Phaser.GameObjects.Sprite, boss = false) {
  animate(sprite.scene, () => sprite.scene.add.image(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name)
    .setOrigin(sprite.originX, sprite.originY).setScale(sprite.scaleX, sprite.scaleY)
    .setRotation(sprite.rotation).setFlip(sprite.flipX, sprite.flipY)
    .setTint(boss ? 0xffc5ee : 0xb8edff), boss ? 280 : 200, boss ? 1.16 : 1.1)
}

// Fixed-size visual pool drawn into one Graphics object: no emitters, timers or
// per-frame GameObjects. Burn's owner controls its exact lifetime and refresh.
export function burnMarker(sprite: Phaser.GameObjects.Sprite) {
  const graphics = sprite.scene.add.graphics().setDepth(0.5)
  const started = sprite.scene.time.now
  const update = () => {
    const elapsed = sprite.scene.time.now - started
    const width = sprite.displayWidth
    const height = sprite.displayHeight
    const size = Math.min(1.5, Math.max(1, width / 54))
    graphics.clear().setPosition(sprite.x, sprite.y)
    // Three small tongues of fire leave the centre of the sprite unobscured.
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * width * 0.34
      const y = height * (i === 1 ? 0.34 : 0.08)
      const flicker = Math.sin(elapsed / 85 + i * 2)
      const tip = y - (10 + flicker * 2) * size
      graphics.fillStyle(0xff4020, 0.3).fillCircle(x, y - 3 * size, 7 * size)
      graphics.fillStyle(0xff7626, 0.9).fillTriangle(
        x - 4 * size, y, x + 4 * size, y, x + flicker * 2, tip,
      )
      graphics.fillStyle(0xffdc79, 0.95).fillTriangle(
        x - 2 * size, y, x + 2 * size, y, x, y - 6 * size,
      )
    }
    // Four staggered rising embers, recycled mathematically rather than spawned.
    for (let i = 0; i < 4; i++) {
      const progress = ((elapsed / 650 + i / 4) % 1 + 1) % 1
      const side = i % 2 === 0 ? -1 : 1
      const x = side * width * 0.36 + Math.sin(progress * 5 + i) * 3 * size
      const y = height * 0.25 - progress * height * 0.65
      graphics.fillStyle(i % 2 === 0 ? 0xffa238 : 0xff5a27, 0.9 * (1 - progress))
        .fillCircle(x, y, (2.2 - progress) * size)
    }
  }
  update()
  return { update, destroy: () => graphics.destroy() }
}

// Alpha only: scaling the Arcade sprite would also scale its physical body.
export class ReviveEffect {
  private field?: Phaser.GameObjects.Arc
  private started = 0
  private until = 0
  private originalAlpha = 1
  private running = false

  start(sprite: Phaser.GameObjects.Sprite, invulnerableUntil: number) {
    this.clear(sprite)
    this.running = true
    this.started = sprite.scene.time.now
    this.until = invulnerableUntil
    this.originalAlpha = sprite.alpha
    this.field = sprite.scene.add.circle(sprite.x, sprite.y,
      Math.max(sprite.displayWidth, sprite.displayHeight) / 2 + 9, 0x7dffc7, 0.12)
      .setStrokeStyle(3, 0x92ffe0, 0.9).setDepth(0.6)
  }

  update(sprite: Phaser.GameObjects.Sprite) {
    if (!this.running) return
    const now = sprite.scene.time.now
    if (now >= this.until) { this.clear(sprite); return }
    const elapsed = now - this.started
    // 0–100: collapse; 100–220: dim; 220–600: reappear. Movement never pauses.
    const alpha = elapsed < 100 ? 1 - 0.85 * elapsed / 100
      : elapsed < 220 ? 0.15 : Math.min(1, 0.15 + 0.85 * (elapsed - 220) / 380)
    sprite.setAlpha(this.originalAlpha * alpha)
    this.field?.setPosition(sprite.x, sprite.y)
      .setScale(1 + 0.10 * Math.sin(elapsed / 70))
      .setAlpha(0.7 + 0.25 * Math.sin(elapsed / 70))
  }

  clear(sprite: Phaser.GameObjects.Sprite) {
    if (this.running) sprite.setAlpha(this.originalAlpha)
    this.running = false
    this.field?.destroy()
    this.field = undefined
  }
}
