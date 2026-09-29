export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
export type UpgradeWave = 1 | 2 | 3 | 4 | 5 | 6

export interface Upgrade {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly rarity: Rarity
  readonly repeatable: boolean
}

export const UPGRADES: readonly Upgrade[] = [
  { id: 'power-core', name: 'Power Core', description: '+25% daño por nivel.', rarity: 'COMMON', repeatable: true },
  { id: 'overclock', name: 'Overclock', description: '+15% velocidad de ataque.', rarity: 'COMMON', repeatable: true },
  { id: 'turbo', name: 'Turbo', description: '+12% velocidad de movimiento.', rarity: 'COMMON', repeatable: true },
  { id: 'reinforced-chassis', name: 'Reinforced Chassis', description: '+1 HP máximo y cura 1 HP.', rarity: 'COMMON', repeatable: true },
  { id: 'repair', name: 'Repair', description: 'Recupera 2 HP.', rarity: 'COMMON', repeatable: true },
  { id: 'piercing-shot', name: 'Piercing Shot', description: 'Los proyectiles atraviesan 1 enemigo.', rarity: 'RARE', repeatable: false },
  { id: 'ricochet', name: 'Ricochet', description: 'Los proyectiles pueden rebotar hacia otro enemigo.', rarity: 'RARE', repeatable: false },
  { id: 'flame-shot', name: 'Flame Shot', description: 'Los impactos aplican daño adicional durante un breve tiempo.', rarity: 'RARE', repeatable: false },
  { id: 'rapid-shot', name: 'Rapid Shot', description: 'Dispara un segundo proyectil.', rarity: 'RARE', repeatable: false },
  { id: 'homing-shot', name: 'Homing Shot', description: 'Los proyectiles corrigen su trayectoria hacia enemigos.', rarity: 'EPIC', repeatable: false },
  { id: 'energy-shield', name: 'Energy Shield', description: 'Bloquea el primer golpe de cada wave.', rarity: 'EPIC', repeatable: false },
  { id: 'revive', name: 'Revive', description: 'Permite revivir una vez por partida.', rarity: 'EPIC', repeatable: false },
  { id: 'power-trio', name: 'Power Trio', description: 'Mejora daño, cadencia y HP máximo.', rarity: 'LEGENDARY', repeatable: false },
  { id: 'triple-shot', name: 'Triple Shot', description: 'Dispara 3 proyectiles simultáneamente.', rarity: 'LEGENDARY', repeatable: false },
]

export const RARITY_WEIGHTS: Record<UpgradeWave, Readonly<Record<Rarity, number>>> = {
  1: { COMMON: 70, RARE: 25, EPIC: 5, LEGENDARY: 0 },
  2: { COMMON: 55, RARE: 32, EPIC: 12, LEGENDARY: 1 },
  3: { COMMON: 40, RARE: 38, EPIC: 19, LEGENDARY: 3 },
  4: { COMMON: 30, RARE: 38, EPIC: 26, LEGENDARY: 6 },
  5: { COMMON: 20, RARE: 35, EPIC: 34, LEGENDARY: 11 },
  6: { COMMON: 10, RARE: 30, EPIC: 42, LEGENDARY: 18 },
}

// random follows Math.random's [0, 1) contract and can be supplied by tests.
export function generateUpgradeOptions(
  wave: UpgradeWave,
  selectedIds: readonly string[],
  health: number,
  maxHealth: number,
  random: () => number = Math.random,
): Upgrade[] {
  const weights = RARITY_WEIGHTS[wave]
  const rarities: Rarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY']
  const available = UPGRADES.filter(upgrade =>
    (upgrade.repeatable || !selectedIds.includes(upgrade.id)) &&
    (upgrade.id !== 'repair' || health < maxHealth),
  )
  const options: Upgrade[] = []

  for (let i = 0; i < 3; i++) {
    const roll = random() * 100
    let cumulative = 0
    const rarity = rarities.find(value => {
      cumulative += weights[value]
      return roll < cumulative
    })!
    let pool = available.filter(upgrade => upgrade.rarity === rarity)

    if (pool.length === 0) {
      const fallback = rarities.find(value => weights[value] > 0 &&
        available.some(upgrade => upgrade.rarity === value)) ??
        rarities.find(value => available.some(upgrade => upgrade.rarity === value))!
      pool = available.filter(upgrade => upgrade.rarity === fallback)
    }

    // Four common upgrades always remain eligible, even at full HP.
    const chosen = pool[Math.floor(random() * pool.length)]
    options.push(chosen)
    available.splice(available.indexOf(chosen), 1)
  }

  return options
}
