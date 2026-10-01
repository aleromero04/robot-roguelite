import type Phaser from 'phaser'
import { UPGRADES } from '../data/upgrades.ts'
import type { Upgrade } from '../data/upgrades'

export function preloadUpgradeIcons(scene: Phaser.Scene) {
  for (const upgrade of UPGRADES) {
    if (!scene.textures.exists(upgrade.iconKey)) scene.load.image(upgrade.iconKey, upgrade.assetPath)
  }
}

export function createUpgradeIcon(scene: Phaser.Scene, upgrade: Upgrade, x: number, y: number, size: number) {
  const texture = scene.textures.get(upgrade.iconKey)
  const [left, top, width, height] = upgrade.iconBounds
  if (!texture.has('icon')) texture.add('icon', 0, left, top, width, height)
  return scene.add.image(x, y, upgrade.iconKey, 'icon').setScale(size / Math.max(width, height))
}
