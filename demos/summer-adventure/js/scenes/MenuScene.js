import { createButton } from '../utils/functions.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  // chargement des assets
  preload() {
    this.load.image('background', 'assets/background.jpg');
    this.load.image('titre', 'assets/titre.png');
    this.load.image('play', 'assets/play.png');
    this.load.image('option', 'assets/option.png');
  }

  // initialisation de la scène
  create() {
    this.setupBackground();
    this.createButtons();
  }

  setupBackground() {
    // Fond d'écran
    this.add.image(640, 360, 'background');
    
    // Logo du jeu
    this.add.image(640, 200, 'titre');
  }

  createButtons() {
    // Bouton Play → Lance le jeu
    createButton(this, 640, 400, 'play', () => {
      this.scene.start('GameScene');
    });

    // Bouton Options → Ouvre les options
    createButton(this, 640, 520, 'option', () => {
      this.scene.start('OptionsScene');
    });
  }
}