import Phaser from 'phaser';
import { generateFloor } from '../../core/floor';
import { completeFloor } from '../../core/run';
import { Stalker } from '../../core/stalker';
import { JumpscareDirector, JumpscareEvent } from '../../core/jumpscares';
import { CorruptionManager, CorruptionEffect } from '../../core/corruption';
import { MovingWallSystem, Wall, WallMoveEvent } from '../../core/movingWalls';
import { Crawler, Watcher, spawnSecondaryEnemies } from '../../core/secondaryEnemies';
import type { Floor, Searchable, SearchResult } from '../../core/floor';
import type { RunState } from '../../core/run';

interface FloorSceneData {
  runState: RunState;
}

interface SearchableSprite {
  sprite: Phaser.GameObjects.Sprite;
  data: Searchable;
  searched: boolean;
}

export class FloorScene extends Phaser.Scene {
  private runState!: RunState;
  private floorData!: Floor;
  private tileSize = 32;
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key };
  private flashlightKey!: Phaser.Input.Keyboard.Key;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private keySprite!: Phaser.GameObjects.Sprite;
  private stairsSprite!: Phaser.GameObjects.Sprite;
  private searchableSprites: SearchableSprite[] = [];
  private hasKey = false;
  private lastDamageTime: number = 0; // Track invulnerability
  private invulnerabilityDuration: number = 1500; // 1.5 seconds
  private stairsUnlocked = false;
  private statusText!: Phaser.GameObjects.Text;
  private interactPrompt!: Phaser.GameObjects.Text;
  private controlsHint!: Phaser.GameObjects.Text;
  private dangerIndicator?: Phaser.GameObjects.Text;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera; // Dedicated UI camera
  private flashlightOn = false;
  private lightmapTexture!: Phaser.GameObjects.RenderTexture;
  private lightmapGraphics!: Phaser.GameObjects.Graphics;
  private playerFacingAngle = 0;
  private nearestInteractable: { type: 'key' | 'stairs' | 'searchable'; target: any } | null = null;
  private stalker!: Stalker;
  private stalkerSprite!: Phaser.GameObjects.Sprite;
  private jumpscareDirector!: JumpscareDirector;
  private corruptionManager!: CorruptionManager;
  private movingWallSystem!: MovingWallSystem;
  private crawlers: Crawler[] = [];
  private crawlerSprites: Phaser.GameObjects.Sprite[] = [];
  private watchers: Watcher[] = [];
  private watcherSprites: Phaser.GameObjects.Sprite[] = [];
  private movingWallSprites: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private currentRoom: number = -1; // Track which room player is in
  private keyCollectedAt: number = 0; // Time when key was collected

  constructor() {
    super({ key: 'FloorScene' });
  }

  init(data: FloorSceneData) {
    this.runState = data.runState;
    // Generate floor layout with seed and current floor number
    this.floorData = generateFloor(this.runState.seed, this.runState.floor);
    
    // Reset per-floor state
    this.hasKey = false;
    this.stairsUnlocked = false;
    this.flashlightOn = false;
    this.searchableSprites = [];
    this.nearestInteractable = null;
  }

  create() {
    const { width, height, tiles, start, key, exit, doors, searchables } = this.floorData;

    // Calculate camera bounds
    const worldWidth = width * this.tileSize;
    const worldHeight = height * this.tileSize;

    // Set world bounds
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // Create walls group
    this.walls = this.physics.add.staticGroup();

    // Draw floor tiles and create wall colliders
    this.drawFloor(tiles);

    // Draw doors
    this.drawDoors(doors);

    // Create searchable objects
    this.createSearchables(searchables);

    // Create key sprite
    this.keySprite = this.createKey(key[0], key[1]);

    // Create stairs sprite (locked initially)
    this.stairsSprite = this.createStairs(exit[0], exit[1]);

    // Create player at start position
    this.player = this.createPlayer(start[0], start[1]);

    // Setup collisions
    this.physics.add.collider(this.player, this.walls);

    // Create stalker
    this.createStalker(worldWidth, worldHeight);
    
    // Create jumpscare director
    this.jumpscareDirector = new JumpscareDirector({
      seed: this.runState.seed,
      floor: this.runState.floor,
    });
    
    // Create corruption manager
    this.corruptionManager = new CorruptionManager(this.runState.seed, this.runState.floor);
    
    // Create moving wall system
    this.movingWallSystem = new MovingWallSystem(
      this.runState.seed,
      this.runState.floor,
      this.floorData.tiles
    );
    
    // Spawn secondary enemies
    const { crawlers, watchers } = spawnSecondaryEnemies(
      this.runState.floor,
      this.runState.seed,
      this.player.x,
      this.player.y,
      this.floorData.tiles,
      this.floorData.rooms,
      this.tileSize
    );
    this.crawlers = crawlers;
    this.watchers = watchers;
    this.createSecondaryEnemySprites();

    // Camera follows player smoothly with increased zoom
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.4); // Closer camera - less maze visible
    
    // Create dedicated UI camera that ignores world zoom
    this.uiCamera = this.cameras.add(0, 0, this.cameras.main.width, this.cameras.main.height);
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setZoom(1); // Always 1:1, never zooms
    
    // Make UI camera ignore all game objects by default
    this.uiCamera.ignore(this.children.list);

    // Setup lighting AFTER world is created
    this.setupLighting(worldWidth, worldHeight);
    
    // Make sure UI camera ignores the lightmap (it was added after the initial ignore call)
    this.uiCamera.ignore(this.lightmapTexture);

    // Setup input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.flashlightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    
    // Ensure keyboard is enabled
    if (this.input.keyboard) {
      this.input.keyboard.enabled = true;
    }

    // Floor info with run state
    const dangerLevel = this.runState.curse;
    const dangerColor = dangerLevel < 20 ? '#70d4c6' : dangerLevel < 40 ? '#ffd700' : '#ff4444';
    
    this.statusText = this.add.text(16, 16, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#70d4c6',
      backgroundColor: '#07090d',
      padding: { x: 8, y: 4 },
      lineSpacing: 2,
    }).setScrollFactor(0).setDepth(100);
    
    this.updateStatusText();

    // Danger indicator
    if (dangerLevel > 0) {
      this.dangerIndicator = this.add.text(this.cameras.main.width - 16, 16, `⚠ DANGER: ${dangerLevel}`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: dangerColor,
        backgroundColor: '#07090d',
        padding: { x: 8, y: 4 },
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    }

    // Interaction prompt (hidden initially)
    this.interactPrompt = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height - 100,
      '',
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffd700',
        backgroundColor: '#000000',
        padding: { x: 10, y: 6 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false);

    // Controls hint
    this.controlsHint = this.add.text(16, this.cameras.main.height - 80, 'WASD / ARROWS - MOVE\nF - FLASHLIGHT\nE - INTERACT', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#a5b6b5',
      backgroundColor: '#07090d',
      padding: { x: 8, y: 4 },
      lineSpacing: 2,
    }).setScrollFactor(0).setDepth(100);
    
    // Make UI camera only render HUD elements
    this.cameras.main.ignore([this.statusText, this.interactPrompt, this.controlsHint]);
    if (this.dangerIndicator) {
      this.cameras.main.ignore(this.dangerIndicator);
    }
  }

  update(time: number, delta: number) {
    this.handlePlayerMovement();
    this.handleFlashlight();
    this.updateLighting();
    this.updateStalker(delta);
    this.updateSecondaryEnemies(delta);
    this.updateMovingWalls();
    this.updateCorruption();
    this.drainBattery(delta);
    this.checkInteractables();
    this.handleInteraction();
    this.checkRoomTransitions();
    this.checkJumpscareConditions();
  }

  private setupLighting(worldWidth: number, worldHeight: number) {
    // Create RenderTexture for lightmap (covers entire world)
    this.lightmapTexture = this.add.renderTexture(0, 0, worldWidth, worldHeight);
    // RenderTexture defaults to a centered origin (0.5, 0.5). For a world-space
    // lightmap positioned at (0, 0) we need its top-left corner at world (0, 0).
    this.lightmapTexture.setOrigin(0, 0);
    this.lightmapTexture.setDepth(50); // Above game world (depth 5-10), below HUD (depth 100)
    this.lightmapTexture.setBlendMode(Phaser.BlendModes.MULTIPLY);

    // Create a reusable Graphics object that is NOT on the display list.
    this.lightmapGraphics = this.make.graphics({ x: 0, y: 0 }, false);
  }

  private updateLighting() {
    const worldWidth = this.floorData.width * this.tileSize;
    const worldHeight = this.floorData.height * this.tileSize;

    // Clear previous frame's drawing
    this.lightmapGraphics.clear();

    // Increased darkness - darker base multiplier
    this.lightmapGraphics.fillStyle(0x202020, 1); // Much darker: ~12% of original brightness (was 0x404040 = 25%)
    this.lightmapGraphics.fillRect(0, 0, worldWidth, worldHeight);

    // Smaller ambient visibility around the player
    this.lightmapGraphics.fillStyle(0x909090, 1); // Dimmer ambient (was 0xb8b8b8)
    this.lightmapGraphics.fillCircle(this.player.x, this.player.y, 56); // Smaller radius (was 72)
    this.lightmapGraphics.fillStyle(0xe0e0e0, 1); // Slightly dimmer center (was 0xffffff)
    this.lightmapGraphics.fillCircle(this.player.x, this.player.y, 32); // Smaller center (was 42)

    // Directional flashlight
    if (this.flashlightOn) {
      const length = 230;
      const halfAngle = Phaser.Math.DegToRad(24);
      const startX = this.player.x;
      const startY = this.player.y;
      const leftX = startX + Math.cos(this.playerFacingAngle - halfAngle) * length;
      const leftY = startY + Math.sin(this.playerFacingAngle - halfAngle) * length;
      const rightX = startX + Math.cos(this.playerFacingAngle + halfAngle) * length;
      const rightY = startY + Math.sin(this.playerFacingAngle + halfAngle) * length;

      // Outer cone
      const outerLength = 250;
      const outerHalfAngle = Phaser.Math.DegToRad(30);
      const outerLeftX = startX + Math.cos(this.playerFacingAngle - outerHalfAngle) * outerLength;
      const outerLeftY = startY + Math.sin(this.playerFacingAngle - outerHalfAngle) * outerLength;
      const outerRightX = startX + Math.cos(this.playerFacingAngle + outerHalfAngle) * outerLength;
      const outerRightY = startY + Math.sin(this.playerFacingAngle + outerHalfAngle) * outerLength;

      this.lightmapGraphics.fillStyle(0x707070, 1); // Dimmer outer cone (was 0x8a8a8a)
      this.lightmapGraphics.fillTriangle(startX, startY, outerLeftX, outerLeftY, outerRightX, outerRightY);

      this.lightmapGraphics.fillStyle(0xffffff, 1);
      this.lightmapGraphics.fillTriangle(startX, startY, leftX, leftY, rightX, rightY);
    }

    // Draw the finished grayscale lightmap into the RenderTexture
    this.lightmapTexture.clear();
    this.lightmapTexture.draw(this.lightmapGraphics, 0, 0);
  }

  private createCircleTexture(size: number, fillStyle: any): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(size / 2, size / 2, size / 2);
    return graphics;
  }

  private handleFlashlight() {
    if (Phaser.Input.Keyboard.JustDown(this.flashlightKey)) {
      if (this.runState.battery > 0) {
        this.flashlightOn = !this.flashlightOn;
        
        // Notify stalker of flashlight toggle
        if (this.stalker) {
          this.stalker.onFlashlightToggle(this.flashlightOn);
        }
        
        // Play sound effect (placeholder)
        if (this.flashlightOn) {
          // Click sound
        } else {
          // Click sound
        }
      } else {
        // Show no battery message
        if (!this.time.now || this.time.now % 2000 < 100) {
          this.showTemporaryMessage('NO BATTERY!', '#ff4444');
        }
      }
    }
  }

  private drainBattery(delta: number) {
    if (this.flashlightOn && this.runState.battery > 0) {
      // Drain battery: ~1% per second (adjust based on delta)
      const drainRate = 0.6 + (this.runState.curse * 0.02); // Faster drain with higher curse
      this.runState.battery -= (drainRate * delta) / 1000;
      
      if (this.runState.battery <= 0) {
        this.runState.battery = 0;
        this.flashlightOn = false;
        this.showTemporaryMessage('BATTERY DEPLETED!', '#ff4444');
      }
      
      this.updateStatusText();
    }
  }

  private showTemporaryMessage(text: string, color: string, duration: number = 1200) {
    const msg = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 80,
      text,
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: color,
        backgroundColor: '#000000',
        padding: { x: 8, y: 6 },
        align: 'center',
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);
    
    // Make main camera ignore this, let UI camera render it
    this.cameras.main.ignore(msg);

    this.tweens.add({
      targets: msg,
      alpha: 1,
      duration: 150,
      onComplete: () => {
        this.time.delayedCall(duration, () => {
          this.tweens.add({
            targets: msg,
            alpha: 0,
            duration: 200,
            onComplete: () => msg.destroy(),
          });
        });
      }
    });
  }

  private updateStatusText() {
    const batteryColor = this.runState.battery > 50 ? '#70d4c6' : this.runState.battery > 20 ? '#ffd700' : '#ff4444';
    const hpColor = this.runState.hp > 50 ? '#70d4c6' : this.runState.hp > 25 ? '#ffd700' : '#ff4444';
    const flashStatus = this.flashlightOn ? '■' : '□';
    
    const lines = [
      `FLOOR ${this.runState.floor}/3`,
      `HP: ${Math.floor(this.runState.hp)}/100`,
      `CURSE: ${Math.floor(this.runState.curse)}%`,
      `BATTERY: ${Math.floor(this.runState.battery)}%`,
      `SCORE: ${this.runState.score}`,
      `LIGHT: ${flashStatus}`,
    ];
    this.statusText.setText(lines.join('\n'));
    
    // Update color based on most critical resource
    if (this.runState.hp <= 25) {
      this.statusText.setColor(hpColor);
    } else if (this.runState.battery <= 20) {
      this.statusText.setColor(batteryColor);
    } else {
      this.statusText.setColor('#70d4c6');
    }
  }

  private drawFloor(tiles: boolean[][]) {
    const graphics = this.add.graphics();

    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        const posX = x * this.tileSize;
        const posY = y * this.tileSize;

        if (tiles[y][x]) {
          // Walkable floor - darker tile
          graphics.fillStyle(0x1a1f26, 1);
          graphics.fillRect(posX, posY, this.tileSize, this.tileSize);
          graphics.lineStyle(1, 0x2a2f36, 0.2);
          graphics.strokeRect(posX, posY, this.tileSize, this.tileSize);
        } else {
          // Wall/obstacle - very dark
          graphics.fillStyle(0x0a0d11, 1);
          graphics.fillRect(posX, posY, this.tileSize, this.tileSize);
          graphics.lineStyle(1, 0x14181f, 0.8);
          graphics.strokeRect(posX, posY, this.tileSize, this.tileSize);

          // Add invisible physics body for collision
          const wall = this.add.rectangle(
            posX + this.tileSize / 2,
            posY + this.tileSize / 2,
            this.tileSize,
            this.tileSize
          );
          this.walls.add(wall);
        }
      }
    }
  }

  private drawDoors(doors: [number, number][]) {
    const graphics = this.add.graphics();
    
    for (const [x, y] of doors) {
      const posX = x * this.tileSize;
      const posY = y * this.tileSize;
      
      // Door frame (slightly lighter than floor)
      graphics.fillStyle(0x2d3748, 1);
      graphics.fillRect(posX + 6, posY + 4, this.tileSize - 12, this.tileSize - 8);
      
      // Door highlight
      graphics.lineStyle(2, 0x4a5568, 1);
      graphics.strokeRect(posX + 6, posY + 4, this.tileSize - 12, this.tileSize - 8);
    }
  }

  private createKey(x: number, y: number): Phaser.GameObjects.Sprite {
    const posX = x * this.tileSize + this.tileSize / 2;
    const posY = y * this.tileSize + this.tileSize / 2;

    // Create key texture
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffd700, 1);
    
    // Key head (circle)
    graphics.fillCircle(0, -6, 5);
    
    // Key shaft
    graphics.fillRect(-2, -2, 4, 12);
    
    // Key teeth
    graphics.fillRect(2, 6, 3, 2);
    graphics.fillRect(2, 9, 3, 2);
    
    graphics.generateTexture('key', 16, 20);
    graphics.destroy();

    const keySprite = this.physics.add.sprite(posX, posY, 'key');
    keySprite.setDepth(5);
    
    // Add floating animation
    this.tweens.add({
      targets: keySprite,
      y: posY - 5,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Add glow effect
    this.tweens.add({
      targets: keySprite,
      alpha: 0.7,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Add label
    this.add.text(posX, posY - 30, 'KEY', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffd700',
      backgroundColor: '#000000',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);

    return keySprite;
  }

  private createStairs(x: number, y: number): Phaser.GameObjects.Sprite {
    const posX = x * this.tileSize + this.tileSize / 2;
    const posY = y * this.tileSize + this.tileSize / 2;

    // Create stairs texture (locked)
    const graphics = this.add.graphics();
    
    // Stairs base (dark gray)
    graphics.fillStyle(0x4a5568, 1);
    for (let i = 0; i < 4; i++) {
      graphics.fillRect(-10 + i * 2, 6 - i * 3, 20 - i * 4, 3);
    }
    
    // Lock icon (red when locked)
    graphics.fillStyle(0xff4444, 1);
    graphics.fillRect(-4, -8, 8, 6);
    graphics.fillCircle(0, -8, 3);
    
    graphics.generateTexture('stairs_locked', 24, 24);
    graphics.destroy();

    // Create stairs texture (unlocked)
    const graphics2 = this.add.graphics();
    
    // Stairs base (cyan/teal when unlocked)
    graphics2.fillStyle(0x70d4c6, 1);
    for (let i = 0; i < 4; i++) {
      graphics2.fillRect(-10 + i * 2, 6 - i * 3, 20 - i * 4, 3);
    }
    
    // Open lock icon (green)
    graphics2.fillStyle(0x44ff44, 1);
    graphics2.fillRect(-4, -6, 8, 6);
    graphics2.lineStyle(2, 0x44ff44, 1);
    graphics2.beginPath();
    graphics2.arc(0, -6, 3, Math.PI, 0, true);
    graphics2.strokePath();
    
    graphics2.generateTexture('stairs_unlocked', 24, 24);
    graphics2.destroy();

    const stairsSprite = this.physics.add.sprite(posX, posY, 'stairs_locked');
    stairsSprite.setDepth(5);

    // Add label
    this.add.text(posX, posY - 30, 'STAIRS', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ff4444',
      backgroundColor: '#000000',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5).setName('stairsLabel');

    return stairsSprite;
  }

  private createPlayer(x: number, y: number): Phaser.Physics.Arcade.Sprite {
    const posX = x * this.tileSize + this.tileSize / 2;
    const posY = y * this.tileSize + this.tileSize / 2;

    // Create player sprite (simple rectangle placeholder)
    const graphics = this.add.graphics();
    graphics.fillStyle(0xd9f3ea, 1);
    graphics.fillRect(-8, -12, 16, 24); // Rectangular body
    graphics.fillStyle(0xe9f5f1, 1);
    graphics.fillCircle(0, -8, 6); // Head
    graphics.generateTexture('player', 20, 28);
    graphics.destroy();

    const player = this.physics.add.sprite(posX, posY, 'player');
    player.setCollideWorldBounds(true);
    player.setDepth(10);
    
    // Set smaller collision body
    player.setSize(14, 14);
    player.setOffset(3, 14);

    return player;
  }

  private handlePlayerMovement() {
    const speed = 160;
    
    // Reset velocity
    this.player.setVelocity(0);

    // Check WASD and Arrow keys
    const left = this.cursors.left.isDown || this.wasd.a.isDown;
    const right = this.cursors.right.isDown || this.wasd.d.isDown;
    const up = this.cursors.up.isDown || this.wasd.w.isDown;
    const down = this.cursors.down.isDown || this.wasd.s.isDown;

    let velocityX = 0;
    let velocityY = 0;

    // Horizontal movement
    if (left) {
      velocityX = -speed;
    } else if (right) {
      velocityX = speed;
    }

    // Vertical movement
    if (up) {
      velocityY = -speed;
    } else if (down) {
      velocityY = speed;
    }

    // Normalize diagonal movement
    if ((left || right) && (up || down)) {
      velocityX *= 0.707;
      velocityY *= 0.707;
    }

    this.player.setVelocity(velocityX, velocityY);

    // Update facing direction based on movement
    if (velocityX !== 0 || velocityY !== 0) {
      this.playerFacingAngle = Math.atan2(velocityY, velocityX);
    }
  }

  private completeFloor() {
    // Disable player movement
    this.player.setVelocity(0);
    this.input.keyboard?.enabled && (this.input.keyboard.enabled = false);

    // Update run state using core function (includes battery bonus)
    const updatedRunState = completeFloor(this.runState);
    this.registry.set('runState', updatedRunState);

    // Show completion message with stats
    const message = updatedRunState.status === 'won' 
      ? `FLOOR ${this.runState.floor} COMPLETE!\nESCAPE SUCCESSFUL!`
      : `FLOOR ${this.runState.floor} COMPLETE!`;

    const completionText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      message,
      {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#70d4c6',
        backgroundColor: '#000000',
        padding: { x: 16, y: 12 },
        align: 'center',
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);
    
    // UI camera only
    this.cameras.main.ignore(completionText);

    // Show score gain and battery bonus
    const scoreGain = 100 * this.runState.floor;
    const batteryGain = updatedRunState.battery - this.runState.battery;
    const scoreText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 60,
      `+${scoreGain} POINTS\n+${batteryGain}% BATTERY`,
      {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffd700',
        backgroundColor: '#000000',
        padding: { x: 12, y: 8 },
        align: 'center',
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);
    
    // UI camera only
    this.cameras.main.ignore(scoreText);

    this.tweens.add({
      targets: [completionText, scoreText],
      alpha: 1,
      duration: 300,
    });

    // Fade to black and transition
    this.time.delayedCall(2500, () => {
      this.cameras.main.fadeOut(500);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        if (updatedRunState.status === 'won') {
          // Game complete!
          this.showVictoryScreen(updatedRunState);
        } else {
          // Go to next floor with updated state
          this.scene.restart({ runState: updatedRunState });
        }
      });
    });
  }

  private showVictoryScreen(finalState: RunState) {
    this.cameras.main.fadeIn(300);
    
    const { width, height } = this.cameras.main;
    
    this.add.text(width / 2, height / 2 - 80, 'ESCAPE COMPLETE!', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#70d4c6',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 20, 'YOU SURVIVED BLOCK 13', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#d9f3ea',
    }).setOrigin(0.5);

    const elapsed = Math.floor((Date.now() - finalState.timeStarted) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    this.add.text(width / 2, height / 2 + 40, [
      `FINAL SCORE: ${finalState.score}`,
      `TIME: ${minutes}:${seconds.toString().padStart(2, '0')}`,
      `FLOORS CLEARED: ${finalState.floorsCompleted}`,
    ].join('\n'), {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#a5b6b5',
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5);
  }

  // ====== SEARCHABLE OBJECTS ======

  private createSearchables(searchables: Searchable[]) {
    searchables.forEach((searchable) => {
      const sprite = this.createSearchableSprite(searchable);
      this.searchableSprites.push({
        sprite,
        data: searchable,
        searched: false,
      });
    });
  }

  private createSearchableSprite(searchable: Searchable): Phaser.GameObjects.Sprite {
    const posX = searchable.x * this.tileSize + this.tileSize / 2;
    const posY = searchable.y * this.tileSize + this.tileSize / 2;

    // Create texture based on object type
    const textureName = searchable.isMimic ? `mimic_${searchable.x}_${searchable.y}` : `searchable_${searchable.objectType}`;
    
    if (!this.textures.exists(textureName)) {
      const graphics = this.add.graphics();
      
      if (searchable.isMimic) {
        // Mimic - looks like a box but with subtle differences
        graphics.fillStyle(0x6e665c, 1); // Slightly darker/different brown
        graphics.fillRect(-8, -8, 16, 16);
        graphics.lineStyle(2, 0x998f85, 1); // Slightly off color outline
        graphics.strokeRect(-8, -8, 16, 16);
        // Different tape pattern (diagonal instead of horizontal)
        graphics.lineStyle(2, 0xccc3b9, 1);
        graphics.lineBetween(-8, -3, 8, 3);
      } else {
        switch (searchable.objectType) {
          case 'cabinet':
            // Cabinet (tall rectangle)
            graphics.fillStyle(0x4a5568, 1);
            graphics.fillRect(-10, -12, 20, 24);
            graphics.lineStyle(2, 0x6b7280, 1);
            graphics.strokeRect(-10, -12, 20, 24);
            // Handles
            graphics.fillStyle(0x9ca3af, 1);
            graphics.fillCircle(-5, -3, 2);
            graphics.fillCircle(5, -3, 2);
            break;
            
          case 'locker':
            // Locker (narrow tall)
            graphics.fillStyle(0x374151, 1);
            graphics.fillRect(-8, -12, 16, 24);
            graphics.lineStyle(2, 0x6b7280, 1);
            graphics.strokeRect(-8, -12, 16, 24);
            // Vents
            graphics.lineStyle(1, 0x9ca3af, 1);
            for (let i = 0; i < 3; i++) {
              graphics.lineBetween(-6, -8 + i * 3, 6, -8 + i * 3);
            }
            break;
            
          case 'box':
            // Box (small square)
            graphics.fillStyle(0x78716c, 1);
            graphics.fillRect(-8, -8, 16, 16);
            graphics.lineStyle(2, 0xa8a29e, 1);
            graphics.strokeRect(-8, -8, 16, 16);
            // Tape
            graphics.lineStyle(2, 0xd6d3d1, 1);
            graphics.lineBetween(-8, 0, 8, 0);
            break;
            
          case 'drawer':
            // Drawer (wide short)
            graphics.fillStyle(0x57534e, 1);
            graphics.fillRect(-12, -6, 24, 12);
            graphics.lineStyle(2, 0x78716c, 1);
            graphics.strokeRect(-12, -6, 24, 12);
            // Handle
            graphics.fillStyle(0xa8a29e, 1);
            graphics.fillRect(-4, -2, 8, 4);
            break;
        }
      }
      
      graphics.generateTexture(textureName, 24, 24);
      graphics.destroy();
    }

    const sprite = this.add.sprite(posX, posY, textureName);
    sprite.setDepth(4);
    
    // Add subtle twitch animation for mimics
    if (searchable.isMimic) {
      this.time.addEvent({
        delay: 2000 + Math.random() * 3000,
        callback: () => {
          if (sprite.active) {
            this.tweens.add({
              targets: sprite,
              x: sprite.x + (Math.random() - 0.5) * 2,
              y: sprite.y + (Math.random() - 0.5) * 2,
              duration: 100,
              yoyo: true,
            });
          }
        },
        loop: true,
      });
    }
    
    return sprite;
  }

  // ====== INTERACTION SYSTEM ======

  private checkInteractables() {
    const interactRange = 48; // pixels
    this.nearestInteractable = null;

    // Check key (if not collected)
    if (!this.hasKey && this.keySprite.active) {
      const distToKey = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.keySprite.x, this.keySprite.y
      );
      if (distToKey < interactRange) {
        this.nearestInteractable = { type: 'key', target: this.keySprite };
      }
    }

    // Check stairs
    if (!this.nearestInteractable) {
      const distToStairs = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.stairsSprite.x, this.stairsSprite.y
      );
      if (distToStairs < interactRange) {
        this.nearestInteractable = { type: 'stairs', target: this.stairsSprite };
      }
    }

    // Check searchables
    if (!this.nearestInteractable) {
      let closestDist = interactRange;
      let closestSearchable: SearchableSprite | null = null;

      this.searchableSprites.forEach((searchable) => {
        if (searchable.searched) return;
        
        const dist = Phaser.Math.Distance.Between(
          this.player.x, this.player.y,
          searchable.sprite.x, searchable.sprite.y
        );
        
        if (dist < closestDist) {
          closestDist = dist;
          closestSearchable = searchable;
        }
      });

      if (closestSearchable) {
        this.nearestInteractable = { type: 'searchable', target: closestSearchable };
      }
    }

    // Update prompt
    this.updateInteractPrompt();
  }

  private updateInteractPrompt() {
    if (!this.nearestInteractable) {
      this.interactPrompt.setVisible(false);
      return;
    }

    let promptText = '';
    
    switch (this.nearestInteractable.type) {
      case 'key':
        promptText = '[E] PICK UP KEY';
        break;
      case 'stairs':
        if (this.stairsUnlocked) {
          promptText = '[E] DESCEND STAIRS';
        } else {
          promptText = '[E] STAIRS (LOCKED)';
        }
        break;
      case 'searchable':
        const searchable = this.nearestInteractable.target as SearchableSprite;
        const objName = searchable.data.objectType.toUpperCase();
        promptText = `[E] SEARCH ${objName}`;
        break;
    }

    this.interactPrompt.setText(promptText);
    this.interactPrompt.setVisible(true);
  }

  private handleInteraction() {
    if (!Phaser.Input.Keyboard.JustDown(this.interactKey)) return;
    if (!this.nearestInteractable) return;

    switch (this.nearestInteractable.type) {
      case 'key':
        this.interactWithKey();
        break;
      case 'stairs':
        this.interactWithStairs();
        break;
      case 'searchable':
        this.interactWithSearchable(this.nearestInteractable.target as SearchableSprite);
        break;
    }
  }

  private interactWithKey() {
    if (this.hasKey) return;

    this.hasKey = true;
    this.keyCollectedAt = Date.now();
    
    // Remove key with effect
    this.tweens.add({
      targets: this.keySprite,
      scale: 1.5,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.keySprite.destroy();
      }
    });

    // DO NOT unlock stairs yet - player must carry key back to stairs
    // Show notification
    this.showTemporaryMessage('KEY COLLECTED!\nRETURN TO THE STAIRS', '#ffd700');
    
    // Trigger jumpscare on key collection
    const scare = this.jumpscareDirector.tryTriggerOnKeyCollected(Date.now());
    if (scare) {
      this.executeJumpscare(scare);
    }
    
    // Escalate stalker after key collection
    this.escalateStalkerAfterKey();
  }

  private interactWithStairs() {
    if (!this.hasKey) {
      this.showTemporaryMessage('STAIRS LOCKED\nFIND THE KEY', '#ff4444');
      return;
    }

    if (!this.stairsUnlocked) {
      // Player has key but hasn't unlocked stairs yet - unlock them now
      this.unlockStairs();
      return;
    }

    // Stairs already unlocked - descend
    this.completeFloor();
  }
  
  private unlockStairs() {
    this.stairsUnlocked = true;
    this.stairsSprite.setTexture('stairs_unlocked');
    
    // Update stairs label
    const stairsLabel = this.children.getByName('stairsLabel') as Phaser.GameObjects.Text;
    if (stairsLabel) {
      stairsLabel.setColor('#70d4c6');
      stairsLabel.setText('STAIRS - UNLOCKED');
    }

    // Flash effect on stairs
    this.tweens.add({
      targets: this.stairsSprite,
      alpha: 0.5,
      duration: 150,
      yoyo: true,
      repeat: 3,
    });

    // Show notification
    this.showTemporaryMessage('STAIRS UNLOCKED!\nPRESS [E] TO DESCEND', '#70d4c6');
  }

  private interactWithSearchable(searchable: SearchableSprite) {
    if (searchable.searched) return;

    // Mark as searched
    searchable.searched = true;
    searchable.sprite.setTint(0x666666);
    searchable.sprite.setAlpha(0.6);

    // Notify stalker of player action
    if (this.stalker) {
      this.stalker.onPlayerSearch();
    }
    
    // Check for jumpscare
    const scare = this.jumpscareDirector.tryTriggerOnSearch(Date.now(), this.hasKey);
    if (scare) {
      this.executeJumpscare(scare);
    }

    // Process result
    const result = searchable.data.result;
    
    switch (result.type) {
      case 'mimic_reveal':
        this.revealMimic(searchable);
        break;
        
      case 'battery':
        this.runState.battery = Math.min(100, this.runState.battery + result.amount);
        this.updateStatusText();
        this.showTemporaryMessage(`FOUND BATTERY\n+${result.amount}% CHARGE`, '#70d4c6');
        break;
        
      case 'health':
        this.runState.hp = Math.min(100, this.runState.hp + result.amount);
        this.updateStatusText();
        this.showTemporaryMessage(`FOUND MEDICAL SUPPLIES\n+${result.amount} HP`, '#44ff44');
        break;
        
      case 'collectible':
        this.runState.score += result.score;
        this.updateStatusText();
        const itemName = result.item.toUpperCase();
        const color = result.item === 'hemi' ? '#ffd700' : result.item === 'btc' ? '#ff8800' : '#70d4c6';
        this.showTemporaryMessage(`FOUND ${itemName}\n+${result.score} SCORE`, color);
        break;
        
      case 'clue':
        this.showTemporaryMessage('FOUND A CLUE\n[Placeholder]', '#a5b6b5');
        break;
        
      case 'nothing':
        const messages = ['EMPTY', 'NOTHING HERE', 'NOTHING USEFUL', 'DISAPPOINTING'];
        const randomMsg = messages[Math.floor(Math.random() * messages.length)];
        this.showTemporaryMessage(randomMsg, '#6b7280');
        break;
    }

    // Hide prompt
    this.nearestInteractable = null;
    this.interactPrompt.setVisible(false);
  }
  
  private revealMimic(searchable: SearchableSprite) {
    // Mimic reveal scare
    this.cameras.main.shake(300, 0.01);
    
    // Flash red
    const flash = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0xff0000,
      0.4
    ).setScrollFactor(0).setDepth(160);
    
    // UI camera only
    this.cameras.main.ignore(flash);
    
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      repeat: 2,
      yoyo: true,
      onComplete: () => flash.destroy()
    });
    
    // Damage player (with invulnerability check)
    const now = Date.now();
    if (now - this.lastDamageTime > this.invulnerabilityDuration) {
      this.takeDamage(20, 'MIMIC ATTACK!');
    }
    
    // Transform sprite to aggressive mimic
    searchable.sprite.setTint(0xff4444);
    searchable.sprite.setScale(1.2);
    
    // Mimic chases briefly then despawns
    const mimicChaseTime = 2000; // 2 seconds
    const startTime = Date.now();
    
    const chaseInterval = this.time.addEvent({
      delay: 50,
      callback: () => {
        if (Date.now() - startTime > mimicChaseTime) {
          // Despawn mimic
          this.tweens.add({
            targets: searchable.sprite,
            alpha: 0,
            scale: 0.5,
            duration: 300,
            onComplete: () => searchable.sprite.destroy()
          });
          chaseInterval.remove();
        } else {
          // Chase player
          const dx = this.player.x - searchable.sprite.x;
          const dy = this.player.y - searchable.sprite.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > 10) {
            const speed = 80;
            const ratio = speed * 0.05 / dist;
            searchable.sprite.x += dx * ratio;
            searchable.sprite.y += dy * ratio;
          }
          
          // Check collision during chase
          if (dist < 25 && Date.now() - this.lastDamageTime > this.invulnerabilityDuration) {
            this.takeDamage(10, 'MIMIC HIT!');
          }
        }
      },
      loop: true
    });
  }
  
  private takeDamage(amount: number, message: string) {
    const now = Date.now();
    
    // Check invulnerability
    if (now - this.lastDamageTime < this.invulnerabilityDuration) {
      return; // Still invulnerable
    }
    
    this.lastDamageTime = now;
    this.runState.hp = Math.max(0, this.runState.hp - amount);
    this.updateStatusText();
    this.showTemporaryMessage(`${message}\n-${amount} HP`, '#ff4444', 1200);
    
    // Player flash
    this.tweens.add({
      targets: this.player,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.player.setAlpha(1)
    });
    
    // Check death
    if (this.runState.hp <= 0) {
      this.playerDeath();
    }
  }
  
  private playerDeath() {
    // Disable input
    this.player.setVelocity(0);
    if (this.input.keyboard) {
      this.input.keyboard.enabled = false;
    }
    
    this.runState.status = 'lost';
    
    // Death animation
    this.tweens.add({
      targets: this.player,
      alpha: 0,
      scale: 0.5,
      duration: 800,
      ease: 'Power2'
    });
    
    // Show death screen
    this.time.delayedCall(1000, () => {
      this.showGameOver();
    });
  }
  
  // ====== JUMPSCARE SYSTEM ======
  
  private checkRoomTransitions() {
    // Determine which room player is in
    const playerTileX = Math.floor(this.player.x / this.tileSize);
    const playerTileY = Math.floor(this.player.y / this.tileSize);
    
    for (let i = 0; i < this.floorData.rooms.length; i++) {
      const room = this.floorData.rooms[i];
      if (playerTileX >= room.x && playerTileX < room.x + room.width &&
          playerTileY >= room.y && playerTileY < room.y + room.height) {
        if (this.currentRoom !== i) {
          // Entered new room
          this.currentRoom = i;
          const scare = this.jumpscareDirector.tryTriggerOnRoomEnter(Date.now(), this.hasKey);
          if (scare) {
            this.executeJumpscare(scare);
          }
        }
        return;
      }
    }
  }
  
  private checkJumpscareConditions() {
    const now = Date.now();
    
    // Check low battery scares
    const batteryScare = this.jumpscareDirector.tryTriggerOnLowBattery(now, this.runState.battery);
    if (batteryScare) {
      this.executeJumpscare(batteryScare);
      return;
    }
    
    // Check near stairs with key
    if (this.hasKey && !this.stairsUnlocked) {
      const distToStairs = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.stairsSprite.x, this.stairsSprite.y
      );
      const stairsScare = this.jumpscareDirector.tryTriggerNearStairs(now, this.hasKey, distToStairs);
      if (stairsScare) {
        this.executeJumpscare(stairsScare);
      }
    }
  }
  
  private executeJumpscare(scare: JumpscareEvent) {
    // Alert stalker if applicable
    if (scare.canAlertStalker && this.stalker && this.stalker.state === 'dormant') {
      this.stalker.state = 'investigating';
      this.stalker.targetX = this.player.x;
      this.stalker.targetY = this.player.y;
    }
    
    // Execute scare based on type
    switch (scare.type) {
      case 'light_flicker':
        this.flickerLights();
        break;
      case 'door_slam':
        this.playSlamSound();
        break;
      case 'footsteps':
        this.playFootstepsSound();
        break;
      case 'shadow_cross':
        this.showShadowCross();
        break;
      case 'false_stalker':
        this.showFalseStalker();
        break;
      case 'object_move':
        this.animateObjectMove();
        break;
      case 'sudden_noise':
        this.playSuddenNoise();
        break;
      case 'screen_glitch':
        this.screenGlitch();
        break;
    }
  }
  
  private flickerLights() {
    const originalAlpha = this.lightmapTexture.alpha;
    this.tweens.add({
      targets: this.lightmapTexture,
      alpha: 0.3,
      duration: 80,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        this.lightmapTexture.alpha = originalAlpha;
      }
    });
  }
  
  private playSlamSound() {
    // Visual indicator for door slam
    this.cameras.main.shake(100, 0.003);
    this.showTemporaryMessage('*SLAM*', '#ff4444', 800);
  }
  
  private playFootstepsSound() {
    // Subtle footsteps indication
    this.showTemporaryMessage('...footsteps...', '#888888', 1200);
  }
  
  private showShadowCross() {
    // Create a dark shadow that crosses the player's view
    const shadow = this.add.rectangle(
      this.player.x + 150,
      this.player.y - 50,
      40,
      100,
      0x000000,
      0.7
    ).setDepth(8);
    
    this.tweens.add({
      targets: shadow,
      y: shadow.y + 200,
      duration: 800,
      ease: 'Linear',
      onComplete: () => shadow.destroy()
    });
  }
  
  private showFalseStalker() {
    // Brief stalker silhouette that disappears
    const fakeSprite = this.add.sprite(
      this.player.x + 200,
      this.player.y,
      'stalker'
    ).setDepth(9).setAlpha(0.4);
    
    this.time.delayedCall(300, () => {
      this.tweens.add({
        targets: fakeSprite,
        alpha: 0,
        duration: 200,
        onComplete: () => fakeSprite.destroy()
      });
    });
  }
  
  private animateObjectMove() {
    // Find nearest searchable and animate it
    let nearest: any = null;
    let nearestDist = 300;
    
    this.searchableSprites.forEach(s => {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        s.sprite.x, s.sprite.y
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = s.sprite;
      }
    });
    
    if (nearest) {
      this.tweens.add({
        targets: nearest,
        x: nearest.x + 5,
        duration: 100,
        yoyo: true,
        repeat: 2
      });
    }
  }
  
  private playSuddenNoise() {
    this.cameras.main.shake(150, 0.005);
    this.showTemporaryMessage('*CRASH*', '#ff8844', 600);
  }
  
  private screenGlitch() {
    const glitchOverlay = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0xff0000,
      0.3
    ).setScrollFactor(0).setDepth(150);
    
    // UI camera only
    this.cameras.main.ignore(glitchOverlay);
    
    this.tweens.add({
      targets: glitchOverlay,
      alpha: 0,
      duration: 100,
      repeat: 3,
      yoyo: true,
      onComplete: () => glitchOverlay.destroy()
    });
  }
  
  private escalateStalkerAfterKey() {
    if (!this.stalker) return;
    
    // Force stalker into more aggressive state
    if (this.stalker.state === 'dormant') {
      this.stalker.state = 'roaming';
      this.stalker.pickRoamTarget(this.floorData.tiles);
    } else if (this.stalker.state === 'roaming') {
      this.stalker.state = 'investigating';
      this.stalker.targetX = this.player.x;
      this.stalker.targetY = this.player.y;
    }
  }
  
  // ====== SECONDARY ENEMIES ======
  
  private createSecondaryEnemySprites() {
    // Create crawler sprites
    this.crawlers.forEach((crawler) => {
      const graphics = this.add.graphics();
      graphics.fillStyle(0x4a5568, 1); // Dark gray
      graphics.fillEllipse(0, 0, 12, 8); // Small oval body
      graphics.fillStyle(0x6b7280, 1);
      graphics.fillCircle(-3, -2, 2); // Left eye
      graphics.fillCircle(3, -2, 2); // Right eye
      graphics.generateTexture(`crawler_${crawler.id}`, 16, 12);
      graphics.destroy();
      
      const sprite = this.add.sprite(crawler.x, crawler.y, `crawler_${crawler.id}`);
      sprite.setDepth(8);
      this.crawlerSprites.push(sprite);
    });
    
    // Create watcher sprites
    this.watchers.forEach((watcher) => {
      const graphics = this.add.graphics();
      graphics.fillStyle(0x1a1a2e, 0.7); // Dark semi-transparent
      graphics.fillRect(-12, -16, 24, 32); // Tall shadowy figure
      graphics.fillStyle(0xff4444, 0.8); // Red eyes
      graphics.fillCircle(-5, -6, 3);
      graphics.fillCircle(5, -6, 3);
      graphics.generateTexture(`watcher_${watcher.id}`, 28, 36);
      graphics.destroy();
      
      const sprite = this.add.sprite(watcher.x, watcher.y, `watcher_${watcher.id}`);
      sprite.setDepth(8);
      sprite.setAlpha(0.6);
      this.watcherSprites.push(sprite);
    });
  }
  
  private updateSecondaryEnemies(delta: number) {
    const now = Date.now();
    const canTakeDamage = (now - this.lastDamageTime) > this.invulnerabilityDuration;
    
    // Update crawlers
    this.crawlers.forEach((crawler, index) => {
      const caught = crawler.update(delta, this.player.x, this.player.y, this.floorData.tiles);
      
      if (caught && canTakeDamage) {
        // Player caught by crawler
        this.takeDamage(15, 'CRAWLER ATTACK!');
        
        // Respawn crawler far away
        crawler.spawn(this.player.x, this.player.y, this.floorData.tiles);
      }
      
      // Update sprite
      const sprite = this.crawlerSprites[index];
      if (sprite) {
        sprite.setPosition(crawler.x, crawler.y);
        sprite.setAlpha(crawler.chasing ? 1.0 : 0.6);
      }
    });
    
    // Update watchers
    this.watchers.forEach((watcher, index) => {
      if (!watcher.active) {
        const sprite = this.watcherSprites[index];
        if (sprite && sprite.alpha > 0) {
          sprite.setAlpha(Math.max(0, sprite.alpha - 0.02));
        }
        return;
      }
      
      // Check if player is facing/approaching watcher
      const dx = watcher.x - this.player.x;
      const dy = watcher.y - this.player.y;
      const angleToWatcher = Math.atan2(dy, dx);
      const angleDiff = Math.abs(angleToWatcher - this.playerFacingAngle);
      const playerApproaching = angleDiff < Math.PI / 3; // 60 degree cone
      
      // Check if watcher is illuminated by flashlight
      const distToPlayer = Math.sqrt(dx * dx + dy * dy);
      const illuminated = this.flashlightOn && distToPlayer < 200 && playerApproaching;
      
      const curseGain = watcher.update(delta, this.player.x, this.player.y, playerApproaching, illuminated);
      
      if (curseGain > 0) {
        this.runState.curse = Math.min(100, this.runState.curse + curseGain);
      }
      
      // Update sprite
      const sprite = this.watcherSprites[index];
      if (sprite) {
        sprite.setPosition(watcher.x, watcher.y);
        
        // Pulse effect when player is near
        if (distToPlayer < 150) {
          const pulse = Math.sin(Date.now() / 300) * 0.2 + 0.6;
          sprite.setAlpha(pulse);
        } else {
          sprite.setAlpha(watcher.active ? 0.6 : 0);
        }
      }
    });
  }
  
  // ====== MOVING WALLS ======
  
  private updateMovingWalls() {
    const now = Date.now();
    
    const keyPos = this.hasKey 
      ? { x: this.player.x, y: this.player.y }
      : { x: this.keySprite.x, y: this.keySprite.y };
    
    const wallEvent = this.movingWallSystem.tryTriggerWallMove(
      now,
      this.player.x,
      this.player.y,
      keyPos.x,
      keyPos.y,
      this.stairsSprite.x,
      this.stairsSprite.y,
      this.hasKey
    );
    
    if (wallEvent) {
      this.executeWallMove(wallEvent);
      
      // Trigger corruption on wall move
      const corruptionEffect = this.corruptionManager.triggerOnWallMove();
      this.executeCorruptionEffect(corruptionEffect);
      
      // Alert stalker
      if (this.stalker && this.stalker.state === 'dormant') {
        this.stalker.state = 'investigating';
        this.stalker.targetX = this.player.x;
        this.stalker.targetY = this.player.y;
      }
    }
  }
  
  private executeWallMove(event: WallMoveEvent) {
    const wall = event.wall;
    const key = `${wall.x}_${wall.y}_${wall.horizontal}`;
    
    if (event.closing) {
      // Show wall appearing with telegraph
      for (let i = 0; i < wall.length; i++) {
        const wx = (wall.horizontal ? wall.x + i : wall.x) * this.tileSize;
        const wy = (wall.horizontal ? wall.y : wall.y + i) * this.tileSize;
        
        // Telegraph with warning rectangle
        const warning = this.add.rectangle(
          wx + this.tileSize / 2,
          wy + this.tileSize / 2,
          this.tileSize - 4,
          this.tileSize - 4,
          0xff4444,
          0.3
        ).setDepth(3);
        
        this.tweens.add({
          targets: warning,
          alpha: 0.6,
          duration: 300,
          yoyo: true,
          repeat: 2,
          onComplete: () => {
            warning.destroy();
            
            // Create actual wall
            const wallRect = this.add.rectangle(
              wx + this.tileSize / 2,
              wy + this.tileSize / 2,
              this.tileSize - 2,
              this.tileSize - 2,
              0x8b0000,
              1
            ).setDepth(3);
            
            this.movingWallSprites.set(`${key}_${i}`, wallRect);
            
            // Add to physics walls
            this.physics.add.existing(wallRect, true);
            this.walls.add(wallRect);
          }
        });
      }
      
      this.showTemporaryMessage('*WALLS SHIFTING*', '#ff4444', 1000);
      this.cameras.main.shake(200, 0.005);
    } else {
      // Wall disappearing
      for (let i = 0; i < wall.length; i++) {
        const wallKey = `${key}_${i}`;
        const wallRect = this.movingWallSprites.get(wallKey);
        
        if (wallRect) {
          this.tweens.add({
            targets: wallRect,
            alpha: 0,
            duration: 500,
            onComplete: () => {
              this.walls.remove(wallRect, true, true);
              wallRect.destroy();
              this.movingWallSprites.delete(wallKey);
            }
          });
        }
      }
    }
  }
  
  // ====== CORRUPTION EFFECTS ======
  
  private updateCorruption() {
    const now = Date.now();
    const stalkerDist = Math.sqrt(
      Math.pow(this.stalker.x - this.player.x, 2) +
      Math.pow(this.stalker.y - this.player.y, 2)
    );
    
    const corruptionEffect = this.corruptionManager.tryTriggerCorruption(
      now,
      this.runState.curse,
      stalkerDist,
      this.hasKey
    );
    
    if (corruptionEffect) {
      this.executeCorruptionEffect(corruptionEffect);
    }
  }
  
  private executeCorruptionEffect(effect: CorruptionEffect) {
    switch (effect.type) {
      case 'horizontal_shift':
        this.corruptionHorizontalShift(effect.intensity, effect.duration);
        break;
      case 'scanline':
        this.corruptionScanline(effect.intensity, effect.duration);
        break;
      case 'chromatic':
        this.corruptionChromatic(effect.intensity, effect.duration);
        break;
      case 'hud_flicker':
        this.corruptionHudFlicker(effect.duration);
        break;
      case 'static_noise':
        this.corruptionStaticNoise(effect.intensity, effect.duration);
        break;
      case 'camera_shake':
        this.cameras.main.shake(effect.duration, effect.intensity * 0.01);
        break;
      case 'visual_glitch':
        this.screenGlitch(); // Reuse existing jumpscare effect
        break;
    }
  }
  
  private corruptionHorizontalShift(intensity: number, duration: number) {
    const shiftAmount = intensity * 20;
    const originalX = this.cameras.main.scrollX;
    
    this.tweens.add({
      targets: this.cameras.main,
      scrollX: originalX + shiftAmount,
      duration: duration / 3,
      yoyo: true,
      ease: 'Sine.easeInOut'
    });
  }
  
  private corruptionScanline(intensity: number, duration: number) {
    const scanline = this.add.rectangle(
      this.cameras.main.width / 2,
      0,
      this.cameras.main.width,
      3,
      0xffffff,
      intensity * 0.3
    ).setScrollFactor(0).setDepth(160);
    
    // UI camera only
    this.cameras.main.ignore(scanline);
    
    this.tweens.add({
      targets: scanline,
      y: this.cameras.main.height,
      duration: duration,
      onComplete: () => scanline.destroy()
    });
  }
  
  private corruptionChromatic(intensity: number, duration: number) {
    // Simulate chromatic aberration with overlays
    const overlay1 = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0xff0000,
      intensity * 0.1
    ).setScrollFactor(0).setDepth(160).setBlendMode(Phaser.BlendModes.ADD);
    
    // UI camera only
    this.cameras.main.ignore(overlay1);
    
    this.tweens.add({
      targets: overlay1,
      alpha: 0,
      duration: duration,
      onComplete: () => overlay1.destroy()
    });
  }
  
  private corruptionHudFlicker(duration: number) {
    const originalAlpha = this.statusText.alpha;
    
    this.tweens.add({
      targets: this.statusText,
      alpha: 0.2,
      duration: duration / 4,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this.statusText.setAlpha(originalAlpha);
      }
    });
  }
  
  private corruptionStaticNoise(intensity: number, duration: number) {
    const noise = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0xffffff,
      intensity * 0.15
    ).setScrollFactor(0).setDepth(160);
    
    // UI camera only
    this.cameras.main.ignore(noise);
    
    // Flicker rapidly
    this.tweens.add({
      targets: noise,
      alpha: 0,
      duration: 50,
      yoyo: true,
      repeat: Math.floor(duration / 100),
      onComplete: () => noise.destroy()
    });
  }

  // ====== STALKER AI ======

  private createStalker(worldWidth: number, worldHeight: number) {
    // Create stalker AI
    this.stalker = new Stalker({
      floor: this.runState.floor,
      seed: this.runState.seed,
      worldWidth,
      worldHeight,
      tileSize: this.tileSize,
    });

    // Spawn stalker away from player
    this.stalker.spawn(this.player.x, this.player.y, this.floorData.tiles);

    // Create stalker sprite
    const graphics = this.add.graphics();
    graphics.fillStyle(0x8b0000, 1); // Dark red
    graphics.fillRect(-10, -14, 20, 28); // Slightly larger than player
    graphics.fillStyle(0xff0000, 0.5); // Red glow
    graphics.fillCircle(0, -8, 8);
    graphics.generateTexture('stalker', 24, 32);
    graphics.destroy();

    this.stalkerSprite = this.add.sprite(this.stalker.x, this.stalker.y, 'stalker');
    this.stalkerSprite.setDepth(9); // Just below player
    this.stalkerSprite.setAlpha(0); // Start invisible
  }

  private updateStalker(delta: number) {
    if (!this.stalker || !this.stalkerSprite) return;

    const result = this.stalker.update(
      delta,
      this.player.x,
      this.player.y,
      this.flashlightOn,
      this.floorData.tiles
    );

    // Update sprite position
    this.stalkerSprite.setPosition(this.stalker.x, this.stalker.y);

    // Update visibility based on stalker state
    if (result.visible) {
      this.stalkerSprite.setAlpha(Math.min(this.stalkerSprite.alpha + 0.02, 0.8));
    } else {
      this.stalkerSprite.setAlpha(Math.max(this.stalkerSprite.alpha - 0.01, 0));
    }

    // Handle player caught
    if (result.caught) {
      this.onPlayerCaught();
    }
  }

  private onPlayerCaught() {
    // Disable player movement
    this.player.setVelocity(0);
    this.input.keyboard?.enabled && (this.input.keyboard.enabled = false);

    // Damage player from stalker
    const now = Date.now();
    if (now - this.lastDamageTime < this.invulnerabilityDuration) {
      // Still invulnerable from recent hit, just retreat stalker
      this.stalker.state = 'retreating';
      this.input.keyboard && (this.input.keyboard.enabled = true);
      return;
    }
    
    this.lastDamageTime = now;
    this.runState.hp = Math.max(0, this.runState.hp - 35); // Stalker does significant damage
    this.runState.curse = Math.min(100, this.runState.curse + 30);

    // Show caught message
    const caughtText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      'STALKER ATTACK!',
      {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#ff0000',
        backgroundColor: '#000000',
        padding: { x: 20, y: 12 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);
    
    // UI camera only
    this.cameras.main.ignore(caughtText);

    this.tweens.add({
      targets: caughtText,
      alpha: 1,
      duration: 200,
    });

    // Player flash
    this.tweens.add({
      targets: this.player,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.player.setAlpha(1)
    });

    // Check if player dies
    if (this.runState.hp <= 0 || this.runState.curse >= 100) {
      // Player dies
      this.time.delayedCall(2000, () => {
        this.runState.status = 'lost';
        this.registry.set('runState', this.runState);
        this.playerDeath();
      });
    } else {
      // Player survives but stalker retreats
      this.time.delayedCall(2000, () => {
        caughtText.destroy();
        
        // Re-enable input
        if (this.input.keyboard) {
          this.input.keyboard.enabled = true;
        }
        
        // Force stalker to retreat
        this.stalker.state = 'retreating';
        this.showTemporaryMessage(`-35 HP | CURSE: ${Math.floor(this.runState.curse)}%`, '#ff4444');
        this.updateStatusText();
      });
    }
  }

  private showGameOver() {
    this.cameras.main.fadeIn(300);
    
    const { width, height } = this.cameras.main;
    
    this.add.text(width / 2, height / 2 - 80, 'THE STALKER GOT YOU', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#ff0000',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 20, 'YOU FAILED TO ESCAPE', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#d9f3ea',
    }).setOrigin(0.5);

    const elapsed = Math.floor((Date.now() - this.runState.timeStarted) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    this.add.text(width / 2, height / 2 + 40, [
      `FINAL SCORE: ${this.runState.score}`,
      `TIME: ${minutes}:${seconds.toString().padStart(2, '0')}`,
      `FLOORS CLEARED: ${this.runState.floorsCompleted}`,
    ].join('\n'), {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#a5b6b5',
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5);
  }
}
