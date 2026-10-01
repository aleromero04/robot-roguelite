// Gameplay suites observe effect events without a renderer. Real visual lifecycle
// and tint restoration are exercised separately in combat-effects.test.mjs.
export const events = []
export class DamageFlash {
  show(sprite) { events.push(['damage', sprite]); sprite.setTint(0xffffff); this.until = sprite.scene.time.now + 80 }
  update(sprite) { if (this.until && sprite.scene.time.now >= this.until) { sprite.clearTint(); this.until = 0 } }
}
export function impact(...args) { events.push(['impact', ...args]) }
export function shieldBlock(sprite) { events.push(['shield', sprite]) }
export function death(sprite) { events.push(['death', sprite, sprite.active]) }
export function burnMarker(sprite) {
  const marker = { destroyed: false, update() {}, setPosition() { return this }, setAlpha() { return this }, destroy() { this.destroyed = true } }
  events.push(['burn', sprite, marker])
  return marker
}
export class ReviveEffect {
  start(sprite, until) { events.push(['revive', sprite, until]) }
  update() {}
  clear() {}
}
