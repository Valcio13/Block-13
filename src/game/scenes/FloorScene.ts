import Phaser from 'phaser';
import { generateFloor } from '../../core/floor';
import { completeFloor } from '../../core/run';
import type { Floor } from '../../core/floor';
import type { RunState } from '../../core/run';

interface FloorSceneData {
  runState: RunState;
}

export class FloorScene extends Phaser.Scene {
  private runState!: RunState;
  private floorData!: Floor;
  private tileSize = 32;
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key };
  private flashlightKey!: Phaser.Input.Keyboard.Key;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private keySprite!: Phaser.GameObjects.Sprite;
  private stairsSprite!: Phaser.GameObjects.Sprite;
  private hasKey = false;
  private stairsUnlocked = false;
  private statusText!: Phaser.GameObjects.Text;
  private flashlightOn = false;
  private darkness!: Phaser.GameObjects.Graphics;

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
  }

  create() {
    const { width, height, tiles, start, key, exit, doors } = this.floorData;

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

    // Create key sprite
    this.keySprite = this.createKey(key[0], key[1]);

    // Create stairs sprite (locked initially)
    this.stairsSprite = this.createStairs(exit[0], exit[1]);

    // Create player at start position
    this.player = this.createPlayer(start[0], start[1]);

    // Setup collisions
    this.physics.add.collider(this.player, this.walls);
    
    // Setup overlap detection for key
    this.physics.add.overlap(this.player, this.keySprite, this.collectKey, undefined, this);
    
    // Setup overlap detection for stairs
    this.physics.add.overlap(this.player, this.stairsSprite, this.reachStairs, undefined, this);

    // Camera follows player smoothly
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Setup input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.flashlightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F);

    // Create darkness/lighting system
    this.setupLighting();

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
      this.add.text(this.cameras.main.width - 16, 16, `⚠ DANGER: ${dangerLevel}`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: dangerColor,
        backgroundColor: '#07090d',
        padding: { x: 8, y: 4 },
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    }

    // Controls hint
    this.add.text(16, this.cameras.main.height - 60, 'WASD / ARROWS - MOVE\nF - FLASHLIGHT', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#a5b6b5',
      backgroundColor: '#07090d',
      padding: { x: 8, y: 4 },
      lineSpacing: 2,
    }).setScrollFactor(0).setDepth(100);
  }

  update(time: number, delta: number) {
    this.handlePlayerMovement();
    this.handleFlashlight();
    this.updateLighting();
    this.drainBattery(delta);
  }

  private setupLighting() {
    // Create darkness overlay
    this.darkness = this.add.graphics();
    this.darkness.setDepth(49);
  }

  private updateLighting() {
    this.darkness.clear();

    const playerX = this.player.x;
    const playerY = this.player.y;

    if (this.flashlightOn && this.runState.battery > 0) {
      // Draw full darkness
      this.darkness.fillStyle(0x000000, 0.90);
      this.darkness.fillRect(0, 0, this.floorData.width * this.tileSize, this.floorData.height * this.tileSize);

      // Create flashlight beam (layered circles for gradient effect)
      const beamRadius = 140;
      
      // Outer glow
      this.darkness.fillStyle(0x000000, -0.2); // Subtract blend
      this.darkness.fillCircle(playerX, playerY, beamRadius);
      
      // Middle
      this.darkness.fillStyle(0x000000, -0.3);
      this.darkness.fillCircle(playerX, playerY, beamRadius * 0.7);
      
      // Core light
      this.darkness.fillStyle(0x000000, -0.5);
      this.darkness.fillCircle(playerX, playerY, beamRadius * 0.4);
      
    } else {
      // Ambient darkness (no flashlight)
      this.darkness.fillStyle(0x000000, 0.75);
      this.darkness.fillRect(0, 0, this.floorData.width * this.tileSize, this.floorData.height * this.tileSize);

      // Small ambient light around player
      const ambientRadius = 60;
      this.darkness.fillStyle(0x000000, -0.25);
      this.darkness.fillCircle(playerX, playerY, ambientRadius);
    }
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

  private showTemporaryMessage(text: string, color: string) {
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
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);

    this.tweens.add({
      targets: msg,
      alpha: 1,
      duration: 150,
      onComplete: () => {
        this.time.delayedCall(1200, () => {
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
    const flashStatus = this.flashlightOn ? '■' : '□';
    
    const lines = [
      `FLOOR ${this.runState.floor}/3`,
      `SCORE: ${this.runState.score}`,
      `BATTERY: ${Math.floor(this.runState.battery)}%`,
      `LIGHT: ${flashStatus}`,
    ];
    this.statusText.setText(lines.join('\n'));
    
    // Update color based on battery
    if (this.runState.battery <= 20) {
      this.statusText.setColor(batteryColor);
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

    // Horizontal movement
    if (left) {
      this.player.setVelocityX(-speed);
    } else if (right) {
      this.player.setVelocityX(speed);
    }

    // Vertical movement
    if (up) {
      this.player.setVelocityY(-speed);
    } else if (down) {
      this.player.setVelocityY(speed);
    }

    // Normalize diagonal movement
    if ((left || right) && (up || down)) {
      this.player.setVelocity(
        this.player.body!.velocity.x * 0.707,
        this.player.body!.velocity.y * 0.707
      );
    }
  }

  private collectKey(
    player: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody,
    key: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody
  ) {
    if (this.hasKey) return;

    this.hasKey = true;
    
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

    // Unlock the stairs
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
    const notification = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 50,
      'KEY COLLECTED!\nSTAIRS UNLOCKED',
      {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffd700',
        backgroundColor: '#000000',
        padding: { x: 12, y: 8 },
        align: 'center',
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);

    this.tweens.add({
      targets: notification,
      alpha: 1,
      duration: 200,
      onComplete: () => {
        this.time.delayedCall(1500, () => {
          this.tweens.add({
            targets: notification,
            alpha: 0,
            duration: 300,
            onComplete: () => notification.destroy(),
          });
        });
      }
    });
  }

  private reachStairs(
    player: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody,
    stairs: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile | Phaser.Types.Physics.Arcade.GameObjectWithBody
  ) {
    if (!this.stairsUnlocked) {
      // Show locked message (throttled to avoid spam)
      if (!this.time.now || this.time.now % 1000 < 100) {
        this.showTemporaryMessage('STAIRS LOCKED - FIND THE KEY', '#ff4444');
      }
      return;
    }

    // Floor complete!
    this.completeFloor();
  }

  private completeFloor() {
    // Disable player movement
    this.player.setVelocity(0);
    this.input.keyboard?.enabled && (this.input.keyboard.enabled = false);

    // Update run state
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

    // Show score gain
    const scoreGain = 100 * this.runState.floor;
    const scoreText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 60,
      `+${scoreGain} POINTS`,
      {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffd700',
        backgroundColor: '#000000',
        padding: { x: 12, y: 8 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);

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
          // Go to next floor
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
}
