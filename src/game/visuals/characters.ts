import Phaser from 'phaser'
import { PLAYABLE_BOUNDS } from '../environment/ArenaBounds.ts'

// Non-transparent bounds measured from the original PNGs; originals stay intact.
export const CHARACTERS = {
  player: { bounds: [81, 51, 1098, 1153], size: 54 },
  'enemy-basic': { bounds: [0, 21, 1285, 1120], size: 50 },
  'enemy-runner': { bounds: [23, 21, 1228, 1137], size: 44 },
  'enemy-shooter': { bounds: [82, 50, 1200, 1089], size: 54 },
  'enemy-boss': { bounds: [15, 19, 1343, 1074], size: 104 },
} as const

// Characters are unrotated and centered. Include both the cropped visual frame
// and the physical body, rounding inward to keep integer edge spawns safe.
export function getCharacterSpawnMargin(key: keyof typeof CHARACTERS, hitboxSize: number) {
  const { bounds: [, , width, height], size } = CHARACTERS[key]
  const scale = size / Math.max(width, height)
  return {
    x: Math.ceil(Math.max(width * scale, hitboxSize) / 2),
    y: Math.ceil(Math.max(height * scale, hitboxSize) / 2),
  }
}

export function configureCharacter(sprite: Phaser.Physics.Arcade.Sprite, hitboxSize: number) {
  const config = CHARACTERS[sprite.texture.key as keyof typeof CHARACTERS]
  sprite.setFrame('character')
  const scale = config.size / Math.max(sprite.width, sprite.height)
  sprite.setScale(scale)
  // Arcade body sizes use unscaled texture units. Preserve the original world-space square.
  const body = sprite.body as Phaser.Physics.Arcade.Body
  body.setSize(hitboxSize / scale, hitboxSize / scale, true)
  body.updateFromGameObject()
  // A reinforcement can be created after Arcade preUpdate. Its first postUpdate
  // must not treat the texture/scale correction as movement from the original PNG.
  body.prev.copy(body.position)
  body.prevFrame.copy(body.position)
  // Keep the larger visual frame off the walls without enlarging the hitbox.
  const overhangX = Math.max(0, (sprite.width * scale - hitboxSize) / 2)
  const overhangY = Math.max(0, (sprite.height * scale - hitboxSize) / 2)
  const b = PLAYABLE_BOUNDS
  const limits = new Phaser.Geom.Rectangle(b.left + overhangX, b.top + overhangY,
    b.right - b.left - 2 * overhangX, b.bottom - b.top - 2 * overhangY)
  body.setBoundsRectangle(limits)
  body.setCollideWorldBounds(true)
}
