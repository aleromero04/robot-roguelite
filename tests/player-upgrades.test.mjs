import { HealthFeedback } from '../src/game/ui/HealthFeedback.ts'
import * as effects from './combat-effects-stub.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Exercise the real entity methods without requiring a browser/WebGL context.
class Sprite {
  constructor(scene) { this.scene = scene; this.active = true }
  setDisplaySize() {}
  setTint() { return this }
  setTintMode() { return this }
  setCollideWorldBounds() {}
  setImmovable() {}
  setVelocity() {}
  destroy() { this.active = false }
}
const phaser = { TintModes: { FILL: 1 }, Physics: { Arcade: { Sprite } }, Input: { Keyboard: { KeyCodes: {} } } }
function loadEntity(name) {
  const source = fs.readFileSync(new URL(`../src/game/entities/${name}.ts`, import.meta.url), 'utf8')
  const context = { exports: {}, require: id => id === 'phaser' ? phaser : id === '../effects/CombatEffects' ? effects : { configureCharacter() {} } }
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context)
  return context.exports[name]
}
const Player = loadEntity('Player')
const Enemy = loadEntity('Enemy')
function makePlayer() {
  const scene = {
    time: { now: 0 }, add: { existing() {} }, physics: { add: { existing() {} } },
    input: { keyboard: { createCursorKeys: () => ({}), addKeys: () => ({}) } },
  }
  return new Player(scene, 400, 300)
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9)

test('base stats and additive percentage levels 1-3', () => {
  const p = makePlayer()
  assert.equal(p.getDamage(), 1)
  assert.equal(p.getAttackCooldown(), 500)
  assert.equal(p.getMoveSpeed(), 220)
  for (let level = 1; level <= 3; level++) {
    p.applyUpgrade('power-core')
    p.applyUpgrade('overclock')
    p.applyUpgrade('turbo')
    near(p.getDamage(), [1.25, 1.5, 1.75][level - 1])
    near(p.getAttackCooldown(), 500 / (1 + 0.15 * level))
    near(p.getMoveSpeed(), [246.4, 272.8, 299.2][level - 1])
  }
  assert.equal(p.getSelectedUpgradeIds().length, 9)
})

test('Chassis at full and partial HP, repeated Repair caps at max HP', () => {
  const full = makePlayer()
  full.applyUpgrade('reinforced-chassis')
  assert.equal(full.getHealth(), 6)
  assert.equal(full.getMaxHealth(), 6)
  const p = makePlayer()
  p.takeDamage(2)
  p.applyUpgrade('reinforced-chassis')
  assert.equal(p.getHealth(), 4)
  assert.equal(p.getMaxHealth(), 6)
  p.applyUpgrade('repair')
  assert.equal(p.getHealth(), 6)
  p.applyUpgrade('repair')
  assert.equal(p.getHealth(), 6)
  p.applyUpgrade('reinforced-chassis')
  assert.equal(p.getHealth(), 7)
  assert.equal(p.getMaxHealth(), 7)
})

test('non-stat skills do not change base numeric stats', () => {
  const p = makePlayer()
  for (const id of ['piercing-shot', 'ricochet', 'flame-shot', 'rapid-shot', 'homing-shot', 'energy-shield', 'revive', 'triple-shot']) p.applyUpgrade(id)
  assert.equal(p.getSelectedUpgradeIds().length, 8)
  assert.equal(p.getDamage(), 1)
  assert.equal(p.getAttackCooldown(), 500)
  assert.equal(p.getMoveSpeed(), 220)
  assert.equal(p.getHealth(), 5)
  assert.equal(p.getMaxHealth(), 5)
})

test('enemy retains fractional HP and dies at zero', () => {
  const p = makePlayer()
  p.applyUpgrade('power-core')
  const enemy = new Enemy(p.scene, 0, 0)
  enemy.takeDamage(p.getDamage())
  assert.equal(enemy.health, 1.75)
  enemy.takeDamage(p.getDamage())
  assert.equal(enemy.health, 0.5)
  assert.equal(enemy.active, true)
  enemy.takeDamage(p.getDamage())
  assert.equal(enemy.active, false)
})

test('shield blocks entire event, simultaneous overlaps and recharges per wave', () => {
  const p = makePlayer()
  p.applyUpgrade('energy-shield')
  p.applyUpgrade('revive')
  p.startWave()
  assert.equal(p.takeDamage(100), true)
  assert.equal(p.getHealth(), 5)
  assert.equal(p.isShieldReady(), false)
  assert.equal(p.isReviveReady(), true)
  assert.equal(p.takeDamage(100), false)
  p.scene.time.now = 1000
  p.takeDamage(1)
  assert.equal(p.getHealth(), 4)
  p.startWave()
  assert.equal(p.isShieldReady(), true)
  assert.equal(p.takeDamage(1), false) // Invulnerability does not consume shield.
  assert.equal(p.isShieldReady(), true)
  p.scene.time.now = 2000
  p.takeDamage(2)
  assert.equal(p.getHealth(), 4)
})

