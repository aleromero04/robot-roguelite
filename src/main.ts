import Phaser from 'phaser'
import './style.css'
import { GameScene } from './game/scenes/GameScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
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