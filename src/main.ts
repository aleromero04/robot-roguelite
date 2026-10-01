import Phaser from 'phaser'
import './style.css'
import { ARENA_WIDTH, ARENA_HEIGHT } from './game/environment/ArenaBounds.ts'
import { GameScene } from './game/scenes/GameScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  parent: 'app',

  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },

  scene: [GameScene],
}

new Phaser.Game(config)