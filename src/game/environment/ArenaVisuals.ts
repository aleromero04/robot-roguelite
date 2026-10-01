import type Phaser from 'phaser'
import { ARENA_WIDTH, ARENA_HEIGHT, WALL_THICKNESS } from './ArenaBounds.ts'
import { ARENA_OBSTACLES } from './ArenaObstacles'

const ASSETS = [
  'floor-base', 'floor-worn', 'floor-cracked', 'floor-grate', 'floor-stripes',
  'wall-bottom', 'wall-left', 'wall-corner',
  'prop-container', 'prop-crates', 'prop-machine',
] as const

// Non-destructive frames remove empty padding; wall-top is excluded because its
// surrounding grey background is opaque. The bottom segment also frames the top.
const FRAMES = {
  'floor-stripes': [21, 263, 1491, 691],
  'wall-bottom': [37, 146, 2003, 509],
  'wall-left': [147, 84, 745, 1374],
  'wall-corner': [337, 14, 1102, 865],
} as const

export function preloadArena(scene: Phaser.Scene) {
  for (const name of ASSETS) {
    const key = `arena-${name}`
    if (!scene.textures.exists(key)) scene.load.image(key, `assets/arena/${name}.png`)
  }
}

// Entirely decorative: no physics, timers, random numbers or gameplay references.
// Negative depths keep all decoration behind actors (0) and the existing HUD (1+).
export function createArena(scene: Phaser.Scene) {
  for (const [name, bounds] of Object.entries(FRAMES)) {
    const texture = scene.textures.get(`arena-${name}`)
    const [x, y, width, height] = bounds
    if (!texture.has('trimmed')) texture.add('trimmed', 0, x, y, width, height)
  }

  const floor = ['21000110', '10000001', '00010000', '00000100', '10000001', '01100012']
  const variants = ['floor-base', 'floor-worn', 'floor-cracked']
  floor.forEach((row, y) => [...row].forEach((variant, x) => {
    scene.add.image(x * 100 + 50, y * 100 + 50, `arena-${variants[Number(variant)]}`)
      .setDisplaySize(100, 100).setAngle((x + y) % 2 * 180)
      .setTint(0x8996a3).setDepth(-30)
  }))

  // Each tuple is [asset, center x/y, longest dimension, angle, depth].
  const decor: readonly (readonly [typeof ASSETS[number], number, number, number, number, number])[] = [
    ['floor-grate', 130, 85, 110, 0, -25],
    ['floor-grate', 670, 510, 110, 180, -25],
    ['floor-stripes', 150, 125, 100, 0, -24],
    ['floor-stripes', 650, 465, 100, 180, -24],
    ['floor-grate', 110, 520, 100, 0, -25],
    ['floor-grate', 745, 395, 68, 90, -25],
    ['floor-grate', 63, 290, 67, 90, -25],
  ]
  for (const o of ARENA_OBSTACLES) {
    const image = scene.add.image(o.x, o.y, `arena-${o.asset}`)
    image.setScale(o.size / Math.max(image.width, image.height)).setTint(0xa6b1bb).setDepth(-15)
  }
  for (const [name, x, y, size, angle, depth] of decor) {
    const image = scene.add.image(x, y, `arena-${name}`, name in FRAMES ? 'trimmed' : undefined)
    image.setScale(size / Math.max(image.width, image.height))
      .setAngle(angle).setTint(0xa6b1bb).setDepth(depth)
  }

  // Four tiled strips, only 14 px deep: no oversized walls covering edge spawns.
  for (const y of [WALL_THICKNESS / 2, ARENA_HEIGHT - WALL_THICKNESS / 2]) {
    scene.add.tileSprite(ARENA_WIDTH / 2, y, ARENA_WIDTH, WALL_THICKNESS, 'arena-wall-bottom', 'trimmed')
      .setTileScale(WALL_THICKNESS / FRAMES['wall-bottom'][3]).setFlipY(y === WALL_THICKNESS / 2).setDepth(-10)
  }
  for (const x of [WALL_THICKNESS / 2, ARENA_WIDTH - WALL_THICKNESS / 2]) {
    scene.add.tileSprite(x, ARENA_HEIGHT / 2, WALL_THICKNESS, ARENA_HEIGHT, 'arena-wall-left', 'trimmed')
      .setTileScale(WALL_THICKNESS / FRAMES['wall-left'][2]).setFlipX(x > ARENA_WIDTH / 2).setDepth(-10)
  }
  const cornerCenter = WALL_THICKNESS / 2
  for (const [x, y, flipX, flipY] of [
    [cornerCenter, cornerCenter, false, false], [ARENA_WIDTH - cornerCenter, cornerCenter, true, false],
    [cornerCenter, ARENA_HEIGHT - cornerCenter, false, true], [ARENA_WIDTH - cornerCenter, ARENA_HEIGHT - cornerCenter, true, true],
  ] as const) {
    const corner = scene.add.image(x, y, 'arena-wall-corner', 'trimmed')
    corner.setScale(WALL_THICKNESS / Math.max(corner.width, corner.height))
      .setFlip(flipX, flipY).setDepth(-9)
  }
}
