import type { Rarity } from '../data/upgrades'

export const RARITY_COLORS: Record<Rarity, number> = {
  COMMON: 0x64d98b, RARE: 0x50aaff, EPIC: 0xbe8bfa, LEGENDARY: 0xf6c75d,
}
export function rarityTextColor(rarity: Rarity) {
  return `#${RARITY_COLORS[rarity].toString(16).padStart(6, '0')}`
}
