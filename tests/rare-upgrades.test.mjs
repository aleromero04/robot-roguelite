import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'
const ArcadeBody = createRequire(import.meta.url)('../node_modules/phaser/src/physics/arcade/Body.js')
class Sprite {
  constructor(scene,x,y,texture) { Object.assign(this,{scene,x,y,texture,active:true}) }
  setDisplaySize() {}
  setTint() { this.tinted=true;return this }
  setTintMode() { return this }
  clearTint() { this.tinted=false }
  setVisible() {return this}
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
const phaser={TintModes:{FILL:1},Scene:class {},Physics:{Arcade:{Sprite}},Math:{Vector2,Between:(min,max)=>Math.floor(Math.random()*(max-min+1))+min,Distance:{BetweenPointsSquared:(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2}}}
const modules={'../visuals/characters':{configureCharacter(){},CHARACTERS:{}}}
const graphics=()=>({clear(){},fillStyle(){},fillRect(){},setDepth(){return this}})
function load(path,name) {
  const context={exports:{},require:id=>id==='phaser'?phaser:modules[id]??{}}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`src/game/${path}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context)
  return context.exports[name]
}
modules['../visuals/characters'].CHARACTERS=load('visuals/characters','CHARACTERS')
modules['../visuals/characters'].getCharacterSpawnMargin=load('visuals/characters','getCharacterSpawnMargin')
const Enemy=load('entities/Enemy','Enemy');modules['../entities/Enemy']={Enemy};modules['./Enemy']={Enemy}
const Boss=load('entities/Boss','Boss');modules['../entities/Boss']={Boss}
const Projectile=load('entities/Projectile','Projectile');modules['../entities/Projectile']={Projectile}
const EnemyProjectile=load('entities/EnemyProjectile','EnemyProjectile');modules['../entities/EnemyProjectile']={EnemyProjectile}
const WAVES=load('data/waves','WAVES');modules['../data/waves']={WAVES}
modules['../data/upgrades']={}
modules['../entities/Player']={Player:load('entities/Player','Player')}
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
 Object.assign(s,{enemyHealthBars:graphics(),state:'COMBAT',currentWave:1,nextGroupIndex:1,time:{now:500,delayedCall:(delay,cb)=>timers.push({delay,cb})},add:{existing(){}},physics:{add:{existing(){}}},enemies:{getChildren:()=>enemies,countActive:()=>enemies.filter(e=>e.active).length},projectiles:{add:p=>shots.push(p)}})
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
 for(const [type,hp,speed,texture] of [['basic',3,90,'enemy-basic'],['runner',1.5,160,'enemy-runner']]) {
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
   enemyHealthBars:graphics(),player:{x:400,y:300,startWave(){}},updatePlayerUI(){},
   add:{existing(){}},physics:{add:{existing(){}},world:{bounds:{left:0,right:800,top:0,bottom:600}}},
   enemies:{getChildren:()=>items,add:e=>items.push(e)},
   time:{now:0,delayedCall(){}},waveText:{setText(){return this},setVisible(){return this}},
  })
  s.startWave(wave)
  assert.equal(items.filter(e=>e.texture==='enemy-basic').length,wave===1?5:7)
  assert.equal(items.filter(e=>e.texture==='enemy-runner').length,0)
  assert.equal(items.filter(e=>e.texture==='enemy-shooter').length,0)
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
 s.updatePlayerUI=()=>ui++;s.stopCombat=()=>stopped++;s.showPlayAgain=()=>{}
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
  enemyHealthBars:graphics(),add:{existing(){},text,graphics},physics:{add:{existing(){}},world:{bounds:{left:0,right:800,top:0,bottom:600}}},
  input:{keyboard:{createCursorKeys:()=>({}),addKeys:()=>({})}},
  time:{now:0,delayedCall:(delay,cb)=>timers.push({at:s.time.now+delay,cb})},
  enemies:{getChildren:()=>items,clear(){items.forEach(e=>e.destroy());items.length=0},add:e=>{e.updateBehavior=()=>{};items.push(e)},countActive:()=>items.filter(e=>e.active).length},
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
test('full six-wave flow: six choices, correct rarity wave, cleanup, shield recharge, no revive reset, boss start',()=>{
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
 assert.equal(f.s.state,'COMBAT');assert.equal(f.s.currentWave,7)
 assert.equal(f.s.player.isShieldReady(),true);assert.equal(f.s.player.isReviveReady(),false)
 assert.equal(f.items.length,1);assert.ok(f.items[0] instanceof Boss);assert.equal(f.items[0].health,40)
})
test('Game Over prevents pending groups and any later transition',()=>{
 const f=waveFixture();f.s.startWave(6);f.killTo(2);f.s.damagePlayer(100)
 assert.equal(f.s.state,'GAME_OVER');f.s.update(1000)
 while(f.timers.length)f.tick()
 assert.equal(f.items.length,8);assert.equal(f.s.nextGroupIndex,1)
 assert.equal(f.s.state,'GAME_OVER');assert.equal(f.cards.length,1);assert.equal(f.upgradeWaves.length,0)
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

test('Boss normal speed, fixed charge vector, duration and special recovery',()=>{
 const s=scene(),boss=new Boss(s,100,100);let shots=0
 assert.equal(boss.health,40);assert.equal(boss.contactDamage,2)
 boss.updateBehavior(200,100,()=>shots++);assert.equal(boss.velocity.x,75)
 const random=phaser.Math.Between;phaser.Math.Between=()=>0
 try {
  s.time.now=4000;boss.updateBehavior(200,100,()=>shots++);assert.equal(boss.velocity.x,230)
  s.time.now=4500;boss.updateBehavior(100,200,()=>shots++);assert.equal(boss.velocity.x,230);assert.equal(boss.velocity.y,0)
  s.time.now=5200;boss.updateBehavior(100,200,()=>shots++);assert.equal(boss.phase,'NORMAL');assert.equal(boss.velocity.y,75)
  assert.equal(boss.nextSpecial,9200);assert.equal(shots,0)
 } finally {phaser.Math.Between=random}
})
test('Boss shoot fires at 0/200/400 with fresh aim, no fire after death and shared burn',()=>{
 const s=scene(),boss=new Boss(s,100,100),shots=[]
 const random=phaser.Math.Between;phaser.Math.Between=()=>1
 try {
  for(const [now,x,y] of [[4000,200,100],[4199,100,200],[4200,100,200],[4400,0,100]]) {
   s.time.now=now;boss.updateBehavior(x,y,()=>shots.push(new EnemyProjectile(s,boss.x,boss.y,x,y)))
  }
  assert.equal(shots.length,3);assert.equal(shots[0].velocity.x,250);assert.equal(shots[1].velocity.y,250);assert.equal(shots[2].velocity.x,-250)
  assert.equal(boss.phase,'NORMAL');assert.equal(boss.nextSpecial,8400)
  boss.applyBurn();boss.updateBurn(4900);assert.equal(boss.health,39.75)
  boss.takeDamage(40);assert.equal(boss.burnTicksRemaining,0)
  s.time.now=10000;boss.updateBehavior(0,0,()=>shots.push(null));assert.equal(shots.length,3)
 } finally {phaser.Math.Between=random}
})
test('boss spawn, victory cleanup, no upgrade and PLAY AGAIN requests scene restart once',()=>{
 const f=waveFixture();f.s.startWave(7)
 const boss=f.items[0]
 assert.ok(Math.hypot(boss.x-f.s.player.x,boss.y-f.s.player.y)>=400)
 assert.ok(boss.x>=40&&boss.x<=760&&boss.y>=40&&boss.y<=560)
 boss.takeDamage(40);f.s.update(0)
 assert.equal(f.s.state,'VICTORY');assert.equal(f.s.projectiles.cleared,true);assert.equal(f.s.enemyProjectiles.cleared,true)
 assert.equal(f.s.waveText.value,'VICTORY')
 while(f.timers.length)f.tick()
 assert.equal(f.upgradeWaves.length,0)
 let restarts=0;f.s.scene={restart:()=>restarts++}
 f.cards.at(-1).click();f.cards.at(-1).click();assert.equal(restarts,1);assert.equal(f.s.state,'START')
})

test('create after restart resets run fields and creates a fresh Player and empty groups',()=>{
 const f=waveFixture(),s=f.s
 s.player.applyUpgrade('power-trio');s.player.applyUpgrade('revive');s.player.applyUpgrade('energy-shield')
 const oldPlayer=s.player;s.currentWave=7;s.nextGroupIndex=3;s.lastShotTime=9000;s.state='VICTORY'
 s.cameras={main:{setBackgroundColor(){}}}
 s.physics.world.setBounds=()=>{};s.physics.add.overlap=()=>{}
 const textures=new Set();s.textures={exists:key=>textures.has(key),get:()=>({has:()=>true})}
 s.make={graphics:()=>({fillStyle(){},fillRect(){},fillCircle(){},generateTexture(key){assert.equal(textures.has(key),false);textures.add(key)},destroy(){}})}
 s.add.group=()=>({getChildren:()=>[],countActive:()=>0})
 for(let i=0;i<2;i++) {
  s.create()
  assert.notEqual(s.player,oldPlayer);assert.equal(s.state,'START');assert.equal(s.currentWave,1);assert.equal(s.nextGroupIndex,0);assert.equal(s.lastShotTime,0)
  assert.equal(s.player.getHealth(),5);assert.equal(s.player.getMaxHealth(),5);assert.equal(s.player.getSelectedUpgradeIds().length,0)
  assert.equal(s.player.getDamage(),1);assert.equal(s.player.getAttackCooldown(),500);assert.equal(s.player.getMoveSpeed(),220)
  assert.equal(s.player.isReviveReady(),false);assert.equal(s.player.isShieldReady(),false)
  assert.equal(s.enemies.countActive(),0);assert.equal(s.enemyProjectiles.countActive(),0);assert.equal(s.projectiles.countActive(),0)
 }
})
test('boss contact blocks full 2 damage with Shield, revives once, then Game Over stops boss',()=>{
 const f=waveFixture();f.s.player.applyUpgrade('energy-shield');f.s.player.applyUpgrade('revive');f.s.startWave(7)
 f.s.damagePlayer(2);assert.equal(f.s.player.getHealth(),5);assert.equal(f.s.player.isShieldReady(),false)
 for(const time of [1000,2000,3000]){f.s.time.now=time;f.s.damagePlayer(2)}
 assert.equal(f.s.player.getHealth(),3);assert.equal(f.s.state,'COMBAT');assert.equal(f.s.player.isReviveReady(),false)
 f.s.damagePlayer(2);assert.equal(f.s.player.getHealth(),3)
 for(const time of [4000,5000]){f.s.time.now=time;f.s.damagePlayer(2)}
 assert.equal(f.s.state,'GAME_OVER');assert.equal(f.items[0].velocity.x,0)
 assert.equal(f.s.enemyProjectiles.cleared,true)
 f.s.update(10000);assert.equal(f.s.state,'GAME_OVER')
})

test('enemy damage flashes briefly and health bars follow fractional HP and disappear on death',()=>{
 const f=waveFixture(),e=new Enemy(f.s,120,140,'runner')
 e.displayHeight=44;f.items.push(e)
 e.takeDamage(0.25)
 assert.equal(e.getMaxHealth(),1.5);assert.equal(e.getHealth(),1.25);assert.equal(e.tinted,true)
 f.s.time.now=79;e.preUpdate(79,16);assert.equal(e.tinted,true)
 f.s.time.now=80;e.preUpdate(80,1);assert.equal(e.tinted,false)
 const rects=[]
 f.s.enemyHealthBars={clear(){rects.length=0},fillStyle(){},fillRect(...args){rects.push(args)}}
 f.s.drawEnemyHealthBars()
 assert.deepEqual(rects[1],[104,109,32*1.25/1.5,4])
 e.x=180;f.s.drawEnemyHealthBars();assert.equal(rects[1][0],164)
 e.takeDamage(2);f.s.drawEnemyHealthBars();assert.equal(rects.length,0)
 const boss=new Boss(f.s,400,100);f.items.push(boss);boss.takeDamage(20)
 f.s.drawEnemyHealthBars();assert.deepEqual(rects[1],[280,24,120,10])
})
test('preload requests the five PNG textures and reuses them on restart',()=>{
 const s=new GameScene(),loaded=[]
 s.textures={exists:()=>false};s.load={image:(...args)=>loaded.push(args)}
 s.preload()
 assert.deepEqual(loaded.map(a=>a[0]),['player','enemy-basic','enemy-runner','enemy-shooter','enemy-boss'])
 assert.ok(loaded.every(([key,path])=>path===`assets/characters/${key}.png`))
 s.textures.exists=()=>true;s.preload();assert.equal(loaded.length,5)
})

test('all enemy types spawn fully visible on each edge; boss fits all four corners',()=>{
 const {CHARACTERS}=modules['../visuals/characters']
 const inside=(enemy,key,bodySize)=>{
  const c=CHARACTERS[key],scale=c.size/Math.max(c.bounds[2],c.bounds[3])
  const halfWidth=c.bounds[2]*scale/2,halfHeight=c.bounds[3]*scale/2
  assert.ok(enemy.x-halfWidth>=0 && enemy.x+halfWidth<=800)
  assert.ok(enemy.y-halfHeight>=0 && enemy.y+halfHeight<=600)
  assert.ok(enemy.x-bodySize/2>=0 && enemy.x+bodySize/2<=800)
  assert.ok(enemy.y-bodySize/2>=0 && enemy.y+bodySize/2<=600)
 }
 const original=phaser.Math.Between
 try {
  for(const type of ['basic','runner','shooter'])for(const edge of [0,1,2,3]) {
   phaser.Math.Between=(min,max)=>min===0&&max===3?edge:min
   const f=waveFixture();f.s.spawnGroup([type])
   inside(f.items[0],`enemy-${type}`,40)
   assert.ok(Math.hypot(f.items[0].x-400,f.items[0].y-300)>=280)
   // Force failed random retries against the first spawn to exercise edge fallback.
   f.s.spawnGroup([type])
   inside(f.items[1],`enemy-${type}`,40)
   assert.ok(Math.hypot(f.items[0].x-f.items[1].x,f.items[0].y-f.items[1].y)>=60)
  }
 } finally {phaser.Math.Between=original}
 const corners=new Set()
 for(const [x,y] of [[100,100],[700,100],[100,500],[700,500]]) {
  const f=waveFixture();f.s.player.x=x;f.s.player.y=y;f.s.startWave(7)
  inside(f.items[0],'enemy-boss',80)
  corners.add(`${f.items[0].x},${f.items[0].y}`)
 }
 assert.equal(corners.size,4)
})

test('real Arcade postUpdate preserves initial and reinforcement spawns in W3-W5, random and fallback',()=>{
 const visual=modules['../visuals/characters'],oldConfigure=visual.configureCharacter,oldRandom=phaser.Math.Between
 const dimensions={'enemy-basic':[1305,1205],'enemy-runner':[1297,1212],'enemy-shooter':[1306,1205]}
 try {
  for(const wave of [3,4,5])for(const fallback of [false,true]) {
   visual.configureCharacter=oldConfigure
   const f=waveFixture(),bodies=[]
   visual.configureCharacter=load('visuals/characters','configureCharacter')
   f.s.physics.add.existing=sprite=>{
    const key=sprite.texture,[w,h]=dimensions[key]
    Object.assign(sprite,{texture:{key},width:w,height:h,scaleX:1,scaleY:1,angle:0,
     displayOriginX:w/2,displayOriginY:h/2,
     getCenter(){},
     setFrame(){const c=visual.CHARACTERS[key];this.width=c.bounds[2];this.height=c.bounds[3];this.displayOriginX=this.width/2;this.displayOriginY=this.height/2},
     setScale(n){this.scaleX=this.scaleY=n},
    })
    Object.defineProperties(sprite,{
     displayWidth:{get(){return this.width*this.scaleX}},
     displayHeight:{get(){return this.height*this.scaleY}},
    })
    sprite.body=new ArcadeBody({defaults:{},bounds:f.s.physics.world.bounds},sprite)
    bodies.push(sprite.body)
   }
   const check=(items)=>{
    for(const e of items) {
     assert.ok(e.x-e.displayWidth/2>=-1e-9 && e.x+e.displayWidth/2<=800+1e-9)
     assert.ok(e.y-e.displayHeight/2>=-1e-9 && e.y+e.displayHeight/2<=600+1e-9)
     assert.ok(Math.abs(e.body.width-40)<1e-9 && Math.abs(e.body.height-40)<1e-9)
     assert.ok(Math.hypot(e.x-f.s.player.x,e.y-f.s.player.y)>=280-1e-9)
    }
   }
   f.s.startWave(wave)
   // Group 1 exists before the next physics preUpdate.
   bodies.forEach(b=>{b.preUpdate(false,1/60);b.postUpdate()})
   check(f.items)
   for(const group of WAVES[wave].groups.slice(1)) {
    f.killTo(group.spawnAtAlive)
    bodies.filter(b=>b.gameObject.active).forEach(b=>b.preUpdate(false,1/60))
    const before=f.items.length
    if(fallback) {
     // Force all random candidates to the player's corner; safe edge search must recover.
     f.s.player.x=25;f.s.player.y=25
     phaser.Math.Between=(min,max)=>min
    }
    f.s.update(0)
    phaser.Math.Between=oldRandom
    const added=f.items.slice(before),positions=added.map(e=>[e.x,e.y])
    assert.equal(added.length,Object.values(group.enemies).reduce((a,b)=>a+b,0))
    check(added)
    // New bodies skipped preUpdate this frame, just as in the running game.
    bodies.filter(b=>b.gameObject.active).forEach(b=>b.postUpdate())
    check(added)
    added.forEach((e,i)=>{assert.equal(e.x,positions[i][0]);assert.equal(e.y,positions[i][1])})
    f.s.update(0);assert.equal(f.items.length,before+added.length)
    f.s.player.x=400;f.s.player.y=300
   }
  }
 } finally {visual.configureCharacter=oldConfigure;phaser.Math.Between=oldRandom}
})
test('crowded edge fallback relaxes enemy separation, never arena bounds or player distance',()=>{
 const f=waveFixture(),original=phaser.Math.Between
 for(let x=0;x<=800;x+=40)for(let y=0;y<=600;y+=40) f.items.push(new Enemy(f.s,x,y))
 try {
  phaser.Math.Between=min=>min
  const before=f.items.length
  f.s.spawnGroup(['shooter'])
  assert.equal(f.items.length,before+1)
  const e=f.items.at(-1)
  assert.ok(e.x>=27&&e.x<=773&&e.y>=25&&e.y<=575)
  assert.ok(Math.hypot(e.x-400,e.y-300)>=280)
 } finally {phaser.Math.Between=original}
})
