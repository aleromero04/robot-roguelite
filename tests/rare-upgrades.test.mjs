import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
class Sprite {
  constructor(scene,x,y,texture) { Object.assign(this,{scene,x,y,texture,active:true}) }
  setDisplaySize() {}
  setImmovable() {}
  setCollideWorldBounds() {}
  preUpdate() {}
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
const EnemyProjectile=load('entities/EnemyProjectile','EnemyProjectile');modules['../entities/EnemyProjectile']={EnemyProjectile}
const WAVES=load('data/waves','WAVES');modules['../data/waves']={WAVES}
modules['../data/upgrades']={}
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
  assert.equal(p.hit(a,1),false);p.hit(b,1);p.finishHit(a);assert.equal(p.active,piercing)
  if(piercing) {
   const c=new Enemy(s,0,100);p.hit(c,1);p.finishHit();assert.equal(p.active,false)
  }
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
 Object.assign(s,{state:'COMBAT',currentWave:1,nextGroupIndex:1,time:{now:500,delayedCall:(delay,cb)=>timers.push({delay,cb})},add:{existing(){}},physics:{add:{existing(){}}},enemies:{getChildren:()=>enemies,countActive:()=>enemies.filter(e=>e.active).length},projectiles:{add:p=>shots.push(p)}})
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
 p.hit(basic,1);p.finishHit();assert.equal(p.active,true)
 assert.equal(basic.health,2);assert.equal(basic.burnTicksRemaining,4)
})
test('Waves 1 and 2 each spawn their single Basic group safely',()=>{
 for(const wave of [1,2]) {
  const s=new GameScene(),items=[]
  Object.assign(s,{
   player:{x:400,y:300,startWave(){}},updatePlayerUI(){},
   add:{existing(){}},physics:{add:{existing(){}},world:{bounds:{left:0,right:800,top:0,bottom:600}}},
   enemies:{getChildren:()=>items,add:e=>items.push(e)},
   time:{now:0,delayedCall(){}},waveText:{setText(){return this},setVisible(){return this}},
  })
  s.startWave(wave)
  assert.equal(items.filter(e=>e.texture==='enemy').length,wave===1?5:7)
  assert.equal(items.filter(e=>e.texture==='runner').length,0)
  assert.equal(items.filter(e=>e.texture==='shooter').length,0)
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

test('Shooter range hysteresis, stats, cooldown and death',()=>{
 const s=scene(),e=new Enemy(s,0,0,'shooter');let shots=0;const fire=()=>shots++
 assert.equal(e.health,2);assert.equal(e.contactDamage,1)
 e.updateBehavior(350,0,fire);assert.equal(e.velocity.x,70)
 e.updateBehavior(295,0,fire);assert.equal(e.velocity.x,70)
 e.updateBehavior(280,0,fire);assert.equal(e.velocity.x,0)
 s.time.now=1499;e.updateBehavior(250,0,fire);assert.equal(shots,0)
 s.time.now=1500;e.updateBehavior(250,0,fire);assert.equal(shots,1)
 s.time.now=2999;e.updateBehavior(250,0,fire);assert.equal(shots,1)
 s.time.now=3000;e.updateBehavior(250,0,fire);assert.equal(shots,2)
 e.updateBehavior(190,0,fire);assert.equal(e.velocity.x,-70)
 e.updateBehavior(205,0,fire);assert.equal(e.velocity.x,-70)
 e.updateBehavior(220,0,fire);assert.equal(e.velocity.x,0)
 e.updateBehavior(0,0,fire);assert.ok(Number.isFinite(e.velocity.x));assert.equal(Math.hypot(e.velocity.x,e.velocity.y),70)
 e.applyBurn();e.takeDamage(2);e.updateBurn(9000);s.time.now=9000;e.updateBehavior(250,0,fire)
 assert.equal(shots,2);assert.equal(e.burnTicksRemaining,0)
})
test('EnemyProjectile keeps a straight 250 px/s trajectory and exits completely before cleanup',()=>{
 const s=scene();s.physics.world={bounds:{left:0,right:800,top:0,bottom:600}}
 const p=new EnemyProjectile(s,400,300,700,300);p.displayWidth=12;p.displayHeight=12
 assert.equal(p.damage,1);assert.equal(p.velocity.x,250);assert.equal(p.velocity.y,0)
 p.preUpdate(100,100);assert.equal(p.velocity.x,250);assert.equal(p.velocity.y,0)
 p.x=805;p.preUpdate(200,100);assert.equal(p.active,true)
 p.x=807;p.preUpdate(300,100);assert.equal(p.active,false)
})
test('shared damage coordinator delegates to Player, updates UI, respects survival and stops combat on death',()=>{
 const s=new GameScene();let calls=0,ui=0,stopped=0,alive=true,accepted=true
 s.state='COMBAT';s.player={takeDamage:amount=>{assert.equal(amount,1);calls++;return accepted},isAlive:()=>alive}
 s.updatePlayerUI=()=>ui++;s.stopCombat=()=>stopped++
 s.waveText={setVisible(){}};s.enemies={getChildren:()=>[]}
 s.add={text:()=>({setOrigin(){return this},setDepth(){return this}})}
 s.damagePlayer(1);assert.equal(s.state,'COMBAT');assert.equal(ui,1)
 accepted=false;s.damagePlayer(1);assert.equal(ui,1)
 accepted=true;alive=false;s.damagePlayer(1);assert.equal(s.state,'GAME_OVER');assert.equal(stopped,1)
 s.damagePlayer(1);assert.equal(calls,3)
})

function waveFixture() {
 const s=new GameScene(),items=[],timers=[],cards=[],upgradeWaves=[]
 const text=()=>({setText(value){this.value=value;return this},setVisible(){return this},setOrigin(){return this},setDepth(){return this},setInteractive(){return this},on(event,click){this.click=click;cards.push(this);return this},destroy(){}})
 phaser.Input={Keyboard:{KeyCodes:{}}}
 const Player=load('entities/Player','Player')
 Object.assign(s,{
  add:{existing(){},text},physics:{add:{existing(){}},world:{bounds:{left:0,right:800,top:0,bottom:600}}},
  input:{keyboard:{createCursorKeys:()=>({}),addKeys:()=>({})}},
  time:{now:0,delayedCall:(delay,cb)=>timers.push({at:s.time.now+delay,cb})},
  enemies:{getChildren:()=>items,add:e=>{e.updateBehavior=()=>{};items.push(e)},countActive:()=>items.filter(e=>e.active).length},
  projectiles:{clear(){this.cleared=true}},enemyProjectiles:{clear(){this.cleared=true}},
  healthText:text(),abilityText:text(),waveText:text(),
 })
 s.player=new Player(s,400,300);s.player.update=()=>{};s.player.isMoving=()=>true
 const generator=load('data/upgrades','generateUpgradeOptions')
 modules['../data/upgrades'].generateUpgradeOptions=(wave,...args)=>{upgradeWaves.push(wave);return generator(wave,...args)}
 const tick=()=>{timers.sort((a,b)=>a.at-b.at);const t=timers.shift();assert.ok(t);s.time.now=t.at;t.cb()}
 const killTo=n=>{const alive=items.filter(e=>e.active);alive.slice(0,Math.max(0,alive.length-n)).forEach(e=>e.takeDamage(100))}
 return {s,items,timers,cards,upgradeWaves,tick,killTo}
}
test('configured group compositions and totals match all six waves',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(Object.values(WAVES).map(w=>w.groups.map(g=>g.enemies)))),[
  [{basic:5}],[{basic:7}],[{basic:5},{runner:2}],
  [{basic:4,runner:1,shooter:1},{runner:1,shooter:2}],
  [{basic:4,runner:2,shooter:1},{runner:2,shooter:1},{basic:2,shooter:1}],
  [{basic:5,runner:2,shooter:1},{runner:3,shooter:2},{basic:3,shooter:1}],
 ])
})
test('configured thresholds trigger once at the total alive boundary, never above it',()=>{
 const thresholds={3:[4],4:[4],5:[5,4],6:[5,4]}
 for(const wave of [3,4,5,6]) {
  const f=waveFixture();f.s.startWave(wave)
  assert.deepEqual(Array.from(WAVES[wave].groups.slice(1),g=>g.spawnAtAlive),thresholds[wave])
  for(const [index,threshold] of thresholds[wave].entries()) {
   const before=f.items.length
   f.killTo(threshold+1);f.s.update(0);assert.equal(f.items.length,before)
   f.killTo(threshold);f.s.update(0)
   const added=Object.values(WAVES[wave].groups[index+1].enemies).reduce((a,b)=>a+b,0)
   assert.equal(f.items.length,before+added)
   assert.equal(f.s.enemies.countActive(true),threshold+added)
   assert.equal(f.s.nextGroupIndex,index+2)
   f.s.update(0);assert.equal(f.items.length,before+added)
   assert.equal(f.s.state,'COMBAT')
  }
  f.killTo(0);f.s.update(0);assert.equal(f.s.state,'WAVE_COMPLETE')
 }
})
test('zero survivors still spawns pending groups before completing a wave',()=>{
 for(const wave of [3,4,5,6]) {
  const f=waveFixture();f.s.startWave(wave)
  for(let index=1;index<WAVES[wave].groups.length;index++) {
   f.killTo(0);f.s.update(0)
   assert.equal(f.s.nextGroupIndex,index+1);assert.equal(f.s.state,'COMBAT')
   assert.ok(f.s.enemies.countActive(true)>0)
  }
  f.killTo(0);f.s.update(0);assert.equal(f.s.state,'WAVE_COMPLETE')
 }
})
test('full six-wave flow: six choices, correct rarity wave, cleanup, shield recharge, no revive reset, boss stop',()=>{
 const f=waveFixture();f.s.player.applyUpgrade('energy-shield');f.s.player.applyUpgrade('revive')
 f.s.startWave(1)
 for(let wave=1;wave<=6;wave++) {
  assert.equal(f.s.currentWave,wave);assert.equal(f.s.player.isShieldReady(),true)
  f.s.time.now+=1000;f.s.player.takeDamage(1) // Consume shield.
  if(wave===1){f.s.time.now+=1000;f.s.player.takeDamage(100)} // Consume revive once.
  assert.equal(f.s.player.isReviveReady(),false)
  for(let i=0;i<WAVES[wave].groups.length;i++){f.killTo(0);f.s.update(f.s.time.now)}
  assert.equal(f.s.state,'WAVE_COMPLETE');assert.equal(f.s.projectiles.cleared,true);assert.equal(f.s.enemyProjectiles.cleared,true)
  while(f.s.state==='WAVE_COMPLETE')f.tick()
  assert.equal(f.s.state,'UPGRADE_SELECTION');assert.equal(f.s.player.isShieldReady(),false)
  const before=f.s.player.getSelectedUpgradeIds().length
  const card=f.cards.at(-1);card.click();card.click()
  assert.equal(f.s.player.getSelectedUpgradeIds().length,before+1)
  assert.equal(f.s.state,'COUNTDOWN');assert.equal(f.s.player.isShieldReady(),false)
  while(f.s.state==='COUNTDOWN')f.tick()
 }
 assert.deepEqual(f.upgradeWaves,[1,2,3,4,5,6])
 assert.equal(f.s.state,'BOSS_INCOMING');assert.equal(f.s.waveText.value,'BOSS INCOMING')
 assert.equal(f.s.player.isShieldReady(),false);assert.equal(f.items.filter(e=>e.active).length,0)
 assert.equal(f.items.length,58)
})
test('Game Over prevents pending groups and any later transition',()=>{
 const f=waveFixture();f.s.startWave(6);f.killTo(2);f.s.damagePlayer(100)
 assert.equal(f.s.state,'GAME_OVER');f.s.update(1000)
 while(f.timers.length)f.tick()
 assert.equal(f.items.length,8);assert.equal(f.s.nextGroupIndex,1)
 assert.equal(f.s.state,'GAME_OVER');assert.equal(f.cards.length,0)
})


