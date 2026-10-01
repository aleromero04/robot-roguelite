import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'
import * as bounds from '../src/game/environment/ArenaBounds.ts'
const require = createRequire(import.meta.url)
const Rectangle = require('../node_modules/phaser/src/geom/rectangle/Rectangle.js')
const context = {exports:{},require:id=>id==='phaser'?{Geom:{Rectangle}}:bounds}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/game/visuals/characters.ts','utf8'),
 {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context)
const { CHARACTERS, configureCharacter } = context.exports

test('character frames fit original PNGs, preserve aspect and keep original world hitboxes', () => {
  const dimensions = { player: [1265,1244], 'enemy-basic': [1305,1205],
    'enemy-runner': [1297,1212], 'enemy-shooter': [1306,1205], 'enemy-boss': [1374,1145] }
  for (const [key, config] of Object.entries(CHARACTERS)) {
    const [x,y,w,h] = config.bounds
    assert.ok(x >= 0 && y >= 0 && x+w <= dimensions[key][0] && y+h <= dimensions[key][1])
    let bodySize, synced = false
    const sprite = {
      texture: { key }, width: w, height: h,
      setFrame(frame) { assert.equal(frame, 'character') },
      setScale(scale) { this.scaleX = this.scaleY = scale },
      body: {
        setBoundsRectangle() {}, setCollideWorldBounds() {},
        prev: { copy() {} }, prevFrame: { copy() {} },
        setSize(...args) { bodySize = args },
        updateFromGameObject() { synced = true },
      },
    }
    const hitbox = key === 'enemy-boss' ? 80 : 40
    configureCharacter(sprite, hitbox)
    assert.equal(sprite.scaleX, sprite.scaleY)
    assert.ok(Math.abs(Math.max(w,h)*sprite.scaleX-config.size) < 1e-9)
    assert.ok(Math.abs(bodySize[0]*sprite.scaleX-hitbox) < 1e-9)
    assert.ok(Math.abs(bodySize[1]*sprite.scaleY-hitbox) < 1e-9)
    assert.equal(bodySize[2], true)
    assert.equal(synced, true)
  }
})

test('real Arcade keeps every character body AND scaled visual frame inside all four walls',()=>{
 const World=require('../node_modules/phaser/src/physics/arcade/World.js')
 const Body=require('../node_modules/phaser/src/physics/arcade/Body.js')
 const b=bounds.PLAYABLE_BOUNDS
 for(const [key,c] of Object.entries(CHARACTERS))for(const [vx,vy] of [[230,0],[-230,0],[0,230],[0,-230]]) {
  const world=new World({sys:{scale:{width:800,height:600}}},{x:b.left,y:b.top,width:b.right-b.left,height:b.bottom-b.top})
  const w=c.bounds[2],h=c.bounds[3],size=key==='enemy-boss'?80:40
  const s={x:400,y:300,width:w,height:h,angle:0,scaleX:1,scaleY:1,displayOriginX:w/2,displayOriginY:h/2,
   texture:{key},getCenter(){},setFrame(){},setScale(n){this.scaleX=this.scaleY=n},
   get displayWidth(){return this.width*this.scaleX},get displayHeight(){return this.height*this.scaleY},
  }
  s.body=new Body(world,s)
  configureCharacter(s,size)
  assert.equal(s.body.collideWorldBounds,true)
  for(let frame=0;frame<180;frame++){
   s.body.setVelocity(vx,vy);s.body.preUpdate(true,1/60);s.body.postUpdate()
   assert.ok(s.body.x>=b.left-1e-8&&s.body.right<=b.right+1e-8)
   assert.ok(s.body.y>=b.top-1e-8&&s.body.bottom<=b.bottom+1e-8)
   assert.ok(s.x-s.displayWidth/2>=b.left-1e-8&&s.x+s.displayWidth/2<=b.right+1e-8)
   assert.ok(s.y-s.displayHeight/2>=b.top-1e-8&&s.y+s.displayHeight/2<=b.bottom+1e-8)
  }
  assert.ok(Math.abs(s.body.width-size)<1e-8&&Math.abs(s.body.height-size)<1e-8)
 }
})
