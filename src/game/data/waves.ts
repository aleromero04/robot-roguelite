import type { EnemyType } from '../entities/Enemy'

export type WaveNumber = 1 | 2 | 3 | 4 | 5 | 6
export interface WaveGroup {
  readonly enemies: Readonly<Partial<Record<EnemyType, number>>>
  // null identifies the initial group, spawned when combat starts.
  readonly spawnAtAlive: number | null
}

export const WAVES: Readonly<Record<WaveNumber, { readonly groups: readonly WaveGroup[] }>> = {
  1: { groups: [{ enemies: { basic: 5 }, spawnAtAlive: null }] },
  2: { groups: [{ enemies: { basic: 7 }, spawnAtAlive: null }] },
  3: { groups: [
    { enemies: { basic: 5 }, spawnAtAlive: null },
    { enemies: { runner: 2 }, spawnAtAlive: 4 },
  ] },
  4: { groups: [
    { enemies: { basic: 4, runner: 1, shooter: 1 }, spawnAtAlive: null },
    { enemies: { runner: 1, shooter: 2 }, spawnAtAlive: 4 },
  ] },
  5: { groups: [
    { enemies: { basic: 4, runner: 2, shooter: 1 }, spawnAtAlive: null },
    { enemies: { runner: 2, shooter: 1 }, spawnAtAlive: 5 },
    { enemies: { basic: 2, shooter: 1 }, spawnAtAlive: 4 },
  ] },
  6: { groups: [
    { enemies: { basic: 5, runner: 2, shooter: 1 }, spawnAtAlive: null },
    { enemies: { runner: 3, shooter: 2 }, spawnAtAlive: 5 },
    { enemies: { basic: 3, shooter: 1 }, spawnAtAlive: 4 },
  ] },
}
