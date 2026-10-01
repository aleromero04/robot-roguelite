export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
export type UpgradeWave = 1 | 2 | 3 | 4 | 5 | 6

export interface Upgrade {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly rarity: Rarity
  readonly repeatable: boolean
  readonly iconKey: string
  readonly assetPath: string
  readonly iconBounds: readonly [number, number, number, number]
}

export const UPGRADES: readonly Upgrade[] = [
  { id: 'power-core', name: 'Power Core', description: '+25% daño por nivel.', rarity: 'COMMON', repeatable: true, iconKey: 'skill-power-core', assetPath: 'assets/skills/power-core.png', iconBounds: [0, 49, 1240, 1109] },
  { id: 'overclock', name: 'Overclock', description: '+15% velocidad de ataque.', rarity: 'COMMON', repeatable: true, iconKey: 'skill-overclock', assetPath: 'assets/skills/overclock.png', iconBounds: [0, 21, 1220, 1233] },
  { id: 'turbo', name: 'Turbo', description: '+12% velocidad de movimiento.', rarity: 'COMMON', repeatable: true, iconKey: 'skill-turbo', assetPath: 'assets/skills/turbo.png', iconBounds: [19, 47, 1201, 1207] },
  { id: 'reinforced-chassis', name: 'Reinforced Chassis', description: '+1 HP máximo y cura 1 HP.', rarity: 'COMMON', repeatable: true, iconKey: 'skill-reinforced-chassis', assetPath: 'assets/skills/reinforced-chasis.png', iconBounds: [0, 39, 1241, 1215] },
  { id: 'repair', name: 'Repair', description: 'Recupera 2 HP.', rarity: 'COMMON', repeatable: true, iconKey: 'skill-repair', assetPath: 'assets/skills/repair.png', iconBounds: [0, 18, 1228, 1236] },
  { id: 'piercing-shot', name: 'Piercing Shot', description: 'Los proyectiles atraviesan 1 enemigo.', rarity: 'RARE', repeatable: false, iconKey: 'skill-piercing-shot', assetPath: 'assets/skills/piercing-shot.png', iconBounds: [0, 8, 1240, 1222] },
  { id: 'ricochet', name: 'Ricochet', description: 'Los proyectiles pueden rebotar hacia otro enemigo.', rarity: 'RARE', repeatable: false, iconKey: 'skill-ricochet', assetPath: 'assets/skills/ricochet.png', iconBounds: [19, 19, 1234, 1195] },
  { id: 'flame-shot', name: 'Flame Shot', description: 'Los impactos aplican daño adicional durante un breve tiempo.', rarity: 'RARE', repeatable: false, iconKey: 'skill-flame-shot', assetPath: 'assets/skills/flame-shot.png', iconBounds: [0, 19, 1238, 1211] },
  { id: 'rapid-shot', name: 'Rapid Shot', description: 'Dispara un segundo proyectil.', rarity: 'RARE', repeatable: false, iconKey: 'skill-rapid-shot', assetPath: 'assets/skills/rapid-shot.png', iconBounds: [0, 19, 1238, 1195] },
  { id: 'homing-shot', name: 'Homing Shot', description: 'Los proyectiles corrigen su trayectoria hacia enemigos.', rarity: 'EPIC', repeatable: false, iconKey: 'skill-homing-shot', assetPath: 'assets/skills/homing-shot.png', iconBounds: [0, 17, 1254, 1237] },
  { id: 'energy-shield', name: 'Energy Shield', description: 'Bloquea el primer golpe de cada wave.', rarity: 'EPIC', repeatable: false, iconKey: 'skill-energy-shield', assetPath: 'assets/skills/energy-shield.png', iconBounds: [0, 0, 1254, 1254] },
  { id: 'revive', name: 'Revive', description: 'Permite revivir una vez por partida.', rarity: 'EPIC', repeatable: false, iconKey: 'skill-revive', assetPath: 'assets/skills/revive.png', iconBounds: [0, 0, 1253, 1254] },
  { id: 'power-trio', name: 'Power Trio', description: '+20% daño y velocidad de ataque. +1 HP máximo y cura 1 HP.', rarity: 'LEGENDARY', repeatable: false, iconKey: 'skill-power-trio', assetPath: 'assets/skills/power-trio.png', iconBounds: [0, 0, 1253, 1254] },
  { id: 'triple-shot', name: 'Triple Shot', description: 'Dispara una ráfaga de 3 proyectiles separados por 100 ms.', rarity: 'LEGENDARY', repeatable: false, iconKey: 'skill-triple-shot', assetPath: 'assets/skills/triple-shot.png', iconBounds: [0, 0, 1254, 1254] },
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