test('revive only on lethal damage, once per run, with 1000 ms protection', () => {
  const p = makePlayer()
  p.applyUpgrade('revive')
  p.takeDamage(1)
  assert.equal(p.isReviveReady(), true)
  p.scene.time.now = 1000
  p.takeDamage(10)
  assert.equal(p.getHealth(), 3)
  assert.equal(p.isAlive(), true)
  assert.equal(p.isReviveReady(), false)
  p.startWave()
  p.applyUpgrade('revive') // Does not recharge a consumed unique ability.
  assert.equal(p.isReviveReady(), false)
  p.scene.time.now = 1999
  assert.equal(p.takeDamage(10), false)
  p.scene.time.now = 2000
  p.takeDamage(10)
  assert.equal(p.isAlive(), false)
  const low = makePlayer()
  low.maxHealth = 2
  low.applyUpgrade('revive')
  low.takeDamage(100)
  assert.equal(low.getHealth(), 2)
})

test('Power Trio is additive, heals one, and cannot stack twice', () => {
  for (const first of [false, true]) {
    const p = makePlayer()
    p.takeDamage(2)
    if (first) p.applyUpgrade('power-trio')
    for (let i = 0; i < 2; i++) {
      p.applyUpgrade('power-core')
      p.applyUpgrade('overclock')
    }
    if (!first) p.applyUpgrade('power-trio')
    near(p.getDamage(), 1.7)
    near(p.getAttackCooldown(), 500 / 1.5)
    assert.equal(p.getMaxHealth(), 6)
    assert.equal(p.getHealth(), 4)
    p.applyUpgrade('power-trio')
    assert.equal(p.getMaxHealth(), 6)
    assert.equal(p.getHealth(), 4)
    assert.equal(p.getSelectedUpgradeIds().filter(id => id === 'power-trio').length, 1)
  }
  const full = makePlayer()
  full.applyUpgrade('power-trio')
  assert.equal(full.getHealth(), 6)
  assert.equal(full.getMaxHealth(), 6)
})

test('Triple overrides Rapid regardless of acquisition order', () => {
  const p = makePlayer()
  assert.equal(p.getBurstSize(), 1)
  p.applyUpgrade('rapid-shot')
  assert.equal(p.getBurstSize(), 2)
  p.applyUpgrade('triple-shot')
  assert.equal(p.getBurstSize(), 3)
  const reverse = makePlayer()
  reverse.applyUpgrade('triple-shot')
  reverse.applyUpgrade('rapid-shot')
  reverse.applyUpgrade('triple-shot')
  assert.equal(reverse.getBurstSize(), 3)
  assert.equal(reverse.getSelectedUpgradeIds().filter(id => id === 'triple-shot').length, 1)
})

test('Shield emits only a block effect; rejected overlaps emit none; real damage flashes without changing invulnerability',()=>{
 const p=makePlayer();p.applyUpgrade('energy-shield');p.startWave()
 effects.events.length=0;p.takeDamage(2)
 assert.equal(p.getHealth(),5);assert.deepEqual(effects.events.map(e=>e[0]),['shield'])
 p.takeDamage(2);assert.equal(effects.events.length,1)
 p.scene.time.now=1000;p.takeDamage(2)
 assert.equal(p.getHealth(),3);assert.deepEqual(effects.events.map(e=>e[0]),['shield','damage'])
 p.scene.time.now=1999;p.takeDamage(1);assert.equal(p.getHealth(),3)
 p.scene.time.now=2000;p.takeDamage(1);assert.equal(p.getHealth(),2)
})


test('real Player Shield and i-frames never trigger HUD health-loss feedback; damage and healing do',()=>{
 const p=makePlayer(),feedback=new HealthFeedback()
 feedback.update(p.getHealth(),0)
 p.applyUpgrade('energy-shield');p.startWave();p.takeDamage(2)
 assert.equal(feedback.update(p.getHealth(),0),undefined)
 p.scene.time.now=999;p.takeDamage(1)
 assert.equal(feedback.update(p.getHealth(),999),undefined)
 p.scene.time.now=1000;p.takeDamage(1)
 assert.equal(feedback.update(p.getHealth(),1000),0xff6578)
 p.applyUpgrade('repair')
 assert.equal(feedback.update(p.getHealth(),1001),0x64d98b)
})
