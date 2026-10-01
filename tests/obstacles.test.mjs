import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { PLAYABLE_BOUNDS } from '../src/game/environment/ArenaBounds.ts'
import { ARENA_OBSTACLES, OBSTACLE_BOUNDS, createObstacles, isSpawnClear } from '../src/game/environment/ArenaObstacles.ts'
const require = createRequire(import.meta.url)
const World = require('../node_modules/phaser/src/physics/arcade/World.js')
const Body = require('../node_modules/phaser/src/physics/arcade/Body.js')
const StaticBody = require('../node_modules/phaser/src/physics/arcade/StaticBody.js')

function sprite(x,y,width,height) {
 return {x,y,width,height,displayWidth:width,displayHeight:height,
  scaleX:1,scaleY:1,originX:0.5,originY:0.5,displayOriginX:width/2,displayOriginY:height/2,angle:0,active:true,
  getTopLeft(p){p.set(this.x-this.width/2,this.y-this.height/2);return p},
  setPosition(x,y){this.x=x;this.y=y;return this},
  setVisible(){return this},
 }
}
function fixture() {
 const world=new World({sys:{scale:{width:800,height:600}}},{})
 const shapes=[]
 createObstacles({
  add:{rectangle:(...args)=>sprite(...args)},
  physics:{add:{
   staticGroup:()=>({add:s=>shapes.push(s)}),
   existing:s=>{s.body=new StaticBody(world,s);world.add(s.body)},
  }},
 })
 return {world,shapes}
}
test('static colliders fit solid prop footprints, leave the player and boss corner spawns clear',()=>{
 const {shapes}=fixture()
 assert.equal(shapes.length,3)
 shapes.forEach((s,i)=>{
  const visual=ARENA_OBSTACLES[i],b=s.body
  assert.ok(b.x>=PLAYABLE_BOUNDS.left&&b.y>=PLAYABLE_BOUNDS.top&&b.right<=PLAYABLE_BOUNDS.right&&b.bottom<=PLAYABLE_BOUNDS.bottom)
  assert.ok(b.x>=visual.x-visual.size/2&&b.right<=visual.x+visual.size/2)
  assert.ok(b.y>=visual.y-visual.size/3&&b.bottom<=visual.y+visual.size/3)
  assert.equal(isSpawnClear(visual.x,visual.y,20,20),false)
 })
 assert.equal(isSpawnClear(400,300,27,27),true)
 for(const x of [66,734])for(const y of [56,544])assert.equal(isSpawnClear(x,y,52,42),true)
})
test('Arcade actually blocks character bodies and a 230 px/s charge from every side',()=>{
 for(const size of [40,80])for(const side of ['left','right','top','bottom']) {
  const {world,shapes}=fixture(),o=shapes[0],b=o.body
  const x=side==='left'?b.x-size/2-15:side==='right'?b.right+size/2+15:o.x
  const y=side==='top'?b.y-size/2-15:side==='bottom'?b.bottom+size/2+15:o.y
  const actor=sprite(x,y,size,size);actor.body=new Body(world,actor)
  const vx=side==='left'?230:side==='right'?-230:0
  const vy=side==='top'?230:side==='bottom'?-230:0
  let hits=0
  for(let frame=0;frame<60;frame++){
   actor.body.setVelocity(vx,vy);actor.body.preUpdate(true,1/60)
   world.collide(actor,o,()=>hits++)
   actor.body.postUpdate()
   assert.ok(!world.intersects(actor.body,b))
  }
  assert.ok(hits>0)
 }
})

test('avoidance waypoints near each wall fit both body and visual clearance',async()=>{
 const {findLocalDetour}=await import('../src/game/environment/ArenaObstacles.ts')
 const {PLAYABLE_BOUNDS:b,isInsidePlayable}=await import('../src/game/environment/ArenaBounds.ts')
 let detours=0
 for(const half of [20,40]) {
  const clearance={x:half===40?52:27,y:half===40?42:27}
  const starts=[{x:b.left+clearance.x,y:143},{x:b.right-clearance.x,y:174},
   {x:270,y:b.top+clearance.y},{x:130,y:b.bottom-clearance.y}]
  for(const start of starts)for(const obstacle of ARENA_OBSTACLES){
   const d=findLocalDetour(start,{x:obstacle.x-start.x,y:obstacle.y-start.y},half,obstacle,clearance)
   if(d){detours++;assert.equal(isInsidePlayable(d.x,d.y,clearance.x,clearance.y),true)}
  }
 }
 assert.ok(detours>0)
})