test('Ricochet then Piercing preserve independent charges, Homing and Flame across three distinct hits',()=>{
 const s=scene(),p=shot(s,{piercing:true,ricochet:true,flame:true})
 const a=new Enemy(s,100,0),b=new Enemy(s,0,100),c=new Enemy(s,0,200)
 p.enableHoming(a,()=>[a,b,c].find(e=>e.active&&!p.hasHit(e)))
 assert.equal(p.hit(a,1.25),true);p.finishHit(b)
 assert.equal(p.remainingRicochets,0);assert.equal(p.remainingPierces,1)
 assert.equal(p.homingTarget,b);assert.equal(p.hit(a,1.25),false)
 p.updateHoming(16)
 assert.equal(p.hit(b,1.25),true);p.finishHit(c)
 assert.equal(p.remainingPierces,0);assert.equal(p.active,true);assert.equal(p.canRicochet(),false)
 assert.equal(p.hit(b,1.25),false);p.updateHoming(16);assert.equal(p.homingTarget,c)
 assert.equal(p.hit(c,1.25),true);p.finishHit();assert.equal(p.active,false)
 for(const e of [a,b,c]) {assert.equal(e.health,1.75);assert.equal(e.burnTicksRemaining,4)}
 assert.equal(p.hit(a,1.25),false)
})
test('missing or already-hit bounce target uses only Piercing and cannot cause repeated damage',()=>{
 const s=scene(),p=shot(s,{piercing:true,ricochet:true}),a=new Enemy(s,10,0)
 p.hit(a,1);p.finishHit(a)
 assert.equal(p.remainingPierces,0);assert.equal(p.remainingRicochets,1)
 assert.equal(p.hit(a,1),false);assert.equal(a.health,2)
 const b=new Enemy(s,30,0);p.hit(b,1);p.finishHit()
 assert.equal(p.active,false)
})
