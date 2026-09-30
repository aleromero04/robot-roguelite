import type Phaser from 'phaser'

const ASSETS = [
  'floor-base', 'floor-worn', 'floor-cracked', 'floor-grate', 'floor-stripes', 'floor-vent',
  'wall-bottom', 'wall-left', 'wall-corner',
  'prop-container', 'prop-crates', 'prop-barrels', 'prop-terminal', 'prop-pipes', 'prop-machine',
  'light-blue', 'light-red', 'debris-smaill', 'debris-large', 'cable',
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
    ['floor-vent', 735, 270, 62, 0, -24],
    ['cable', 95, 410, 110, -25, -23],
    ['debris-smaill', 690, 120, 76, 0, -22],
    ['debris-large', 110, 520, 100, 0, -22],
    ['prop-container', 290, 48, 95, 0, -15],
    ['prop-crates', 60, 185, 72, 0, -15],
    ['prop-barrels', 745, 395, 68, 0, -15],
    ['prop-terminal', 63, 290, 67, 0, -15],
    ['prop-pipes', 500, 560, 125, 0, -15],
    ['prop-machine', 700, 55, 105, 0, -15],
    ['light-blue', 210, 55, 52, 0, -14],
    ['light-blue', 565, 550, 52, 0, -14],
    ['light-red', 55, 520, 48, 0, -14],
  ]
  for (const [name, x, y, size, angle, depth] of decor) {
    const image = scene.add.image(x, y, `arena-${name}`, name in FRAMES ? 'trimmed' : undefined)
    image.setScale(size / Math.max(image.width, image.height))
      .setAngle(angle).setTint(0xa6b1bb).setDepth(depth)
  }

  // Four tiled strips, only 14 px deep: no oversized walls covering edge spawns.
  for (const y of [7, 593]) {
    scene.add.tileSprite(400, y, 800, 14, 'arena-wall-bottom', 'trimmed')
      .setTileScale(14 / FRAMES['wall-bottom'][3]).setFlipY(y === 7).setDepth(-10)
  }
  for (const x of [7, 793]) {
    scene.add.tileSprite(x, 300, 14, 600, 'arena-wall-left', 'trimmed')
      .setTileScale(14 / FRAMES['wall-left'][2]).setFlipX(x === 793).setDepth(-10)
  }
  for (const [x, y, flipX, flipY] of [
    [10, 10, false, false], [790, 10, true, false],
    [10, 590, false, true], [790, 590, true, true],
  ] as const) {
    const corner = scene.add.image(x, y, 'arena-wall-corner', 'trimmed')
    corner.setScale(20 / Math.max(corner.width, corner.height))
      .setFlip(flipX, flipY).setDepth(-9)
  }
}
