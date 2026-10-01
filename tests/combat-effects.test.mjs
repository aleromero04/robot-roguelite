import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const Tint = require('../node_modules/phaser/src/gameobjects/components/Tint.js')
const TintModes = require('../node_modules/phaser/src/renderer/TintModes.js')
const context = { exports: {}, require: () => ({ TintModes }) }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/game/effects/CombatEffects.ts','utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context)
const { DamageFlash, impact, death, shieldBlock, burnMarker } = context.exports

class Visual extends EventEmitter {
  constructor(scene, x, y) { super(); Object.assign(this, { scene, x, y, active:true, scaleX:1, scaleY:1 }) }
  clear() { return this }
  setPosition(x,y) { this.x=x;this.y=y;return this }
  fillStyle() { return this }
  fillCircle() { return this }
  fillTriangle() { return this }
  setDepth() { return this }
  setOrigin() { return this }
  setScale(x,y) { this.scaleX=x;this.scaleY=y;return this }
  setRotation() { return this }
  setFlip() { return this }
  setTint() { return this }
  setStrokeStyle() { return this }
  destroy() { if(this.active) { this.active=false;this.emit('destroy') } }
}
function fixture() {
 const visuals=[],tweens=[]
 const scene={time:{now:0},add:{},tweens:{add(config){
  const tween={...config,removed:false,remove(){this.removed=true}}
  tweens.push(tween);return tween
 }}}
 for(const type of ['circle','image','graphics'])scene.add[type]=(x,y)=>{const v=new Visual(scene,x,y);visuals.push(v);return v}
 const sprite=Object.assign(new Visual(scene,100,100),{texture:{key:'enemy-basic'},frame:{name:'character'},displayWidth:50,displayHeight:45})
 return {scene,sprite,visuals,tweens}
}
test('overlapping flashes restore actual Phaser tint corners and mode exactly, preserving secondary tint',()=>{
 const sprite={...Tint,scene:{time:{now:0}}},flash=new DamageFlash()
 sprite.setTint(0x123456,0xabcdef,0x654321,0x112233).setTint2(0x443322).setTintMode(TintModes.ADD)
 flash.show(sprite);sprite.scene.time.now=40;flash.show(sprite)
 sprite.scene.time.now=119;flash.update(sprite);assert.equal(sprite.tintMode,TintModes.FILL)
 sprite.scene.time.now=120;flash.update(sprite)
 assert.deepEqual([sprite.tintTopLeft,sprite.tintTopRight,sprite.tintBottomLeft,sprite.tintBottomRight],[0x123456,0xabcdef,0x654321,0x112233])
 assert.equal(sprite.tintMode,TintModes.ADD);assert.equal(sprite.tint2TopLeft,0x443322)
})
test('death is a separate non-physical image and completes without retaining its tween',()=>{
 const f=fixture();death(f.sprite)
 assert.equal(f.visuals.length,1);assert.notEqual(f.visuals[0],f.sprite)
 assert.equal(f.visuals[0].body,undefined);assert.equal(f.sprite.scaleX,1)
 assert.equal(f.tweens[0].duration,200)
 f.sprite.destroy();assert.equal(f.visuals[0].active,true)
 f.tweens[0].onComplete();assert.equal(f.visuals[0].active,false);assert.equal(f.tweens[0].removed,true)
})
test('transient visuals are capped, release slots on cleanup, and shutdown removes their tweens',()=>{
 const f=fixture()
 for(let i=0;i<100;i++)impact(f.scene,10,10)
 assert.equal(f.visuals.length,48)
 f.visuals.forEach(v=>v.destroy());assert.ok(f.tweens.every(t=>t.removed))
 impact(f.scene,10,10);assert.equal(f.visuals.length,49)
})
test('Shield and Boss use brief distinct effects; burn has no timer or tween',()=>{
 const f=fixture();shieldBlock(f.sprite);death(f.sprite,true);burnMarker(f.sprite)
 assert.deepEqual(f.tweens.map(t=>t.duration),[320,280])
 assert.equal(f.visuals.length,3);assert.equal(f.sprite.scaleX,1)
})

test('Revive visual restores original alpha and cleans exactly at existing invulnerability deadline without modifying transform/body',()=>{
 const f=fixture(),effect=new context.exports.ReviveEffect()
 f.sprite.alpha=0.8;f.sprite.setAlpha=function(a){this.alpha=a;return this}
 Visual.prototype.setPosition=function(x,y){this.x=x;this.y=y;return this}
 Visual.prototype.setAlpha=function(a){this.alpha=a;return this}
 effect.start(f.sprite,1000)
 f.scene.time.now=150;effect.update(f.sprite);assert.ok(f.sprite.alpha<0.2)
 f.scene.time.now=600;effect.update(f.sprite);assert.equal(f.sprite.alpha,0.8)
 assert.equal(f.sprite.scaleX,1);assert.equal(f.sprite.x,100);assert.equal(f.sprite.y,100)
 f.scene.time.now=999;effect.update(f.sprite);assert.equal(f.visuals[0].active,true)
 f.scene.time.now=1000;effect.update(f.sprite);assert.equal(f.visuals[0].active,false)
 assert.equal(f.sprite.alpha,0.8)
 effect.start(f.sprite,2000);effect.clear(f.sprite);assert.equal(f.visuals[1].active,false)
})


test('burn follows the sprite with one reusable visual, no timers/tweens or extra objects, and destroys immediately',()=>{
 const f=fixture(),marker=burnMarker(f.sprite)
 assert.equal(f.visuals.length,1);assert.equal(f.tweens.length,0)
 for(let frame=0;frame<300;frame++){
  f.scene.time.now=frame*16;f.sprite.x=frame;f.sprite.y=frame/2;marker.update()
 }
 assert.equal(f.visuals.length,1)
 assert.equal(f.visuals[0].x,f.sprite.x);assert.equal(f.visuals[0].y,f.sprite.y)
 marker.destroy();assert.equal(f.visuals[0].active,false)
})
