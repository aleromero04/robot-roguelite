import type Phaser from 'phaser'
import { UPGRADES } from '../data/upgrades.ts'
import { createUpgradeIcon } from './UpgradeIconFactory'
import { RARITY_COLORS } from './RarityStyles'
import { HealthFeedback } from './HealthFeedback'

export interface HUDPlayer {
  getHealth(): number
  getMaxHealth(): number
  getSelectedUpgradeIds(): readonly string[]
}
export function acquiredUpgrades(ids: readonly string[]) {
  return UPGRADES.filter(u => u.id !== 'repair' && ids.includes(u.id)).map(upgrade => ({
    upgrade, count: upgrade.repeatable ? ids.filter(id => id === upgrade.id).length : 1,
  }))
}

export class CombatHUD {
  private root: Phaser.GameObjects.Container
  private bars: Phaser.GameObjects.Graphics
  private hp: Phaser.GameObjects.Text
  private wave: Phaser.GameObjects.Text
  private bossLabel: Phaser.GameObjects.Text
  private icons: Phaser.GameObjects.Container
  private buildKey = ''
  private readonly healthFeedback = new HealthFeedback()
  private readonly width: number
  private readonly height: number

  private readonly scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.width = scene.scale.width
    this.height = scene.scale.height
    this.root = scene.add.container(0, 0).setDepth(3).setVisible(false)
    this.bars = scene.add.graphics()
    const style = { fontFamily: 'monospace', fontSize: '14px', color: '#d9f5ff' }
    this.hp = scene.add.text(152, 23, '', style)
    this.wave = scene.add.text(this.width - 24, 23, '', style).setOrigin(1, 0)
    this.bossLabel = scene.add.text(this.width / 2, 17, 'BOSS', { ...style, color: '#ff8e9e', fontSize: '12px' }).setOrigin(0.5, 0)
    this.icons = scene.add.container(24, this.height - 54)
    this.root.add([this.bars, this.hp, this.wave, this.bossLabel, this.icons])
  }

  setVisible(visible: boolean) { this.root.setVisible(visible) }

  update(player: HUDPlayer, wave: number, boss?: { getHealth(): number; getMaxHealth(): number }) {
    this.hp.setText(`${player.getHealth()}/${player.getMaxHealth()}`)
    this.wave.setText(`WAVE ${wave} / 7`)
    const feedback = this.healthFeedback.update(player.getHealth(), this.scene.time.now)
    const g = this.bars.clear()
    g.fillStyle(0x101e2b, 0.78).fillRoundedRect(20, 17, 190, 29, 4)
    g.lineStyle(feedback ? 2 : 1, feedback ?? 0x547181, 0.85).strokeRoundedRect(20, 17, 190, 29, 4)
    g.fillStyle(0x83f1ee).fillRect(29, 25, 4, 13).fillRect(25, 29, 12, 4)
    g.fillStyle(0x304553).fillRect(44, 27, 98, 9)
    g.fillStyle(feedback ?? 0x58dedb).fillRect(44, 27, 98 * Math.max(0, player.getHealth() / player.getMaxHealth()), 9)
    this.bossLabel.setVisible(!!boss)
    if (boss) {
      const x = this.width / 2 - 130
      g.fillStyle(0x101e2b, 0.85).fillRect(x, 34, 260, 10)
      g.fillStyle(0xf0758a).fillRect(x, 34, 260 * Math.max(0, boss.getHealth() / boss.getMaxHealth()), 10)
      g.lineStyle(1, 0x9a5869).strokeRect(x, 34, 260, 10)
    }
    const key = player.getSelectedUpgradeIds().join('|')
    if (key === this.buildKey) return
    this.buildKey = key
    this.icons.removeAll(true)
    acquiredUpgrades(player.getSelectedUpgradeIds()).forEach(({ upgrade, count }, index) => {
      const x = index * 40
      const icon = this.scene.add.graphics()
      icon.fillStyle(0x101e2b, 0.72).fillRoundedRect(x, 0, 34, 34, 4)
      icon.lineStyle(1, RARITY_COLORS[upgrade.rarity], 0.8).strokeRoundedRect(x, 0, 34, 34, 4)
      this.icons.add([icon, createUpgradeIcon(this.scene, upgrade, x + 17, 17, 28)])
      if (count > 1) this.icons.add(this.scene.add.text(x + 20, 24, `×${count}`, {
        fontFamily: 'monospace', fontSize: '10px', color: '#ffffff', backgroundColor: '#101e2b',
      }))
    })
  }
}
