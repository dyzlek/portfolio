import { createButton, createTextButton } from '../utils/functions.js';

export default class OptionsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'OptionsScene' });
  }

  // Chargement des assets
  preload() {
    this.load.image('background', 'assets/background.jpg');
    this.load.image('titre', 'assets/titre.png');
    this.load.image('retour', 'assets/retour.png');
  }

  // Initialisation de la scène
  create() {
    const currentVolume = this.game.sound.volume * 100;
    
    this.setupBackground();
    this.createVolumeDisplay(currentVolume);
    this.createVolumeBar(currentVolume);
    this.createVolumeSlider(currentVolume);
    this.createVolumeButtons();
    this.createBackButton();
  }

  // Fond et titre
  setupBackground() {
    this.add.image(640, 360, 'background');
    this.add.image(640, 200, 'titre');
  }

  // Affichage du pourcentage de volume
  createVolumeDisplay(currentVolume) {
    this.volumeText = this.add.text(640, 350, Math.round(currentVolume) + '%', {
      fontSize: '32px',
      fill: '#3498db',
      fontFamily: 'Arial Black',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  // Barre de volume
  createVolumeBar(currentVolume) {
    // Conteneur gris foncé de la barre
    this.add.rectangle(640, 420, 460, 50, 0x1a252f, 0.8).setOrigin(0.5);
    
    // Fond de la barre (gris clair)
    this.volumeBarBg = this.add.rectangle(410, 420, 440, 30, 0x7f8c8d, 0.3).setOrigin(0, 0.5);
    
    // Barre de progression (couleur selon volume)
    this.volumeBar = this.add.rectangle(410, 420, currentVolume * 4.4, 30, 0x3498db).setOrigin(0, 0.5);
  }

  // curseur de volume
  createVolumeSlider(currentVolume) {
    const sliderX = 410 + currentVolume * 4.4;
    
    // Bordure du curseur (cercle noir)
    this.volumeSliderBorder = this.add.circle(sliderX, 420, 20, 0x2c3e50);
    
    // Curseur principal (cercle blanc)
    this.volumeSlider = this.add.circle(sliderX, 420, 18, 0xecf0f1).setInteractive();
    this.volumeSliderBorder.setDepth(this.volumeSlider.depth - 1);
    
    this.setupSliderDrag();
    this.setupSliderHover();
  }

  setupSliderDrag() {
    this.input.setDraggable(this.volumeSlider);
    
    // Quand on drag le curseur : mise à jour du volume
    this.input.on('drag', (pointer, gameObject, dragX) => {
      // Limiter le curseur entre 410 (0%) et 850 (100%)
      let newX = Phaser.Math.Clamp(dragX, 410, 850);
      gameObject.x = newX;
      this.volumeSliderBorder.x = newX;
      
      // Calculer le volume en % : position / largeur * 100
      let volume = (newX - 410) / 440 * 100;
      this.game.sound.volume = volume / 100;
      this.updateVolumeDisplay(volume);
    });
  }

  setupSliderHover() {
    // Effet de survol : agrandir le curseur
    this.volumeSlider.on('pointerover', () => {
      this.volumeSlider.setScale(1.2);
      this.volumeSliderBorder.setScale(1.2);
    });
    
    this.volumeSlider.on('pointerout', () => {
      this.volumeSlider.setScale(1);
      this.volumeSliderBorder.setScale(1);
    });
  }

  // Boutons + et -
  createVolumeButtons() {
    // Bouton - (diminue de 10%)
    createTextButton(this, 340, 420, '−', 0xe74c3c, () => {
      let newVolume = Math.max(0, this.game.sound.volume - 0.1);
      this.game.sound.volume = newVolume;
      this.updateVolumeDisplay(newVolume * 100);
    });
    
    // Bouton + (augmente de 10%)
    createTextButton(this, 940, 420, '+', 0x27ae60, () => {
      let newVolume = Math.min(1, this.game.sound.volume + 0.1);
      this.game.sound.volume = newVolume;
      this.updateVolumeDisplay(newVolume * 100);
    });
  }

  // bouton retour au menu
  createBackButton() {
    createButton(this, 640, 540, 'retour', () => {
      this.scene.start('MenuScene');
    });
  }

  // mise à jour de l'affichage du volume
  updateVolumeDisplay(volume) {
    // Met à jour le texte du pourcentage
    this.volumeText.setText(Math.round(volume) + '%');
    
    // Met à jour la largeur de la barre
    let newWidth = volume * 4.4;
    this.volumeBar.width = newWidth;
    
    // Déplace le curseur à la bonne position
    let newX = 410 + newWidth;
    this.volumeSlider.x = newX;
    this.volumeSliderBorder.x = newX;
    
    // Change la couleur selon le volume (rouge → orange → vert)
    if (volume < 30) {
      this.volumeBar.setFillStyle(0xe74c3c); // Rouge
    } else if (volume < 70) {
      this.volumeBar.setFillStyle(0xf39c12); // Orange
    } else {
      this.volumeBar.setFillStyle(0x27ae60); // Vert
    }
  }
}