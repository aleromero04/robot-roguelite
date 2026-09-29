import assert from 'node:assert/strict'
import test from 'node:test'
import { UPGRADES, RARITY_WEIGHTS, generateUpgradeOptions } from '../src/game/data/upgrades.ts'

const sequence = (...values) => { let i = 0; return () => values[i++ % values.length] }

test('catalogue and complete probability table', () => {
  assert.equal(UPGRADES.length, 14)
  assert.equal(new Set(UPGRADES.map(u => u.id)).size, 14)
  assert.deepEqual(Object.values(RARITY_WEIGHTS).map(Object.values), [
    [70, 25, 5, 0], [55, 32, 12, 1], [40, 38, 19, 3],
    [30, 38, 26, 6], [20, 35, 34, 11], [10, 30, 42, 18],
  ])
})

test('rarity thresholds and uniform choice within the selected rarity', () => {
  for (const [wave, weights] of Object.entries(RARITY_WEIGHTS)) {
    let start = 0
    for (const [rarity, weight] of Object.entries(weights)) {
      if (weight) {
        for (const roll of [start / 100, (start + weight - 0.001) / 100]) {
          assert.equal(generateUpgradeOptions(Number(wave), [], 4, 5, sequence(roll, 0))[0].rarity, rarity)
        }
      }
      start += weight
    }
  }
})

test('Repair requires missing HP; Chassis and repeatables remain eligible', () => {
  const owned = UPGRADES.map(u => u.id)
  const full = generateUpgradeOptions(1, owned, 5, 5, sequence(0, 0.999))
  assert.equal(full[0].id, 'reinforced-chassis')
  assert.ok(full.every(u => u.repeatable && u.id !== 'repair'))
  assert.equal(generateUpgradeOptions(1, owned, 4, 5, sequence(0, 0.999))[0].id, 'repair')
})

test('exhausted unique rarities fall back without loops or Wave 1 legendary cards', () => {
  const owned = UPGRADES.filter(u => !u.repeatable).map(u => u.id)
  for (const roll of [0.8, 0.97, 0.999]) {
    const options = generateUpgradeOptions(1, owned, 5, 5, () => roll)
    assert.equal(options.length, 3)
    assert.equal(new Set(options.map(u => u.id)).size, 3)
    assert.ok(options.every(u => u.rarity === 'COMMON'))
  }
  const epic = generateUpgradeOptions(1, [], 4, 5, sequence(0.99, 0))
  assert.equal(new Set(epic.map(u => u.id)).size, 3)
  assert.ok(epic.every(u => u.rarity === 'EPIC'))
})

test('three distinct eligible options across repeated selections and all waves', () => {
  let seed = 12345
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)
  const owned = []
  for (let run = 0; run < 600; run++) {
    const wave = run % 6 + 1
    const options = generateUpgradeOptions(wave, owned, 5, 5, random)
    assert.equal(options.length, 3)
    assert.equal(new Set(options.map(u => u.id)).size, 3)
    assert.ok(options.every(u => u.id !== 'repair' && (u.repeatable || !owned.includes(u.id))))
    if (wave === 1) assert.ok(options.every(u => u.rarity !== 'LEGENDARY'))
    owned.push(options[0].id)
  }
})
