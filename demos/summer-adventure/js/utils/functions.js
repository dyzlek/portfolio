// ==================== FONCTIONS UTILITAIRES ====================

// Crée un bouton image interactif avec effet hover
export function createButton(scene, x, y, texture, callback) {
  const btn = scene.add.image(x, y, texture).setInteractive();
  
  // Agrandir au survol
  btn.on('pointerover', () => {
    btn.setScale(1.1);
  });
  
  // Taille normale en sortant
  btn.on('pointerout', () => {
    btn.setScale(1);
  });
  
  // Exécuter l'action au clic
  btn.on('pointerdown', callback);
  
  return btn;
}

// Crée un bouton rond avec texte (ex: + ou -)
export function createTextButton(scene, x, y, text, color, callback) {
  // Cercle de fond
  const bg = scene.add.circle(x, y, 30, color);
  
  // Texte centré
  const txt = scene.add.text(x, y, text, {
    fontSize: '48px',
    fill: '#ffffff',
    fontFamily: 'Arial Black'
  }).setOrigin(0.5).setInteractive();

  // Effets hover : agrandir les deux éléments
  txt.on('pointerover', () => {
    txt.setScale(1.15);
    bg.setScale(1.15);
  });

  txt.on('pointerout', () => {
    txt.setScale(1);
    bg.setScale(1);
  });

  txt.on('pointerdown', callback);

  return { bg, txt };
}

// Gère la mort du joueur avec animation
export function handlePlayerDeath(scene, player, tintColor = 0xff0000) {
  if (scene.isDead) return; // Évite de mourir plusieurs fois
  scene.isDead = true;
  
  // Arrêter le joueur
  player.setVelocity(0, 0);
  player.body.setEnable(false);
  player.setTint(tintColor); // Colorer en rouge (ou autre)
  player.anims.play("jump");
  
  // Arrêter la musique
  if (scene.musicGame) {
    scene.musicGame.stop();
  }
  
  // Fondu et restart après 700ms
  scene.time.delayedCall(400, () => {
    scene.tweens.add({
      targets: player,
      alpha: 0,
      duration: 300,
      onComplete: () => scene.scene.restart()
    });
  });
}

// Crée toutes les animations du joueur 1
export function createPlayerAnimations(scene) {
  // Animation idle de base
  scene.anims.create({ 
    key: "idle", 
    frames: scene.anims.generateFrameNumbers("idle", { start: 0, end: 4 }), 
    frameRate: 8, 
    repeat: -1 
  });
  
  // Animations idle variantes (après 10s d'inactivité)
  scene.anims.create({ 
    key: "idle1", 
    frames: scene.anims.generateFrameNumbers("idle1", { start: 0, end: 7 }), 
    frameRate: 8, 
    repeat: 0 
  });
  
  scene.anims.create({ 
    key: "idle2", 
    frames: scene.anims.generateFrameNumbers("idle2", { start: 0, end: 4 }), 
    frameRate: 8, 
    repeat: 0 
  });
  
  scene.anims.create({ 
    key: "idle3", 
    frames: scene.anims.generateFrameNumbers("idle3", { start: 0, end: 2 }), 
    frameRate: 8, 
    repeat: 0 
  });
  
  // Animation de course
  scene.anims.create({ 
    key: "run", 
    frames: scene.anims.generateFrameNumbers("run", { start: 0, end: 5 }), 
    frameRate: 10, 
    repeat: -1 
  });
  
  // Animation de saut (frame fixe)
  scene.anims.create({ 
    key: "jump", 
    frames: [{ key: "jump", frame: 0 }], 
    frameRate: 1, 
    repeat: -1 
  });
  
  // Animation de tir à l'arbalète
  scene.anims.create({ 
    key: "shoot", 
    frames: scene.anims.generateFrameNumbers("crossbow_shot", { start: 0, end: 3 }), 
    frameRate: 16, 
    repeat: 0 
  });
}

// Crée toutes les animations du joueur 2 (fée)
export function createPlayer2Animations(scene) {
  // Vol en mouvement
  scene.anims.create({
    key: "fly_forward",
    frames: scene.anims.generateFrameNumbers("fly_forward", { start: 0, end: 3 }),
    frameRate: 8,
    repeat: -1
  });

  // Idle au sol
  scene.anims.create({
    key: "idle_ground",
    frames: scene.anims.generateFrameNumbers("idle_ground", { start: 0, end: 1 }),
    frameRate: 4,
    repeat: -1
  });

  // Idle en vol
  scene.anims.create({
    key: "idle_flying",
    frames: scene.anims.generateFrameNumbers("idle_flying", { start: 0, end: 3 }),
    frameRate: 6,
    repeat: -1
  });
}

// Crée l'écran de victoire avec bouton de retour
export function createWinScreen(scene) {
  // Fond noir semi-transparent
  const winScreen = scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.85)
    .setScrollFactor(0)
    .setDepth(100)
    .setVisible(false);
  
  // Texte "VICTOIRE !"
  const winText = scene.add.text(640, 250, 'VICTOIRE !', {
    fontSize: '72px',
    fill: '#FFD700', // Or
    fontFamily: 'Arial Black',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 8
  }).setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(101)
    .setVisible(false);

  // Bouton "Retour au Menu"
  const winButton = scene.add.rectangle(640, 400, 300, 80, 0x27ae60)
    .setScrollFactor(0)
    .setDepth(101)
    .setVisible(false)
    .setInteractive();
  
  const winButtonText = scene.add.text(640, 400, 'Retour au Menu', {
    fontSize: '32px',
    fill: '#ffffff',
    fontFamily: 'Arial Black'
  }).setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(102)
    .setVisible(false);

  // Effets hover du bouton
  winButton.on('pointerover', () => {
    winButton.setFillStyle(0x2ecc71); // Vert plus clair
    winButton.setScale(1.05);
    winButtonText.setScale(1.05);
  });

  winButton.on('pointerout', () => {
    winButton.setFillStyle(0x27ae60); // Vert normal
    winButton.setScale(1);
    winButtonText.setScale(1);
  });

  // Action au clic : retour au menu
  winButton.on('pointerdown', () => {
    if (scene.musicGame) scene.musicGame.stop();
    scene.scene.start('MenuScene');
  });

  return { winScreen, winText, winButton, winButtonText };
}