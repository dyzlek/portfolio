import { 
  handlePlayerDeath, 
  createPlayerAnimations, 
  createPlayer2Animations, 
  createWinScreen 
} from '../utils/functions.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  // Chargement des assets
  preload() {
    this.loadPlayerAssets();
    this.loadPlayer2Assets();
    this.loadMapAssets();
    this.loadGameObjectAssets();
    this.loadAudioAssets();
  }

  // Chargement des assets du joueur 1
  loadPlayerAssets() {
    const frameSize = { frameWidth: 32, frameHeight: 32 };
    this.load.spritesheet("idle", "assets/Idle_1.png", frameSize);
    this.load.spritesheet("idle1", "assets/Idle_2.png", frameSize);
    this.load.spritesheet("idle2", "assets/Idle_3.png", frameSize);
    this.load.spritesheet("idle3", "assets/Idle_Blink.png", frameSize);
    this.load.spritesheet("run", "assets/Run.png", frameSize);
    this.load.spritesheet("jump", "assets/Jump.png", frameSize);
    this.load.spritesheet("crossbow_shot", "assets/Standing_Crossbow_Shot.png", frameSize);
  }

  // Chargement des assets du joueur 2 (fée)
  loadPlayer2Assets() {
    const frameSize = { frameWidth: 32, frameHeight: 32 };
    this.load.spritesheet("fly_forward", "assets/Flying_Forward_Movement.png", frameSize);
    this.load.spritesheet("idle_ground", "assets/Idle_Ground.png", frameSize);
    this.load.spritesheet("idle_flying", "assets/Idle_Flying.png", frameSize);
  }

  // Chargement des assets de la carte
  loadMapAssets() {
    this.load.tilemapTiledJSON("map1", "assets/map1.tmj");
    this.load.image("Terrain", "assets/Terrain.png");
    this.load.image("Grassland_entities", "assets/Grassland_entities.png");
    this.load.image("House", "assets/House.png");
    this.load.image("Water_frames", "assets/Water_frames.png");
    this.load.image("Sky_color", "assets/Sky_color.png");
    this.load.image("Cloud_cover_1", "assets/Cloud_cover_1.png");
    this.load.image("Cloud_cover_2", "assets/Cloud_cover_2.png");
  }

  // Chargement des assets des objets du jeu
  loadGameObjectAssets() {
    this.load.image("arrow", "assets/Arrow_Projectile.png");
    this.load.spritesheet("ballon", "assets/Ballooney_Flying.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("ballon_red", "assets/Ballooney_Flying_Red.png", { frameWidth: 32, frameHeight: 32 });
    this.load.image("platform1", "assets/platform_1.png");
    this.load.image("platform2", "assets/platform_2.png");
    this.load.image("platform3", "assets/platform_3.png");
    this.load.spritesheet("house_1", "assets/house_1.png", { frameWidth: 112, frameHeight: 96 });
    this.load.spritesheet("wrapped_candies", "assets/wrapped_candies.png", { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("circuit_running", "assets/circuit_running.png", { frameWidth: 32, frameHeight: 32 });
  }

  // Chargement des assets audio
  loadAudioAssets() {
    this.load.audio("music_game", "assets/audio/jeu_1.mp3");
    this.load.audio("sound_arrow", "assets/audio/arrow.mp3");
    this.load.audio("sound_jump", "assets/audio/jump.mp3");
    this.load.audio("sound_ballon_pop", "assets/audio/ballon_pop.mp3");
  }

  // initialisation de la scène
  create() {
    this.initGameState();
    this.setupBackground();
    this.setupMap();
    this.createGroups();
    this.createGameObjects();
    this.setupAnimations();
    this.createPlayers();
    this.setupUI();
    this.setupAudio();
    this.setupCollisions();
    this.setupControls();
    this.setupTextZones(); 
  }

  initGameState() {
    this.isShooting = false;
    this.lastMoveTime = 0;
    this.idlePlaying = false;
    this.isDead = false;
    this.hasWon = false;
    this.isNearDoor = false;
    this.movingPlatforms = [];
    this.currentTextZone = null; 
  }

  // Fond d'écran avec parallaxe
  setupBackground() {
    const zoom = 2.6;
    this.sky = this.add.tileSprite(0, 0, 800, 600, "Sky_color")
      .setOrigin(0, 0).setScrollFactor(0).setScale(zoom);
    this.cloud1 = this.add.tileSprite(0, 0, 800, 600, "Cloud_cover_1")
      .setOrigin(0, 0).setScrollFactor(0).setScale(zoom);
    this.cloud2 = this.add.tileSprite(0, 0, 800, 600, "Cloud_cover_2")
      .setOrigin(0, 0).setScrollFactor(0).setScale(zoom);
    this.add.rectangle(0, 400, 1280, 300, 0xffffff)
      .setOrigin(0, 0).setScrollFactor(0);
  }

  // configuration de la carte Tiled
  setupMap() {
    const map = this.add.tilemap("map1");
    
    const tilesetTerrain = map.addTilesetImage("Terrain", "Terrain");
    const tilesetEau = map.addTilesetImage("Water_frames", "Water_frames");
    const tilesetHouse = map.addTilesetImage("House", "House");
    const tilesetEntities = map.addTilesetImage("Grassland_entities", "Grassland_entities");

    this.calque_plateformes = map.createLayer("calque_platformes", tilesetTerrain).setDepth(1);
    map.createLayer("calque_backgrounds1", tilesetHouse).setDepth(2);
    map.createLayer("calque_backgrounds2", tilesetEntities).setDepth(3);
    this.calque_eau = map.createLayer("calque_eau", tilesetEau).setDepth(0);

    this.calque_plateformes.setCollisionByProperty({ estSolide: true });
    this.calque_eau.setCollisionByProperty({ estEau: true });
    
    this.spawnObjects = map.getObjectLayer("Calque_objets")?.objects || [];
  }

  // Groupes pour les objets du jeu
  createGroups() {
    this.projectiles = this.physics.add.group({ allowGravity: false });
    this.ballonsGroup = this.physics.add.group();
    this.redBallonsGroup = this.physics.add.group();
    this.platformsGroup = this.physics.add.staticGroup();
    this.candyGroup = this.physics.add.staticGroup();
    this.enemiesGroup = this.physics.add.group();
    this.doorZones = this.physics.add.staticGroup();
    this.textZonesGroup = this.physics.add.staticGroup(); // Nouveau : zones de texte
  }

  // Objets du jeu (ballons, maison, ennemis, bonbons, etc.)
  createGameObjects() {
    this.createBalloons();
    this.createHouse();
    this.createDoorZone();
    this.createEnemies();
    this.createCandies();
  }

  // Création des ballons
  createBalloons() {
    this.anims.create({
      key: "ballon_fly",
      frames: this.anims.generateFrameNumbers("ballon", { start: 0, end: 1 }),
      frameRate: 4,
      repeat: -1
    });

    this.anims.create({
      key: "ballon_red_fly",
      frames: this.anims.generateFrameNumbers("ballon_red", { start: 0, end: 1 }),
      frameRate: 4,
      repeat: -1
    });

    this.createStaticBalloons();
    this.createMovingBalloon();
    this.createRedBalloon();
  }

  // Ballons statiques (type 1)
  createStaticBalloons() {
    this.spawnObjects
      .filter(obj => obj.type === "spawn_ballon_1")
      .forEach(obj => {
        let ballon = this.ballonsGroup.create(obj.x, obj.y, "ballon");
        ballon.setDepth(5);
        ballon.body.allowGravity = false;
        ballon.setCollideWorldBounds(true);
        ballon.anims.play("ballon_fly");
        ballon.ballonType = 1;
      });
  }

  // Ballon mouvant (type 2)
  createMovingBalloon() {
    let spawnBallon2 = this.spawnObjects.find(obj => 
      obj.type === "spawn_ballon_2" || obj.name === "spawn_ballon_2"
    );
    
    if (spawnBallon2) {
      let ballon = this.ballonsGroup.create(spawnBallon2.x, spawnBallon2.y, "ballon");
      ballon.setDepth(5);
      ballon.body.allowGravity = false;
      ballon.setCollideWorldBounds(true);
      ballon.anims.play("ballon_fly");
      ballon.ballonType = 2;
      ballon.initialY = spawnBallon2.y;
      ballon.moveDown = true;
      ballon.moveSpeed = 80;
    }
  }

  // Ballon rouge (mortel)
  createRedBalloon() {
    let spawnBallonRed = this.spawnObjects.find(obj => 
      obj.type === "spawn_ballon_red" || obj.name === "spawn_ballon_red"
    );
    
    if (spawnBallonRed) {
      let ballon = this.redBallonsGroup.create(spawnBallonRed.x, spawnBallonRed.y, "ballon_red");
      ballon.setDepth(5);
      ballon.body.allowGravity = false;
      ballon.setCollideWorldBounds(true);
      ballon.anims.play("ballon_red_fly");
      ballon.initialX = spawnBallonRed.x;
      ballon.moveRight = true;
      ballon.moveSpeed = 60;
    }
  }

  // Maison (animation idle)
  createHouse() {
    this.anims.create({
      key: "house_idle",
      frames: this.anims.generateFrameNumbers("house_1", { start: 0, end: 2 }),
      frameRate: 3,
      repeat: -1
    });

    let housePoint = this.spawnObjects.find(obj => obj.name === "maison");
    if (housePoint) {
      this.house = this.add.sprite(housePoint.x, housePoint.y, "house_1").setOrigin(0, 0);
      this.house.setDepth(3);
      this.house.setFrame(0);
    }
  }

  // Zone de la porte (fin du niveau)
  createDoorZone() {
    let doorPoint = this.spawnObjects.find(obj => obj.name === "door_1");
    if (doorPoint) {
      let doorZone = this.doorZones.create(doorPoint.x, doorPoint.y, null).setOrigin(0.5, 0.5);
      doorZone.setSize(doorPoint.width || 40, doorPoint.height || 60);
      doorZone.setAlpha(0);
      doorZone.body.setSize(doorPoint.width || 40, doorPoint.height || 60);
    }
  }

  // Ennemis (circuit)
  createEnemies() {
    this.anims.create({
      key: "enemy_run",
      frames: this.anims.generateFrameNumbers("circuit_running", { start: 0, end: 2 }),
      frameRate: 8,
      repeat: -1
    });

    this.spawnObjects
      .filter(obj => obj.name === "circuit")
      .forEach(obj => {
        let enemy = this.enemiesGroup.create(obj.x, obj.y, "circuit_running");
        enemy.setDepth(5);
        enemy.body.allowGravity = true;
        enemy.setCollideWorldBounds(true);
        enemy.anims.play("enemy_run");
        enemy.direction = 1;
        enemy.speed = 60;
        enemy.setVelocityX(enemy.speed * enemy.direction);
      });
  }

  // Bonbons à collecter
  createCandies() {
    const candyConfig = [
      { name: "bonbon_2", frame: 0, id: 2, platform: "platform_2" },
      { name: "bonbon_3", frame: 1, id: 3, platform: "platform_3" },
      { name: "bonbon_4", frame: 2, id: 4, platform: "platform_4" },
      { name: "bonbon_5", frame: 0, id: 5, platform: "platform_5" },
      { name: "bonbon_6", frame: 1, id: 6, platform: "platform_6" },
      { name: "bonbon_8", frame: 2, id: 8, platform: "platform_8" },
      { name: "bonbon_9", frame: 0, id: 9, platform: "platform_9" },
      { name: "bonbon_10", frame: 1, id: 10, platform: "platform_10" },
      { name: "bonbon_11", frame: 2, id: 11, platform: "platform_11" }
    ];

    candyConfig.forEach(config => {
      let candyPoint = this.spawnObjects.find(obj => obj.name === config.name);
      let platformPoint = this.spawnObjects.find(obj => obj.name === config.platform);
      
      if (candyPoint) {
        let candy = this.candyGroup.create(candyPoint.x, candyPoint.y, "wrapped_candies", config.frame);
        candy.setDepth(5);
        candy.candyId = config.id;
        candy.platformPoint = platformPoint;
      }
    });
  }

  // Configuration des animations
  setupAnimations() {
    createPlayerAnimations(this);
    createPlayer2Animations(this);
  }

  // Création des joueurs
  createPlayers() {
    let spawnPlayer = this.spawnObjects.find(obj => obj.name === "spawn_player");
    
    this.player = this.physics.add.sprite(spawnPlayer.x, spawnPlayer.y, "idle");
    this.player.setBounce(0.1);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(4);

    this.player2 = this.physics.add.sprite(spawnPlayer.x + 50, spawnPlayer.y, "fly_forward");
    this.player2.setCollideWorldBounds(true);
    this.player2.setDepth(4);
    this.player2.body.allowGravity = false;
    this.player2.setFlipX(false);

    this.indicator = this.add.triangle(0, 0, 0, -6, -4, 4, 4, 4, 0xff6600, 0.9);
    this.indicator.setDepth(10);

    this.setupPlayerEvents();
    this.setupCamera();
  }

  // Événements du joueur (fin de tir, fin d'animation, etc.)
  setupPlayerEvents() {
    this.player.on('animationcomplete-shoot', () => {
      this.isShooting = false;
    });

    this.player.on('animationcomplete', (anim) => {
      if (["idle1", "idle2", "idle3"].includes(anim.key)) {
        this.player.anims.play("idle", true);
        this.idlePlaying = false;
        this.lastMoveTime = this.time.now;
      }
    });
  }

  // Configuration de la caméra
  setupCamera() {
    this.physics.world.setBounds(0, 0, 4800, 640);
    this.cameras.main.setBounds(0, 0, 4800, 640);
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setZoom(1.5);
  }

  // Interface utilisateur (écran de victoire)
  setupUI() {
    const win = createWinScreen(this);
    this.winScreen = win.winScreen;
    this.winText = win.winText;
    this.winButton = win.winButton;
    this.winButtonText = win.winButtonText;
  }

  // Audio
  setupAudio() {
    this.musicGame = this.sound.add("music_game", { loop: true, volume: 0.5 });
    this.soundArrow = this.sound.add("sound_arrow", { volume: 0.7 });
    this.soundJump = this.sound.add("sound_jump", { volume: 0.6 });
    this.soundBallonPop = this.sound.add("sound_ballon_pop", { volume: 0.8 });
    this.musicGame.play();
  }

  // Zones de texte (Tiled)
  setupTextZones() {
    // Chercher les zones P1 à P6 et leurs textes T1 à T6 dans Tiled
    ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].forEach(zoneName => {
      let zoneObj = this.spawnObjects.find(obj => obj.name === zoneName);
      let textName = zoneName.replace('P', 'T'); // P1 → T1, P2 → T2, etc.
      let textObj = this.spawnObjects.find(obj => obj.name === textName);
      
      if (zoneObj && textObj) {
        // Créer une zone invisible de détection
        let zone = this.textZonesGroup.create(zoneObj.x, zoneObj.y, null).setOrigin(0, 0);
        zone.setSize(zoneObj.width || 100, zoneObj.height || 100);
        zone.setAlpha(0);
        zone.body.setSize(zoneObj.width || 100, zoneObj.height || 100);
        zone.zoneName = zoneName;
        
        // Récupérer le texte de Tiled (propriété 'text' de l'objet texte)
        let textContent = textObj.text?.text || textObj.text || 'Texte non défini';
        
        // Créer le texte de Tiled (caché par défaut)
        let displayText = this.add.text(textObj.x, textObj.y, textContent, {
          fontSize: '12px',
          fill: '#ffffff',
          fontFamily: 'Arial',
          backgroundColor: '#000000aa',
          padding: { x: 10, y: 5 },
          align: 'center',
          wordWrap: { width: 400 }
        }).setOrigin(0, 0)
          .setDepth(50)
          .setScrollFactor(1) // Le texte suit le monde (pas la caméra)
          .setVisible(false);
        
        // Lier le texte à la zone
        zone.displayText = displayText;
      }
    });
    
    // Détection quand le joueur entre dans une zone
    this.physics.add.overlap(this.player, this.textZonesGroup, this.onEnterTextZone, null, this);
  }

  // Quand le joueur entre dans une zone de texte
  onEnterTextZone(player, zone) {
    // Si on entre dans une nouvelle zone
    if (this.currentTextZone !== zone.zoneName) {
      // Cacher l'ancien texte
      if (this.currentTextZone) {
        this.hideCurrentText();
      }
      
      // Afficher le nouveau texte
      this.currentTextZone = zone.zoneName;
      zone.displayText.setVisible(true);
    }
  }

  // Cacher le texte de la zone actuelle
  hideCurrentText() {
    // Trouver la zone actuelle et cacher son texte
    this.textZonesGroup.getChildren().forEach(zone => {
      if (zone.zoneName === this.currentTextZone && zone.displayText) {
        zone.displayText.setVisible(false);
      }
    });
  }

  // Vérifie si le joueur a quitté une zone de texte
  checkIfPlayerLeftTextZone() {
    let isInAnyZone = false;
    
    this.textZonesGroup.getChildren().forEach(zone => {
      if (!zone.active) return;
      
      let playerBounds = this.player.getBounds();
      let zoneBounds = new Phaser.Geom.Rectangle(zone.x, zone.y, zone.width, zone.height);
      
      if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, zoneBounds)) {
        isInAnyZone = true;
      }
    });
    
    // Si le joueur a quitté toutes les zones
    if (!isInAnyZone && this.currentTextZone !== null) {
      this.hideCurrentText();
      this.currentTextZone = null;
    }
  }

  // Collisions entre les objets
  setupCollisions() {
    this.setupPlayerCollisions();
    this.setupPlayer2Collisions();
    this.setupProjectileCollisions();
    this.setupBalloonCollisions();
    this.setupEnemyCollisions();
    this.setupDoorCollisions();
    this.setupCandyCollisions();
  }

  // Collisions du joueur 1
  setupPlayerCollisions() {
    this.physics.add.collider(this.player, this.calque_plateformes);
    this.physics.add.collider(this.player, this.platformsGroup);
    
    this.physics.add.collider(this.player, this.calque_eau, () => {
      handlePlayerDeath(this, this.player, 0x0000ff);
    });
  }

  // Collisions du joueur 2 (fée)
  setupPlayer2Collisions() {
    this.physics.add.collider(this.player2, this.calque_plateformes);
    this.physics.add.collider(this.player2, this.platformsGroup);
    this.physics.add.collider(this.player2, this.calque_eau);
  }

  // Collisions des projectiles (flèches)
  setupProjectileCollisions() {
    this.physics.add.collider(this.projectiles, this.calque_plateformes, (arrow) => arrow.destroy());
    this.physics.add.collider(this.projectiles, this.platformsGroup, (arrow) => arrow.destroy());
  }

  // Collisions des ballons
  setupBalloonCollisions() {
    this.physics.add.overlap(this.projectiles, this.ballonsGroup, (arrow, ballonObj) => {
      arrow.destroy();
      this.soundBallonPop.play();

      if (ballonObj.ballonType === 1) {
        this.createPlatform1();
      } else if (ballonObj.ballonType === 2) {
        this.createMovingPlatform();
      }
      
      ballonObj.destroy();
    });

    this.physics.add.overlap(this.player, this.redBallonsGroup, () => {
      handlePlayerDeath(this, this.player, 0xff0000);
    });
  }

  // Fonction pour créer un nouveau plat-forme
  createPlatform1() {
    let platformPoint = this.spawnObjects.find(obj => obj.name === "platform_1");
    if (platformPoint) {
      let newPlatform = this.platformsGroup.create(platformPoint.x, platformPoint.y, "platform1").setOrigin(0, 0);
      newPlatform.refreshBody();
    }
  }

  // Fonction pour créer un nouveau plat-forme mouvant
  createMovingPlatform() {
    let platformPoint7 = this.spawnObjects.find(obj => obj.name === "platform_7");
    if (platformPoint7) {
      let newPlatform = this.physics.add.sprite(platformPoint7.x, platformPoint7.y, "platform3").setOrigin(0, 0);
      newPlatform.body.allowGravity = false;
      newPlatform.body.immovable = true;
      newPlatform.setDepth(1);
      newPlatform.initialY = platformPoint7.y;
      newPlatform.moveDown = true;
      newPlatform.moveSpeed = 10;
      newPlatform.isMovingPlatform = true;
      this.movingPlatforms.push(newPlatform);
      this.physics.add.collider(this.player, newPlatform);
    }
  }

  // Collisions des ennemis
  setupEnemyCollisions() {
    this.physics.add.collider(this.enemiesGroup, this.calque_plateformes);
    this.physics.add.collider(this.enemiesGroup, this.platformsGroup);
    
    this.physics.add.overlap(this.player, this.enemiesGroup, () => {
      handlePlayerDeath(this, this.player, 0xff0000);
    });
    
    this.physics.add.overlap(this.projectiles, this.enemiesGroup, (arrow, enemy) => {
      arrow.destroy();
      enemy.destroy();
    });
  }

  // Collisions avec la zone de la porte
  setupDoorCollisions() {
    this.physics.add.overlap(this.player, this.doorZones, () => {
      this.isNearDoor = true;
    });
  }

  // Collisions avec les bonbons
  setupCandyCollisions() {
    this.physics.add.overlap(this.player2, this.candyGroup, (fairy, candy) => {
      let candyX = candy.x;
      let candyY = candy.y;
      let candyFrame = candy.frame.name;
      let candyId = candy.candyId;
      let platPoint = candy.platformPoint;
      
      candy.destroy();
      
      if (platPoint) {
        let newPlatform = this.platformsGroup.create(platPoint.x, platPoint.y, "platform2").setOrigin(0, 0);
        newPlatform.refreshBody();
        
        this.time.delayedCall(5000, () => {
          newPlatform.destroy();
          let newCandy = this.candyGroup.create(candyX, candyY, "wrapped_candies", candyFrame);
          newCandy.setDepth(5);
          newCandy.candyId = candyId;
          newCandy.platformPoint = platPoint;
        });
      }
    });
  }

  // Configuration des contrôles
  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.keysPlayer2 = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.Z,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.Q,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });
  }

  // boucle de mise à jour
  update() {
    if (this.isDead || this.hasWon) return;
    
    this.updatePlayerMovement();
    this.updatePlayer2Movement();
    this.updateShooting();
    this.updateAnimations();
    this.updateBalloons();
    this.updateEnemies();
    this.updateMovingPlatforms();
    this.updateParallax();
    this.updateIndicator();
    this.checkIfPlayerLeftTextZone();
  }

  // Mise à jour des ennemis (changement de direction)
  updatePlayerMovement() {
    if (this.cursors.left.isDown || this.cursors.right.isDown || this.cursors.up.isDown) {
      this.lastMoveTime = this.time.now;
      this.idlePlaying = false;
    }

    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-140);
      this.player.setFlipX(true);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(140);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    if (this.cursors.up.isDown && this.player.body.blocked.down) {
      this.player.setVelocityY(-220);
      this.soundJump.play();
    }
  }

  // Mise à jour des mouvements du joueur 2 (fée)
  updatePlayer2Movement() {
    let speed = 120;
    let moving2 = false;

    if (this.keysPlayer2.left.isDown) {
      this.player2.setVelocityX(-speed);
      moving2 = true;
      this.player2.setFlipX(true);
    } else if (this.keysPlayer2.right.isDown) {
      this.player2.setVelocityX(speed);
      moving2 = true;
      this.player2.setFlipX(false);
    } else {
      this.player2.setVelocityX(0);
    }

    if (this.keysPlayer2.up.isDown) {
      this.player2.setVelocityY(-speed);
      moving2 = true;
    } else if (this.keysPlayer2.down.isDown) {
      this.player2.setVelocityY(speed);
      moving2 = true;
    } else {
      this.player2.setVelocityY(0);
    }

    if (moving2) {
      this.player2.anims.play("fly_forward", true);
    } else {
      this.player2.anims.play("idle_flying", true);
    }
  }

  // Udapte du joueur1 si il appuie sur P
  updateShooting() {
    this.isNearDoor = false;
    this.doorZones.getChildren().forEach(door => {
      let distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, door.x, door.y);
      if (distance < 60) {
        this.isNearDoor = true;
      }
    });

    if (Phaser.Input.Keyboard.JustDown(this.fireKey)) {
      if (this.isNearDoor) {
        this.enterHouse();
      } else if (!this.isShooting) {
        this.shootArrow();
      }
    }
  }

  // Fonction appelée lorsque le joueur entre dans la maison (fin du niveau)
  enterHouse() {
    this.hasWon = true;
    
    this.player.setVelocity(0, 0);
    this.player.body.setEnable(false);
    
    if (this.house) {
      this.house.anims.play("house_idle");
    }
    
    this.time.delayedCall(1000, () => {
      this.winScreen.setVisible(true);
      this.winText.setVisible(true);
      this.winButton.setVisible(true);
      this.winButtonText.setVisible(true);
      
      this.tweens.add({
        targets: this.winText,
        scale: { from: 0.5, to: 1 },
        duration: 500,
        ease: 'Back.easeOut'
      });
    });
  }

  // Fonction de tir de flèche
  shootArrow() {
    this.isShooting = true;
    this.player.anims.play("shoot", true);
    this.soundArrow.play();

    let offsetX = this.player.flipX ? -16 : 16;
    let arrow = this.projectiles.create(this.player.x + offsetX, this.player.y + 6, "arrow");
    arrow.setVelocityX(this.player.flipX ? -300 : 300);
    arrow.setVelocityY(0);
    arrow.setFlipX(this.player.flipX);
    arrow.setDepth(6);
    
    this.idlePlaying = false;
  }

  // Mise à jour des animations du joueur 1
  updateAnimations() {
    if (!this.isShooting) {
      if (!this.player.body.blocked.down) {
        this.player.anims.play("jump", true);
      } else if (this.cursors.left.isDown || this.cursors.right.isDown) {
        this.player.anims.play("run", true);
      } else {
        let elapsed = this.time.now - this.lastMoveTime;
        if (elapsed > 10000 && !this.idlePlaying) {
          let randIdle = Phaser.Math.RND.pick(["idle1", "idle2", "idle3"]);
          this.player.anims.play(randIdle, true);
          this.idlePlaying = true;
        } else if (!this.idlePlaying) {
          this.player.anims.play("idle", true);
        }
      }
    }
  }

  // Mise à jour des ballons (mouvement et orientation)
  updateBalloons() {
    this.ballonsGroup.getChildren().forEach(b => {
      b.setFlipX(this.player.x < b.x);
      
      if (b.ballonType === 2 && b.active) {
        if (b.moveDown) {
          b.y += b.moveSpeed * (1/60);
          if (b.y >= b.initialY + 100) {
            b.moveDown = false;
          }
        } else {
          b.y -= b.moveSpeed * (1/60);
          if (b.y <= b.initialY - 250) {
            b.moveDown = true;
          }
        }
      }
    });

    this.redBallonsGroup.getChildren().forEach(b => {
      if (!b.active) return;
      b.setFlipX(this.player.x < b.x);
      
      if (b.moveRight) {
        b.x += b.moveSpeed * (1/60);
        if (b.x >= b.initialX + 200) {
          b.moveRight = false;
        }
      } else {
        b.x -= b.moveSpeed * (1/60);
        if (b.x <= b.initialX - 200) {
          b.moveRight = true;
        }
      }
    });
  }

  // Mise à jour des ennemis (changement de direction)
  updateEnemies() {
    this.enemiesGroup.getChildren().forEach(enemy => {
      if (!enemy.active) return;

      if (enemy.body.blocked.left || enemy.body.blocked.right) {
        enemy.direction *= -1;
        enemy.setFlipX(enemy.direction === -1);
      }

      let checkDistance = 20;
      let checkX = enemy.direction === 1 ? enemy.x + checkDistance : enemy.x - checkDistance;
      let checkY = enemy.y + 20;

      let tileBelow = this.calque_plateformes.getTileAtWorldXY(checkX, checkY);
      
      if (!tileBelow || !tileBelow.collides) {
        enemy.direction *= -1;
        enemy.setFlipX(enemy.direction === -1);
      }

      enemy.setVelocityX(enemy.speed * enemy.direction);
    });
  }

  // Mise à jour des plateformes mouvantes
  updateMovingPlatforms() {
    if (this.movingPlatforms) {
      this.movingPlatforms.forEach(platform => {
        if (!platform.active) return;
        
        if (platform.moveDown) {
          platform.y += platform.moveSpeed * (1/60);
          if (platform.y >= platform.initialY + 100) {
            platform.moveDown = false;
          }
        } else {
          platform.y -= platform.moveSpeed * (1/60);
          if (platform.y <= platform.initialY - 250) {
            platform.moveDown = true;
          }
        }
        
        platform.body.updateFromGameObject();
      });
    }
  }

  // Mise à jour du parallaxe
  updateParallax() {
    let camX = this.cameras.main.scrollX;
    this.sky.tilePositionX = camX * 0.05;
    this.cloud1.tilePositionX = camX * 0.15;
    this.cloud2.tilePositionX = camX * 0.25;
  }

  // Mise à jour de l'indicateur au-dessus du joueur 1
  updateIndicator() {
    let angle = Phaser.Math.Angle.Between(
      this.player.x, this.player.y, 
      this.player2.x, this.player2.y
    );
    let distance = 30;
    let indicatorX = this.player.x + Math.cos(angle) * distance;
    let indicatorY = this.player.y + Math.sin(angle) * distance;
    this.indicator.setPosition(indicatorX, indicatorY);
    this.indicator.setRotation(angle + Math.PI / 2);
  }
}