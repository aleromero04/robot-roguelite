import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
class Sprite {
  constructor(scene,x,y,texture) { Object.assign(this,{scene,x,y,texture,active:true}) }
  setDisplaySize() {}
  setImmovable() {}
  setVelocity(x,y) { this.velocity={x,y}; this.body={velocity:this.velocity} }
  destroy() { this.active=false }
}
class Vector2 {
  constructor(x,y) { Object.assign(this,{x,y}) }
  lengthSq() { return this.x*this.x+this.y*this.y }
  set(x,y) { this.x=x;this.y=y;return this }
  scale(n) { this.x*=n;this.y*=n;return this }
  normalize() { const n=Math.hypot(this.x,this.y);if(n){this.x/=n;this.y/=n}return this }
}
const phaser={Scene:class {},Physics:{Arcade:{Sprite}},Math:{Vector2,Between:(min,max)=>Math.floor(Math.random()*(max-min+1))+min,Distance:{BetweenPointsSquared:(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2}}}
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
 s.player={x:0,y:0,isAlive:()=>true,update(){},isMoving:()=>moving,getAttackCooldown:()=>500/1.15,getBurstSize:()=>2,hasUpgrade:()=>true}
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

test('Homing turns gradually at 90 degrees/s, keeps speed, retargets or flies straight',()=>{
 const s=scene(),p=shot(s),a=new Enemy(s,0,100),b=new Enemy(s,100,0)
 let searches=0
 p.enableHoming(a,()=>{searches++;return b.active?b:undefined})
 p.updateHoming(100)
 assert.ok(Math.abs(Math.atan2(p.velocity.y,p.velocity.x)-Math.PI/20)<1e-9)
 assert.ok(Math.abs(Math.hypot(p.velocity.x,p.velocity.y)-500)<1e-9)
 assert.equal(searches,0)
 a.destroy();p.updateHoming(100)
 assert.equal(searches,1);assert.equal(p.homingTarget,b)
 assert.ok(Math.abs(p.velocity.y)<1e-9)
 b.destroy();const before={...p.velocity};p.updateHoming(100)
 assert.deepEqual(p.velocity,before)
})
test('Homing preserves Ricochet target, excludes pierced enemy and Rapid enables each shot',()=>{
 const s=scene(),p=shot(s,{piercing:true,ricochet:true}),a=new Enemy(s,100,0),b=new Enemy(s,0,100)
 p.enableHoming(a,()=>b)
 p.hit(a,1);p.finishHit(b);p.updateHoming(16)
 assert.equal(p.homingTarget,b);assert.equal(p.hit(a,1),false)
 assert.ok(Math.abs(Math.hypot(p.velocity.x,p.velocity.y)-500)<1e-9)
 const piercing=shot(s,{piercing:true});piercing.enableHoming(a,()=>b)
 piercing.hit(a,1);piercing.finishHit();piercing.updateHoming(16)
 assert.equal(piercing.homingTarget,b)
 const f=combat();f.s.update(500);f.timers[0].cb()
 assert.equal(f.shots.length,2)
 assert.ok(f.shots.every(projectile=>typeof projectile.findHomingTarget==='function'))
})

test('Triple creates three shots at 0/100/200 ms, retargets each and retains abilities',()=>{
 const f=combat();f.s.player.getBurstSize=()=>3
 f.enemies[1].x=0;f.enemies[1].y=200
 const third=new Enemy(scene(),-200,0);third.chase=()=>{};f.enemies.push(third)
 f.s.update(500)
 assert.equal(f.shots.length,1)
 assert.deepEqual(f.timers.map(t=>t.delay),[100,200])
 assert.ok(f.shots[0].velocity.x>0)
 f.enemies[0].destroy();f.move();f.s.time.now=600;f.timers[0].cb()
 assert.ok(f.shots[1].velocity.y>0)
 f.enemies[1].destroy();f.s.time.now=700;f.timers[1].cb()
 assert.ok(f.shots[2].velocity.x<0)
 assert.equal(f.shots.length,3)
 assert.ok(f.shots.every(p=>p.abilities.piercing&&p.abilities.ricochet&&p.abilities.flame&&p.findHomingTarget))
 f.s.update(1500);assert.equal(f.shots.length,3)
})
test('Triple cancels pending shots after combat, wave change or no targets',()=>{
 for(const mode of ['empty','game-over','wave']) {
  const f=combat();f.s.player.getBurstSize=()=>3;f.s.update(500)
  if(mode==='empty')f.enemies.forEach(e=>e.destroy())
  if(mode==='game-over')f.s.state='GAME_OVER'
  if(mode==='wave')f.s.currentWave=2
  f.timers.forEach(t=>t.cb());assert.equal(f.shots.length,1)
 }
})

test('Basic and Runner share chase but preserve their health, speed and contact damage',()=>{
 const s=scene();s.time.now=1000
 for(const [type,hp,speed,texture] of [['basic',3,90,'enemy'],['runner',1.5,160,'runner']]) {
  const enemy=new Enemy(s,0,0,type)
  assert.equal(enemy.health,hp);assert.equal(enemy.contactDamage,1);assert.equal(enemy.texture,texture)
  enemy.chase(100,100)
  assert.ok(Math.abs(Math.hypot(enemy.velocity.x,enemy.velocity.y)-speed)<1e-9)
  enemy.chase(0,0);assert.equal(Math.hypot(enemy.velocity.x,enemy.velocity.y),0)
 }
})
test('Runner dies from 1.5 direct damage; Flame stops on death and projectile interactions are shared',()=>{
 const s=scene(),runner=new Enemy(s,20,0,'runner'),basic=new Enemy(s,50,0)
 runner.applyBurn()
 const p=shot(s,{piercing:true,ricochet:true,flame:true})
 p.enableHoming(runner,()=>basic)
 p.hit(runner,1.5);assert.equal(runner.active,false);assert.equal(runner.burnTicksRemaining,0)
 runner.updateBurn(5000);assert.equal(runner.health,0)
 p.finishHit(basic);p.updateHoming(16)
 assert.equal(p.homingTarget,basic);assert.equal(p.hit(runner,1),false)
 p.hit(basic,1);p.finishHit();assert.equal(p.active,false)
 assert.equal(basic.health,2);assert.equal(basic.burnTicksRemaining,4)
})
test('actual wave start creates five Basics then five Basics plus two Runners using safe spawn',()=>{
 for(const wave of [1,2]) {
  const s=new GameScene(),items=[]
  Object.assign(s,{
   player:{x:400,y:300,startWave(){}},updatePlayerUI(){},
   add:{existing(){}},physics:{add:{existing(){}},world:{bounds:{left:0,right:800,top:0,bottom:600}}},
   enemies:{getChildren:()=>items,add:e=>items.push(e)},
   time:{now:0,delayedCall(){}},waveText:{setText(){return this},setVisible(){return this}},
  })
  s.startWave(wave)
  assert.equal(items.filter(e=>e.texture==='enemy').length,5)
  assert.equal(items.filter(e=>e.texture==='runner').length,wave===1?0:2)
  for(const [i,e] of items.entries()) {
   assert.ok(e.x>=20&&e.x<=780&&e.y>=20&&e.y<=580)
   assert.ok(Math.hypot(e.x-400,e.y-300)>=280)
   for(const other of items.slice(0,i))assert.ok(Math.hypot(e.x-other.x,e.y-other.y)>=60)
  }
  s.player.isAlive=()=>true
  s.enemies.countActive=()=>items.filter(e=>e.active).length
  let completed=false;s.completeWave=()=>{completed=true}
  items.forEach(e=>e.takeDamage(3));s.update(1)
  assert.equal(completed,true)
 }
})


test('Runner damage breakpoints retain fractional HP without rounding',()=>{
 for(const [damage,remaining] of [[1,0.5],[1.25,0.25],[1.5,0]]) {
  const s=scene(),runner=new Enemy(s,20,0,'runner')
  const first=shot(s);first.hit(runner,damage);first.finishHit()
  assert.equal(runner.health,remaining)
  assert.equal(runner.active,remaining>0)
  if(remaining>0) {
   const second=shot(s);second.hit(runner,damage);second.finishHit()
   assert.equal(runner.active,false)
  }
 }
})
test('Flame kills a 1.5 HP Runner after two burn ticks and cancels remaining ticks',()=>{
 const s=scene(),runner=new Enemy(s,20,0,'runner'),p=shot(s,{flame:true})
 p.hit(runner,1);p.finishHit()
 assert.equal(runner.health,0.5);assert.equal(runner.active,true)
 runner.updateBurn(499);assert.equal(runner.health,0.5)
 runner.updateBurn(500);assert.equal(runner.health,0.25);assert.equal(runner.active,true)
 runner.updateBurn(1000);assert.equal(runner.health,0);assert.equal(runner.active,false)
 assert.equal(runner.burnTicksRemaining,0)
 runner.updateBurn(5000);assert.equal(runner.health,0)
})
