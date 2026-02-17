import MenuScene from "./js/scenes/MenuScene.js";
import OptionsScene from "./js/scenes/OptionsScene.js";
import GameScene from "./js/scenes/GameScene.js";

// Configuration de phaser
const config = {
  width: 1280,
  height: 720, 
  type: Phaser.AUTO,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    parent: 'game-container',
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade", 
    arcade: {
      gravity: {
        y: 300 
      },
      debug: false
    }
  },
  scene: [MenuScene, OptionsScene, GameScene],
  baseURL: window.location.pathname.replace(/\/[^/]*$/, '')};

// Lancement du jeu
new Phaser.Game(config);