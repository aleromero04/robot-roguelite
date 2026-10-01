import Phaser from 'phaser'
import type { Upgrade } from '../data/upgrades'
import { createUpgradeIcon } from './UpgradeIconFactory'
import { RARITY_COLORS, rarityTextColor } from './RarityStyles'

export function createUpgradeCard(scene: Phaser.Scene, x: number, y: number, upgrade: Upgrade, choose: () => void) {
  const card = scene.add.container(x, y).setDepth(2)
  const color = RARITY_COLORS[upgrade.rarity]
  const tier = { COMMON: 0, RARE: 1, EPIC: 2, LEGENDARY: 3 }[upgrade.rarity]
  const frame = scene.add.graphics()
  const polygon = (left: number, top: number, width: number, height: number, cut: number) => [
    { x: left + cut, y: top }, { x: left + width - cut, y: top },
    { x: left + width, y: top + cut }, { x: left + width, y: top + height - cut },
    { x: left + width - cut, y: top + height }, { x: left + cut, y: top + height },
    { x: left, y: top + height - cut }, { x: left, y: top + cut },
  ].map(point => new Phaser.Math.Vector2(point.x, point.y))
  const outline = polygon(-110, -180, 220, 360, 19)
  const line = (x1: number, y1: number, x2: number, y2: number) => frame.lineBetween(x1, y1, x2, y2)
  const draw = (hover: boolean) => {
    frame.clear()
    // Layered translucent strokes make a cheap glow, without postprocessing.
    for (const width of [16, 10, 5]) {
      frame.lineStyle(width, color, (0.018 + tier * 0.022) * (hover ? 1.7 : 1))
        .strokePoints(outline, true)
    }
    frame.fillStyle(0x263744).fillPoints(outline, true)
    frame.lineStyle(1, 0x77909e, 0.65).strokePoints(outline, true)
    const interior = polygon(-103, -173, 206, 346, 16)
    frame.fillStyle(0x08131e, 0.98).fillPoints(interior, true)
    frame.lineStyle(hover ? 2.5 : 1.4, color, 0.55 + tier * 0.12).strokePoints(interior, true)
    if (tier >= 2) frame.lineStyle(1, color, 0.36).strokePoints(polygon(-98, -168, 196, 336, 14), true)

    // Quiet circuit traces behind the art and text.
    frame.lineStyle(1, color, 0.07 + tier * 0.012)
    for (const side of [-1, 1]) {
      for (const offset of [0, 13, 26]) {
        line(side * (92 - offset), -118, side * (92 - offset), -20)
        line(side * (92 - offset), -20, side * (80 - offset), -8)
        line(side * (80 - offset), -8, side * (80 - offset), 23)
      }
      line(side * 92, 103, side * 82, 113)
      line(side * 82, 113, side * 82, 156)
    }
    for (let radius = 78; radius >= 30; radius -= 12) {
      frame.fillStyle(color, 0.009 + tier * 0.008).fillCircle(0, -53, radius)
    }
    frame.lineStyle(1, color, 0.16 + tier * 0.035).strokeCircle(0, -53, 78)
    frame.lineStyle(2, color, 0.24 + tier * 0.05)
    for (let i = 0; i < 4; i++) {
      frame.beginPath().arc(0, -53, 73, i * Math.PI / 2, i * Math.PI / 2 + 0.6).strokePath()
    }

    // Corner armour, rivets, and short luminous rails.
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        frame.lineStyle(6, 0x3c5261)
        line(side * 109, end * 152, side * 87, end * 176)
        frame.lineStyle(2, color, hover ? 1 : 0.65 + tier * 0.1)
        line(side * 105, end * 151, side * 87, end * 170)
        frame.fillStyle(0x9bb0b9, 0.7).fillCircle(side * 98, end * 157, 2)
        frame.lineStyle(3, color, 0.45 + tier * 0.15)
        line(side * 108, end * 115, side * 108, end * (tier > 0 ? 82 : 100))
      }
      frame.fillStyle(0x334957).fillPoints(polygon(side * 105 - 5, -14, 10, 30, 3), true)
      frame.fillStyle(color, 0.6).fillRect(side * 105 - 1, -6, 2, 12)
      if (tier >= 2) {
        frame.fillStyle(color, 0.85).fillCircle(side * 87, -114, 2)
        frame.fillCircle(side * 87, 151, 2)
      }
    }
    // Integrated rarity plate, rather than a flat banner.
    const plate = polygon(-87, -188, 174, 38, 12)
    frame.fillStyle(0x334754).fillPoints(plate, true)
    frame.lineStyle(2, color, 0.8).strokePoints(plate, true)
    frame.fillStyle(0x0c1b27).fillPoints(polygon(-80, -183, 160, 28, 9), true)
    frame.lineStyle(1, color, 0.4).strokePoints(polygon(-80, -183, 160, 28, 9), true)
    frame.lineStyle(2, color, hover ? 1 : 0.6).lineBetween(-52, 86, -8, 86).lineBetween(8, 86, 52, 86)
    frame.fillStyle(color, 0.9).fillPoints([new Phaser.Math.Vector2(0,81),new Phaser.Math.Vector2(5,86),new Phaser.Math.Vector2(0,91),new Phaser.Math.Vector2(-5,86)], true)
    frame.lineStyle(2, color, 0.6).lineBetween(-42, 174, 42, 174)
    if (tier === 3) {
      frame.lineStyle(1, color, 0.75)
      for (const px of [-64, 64]) {
        line(px, -180, px + 4, -184); line(px, 166, px + 5, 161)
      }
    }
  }
  draw(false)
  const text = (py: number, value: string, size: number, tint: string, title = false) => scene.add.text(0, py, value, {
    fontFamily: '"Arial", "Helvetica Neue", sans-serif', fontSize: `${size}px`, fontStyle: title ? 'bold' : 'normal',
    color: tint, align: 'center', wordWrap: { width: 184 }, lineSpacing: title ? 1 : 3,
  }).setOrigin(0.5).setResolution(2).setLetterSpacing(title ? 0.7 : 0)
  card.add([frame,
    text(-169, upgrade.rarity, 16, rarityTextColor(upgrade.rarity), true),
    createUpgradeIcon(scene, upgrade, 0, -53, 144),
    text(52, upgrade.name.toUpperCase(), 20, '#e8f6ff', true),
    text(125, upgrade.description, 14, '#bed2e0'),
  ])
  if (tier === 3) {
    // Four decorative glints only, with a single tween owned by this card.
    const glints = scene.add.graphics().lineStyle(1, color, 0.9)
    for (const [px, py] of [[-90,-75],[86,12],[-77,155],[78,-130]]) {
      glints.lineBetween(px - 3, py, px + 3, py).lineBetween(px, py - 3, px, py + 3)
    }
    card.add(glints)
    const pulse = scene.tweens.add({ targets: glints, alpha: 0.25, duration: 850, yoyo: true, repeat: -1 })
    card.once('destroy', () => pulse.remove())
  }
  const hitArea = scene.add.zone(0, 0, 220, 360).setInteractive({ useHandCursor: true })
  card.add(hitArea)
  hitArea.on('pointerover', () => { card.setScale(1.015); draw(true) })
    .on('pointerout', () => { card.setScale(1); draw(false) })
    .on('pointerdown', choose)
  return card
}
