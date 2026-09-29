import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
class Sprite {
  constructor(scene,x,y) { Object.assign(this,{scene,x,y,active:true}) }
  setDisplaySize() {}
  setImmovable() {}
  setVelocity(x,y) { this.velocity={x,y} }
  destroy() { this.active=false }
}
class Vector2 {
  constructor(x,y) { Object.assign(this,{x,y}) }
  normalize() { const n=Math.hypot(this.x,this.y);if(n){this.x/=n;this.y/=n}return this }
}
const phaser={Scene:class {},Physics:{Arcade:{Sprite}},Math:{Vector2,Distance:{BetweenPointsSquared:(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2}}}
const modules={}
function load(path,name) {
  const context={exports:{},require:id=>id==='phaser'?phaser:modules[id]??{}}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`src/game/${path}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context)
  return context.exports[name]
}
const Enemy=load('entities/Enemy','Enemy');modules['../entities/Enemy']={Enemy}
const Projectile=load('entities/Projectile','Projectile');modules['../entities/Projectile']={Projectile}
const GameScene=load('scenes/GameScene','GameScene')
const scene=()=>({time:{now:0},add:{existing(){}},physics:{add:{existing(){}}}})
const shot=(s,abilities={})=>new Projectile(s,0,0,100,0,{piercing:false,ricochet:false,flame:false,...abilities})

test('piercing never repeats damage and stops after two distinct hits',()=>{
 const s=scene(),p=shot(s,{piercing:true}),a=new Enemy(s,20,0),b=new Enemy(s,40,0)
 assert.equal(p.hit(a,1.25),true);p.finishHit();assert.equal(p.active,true)
 assert.equal(p.hit(a,1.25),false);assert.equal(a.health,1.75)
 assert.equal(p.hit(b,1.25),true);p.finishHit();assert.equal(p.active,false)
})
test('ricochet alone and with piercing redirects only once, excludes repeat hits',()=>{
 for(const piercing of [false,true]) {
  const s=scene(),p=shot(s,{piercing,ricochet:true}),a=new Enemy(s,20,0),b=new Enemy(s,0,50)
  p.hit(a,1);p.finishHit(b);assert.equal(p.velocity.y,500);assert.equal(p.canRicochet(),false)
  assert.equal(p.hit(a,1),false);p.hit(b,1);p.finishHit(a);assert.equal(p.active,false)
 }
 const s=scene(),p=shot(s,{ricochet:true});p.hit(new Enemy(s,20,0),1);p.finishHit();assert.equal(p.active,false)
})
test('burn ticks at 500 ms, refresh replaces schedule, death/stop cancels damage',()=>{
 const s=scene(),e=new Enemy(s,0,0)
 e.applyBurn();e.updateBurn(499);assert.equal(e.health,3)
 e.updateBurn(500);assert.equal(e.health,2.75)
 s.time.now=600;e.applyBurn();e.updateBurn(1000);assert.equal(e.health,2.75)
 e.updateBurn(2600);assert.equal(e.health,1.75);e.updateBurn(4000);assert.equal(e.health,1.75)
 e.applyBurn();e.clearBurn();e.updateBurn(9000);assert.equal(e.health,1.75)
 e.applyBurn();e.takeDamage(2);const hp=e.health;e.updateBurn(10000);assert.equal(e.health,hp)
})
test('flame adds burn to direct damage and repeated overlap does not refresh',()=>{
 const s=scene(),e=new Enemy(s,10,0),p=shot(s,{flame:true,piercing:true})
 p.hit(e,1.25);assert.equal(e.health,1.75)
 s.time.now=300;assert.equal(p.hit(e,1.25),false)
 e.updateBurn(2000);assert.equal(e.health,0.75)
})
function combat() {
 const s=new GameScene(),enemies=[new Enemy(scene(),100,0),new Enemy(scene(),200,0)],shots=[],timers=[]
 Object.assign(s,{state:'COMBAT',currentWave:1,time:{now:500,delayedCall:(delay,cb)=>timers.push({delay,cb})},add:{existing(){}},physics:{add:{existing(){}}},enemies:{getChildren:()=>enemies,countActive:()=>enemies.filter(e=>e.active).length},projectiles:{add:p=>shots.push(p)}})
 let moving=false
 s.player={x:0,y:0,isAlive:()=>true,update(){},isMoving:()=>moving,getAttackCooldown:()=>500/1.15,hasUpgrade:()=>true}
 enemies.forEach(e=>{e.chase=()=>{}})
 return {s,enemies,shots,timers,move:()=>{moving=true}}
}
test('Rapid schedules 100 ms, retargets after death, allows movement and transfers abilities',()=>{
 const {s,enemies,shots,timers,move}=combat();s.update(500)
 assert.equal(shots.length,1);assert.equal(timers[0].delay,100)
 enemies[0].destroy();move();timers[0].cb();assert.equal(shots.length,2)
 assert.equal(shots[1].abilities.flame,true);assert.equal(shots[1].abilities.piercing,true);assert.equal(shots[1].abilities.ricochet,true)
 s.update(1000);assert.equal(shots.length,2)
})
test('Rapid suppresses second shot without enemies, after Game Over or wave change',()=>{
 for(const mode of ['empty','game-over','wave']) {
  const {s,enemies,shots,timers}=combat();s.update(500)
  if(mode==='empty')enemies.forEach(e=>e.destroy())
  if(mode==='game-over')s.state='GAME_OVER'
  if(mode==='wave')s.currentWave=2
  timers[0].cb();assert.equal(shots.length,1)
 }
})
