import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'
import * as upgrades from '../src/game/data/upgrades.ts'
import { configureProjectile } from '../src/game/visuals/projectiles.ts'
const require = createRequire(import.meta.url)
function load(file, modules={}) {
 const context={exports:{},require:id=>modules[id]}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 }).outputText,context)
 return context.exports
}
const icons=load('src/game/ui/UpgradeIconFactory.ts',{'../data/upgrades.ts':upgrades})
const rarity=load('src/game/ui/RarityStyles.ts')
const feedback=load('src/game/ui/HealthFeedback.ts')
const {CombatHUD,acquiredUpgrades}=load('src/game/ui/CombatHUD.ts',{'../data/upgrades.ts':upgrades,'./UpgradeIconFactory':icons,'./RarityStyles':rarity,'./HealthFeedback':feedback})
function fixture() {
 const objects=[]
 const make=(kind,x,y,text)=>{
  const o={kind,x,y,text,visible:true,children:[],rects:[],
   setScale(value){this.scale=value;return this},setDepth(){return this},setOrigin(){return this},setVisible(v){this.visible=v;return this},
   setText(v){this.text=v;return this},add(items){this.children.push(...(Array.isArray(items)?items:[items]));return this},
   removeAll(){this.children=[]},clear(){this.rects=[];return this},fillRect(...args){this.rects.push(args);return this},
  }
  for(const key of ['fillStyle','fillRoundedRect','lineStyle','strokeRoundedRect','strokeRect','beginPath','moveTo','lineTo','strokePath','strokeCircle','arc'])o[key]=()=>o
  objects.push(o);return o
 }
 const scene={time:{now:0},textures:{get:()=>({has:()=>true})},scale:{width:800,height:600},add:{image:(x,y,key,frame)=>make('image',x,y,key),container:(x,y)=>make('container',x,y),graphics:()=>make('graphics'),text:(x,y,t)=>make('text',x,y,t)}}
 return {scene,objects}
}
test('HUD shows real fractional HP, max HP, wave and Boss fraction; hides cleanly outside combat',()=>{
 const f=fixture(),hud=new CombatHUD(f.scene)
 const p={getHealth:()=>3.5,getMaxHealth:()=>6,getSelectedUpgradeIds:()=>[]}
 assert.equal(f.objects[0].visible,false)
 hud.setVisible(true);hud.update(p,7,{getHealth:()=>12.5,getMaxHealth:()=>40})
 assert.equal(hud.hp.text,'3.5/6');assert.equal(hud.wave.text,'WAVE 7 / 7')
 assert.equal(hud.bossLabel.visible,true)
 assert.ok(hud.bars.rects.some(r=>r[2]===260*12.5/40))
 hud.update(p,1);assert.equal(hud.bossLabel.visible,false)
 hud.setVisible(false);assert.equal(f.objects[0].visible,false)
})
test('acquired icons use catalogue rarity, repeatable stacks, exclude instant Repair and avoid duplicate unique icons',()=>{
 const items=acquiredUpgrades(['power-core','power-core','turbo','repair','energy-shield','energy-shield'])
 assert.deepEqual(Array.from(items, i=>[i.upgrade.id,i.count]),[['power-core',2],['turbo',1],['energy-shield',1]])
 for(const item of items)assert.equal(item.upgrade,upgrades.UPGRADES.find(u=>u.id===item.upgrade.id))
 const f=fixture(),hud=new CombatHUD(f.scene)
 const p={getHealth:()=>5,getMaxHealth:()=>5,getSelectedUpgradeIds:()=>['power-core','power-core','turbo']}
 hud.update(p,2);const count=f.objects.length
 assert.equal(hud.icons.children.filter(o=>o.kind==='text')[0].text,'×2')
 hud.update(p,2);assert.equal(f.objects.length,count) // No recreation per frame.
 for(const upgrade of upgrades.UPGRADES)icons.createUpgradeIcon(f.scene,upgrade,0,0,28)
})
test('24x12 laser visuals retain centered 10/12 pixel Arcade hitboxes at every rotation and do not shift on first postUpdate',()=>{
 const World=require('../node_modules/phaser/src/physics/arcade/World.js')
 const Body=require('../node_modules/phaser/src/physics/arcade/Body.js')
 for(const size of [10,12])for(const angle of [0,45,90,180,270]) {
  const world=new World({sys:{scale:{width:800,height:600}}},{})
  const s={x:400,y:300,width:24,height:12,angle,scaleX:1,scaleY:1,displayOriginX:12,displayOriginY:6,getCenter(){}}
  s.body=new Body(world,s);configureProjectile(s,size);s.body.postUpdate()
  assert.equal(s.x,400);assert.equal(s.y,300)
  assert.equal(s.body.width,size);assert.equal(s.body.height,size)
  assert.equal(s.body.center.x,400);assert.equal(s.body.center.y,300)
 }
})

test('all 14 metadata entries point to real RGBA PNGs and valid content frames; preload skips loaded assets',()=>{
 const loaded=new Set(),requests=[]
 const scene={textures:{exists:key=>loaded.has(key)},load:{image(key,path){requests.push([key,path]);loaded.add(key)}}}
 icons.preloadUpgradeIcons(scene);icons.preloadUpgradeIcons(scene)
 assert.equal(requests.length,14);assert.equal(new Set(requests.map(r=>r[0])).size,14)
 for(const u of upgrades.UPGRADES){
  const png=fs.readFileSync(`public/${u.assetPath}`)
  const w=png.readUInt32BE(16),h=png.readUInt32BE(20)
  assert.equal(png[25],6) // RGBA PNG
  const [x,y,fw,fh]=u.iconBounds
  assert.ok(x>=0&&y>=0&&x+fw<=w&&y+fh<=h)
  const f=fixture();const icon=icons.createUpgradeIcon(f.scene,u,0,0,112)
  assert.equal(icon.text,u.iconKey);assert.equal(icon.scale,112/Math.max(fw,fh))
 }
 assert.equal(upgrades.UPGRADES.find(u=>u.id==='reinforced-chassis').assetPath,'assets/skills/reinforced-chasis.png')
 assert.deepEqual(Object.keys(rarity.RARITY_COLORS),['COMMON','RARE','EPIC','LEGENDARY'])
 assert.equal(rarity.RARITY_COLORS.COMMON,0x64d98b)
})
test('HP feedback follows real losses/healing, ignores unchanged HP and expires after 200 ms',()=>{
 const state=new feedback.HealthFeedback()
 assert.equal(state.update(5,0),undefined)
 assert.equal(state.update(5,100),undefined) // Shield / rejected overlap.
 assert.equal(state.update(4,200),0xff6578)
 assert.equal(state.update(4,399),0xff6578)
 assert.equal(state.update(4,400),undefined)
 assert.equal(state.update(5,500),0x64d98b)
 assert.equal(state.update(5,700),undefined)
})
