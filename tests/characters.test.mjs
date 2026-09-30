import assert from 'node:assert/strict'
import test from 'node:test'
import { CHARACTERS, configureCharacter } from '../src/game/visuals/characters.ts'

test('character frames fit original PNGs, preserve aspect and keep original world hitboxes', () => {
  const dimensions = { player: [1265,1244], 'enemy-basic': [1305,1205],
    'enemy-runner': [1297,1212], 'enemy-shooter': [1306,1205], 'enemy-boss': [1374,1145] }
  for (const [key, config] of Object.entries(CHARACTERS)) {
    const [x,y,w,h] = config.bounds
    assert.ok(x >= 0 && y >= 0 && x+w <= dimensions[key][0] && y+h <= dimensions[key][1])
    let bodySize, synced = false
    const sprite = {
      texture: { key }, width: w, height: h,
      setFrame(frame) { assert.equal(frame, 'character') },
      setScale(scale) { this.scaleX = this.scaleY = scale },
      body: {
        prev: { copy() {} }, prevFrame: { copy() {} },
        setSize(...args) { bodySize = args },
        updateFromGameObject() { synced = true },
      },
    }
    const hitbox = key === 'enemy-boss' ? 80 : 40
    configureCharacter(sprite, hitbox)
    assert.equal(sprite.scaleX, sprite.scaleY)
    assert.ok(Math.abs(Math.max(w,h)*sprite.scaleX-config.size) < 1e-9)
    assert.ok(Math.abs(bodySize[0]*sprite.scaleX-hitbox) < 1e-9)
    assert.ok(Math.abs(bodySize[1]*sprite.scaleY-hitbox) < 1e-9)
    assert.equal(bodySize[2], true)
    assert.equal(synced, true)
  }
})
