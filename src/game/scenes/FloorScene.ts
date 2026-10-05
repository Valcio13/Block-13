import Phaser from 'phaser';
import { type CorruptionEffect } from '../../core/corruption';
import { AudioDirector, AUDIO_KEYS } from '../../core/audioDirector';
import { SimulationEngine } from '../../core/simulationEngine';
import { InputPipeline, InputRecorder, InputReplayer, LiveInputSource, type InputSource, type InputState } from '../../core/inputRecorder';
import { firstMimicTwitchDelay, mimicTwitch } from '../../core/cosmeticAnimation';
import { audioCuesForEvents, audioCuesForStateChange, floorAmbienceKeys, type AudioCue } from '../../core/presentationAudio';
import type { Floor, Searchable } from '../../core/floor';
import type { RunState } from '../../core/run';
import { AuthoritativeSimulation, FIXED_SCALE, type AuthoritativeState } from '../../core/authoritativeSimulation';
import { encodeFinalStateV1, finalStateV1FromSimulation, hashFinalStateV1 } from '../../core/finalStateV1';
import { keccak256, toHex } from 'viem';
import { getAuthoredClueForSearchId } from '../../core/clues';
import { formatFixedPointPercent, formatWholePercent } from '../../core/uiFormatting';
import { corruptionVisualStrength, floorVisualProfile, flashlightVisualFactor, tileDressingAt } from '../../core/visualAtmosphere';
import { isBlock13Floor, progressionName, START_FLOOR } from '../../core/progression';
import { enemyPresentationExposure } from '../presentationVisibility';

interface FloorSceneData {
  runState: RunState;
  /** Optional encoded run log, supplied by a replay launcher. */
  replayLog?: Uint8Array;
}

interface SearchableSprite {
  sprite: Phaser.GameObjects.Sprite;
  halo: Phaser.GameObjects.Arc;
  data: Searchable;
  searched: boolean;
}

export class FloorScene extends Phaser.Scene {
  private runState!: RunState;
  private floorData!: Floor;
  private tileSize = 32;
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key };
  private flashlightKey!: Phaser.Input.Keyboard.Key;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private keySprite!: Phaser.GameObjects.Sprite;
  private stairsSprite!: Phaser.GameObjects.Sprite;
  private keyHalo!: Phaser.GameObjects.Arc;
  private stairsHalo!: Phaser.GameObjects.Arc;
  private searchableSprites: SearchableSprite[] = [];
  private hasKey = false;
  private stairsUnlocked = false;

  // Deterministic replay system
  private simulationEngine!: SimulationEngine;
  private inputRecorder!: InputRecorder;
  private inputSource?: InputSource;
  private inputPipeline!: InputPipeline;
  private authoritativeSimulation!: AuthoritativeSimulation;

  // Mimic twitch state (tick-based)
  private mimicTwitchStates: Map<Phaser.GameObjects.Sprite, { nextTick: number; entityId: number }> = new Map();
  private statusText!: Phaser.GameObjects.Text;
  private interactPrompt!: Phaser.GameObjects.Text;
  private controlsHint!: Phaser.GameObjects.Text;
  private dangerIndicator?: Phaser.GameObjects.Text;
  private healthBarBg!: Phaser.GameObjects.Rectangle;
  private healthBarFill!: Phaser.GameObjects.Graphics;
  private healthBarText!: Phaser.GameObjects.Text;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera; // Dedicated UI camera
  private flashlightOn = false;
  private lightmapTexture!: Phaser.GameObjects.RenderTexture;
  private lightmapGraphics!: Phaser.GameObjects.Graphics;
  private damageVignette!: Phaser.GameObjects.Graphics;
  private corruptionVignette!: Phaser.GameObjects.Graphics;
  private playerFacingAngle = 0;
  private stalkerSprite!: Phaser.GameObjects.Sprite;
  private audioDirector!: AudioDirector;
  private ambusherSprites: Phaser.GameObjects.Sprite[] = [];
  private crawlerSprites: Phaser.GameObjects.Sprite[] = [];
  private watcherSprites: Phaser.GameObjects.Sprite[] = [];
  private isPaused = false; // Track pause state
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private isTransitioning = false; // Track floor transitions
  private storyPopupOpen = false; // Track if story popup is displayed
  private closeStoryPopup?: () => void;
  private storyCloseKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'FloorScene' });
  }

  init(data: FloorSceneData) {
    // CRITICAL: Always use registry as single source of truth
    // scene.restart() data params are unreliable in Phaser
    const registryState = this.registry.get('runState') as RunState | undefined;
    this.runState = registryState || data.runState;

    // Reset per-floor state
    this.hasKey = false;
    this.stairsUnlocked = false;
    this.flashlightOn = false;
    this.searchableSprites = [];
    this.isTransitioning = false;
    this.storyPopupOpen = false;
    this.closeStoryPopup = undefined;
    this.storyCloseKey = undefined;
    // Phaser restarts this Scene instance. Clear every presentation reference
    // here so create() cannot accidentally touch a destroyed floor's objects.
    this.statusText = undefined as unknown as Phaser.GameObjects.Text;
    this.dangerIndicator = undefined;
    this.healthBarBg = undefined as unknown as Phaser.GameObjects.Rectangle;
    this.healthBarFill = undefined as unknown as Phaser.GameObjects.Graphics;
    this.healthBarText = undefined as unknown as Phaser.GameObjects.Text;
    this.uiCamera = undefined as unknown as Phaser.Cameras.Scene2D.Camera;
    this.lightmapTexture = undefined as unknown as Phaser.GameObjects.RenderTexture;
    this.lightmapGraphics = undefined as unknown as Phaser.GameObjects.Graphics;
    this.damageVignette = undefined as unknown as Phaser.GameObjects.Graphics;
    this.corruptionVignette = undefined as unknown as Phaser.GameObjects.Graphics;
    this.mimicTwitchStates.clear();

    // Initialize simulation engine and input recorder
    this.simulationEngine = this.registry.get('simulationEngine') as SimulationEngine | undefined ?? new SimulationEngine();
    this.registry.set('simulationEngine', this.simulationEngine);
    this.inputRecorder = this.registry.get('inputRecorder') as InputRecorder | undefined ?? new InputRecorder();
    this.registry.set('inputRecorder', this.inputRecorder);
    this.authoritativeSimulation = this.registry.get('authoritativeSimulation') as AuthoritativeSimulation | undefined
      ?? new AuthoritativeSimulation(BigInt(this.runState.canonicalSeed), {
        floor: this.runState.floor, hp: this.runState.hp, battery: Math.round(this.runState.battery * FIXED_SCALE),
        curse: Math.round(this.runState.curse * FIXED_SCALE), score: this.runState.score, floorsCompleted: this.runState.floorsCompleted,
      });
    this.registry.set('authoritativeSimulation', this.authoritativeSimulation);
    this.floorData = this.authoritativeSimulation.floor;
    const savedInputSource = this.registry.get('inputSource') as InputSource | undefined;
    this.inputSource = data.replayLog
      ? InputReplayer.fromBinary(data.replayLog)
      : savedInputSource instanceof InputReplayer ? savedInputSource : undefined;
    if (this.inputSource) this.registry.set('inputSource', this.inputSource);

    // Reset tick-based timing
  }

  create() {
    // Scene class methods are not lifecycle hooks unless subscribed explicitly.
    // Register per run so custom audio and detached presentation resources are
    // released on restart as well as when the scene is stopped.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    const { width, height, tiles, start, key, exit, searchables } = this.floorData;

    // Calculate camera bounds
    const worldWidth = width * this.tileSize;
    const worldHeight = height * this.tileSize;

    // Set world bounds
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    // Draw floor tiles; collision is resolved only by AuthoritativeSimulation.
    this.drawFloor(tiles);

    // Create searchable objects
    this.createSearchables(searchables);

    // Create key sprite
    this.keySprite = this.createKey(key[0], key[1]);

    // Create stairs sprite (locked initially)
    this.stairsSprite = this.createStairs(exit[0], exit[1]);

    // Create player at start position
    this.player = this.createPlayer(start[0], start[1]);

    // Create stalker
    this.createStalker(worldWidth, worldHeight);

    // Create audio director
    this.audioDirector = new AudioDirector({
      seed: this.runState.seed,
      scene: this,
    });
    for (const key of floorAmbienceKeys(this.authoritativeSimulation.state.floor)) {
      this.audioDirector.play(key, 'ambience', { loop: true, volume: 0.32 });
    }
    if (isBlock13Floor(this.authoritativeSimulation.state.floor)) {
      this.audioDirector.playWithCooldown('sfx_block13_reveal', 'sfx', 5000, { volume: 0.8 });
    }

    // Legacy managers are not constructed: AuthoritativeSimulation owns all AI,
    // random decisions, movement, damage, searches, and progression.
    this.createSecondaryEnemySprites();
    this.createAmbusherSprites();

    // Camera follows player smoothly with increased zoom
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.4); // Closer camera - less maze visible

    // Create dedicated UI camera that ignores world zoom
    this.uiCamera = this.cameras.add(0, 0, this.cameras.main.width, this.cameras.main.height);
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setZoom(1); // Always 1:1, never zooms

    // Make UI camera ignore all game objects by defaul
    this.uiCamera.ignore(this.children.list);

    // Setup lighting AFTER world is created
    this.setupLighting(worldWidth, worldHeight);
    this.setupAtmosphereOverlays();
    if (isBlock13Floor(this.authoritativeSimulation.state.floor)) this.playBlock13Arrival();

    // Make sure UI camera ignores the lightmap (it was added after the initial ignore call)
    this.uiCamera.ignore(this.lightmapTexture);

    // Setup inpu
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.flashlightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.pauseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    if (!this.inputSource) {
      this.inputSource = new LiveInputSource(() => this.readKeyboardInput());
      this.registry.set('inputSource', this.inputSource);
    }
    this.inputPipeline = new InputPipeline(this.inputSource, this.inputRecorder);

    // Setup pause key handler
    this.pauseKey.on('down', () => {
      if (this.storyPopupOpen) {
        this.closeStoryPopup?.();
        return;
      }
      if (!this.isPaused) {
        this.showPauseMenu();
      }
    });
    this.storyCloseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.storyCloseKey.on('down', () => this.closeStoryPopup?.());

    // Ensure keyboard is enabled
    if (this.input.keyboard) {
      this.input.keyboard.enabled = true;
    }

    // Floor info with run state
    const dangerLevel = this.runState.curse;

    this.statusText = this.add.text(16, 16, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#70d4c6',
      backgroundColor: '#07090d',
      padding: { x: 8, y: 4 },
      lineSpacing: 2,
    }).setScrollFactor(0).setDepth(100);

    // Danger indicator
    {
      this.dangerIndicator = this.add.text(this.cameras.main.width - 16, 16, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#70d4c6',
        backgroundColor: '#07090d',
        padding: { x: 8, y: 4 },
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(100).setVisible(dangerLevel > 0);
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

    // Controls hin
    this.controlsHint = this.add.text(16, this.cameras.main.height - 100, 'WASD / ARROWS - MOVE\nF - FLASHLIGHT\nE - INTERACT\nESC - PAUSE', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#a5b6b5',
      backgroundColor: '#07090d',
      padding: { x: 8, y: 4 },
      lineSpacing: 2,
    }).setScrollFactor(0).setDepth(100);

    // Create horizontal health bar at top center
    const healthBarWidth = 300;
    const healthBarHeight = 20;
    const healthBarX = this.cameras.main.width / 2;
    const healthBarY = 20;

    // Background (dark) - using Graphics for better control
    this.healthBarBg = this.add.rectangle(
      healthBarX,
      healthBarY,
      healthBarWidth,
      healthBarHeight,
      0x1a1a1a,
      1
    ).setScrollFactor(0).setDepth(100);

    // Health fill - using Graphics object instead of Rectangle
    const fillGraphics = this.add.graphics();
    fillGraphics.setScrollFactor(0).setDepth(101);
    this.healthBarFill = fillGraphics as any; // Store as graphics

    // HP text overlay
    this.healthBarText = this.add.text(
      healthBarX,
      healthBarY,
      `${Math.floor(this.runState.hp)} / 100 HP`,
      {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff',
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    this.updateHealthBar();

    // Make UI camera only render HUD elements
    this.cameras.main.ignore([
      this.statusText,
      this.interactPrompt,
      this.controlsHint,
      this.healthBarBg,
      this.healthBarFill,
      this.healthBarText
    ]);
    if (this.dangerIndicator) {
      this.cameras.main.ignore(this.dangerIndicator);
    }

    // All lifecycle-owned HUD objects must be recreated before any updater
    // touches them. updateStatusText also updates the health bar.
    this.updateStatusText();
  }

  update(time: number, delta: number) {
    // Story and pause overlays freeze simulation ticks. Dismissing a note is UI
    // input only, so it is neither recorded nor allowed to consume a gameplay tick.
    if (!this.storyPopupOpen && !this.isTransitioning && !this.isPaused) {
      this.simulationEngine.update(delta, (fixedDelta, tick) => {
        this.fixedUpdate(fixedDelta, tick);
      }, () => this.storyPopupOpen || this.isTransitioning || this.isPaused);
    }

    // Update UI (can use variable delta/wall-clock timing - cosmetic only)
    this.updateStatusText();
  }

  /**
   * Fixed timestep update - runs at consistent 60 Hz
   * All gameplay logic must be deterministic
   */
  private fixedUpdate(fixedDelta: number, tick: number) {
    // Don't update during transitions/pauses/popups
    if (this.isTransitioning || this.isPaused || this.storyPopupOpen) {
      return;
    }
    if (this.authoritativeSimulation.state.status !== 'playing') return;

    // Single live/replay input path into the Phaser-free authority.
    this.inputPipeline.step(tick, inputs => {
      const before = this.authoritativeSimulation.state;
      const previousFloor = before.floor;
      const result = this.authoritativeSimulation.stepWithEvents(inputs);
      const state = result.state;
      this.player.setPosition(state.x / FIXED_SCALE, state.y / FIXED_SCALE);
      this.flashlightOn = state.flashlightOn;
      this.runState.floor = state.floor;
      this.runState.floorsCompleted = state.floorsCompleted;
      this.runState.hp = state.hp;
      this.runState.battery = state.battery / FIXED_SCALE;
      this.runState.curse = state.curse / FIXED_SCALE;
      this.runState.score = state.score;
      this.runState.status = state.status;
      this.registry.set('runState', this.runState);
      // Progression has already happened in the simulation. Start the scene
      // presentation timer immediately and do not let an event/tween/render
      // adapter run before it or become a gate for loading the next floor.
      if (state.floor !== previousFloor && state.status === 'playing') {
        this.completeFloor(before, state);
        return;
      }

      this.updateLighting();
      this.renderAuthoritativeState(before, state, result.events);
      this.presentSimulationEvents(result.events);
      if (state.status === 'won') {
        this.audioDirector.stopCategory('ambience');
        this.showVictoryScreen(this.runState);
      } else if (state.status === 'lost') {
        this.audioDirector.stopCategory('ambience');
        this.playerDeath();
      }
    });

    // InputPipeline records this terminal tick after the simulation callback.
    // Freeze both canonical artifacts only after that write is complete.
    const state = this.authoritativeSimulation.state;
    if (state.status !== 'playing') {
      this.inputRecorder.setTerminalTick(state.tick);
      const inputLogV2Bytes = this.inputRecorder.encodeBinary();
      this.registry.set('inputLogV2Bytes', inputLogV2Bytes);
      this.registry.set('inputHash', keccak256(toHex(inputLogV2Bytes)));
      if (this.runState.manifest) {
        const finalState = finalStateV1FromSimulation(this.runState.manifest, this.authoritativeSimulation);
        const finalStateV1Bytes = encodeFinalStateV1(finalState);
        this.registry.set('finalStateV1', finalState);
        this.registry.set('finalStateV1Bytes', finalStateV1Bytes);
        this.registry.set('finalStateHash', hashFinalStateV1(finalState));
      }
    }
  }

  private presentSimulationEvents(events: ReturnType<AuthoritativeSimulation['stepWithEvents']>['events']) {
    for (const audioCue of audioCuesForEvents(events)) this.playAudioCue(audioCue);
    for (const event of events) {
      if (event.type === 'key_collected') this.showTemporaryMessage('KEY FOUND', '#ffd700');
      else if (event.type === 'damage') this.showTemporaryMessage(`HURT -${event.amount} HP`, '#ff6666');
      else if (event.type === 'loot_searched') {
        const result = event.result;
        if (result.type === 'battery') this.showTemporaryMessage(`BATTERY +${result.amount}%`, '#70d4c6');
        else if (result.type === 'health') this.showTemporaryMessage(`HEALTH +${result.amount} HP`, '#70d4c6');
        else if (result.type === 'collectible') this.showTemporaryMessage(`${result.item.toUpperCase()} +${result.score} POINTS`, '#ffd700');
        else if (result.type === 'clue') {
          const clue = getAuthoredClueForSearchId(result.id);
          this.showClueModal(clue?.title ?? 'NOTE FOUND', clue?.content ?? 'The writing is too faded to read.');
        } else if (result.type === 'nothing') this.showTemporaryMessage('EMPTY', '#a5b6b5');
        else this.showTemporaryMessage('SOMETHING MOVED INSIDE', '#ff6666');
      } else if (event.type === 'floor_transition' && event.toFloor >= 0) {
        this.showTemporaryMessage(`FLOOR ${event.toFloor} UNLOCKED`, '#ffd700');
      }
    }
  }

  private playAudioCue(audioCue: AudioCue) {
    const director = this.audioDirector;
    if (!director) return;
    if (audioCue.key === 'sfx_player_hurt') {
      director.playVariantWithCooldown(audioCue.key, AUDIO_KEYS.player.hurtVariants, 'sfx', audioCue.cooldownMs, { volume: 0.7 });
    } else if (audioCue.key === 'sfx_crawler_skitter') {
      director.playVariantWithCooldown(audioCue.key, 2, 'sfx', audioCue.cooldownMs, { volume: 0.5 });
    } else if (audioCue.positional) {
      director.playPositionalWithCooldown({
        key: audioCue.key,
        x: audioCue.positional.x / FIXED_SCALE,
        y: audioCue.positional.y / FIXED_SCALE,
        maxDistance: 420,
        category: 'sfx',
        volume: 0.65,
      }, this.player.x, this.player.y, audioCue.cooldownMs);
    } else {
      director.playWithCooldown(audioCue.key, 'sfx', audioCue.cooldownMs, { volume: 0.65 });
    }
  }

  /** Presentation adapter: every moving enemy/object comes from an immutable sim snapshot. */
  private renderAuthoritativeState(previous: AuthoritativeState, state: AuthoritativeState, events: ReturnType<AuthoritativeSimulation['stepWithEvents']>['events']) {
    if (state.facingX !== 0 || state.facingY !== 0) this.playerFacingAngle = Math.atan2(state.facingY, state.facingX);
    this.hasKey = state.hasKey;
    this.stairsUnlocked = state.hasKey;
    this.keySprite.setVisible(!state.hasKey);
    this.stairsSprite.setTexture(state.hasKey ? 'stairs_unlocked' : 'stairs_locked');
    this.searchableSprites.forEach((entry, index) => {
      entry.searched = state.searched[index] ?? true;
      const mimic = state.mimics.find(m => m.searchableIndex === index);
      if (mimic?.revealed) {
        this.mimicTwitchStates.delete(entry.sprite);
        const exposure = enemyPresentationExposure(this.floorData, state, mimic.x, mimic.y);
        entry.sprite.setVisible(mimic.active && exposure > 0);
        entry.sprite.setTexture('mimic_revealed');
        entry.sprite.setPosition(mimic.x / FIXED_SCALE, mimic.y / FIXED_SCALE);
        entry.sprite.setTint(exposure >= 0.7 ? 0xffe4dc : 0xc5a8ae).setAlpha(exposure);
        entry.sprite.setScale(1.2);
      } else {
        entry.sprite.setTexture(entry.data.isMimic ? `mimic_${entry.data.x}_${entry.data.y}` : `searchable_${entry.data.objectType}`);
        entry.sprite.setTint(0xffffff).setScale(1);
        entry.sprite.setVisible(!entry.searched);
      }
    });
    // Disguised mimics keep their old twitching presentation; it only moves
    // sprites and never feeds position back into authoritative state.
    this.updateMimicTwitches(state.tick);

    const stalker = state.stalker;
    this.stalkerSprite?.setPosition(stalker.x / FIXED_SCALE, stalker.y / FIXED_SCALE);
    const stalkerExposure = enemyPresentationExposure(this.floorData, state, stalker.x, stalker.y);
    this.stalkerSprite?.setAlpha(stalker.visible ? stalkerExposure * (stalker.state === 'hunting' ? 0.98 : 0.76) : 0);
    this.stalkerSprite?.setTint(stalker.state === 'hunting' && stalkerExposure >= 0.7 ? 0xffb7b0 : stalkerExposure >= 0.7 ? 0xe0d1d8 : 0xffffff);
    this.stalkerSprite?.setScale(stalker.visible && stalker.state === 'hunting' ? 1.14 : 1);
    state.crawlers.forEach((enemy, index) => {
      const sprite = this.crawlerSprites[index];
      const exposure = enemyPresentationExposure(this.floorData, state, enemy.x, enemy.y);
      sprite?.setPosition(enemy.x / FIXED_SCALE, enemy.y / FIXED_SCALE);
      sprite?.setAlpha(exposure * (enemy.chasing ? 1 : 0.76));
      sprite?.setTint(exposure >= 0.7 ? 0xe3d5bd : 0xffffff);
      sprite?.setScale(enemy.chasing ? 1 + Math.sin(state.tick * 0.16 + enemy.id) * 0.045 : 1);
      if (sprite) sprite.setFlipX(enemy.targetX < enemy.x);
    });
    state.watchers.forEach((enemy, index) => {
      const sprite = this.watcherSprites[index];
      const exposure = enemyPresentationExposure(this.floorData, state, enemy.x, enemy.y);
      sprite?.setPosition(enemy.x / FIXED_SCALE, enemy.y / FIXED_SCALE);
      sprite?.setAlpha(enemy.active ? exposure * (0.76 + Math.sin(state.tick * 0.045 + enemy.id) * 0.07) : 0);
      sprite?.setTint(exposure >= 0.7 ? 0xd9d4ef : 0xffffff);
    });
    state.ambushers.forEach((enemy, index) => {
      const sprite = this.ambusherSprites[index];
      const exposure = enemyPresentationExposure(this.floorData, state, enemy.x, enemy.y);
      sprite?.setPosition(enemy.x / FIXED_SCALE, enemy.y / FIXED_SCALE);
      const activePresentation = enemy.state === 'warning' || enemy.state === 'jumpscare';
      sprite?.setVisible(activePresentation && exposure > 0);
      sprite?.setAlpha(enemy.state === 'warning' ? exposure * (0.62 + (Math.sin(state.tick * 0.35 + enemy.id) + 1) * 0.14) : enemy.state === 'jumpscare' ? exposure : 0);
      sprite?.setTint(enemy.state === 'warning' ? 0xffdca0 : 0xffaaa0);
    });
    this.updateInteractionFeedback(state);
    this.updateCorruptionAtmosphere(state);
    this.updateAuthoritativePrompt(state);
    if (state.hp !== previous.hp) this.updateHealthBar();
    if ((state.x !== previous.x || state.y !== previous.y) && state.tick % 15 === 0) {
      this.audioDirector?.playVariantWithCooldown(AUDIO_KEYS.player.footstep, AUDIO_KEYS.player.footstepVariants, 'sfx', 90, { volume: 0.22 });
    }
    for (const audioCue of audioCuesForStateChange(previous, state, events)) this.playAudioCue(audioCue);
    if (state.damageEventId !== previous.damageEventId) {
      this.cameras.main.shake(150, 0.0035);
      this.flashDamageVignette();
    }
    if (state.scareEventId !== previous.scareEventId) this.cameras.main.shake(220, 0.006);
    if (state.corruption.effectId !== previous.corruption.effectId) {
      const names: CorruptionEffect['type'][] = ['horizontal_shift', 'scanline', 'chromatic', 'hud_flicker', 'static_noise', 'camera_shake', 'visual_glitch'];
      this.executeCorruptionEffect({
        type: names[state.corruption.effectType] ?? 'visual_glitch',
        intensity: state.corruption.intensityPermille / 1000,
        duration: SimulationEngine.ticksToMs(state.corruption.durationTicks),
      });
    }
  }

  private updateAuthoritativePrompt(state: AuthoritativeState) {
    const px = state.x, py = state.y, range2 = (48 * FIXED_SCALE) ** 2;
    let prompt = '';
    const keyX = (this.floorData.key[0] * 32 + 16) * FIXED_SCALE;
    const keyY = (this.floorData.key[1] * 32 + 16) * FIXED_SCALE;
    if (!state.hasKey && (px - keyX) ** 2 + (py - keyY) ** 2 <= range2) prompt = '[E] PICK UP KEY';
    else {
      const itemIndex = this.floorData.searchables.findIndex((item, i) => !state.searched[i] && (px - (item.x * 32 + 16) * FIXED_SCALE) ** 2 + (py - (item.y * 32 + 16) * FIXED_SCALE) ** 2 <= range2);
      if (itemIndex >= 0) prompt = `[E] SEARCH ${this.floorData.searchables[itemIndex].objectType.toUpperCase()}`;
      else {
        const [ex, ey] = this.floorData.exit;
        const dx = px - (ex * 32 + 16) * FIXED_SCALE, dy = py - (ey * 32 + 16) * FIXED_SCALE;
        if (dx * dx + dy * dy <= range2) prompt = state.hasKey ? '[E] DESCEND STAIRS' : '[E] STAIRS (LOCKED)';
      }
    }
    this.interactPrompt.setText(prompt);
    this.interactPrompt.setVisible(prompt.length > 0);
  }

  private updateInteractionFeedback(state: AuthoritativeState) {
    const px = state.x / FIXED_SCALE;
    const py = state.y / FIXED_SCALE;
    const tickPulse = 0.78 + (Math.sin(state.tick * 0.09) + 1) * 0.11;
    const updateHalo = (halo: Phaser.GameObjects.Arc, x: number, y: number, eligible: boolean) => {
      const dx = px - x, dy = py - y;
      const nearby = dx * dx + dy * dy <= 104 * 104;
      const visible = eligible && nearby && this.hasPresentationLineOfSight(px, py, x, y);
      halo.setVisible(visible);
      halo.setAlpha(tickPulse);
    };

    const keyX = this.floorData.key[0] * this.tileSize + this.tileSize / 2;
    const keyY = this.floorData.key[1] * this.tileSize + this.tileSize / 2;
    updateHalo(this.keyHalo, keyX, keyY, !state.hasKey);
    const exitX = this.floorData.exit[0] * this.tileSize + this.tileSize / 2;
    const exitY = this.floorData.exit[1] * this.tileSize + this.tileSize / 2;
    updateHalo(this.stairsHalo, exitX, exitY, true);
    this.searchableSprites.forEach((entry, index) => {
      const x = entry.data.x * this.tileSize + this.tileSize / 2;
      const y = entry.data.y * this.tileSize + this.tileSize / 2;
      updateHalo(entry.halo, x, y, !state.searched[index] && entry.sprite.visible);
    });
  }

  /** Visual-only tile ray. It only suppresses accents behind walls; it never changes interaction rules. */
  private hasPresentationLineOfSight(fromX: number, fromY: number, toX: number, toY: number): boolean {
    let x0 = Math.floor(fromX / this.tileSize), y0 = Math.floor(fromY / this.tileSize);
    const x1 = Math.floor(toX / this.tileSize), y1 = Math.floor(toY / this.tileSize);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    while (x0 !== x1 || y0 !== y1) {
      const twice = error * 2;
      if (twice >= dy) { error += dy; x0 += sx; }
      if (twice <= dx) { error += dx; y0 += sy; }
      if (x0 === x1 && y0 === y1) break; // The target can itself occupy a wall tile.
      if (!this.floorData.tiles[y0]?.[x0]) return false;
    }
    return true;
  }

  private createInteractableHalo(x: number, y: number, color: number, radius: number) {
    return this.add.circle(x, y, radius, color, 0.04)
      .setStrokeStyle(1, color, 0.5)
      .setDepth(3)
      .setVisible(false);
  }

  /**
   * Capture current input state
   */
  private readKeyboardInput(): InputState {
    const justPressedF = Phaser.Input.Keyboard.JustDown(this.flashlightKey);
    const justPressedE = Phaser.Input.Keyboard.JustDown(this.interactKey);

    return {
      left: this.cursors.left.isDown || this.wasd.a.isDown,
      right: this.cursors.right.isDown || this.wasd.d.isDown,
      up: this.cursors.up.isDown || this.wasd.w.isDown,
      down: this.cursors.down.isDown || this.wasd.s.isDown,
      flashlight: justPressedF,
      interact: justPressedE,
    };
  }

  /**
   * Update tick-based mimic twitches
   */
  private updateMimicTwitches(tick: number) {
    this.mimicTwitchStates.forEach((schedule, sprite) => {
      if (tick >= schedule.nextTick && sprite.active) {
        const twitch = mimicTwitch(schedule.entityId, tick);
        // Trigger twitch animation
        this.tweens.add({
          targets: sprite,
          x: sprite.x + twitch.offsetX,
          y: sprite.y + twitch.offsetY,
          duration: 100,
          yoyo: true,
        });

        // Schedule the next cosmetic twitch (2-5 seconds) without RNG state.
        this.mimicTwitchStates.set(sprite, { ...schedule, nextTick: tick + twitch.nextDelayTicks });
      }
    });
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
    const state = this.authoritativeSimulation.state;
    const profile = floorVisualProfile(state.floor);

    this.lightmapGraphics.clear();
    this.lightmapGraphics.fillStyle(profile.darkness, 1);
    this.lightmapGraphics.fillRect(0, 0, worldWidth, worldHeight);

    // Nested values soften the local visibility falloff without a shader.
    this.lightmapGraphics.fillStyle(scaleColor(profile.ambient, 0.34), 1);
    this.lightmapGraphics.fillCircle(this.player.x, this.player.y, 88);
    this.lightmapGraphics.fillStyle(scaleColor(profile.ambient, 0.48), 1);
    this.lightmapGraphics.fillCircle(this.player.x, this.player.y, 76);
    this.lightmapGraphics.fillStyle(scaleColor(profile.ambient, 0.62), 1);
    this.lightmapGraphics.fillCircle(this.player.x, this.player.y, 62);
    this.lightmapGraphics.fillStyle(scaleColor(profile.ambient, 0.82), 1);
    this.lightmapGraphics.fillCircle(this.player.x, this.player.y, 48);
    this.lightmapGraphics.fillStyle(scaleColor(profile.ambient, 1.08), 1);
    this.lightmapGraphics.fillCircle(this.player.x, this.player.y, 34);

    if (this.flashlightOn) {
      const startX = this.player.x;
      const startY = this.player.y;
      const factor = flashlightVisualFactor(state.tick, state.floor);
      const cone = (length: number, halfAngleDegrees: number, color: number) => {
        const halfAngle = Phaser.Math.DegToRad(halfAngleDegrees);
        const leftX = startX + Math.cos(this.playerFacingAngle - halfAngle) * length;
        const leftY = startY + Math.sin(this.playerFacingAngle - halfAngle) * length;
        const rightX = startX + Math.cos(this.playerFacingAngle + halfAngle) * length;
        const rightY = startY + Math.sin(this.playerFacingAngle + halfAngle) * length;
        this.lightmapGraphics.fillStyle(scaleColor(color, factor), 1);
        this.lightmapGraphics.fillTriangle(startX, startY, leftX, leftY, rightX, rightY);
      };
      cone(286, 35, scaleColor(profile.flashlight, 0.3));
      cone(270, 32, scaleColor(profile.flashlight, 0.42));
      cone(248, 28, scaleColor(profile.flashlight, 0.62));
      cone(226, 24, scaleColor(profile.flashlight, 0.82));
      cone(210, 20, profile.flashlight);
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
        wordWrap: { width: Math.max(240, this.cameras.main.width - 48), useAdvancedWrap: true },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);

    // Make main camera ignore this, let UI camera render i
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

  private showClueModal(title: string, content: string) {
    if (this.storyPopupOpen) return;
    this.storyPopupOpen = true;
    this.interactPrompt.setVisible(false);

    const { width, height } = this.cameras.main;
    const panelWidth = Math.min(600, width - 32);
    const panelHeight = Math.min(420, height - 32);
    const centerX = width / 2;
    const centerY = height / 2;
    const depth = 400;

    const overlay = this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.84)
      .setScrollFactor(0).setDepth(depth).setInteractive();
    const panel = this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0x101417, 1)
      .setScrollFactor(0).setDepth(depth + 1).setStrokeStyle(2, 0x8d7baa, 1);
    const heading = this.add.text(centerX, centerY - panelHeight / 2 + 38, title, {
      fontFamily: 'monospace', fontSize: '20px', color: '#d9c9ef', fontStyle: 'bold',
      align: 'center', wordWrap: { width: panelWidth - 56, useAdvancedWrap: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2);
    const note = this.add.text(centerX - panelWidth / 2 + 28, centerY - panelHeight / 2 + 86, content, {
      fontFamily: 'monospace', fontSize: '15px', color: '#e0ded7', lineSpacing: 8,
      wordWrap: { width: panelWidth - 56, useAdvancedWrap: true },
    }).setScrollFactor(0).setDepth(depth + 2);
    const closeButton = this.add.text(centerX, centerY + panelHeight / 2 - 34, 'CLOSE NOTE  ·  [SPACE / ESC]', {
      fontFamily: 'monospace', fontSize: '13px', color: '#70d4c6',
      backgroundColor: '#202a2a', padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2).setInteractive();
    const elements = [overlay, panel, heading, note, closeButton];
    this.cameras.main.ignore(elements);

    const close = () => {
      this.storyPopupOpen = false;
      elements.forEach(element => element.destroy());
      this.closeStoryPopup = undefined;
    };
    this.closeStoryPopup = close;
    closeButton.on('pointerdown', close);
  }

  private showPauseMenu() {
    this.isPaused = true;

    // Pause the scene's simulation update and input capture.

    // Dark overlay
    const overlay = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000,
      0.8
    ).setScrollFactor(0).setDepth(300).setInteractive();

    // Pause menu background
    const menuWidth = 400;
    const menuHeight = 300;
    const menu = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      menuWidth,
      menuHeight,
      0x1a1a1a,
      1
    ).setScrollFactor(0).setDepth(301);

    // Menu border
    const border = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      menuWidth,
      menuHeight
    ).setScrollFactor(0).setDepth(301).setStrokeStyle(2, 0x70d4c6, 1);

    // Pause title
    const title = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 100,
      'PAUSED',
      {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#70d4c6',
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(302);

    // Resume button
    const resumeButton = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 20,
      'RESUME',
      {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#d9f3ea',
        backgroundColor: '#2a2a2a',
        padding: { x: 20, y: 10 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(302).setInteractive();

    // Main menu button
    const mainMenuButton = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 40,
      'MAIN MENU',
      {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#d9f3ea',
        backgroundColor: '#2a2a2a',
        padding: { x: 20, y: 10 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(302).setInteractive();

    // Instructions
    const instructions = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 110,
      'Press [ESC] to resume',
      {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#6b7280',
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(302);

    const pauseElements = [overlay, menu, border, title, resumeButton, mainMenuButton, instructions];

    // Button hover effects
    resumeButton.on('pointerover', () => {
      resumeButton.setStyle({ color: '#ffd700' });
    });
    resumeButton.on('pointerout', () => {
      resumeButton.setStyle({ color: '#d9f3ea' });
    });

    mainMenuButton.on('pointerover', () => {
      mainMenuButton.setStyle({ color: '#ffd700' });
    });
    mainMenuButton.on('pointerout', () => {
      mainMenuButton.setStyle({ color: '#d9f3ea' });
    });

    // Close pause menu handler
    const closePauseMenu = () => {
      this.isPaused = false;
      pauseElements.forEach(el => el.destroy());
      this.pauseKey.off('down', escHandler);
    };

    // Resume button click
    resumeButton.on('pointerdown', () => {
      closePauseMenu();
    });

    // Main menu button click
    mainMenuButton.on('pointerdown', () => {
      window.location.reload(); // Return to React shell
    });

    // ESC to resume
    const escHandler = () => {
      closePauseMenu();
    };
    this.pauseKey.once('down', escHandler);
  }

  private updateStatusText() {
    const batteryColor = this.runState.battery > 50 ? '#70d4c6' : this.runState.battery > 20 ? '#ffd700' : '#ff4444';
    const hpColor = this.runState.hp > 50 ? '#70d4c6' : this.runState.hp > 25 ? '#ffd700' : '#ff4444';
    const flashStatus = this.flashlightOn ? 'ON' : 'OFF';

    // Display floor name
    const floorDisplay = isBlock13Floor(this.runState.floor) ? progressionName(this.runState.floor) : `${progressionName(this.runState.floor)}/${START_FLOOR}`;

    const lines = [
      floorDisplay,
      `HP: ${Math.floor(this.runState.hp)}/100`,
      `CURSE: ${formatWholePercent(this.runState.curse)}%`,
      `BATTERY: ${formatWholePercent(this.runState.battery)}%`,
      `SCORE: ${this.runState.score}`,
      `LIGHT: ${flashStatus}`,
    ];
    this.statusText.setText(lines.join('\n'));

    if (this.dangerIndicator) {
      const danger = formatWholePercent(this.runState.curse);
      this.dangerIndicator.setText(`DANGER: ${danger}%`);
      this.dangerIndicator.setColor(danger < 20 ? '#70d4c6' : danger < 40 ? '#ffd700' : '#ff4444');
      this.dangerIndicator.setVisible(danger > 0);
    }

    // Update color based on most critical resource
    if (this.runState.hp <= 25) {
      this.statusText.setColor(hpColor);
    } else if (this.runState.battery <= 20) {
      this.statusText.setColor(batteryColor);
    } else {
      this.statusText.setColor('#70d4c6');
    }

    // Update health bar
    this.updateHealthBar();
  }

  private updateHealthBar() {
    // Safety check - health bar might not be created ye
    if (!this.healthBarFill || !this.healthBarText) {
      return;
    }

    const maxWidth = 300;
    const healthBarHeight = 16; // Slightly smaller than background
    const healthBarX = this.cameras.main.width / 2;
    const healthBarY = 20;

    const hpPercent = Math.max(0, Math.min(1, this.runState.hp / 100));
    const currentWidth = maxWidth * hpPercent;

    // Clear and redraw the health bar fill
    (this.healthBarFill as Phaser.GameObjects.Graphics).clear();

    // Determine color based on HP
    let fillColor: number;
    if (this.runState.hp > 50) {
      fillColor = 0x70d4c6; // Cyan (healthy)
    } else if (this.runState.hp > 25) {
      fillColor = 0xffd700; // Gold (warning)
    } else {
      fillColor = 0xff4444; // Red (critical)
    }

    // Draw the health bar (from left edge)
    (this.healthBarFill as Phaser.GameObjects.Graphics).fillStyle(fillColor, 1);
    (this.healthBarFill as Phaser.GameObjects.Graphics).fillRect(
      healthBarX - maxWidth / 2,
      healthBarY - healthBarHeight / 2,
      currentWidth,
      healthBarHeight
    );

    // Update tex
    this.healthBarText.setText(`${Math.floor(this.runState.hp)} / 100 HP`);
  }

  private drawFloor(tiles: boolean[][]) {
    const graphics = this.add.graphics();
    const floor = this.authoritativeSimulation.state.floor;
    const profile = floorVisualProfile(floor);

    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        const posX = x * this.tileSize;
        const posY = y * this.tileSize;
        const walkable = tiles[y][x];
        const dressing = tileDressingAt(floor, x, y, walkable);

        if (walkable) {
          graphics.fillStyle(profile.floorBase, 1);
          graphics.fillRect(posX, posY, this.tileSize, this.tileSize);
          graphics.lineStyle(1, profile.grid, 0.24);
          graphics.strokeRect(posX, posY, this.tileSize, this.tileSize);
        } else {
          graphics.fillStyle(profile.wallBase, 1);
          graphics.fillRect(posX, posY, this.tileSize, this.tileSize);
          graphics.lineStyle(1, profile.grid, 0.72);
          graphics.strokeRect(posX, posY, this.tileSize, this.tileSize);
        }

        // Decorative marks are deterministic functions of immutable tile coords.
        // They are drawn into the background layer and never create game objects.
        switch (dressing) {
          case 'stain':
            graphics.fillStyle(profile.stain, 0.72);
            graphics.fillEllipse(posX + 15 + ((x * 7 + y * 3) % 7), posY + 15 + ((x * 2 + y * 5) % 7), 17, 9);
            break;
          case 'crack':
            graphics.lineStyle(1, profile.grime, walkable ? 0.62 : 0.72);
            graphics.lineBetween(posX + 6, posY + 8, posX + 13, posY + 14);
            graphics.lineBetween(posX + 13, posY + 14, posX + 10, posY + 22);
            graphics.lineBetween(posX + 13, posY + 14, posX + 22, posY + 18);
            break;
          case 'pipe':
            graphics.lineStyle(3, profile.grime, 0.72);
            graphics.lineBetween(posX + 5, posY + 4, posX + 5, posY + 28);
            graphics.lineStyle(1, profile.accent, 0.25);
            graphics.lineBetween(posX + 8, posY + 4, posX + 8, posY + 28);
            break;
          case 'warning':
            graphics.fillStyle(profile.accent, 0.48);
            graphics.fillRect(posX + 5, posY + 6, 20, 3);
            graphics.fillRect(posX + 5, posY + 23, 20, 3);
            break;
          case 'corruption':
            graphics.lineStyle(2, profile.corruption, 0.64);
            graphics.lineBetween(posX + 4, posY + 7, posX + 13, posY + 12);
            graphics.lineBetween(posX + 13, posY + 12, posX + 9, posY + 20);
            graphics.lineBetween(posX + 9, posY + 20, posX + 27, posY + 25);
            graphics.fillStyle(profile.corruption, 0.28);
            graphics.fillCircle(posX + 22, posY + 9, 2);
            break;
          case 'none':
            break;
        }
      }
    }
  }

  private setupAtmosphereOverlays() {
    this.damageVignette = this.add.graphics().setScrollFactor(0).setDepth(96).setAlpha(0);
    this.drawEdgeVignette(this.damageVignette, 0x8b2637, 0.18);
    this.corruptionVignette = this.add.graphics().setScrollFactor(0).setDepth(94);
    this.cameras.main.ignore([this.damageVignette, this.corruptionVignette]);
  }

  private drawEdgeVignette(graphics: Phaser.GameObjects.Graphics, color: number, opacity: number) {
    const width = this.scale.width;
    const height = this.scale.height;
    graphics.clear();
    for (let band = 0; band < 4; band++) {
      const inset = band * 18;
      const bandAlpha = opacity * (1 - band * 0.18);
      graphics.fillStyle(color, bandAlpha);
      graphics.fillRect(inset, inset, width - inset * 2, 13);
      graphics.fillRect(inset, height - inset - 13, width - inset * 2, 13);
      graphics.fillRect(inset, inset + 13, 13, height - inset * 2 - 26);
      graphics.fillRect(width - inset - 13, inset + 13, 13, height - inset * 2 - 26);
    }
  }

  private flashDamageVignette() {
    this.damageVignette?.setAlpha(0.9);
    this.tweens.killTweensOf(this.damageVignette);
    this.tweens.add({ targets: this.damageVignette, alpha: 0, duration: 460, ease: 'Sine.easeOut' });
  }

  private updateCorruptionAtmosphere(state: AuthoritativeState) {
    const strength = corruptionVisualStrength(state.floor, state.corruption.intensityPermille);
    if (!this.corruptionVignette) return;
    const profile = floorVisualProfile(state.floor);
    this.drawEdgeVignette(this.corruptionVignette, profile.corruption, Math.min(0.62, strength * 1.8));
  }

  private playBlock13Arrival() {
    const veil = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x140b19, 0.76)
      .setScrollFactor(0).setDepth(92);
    this.cameras.main.ignore(veil);
    this.tweens.add({ targets: veil, alpha: 0, duration: 1250, ease: 'Sine.easeInOut', onComplete: () => veil.destroy() });
  }

  private playEscapeRelease() {
    const release = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xb8d8cf, 0.48)
      .setScrollFactor(0).setDepth(145);
    this.cameras.main.ignore(release);
    this.tweens.add({ targets: release, alpha: 0, duration: 850, ease: 'Sine.easeOut', onComplete: () => release.destroy() });
  }

  private createKey(x: number, y: number): Phaser.GameObjects.Sprite {
    const posX = x * this.tileSize + this.tileSize / 2;
    const posY = y * this.tileSize + this.tileSize / 2;

    // Create key texture
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffd700, 1);

    // Key head (circle)
    graphics.fillCircle(0, -6, 5);

    // Key shaf
    graphics.fillRect(-2, -2, 4, 12);

    // Key teeth
    graphics.fillRect(2, 6, 3, 2);
    graphics.fillRect(2, 9, 3, 2);

    graphics.generateTexture('key', 16, 20);
    graphics.destroy();

    const keySprite = this.add.sprite(posX, posY, 'key');
    keySprite.setDepth(5);
    this.keyHalo = this.createInteractableHalo(posX, posY, 0xd7bf78, 24);

    // Add floating animation
    this.tweens.add({
      targets: keySprite,
      y: posY - 5,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Add glow effec
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

    const stairsSprite = this.add.sprite(posX, posY, 'stairs_locked');
    stairsSprite.setDepth(5);
    this.stairsHalo = this.createInteractableHalo(posX, posY, 0x8faeae, 28);

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

  private createPlayer(x: number, y: number): Phaser.GameObjects.Sprite {
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

    const player = this.add.sprite(posX, posY, 'player');
    player.setDepth(10);

    return player;
  }

  private completeFloor(previous: AuthoritativeState, current: AuthoritativeState) {
    this.isTransitioning = true; // Block scares and damage during transition

    // Schedule the renderer restart before optional presentation work. The sim
    // already owns the next floor; this timer only swaps what the scene renders.
    this.time.delayedCall(2800, () => this.scene.restart({ runState: this.runState }));

    // The simulation has already advanced. Optional audio cannot stop the next floor.
    try { this.audioDirector?.playWithCooldown(AUDIO_KEYS.interaction.floorTransition, 'sfx', 1500, { volume: 0.6 }); } catch { /* optional audio */ }

    // Disable player movemen
    this.input.keyboard?.enabled && (this.input.keyboard.enabled = false);

    // Show completion message with stats
    const floorName = progressionName(previous.floor);
    const message = `${floorName} COMPLETE!`;

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
    const scoreGain = current.score - previous.score;
    const batteryGain = formatFixedPointPercent(current.battery - previous.battery);
    const scoreText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 60,
      `+${scoreGain} POINTS
+${batteryGain}% BATTERY`,
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

    try {
      this.tweens.add({ targets: [completionText, scoreText], alpha: 1, duration: 300 });
    } catch { /* presentation failure cannot hold floor progression */ }
  }

  private showVictoryScreen(finalState: RunState) {
    this.playEscapeRelease();
    this.cameras.main.fadeIn(300);

    const { width, height } = this.cameras.main;

    // Dark overlay with vignette
    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.85
    ).setScrollFactor(0).setDepth(295);

    // Modal background panel
    const panelWidth = 450;
    const panelHeight = 340;

    // Shadow
    const shadow = this.add.rectangle(
      width / 2 + 4,
      height / 2 + 4,
      panelWidth,
      panelHeight,
      0x000000,
      0.5
    ).setScrollFactor(0).setDepth(296);

    // Main panel
    const panel = this.add.rectangle(
      width / 2,
      height / 2,
      panelWidth,
      panelHeight,
      0x0f1f1d,
      1
    ).setScrollFactor(0).setDepth(297);

    // Cyan accent border (double line)
    const borderOuter = this.add.rectangle(
      width / 2,
      height / 2,
      panelWidth,
      panelHeight
    ).setScrollFactor(0).setDepth(297).setStrokeStyle(2, 0x70d4c6, 1);

    const borderInner = this.add.rectangle(
      width / 2,
      height / 2,
      panelWidth - 8,
      panelHeight - 8
    ).setScrollFactor(0).setDepth(297).setStrokeStyle(1, 0x3a6a62, 0.5);

    // Header bar
    const headerBar = this.add.rectangle(
      width / 2,
      height / 2 - panelHeight / 2 + 35,
      panelWidth - 4,
      50,
      0x0a1a18,
      1
    ).setScrollFactor(0).setDepth(298);

    // Title with text shadow
    const titleShadow = this.add.text(width / 2 + 2, height / 2 - 140 + 2, 'ESCAPE COMPLETE!', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#000000',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(298);

    const title = this.add.text(width / 2, height / 2 - 140, 'ESCAPE COMPLETE!', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#70d4c6',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(299);

    const subtitle = this.add.text(width / 2, height / 2 - 95, 'YOU SURVIVED BLOCK 13', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#a5d4c8',
      letterSpacing: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(299);

    // Divider line
    const divider = this.add.rectangle(
      width / 2,
      height / 2 - 60,
      panelWidth - 80,
      1,
      0x3a6a62,
      1
    ).setScrollFactor(0).setDepth(299);

    const elapsed = Math.floor((Date.now() - finalState.timeStarted) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    const stats = this.add.text(width / 2, height / 2 - 15, [
      `FINAL SCORE: ${finalState.score}`,
      `TIME: ${minutes}:${seconds.toString().padStart(2, '0')}`,
      `FLOORS CLEARED: ${finalState.floorsCompleted}`,
    ].join('\n'), {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#d9f3ea',
      align: 'center',
      lineSpacing: 10,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(299);

    // Button containers
    const retryBg = this.add.rectangle(
      width / 2 - 90,
      height / 2 + 95,
      140,
      42,
      0x0a2a28,
      1
    ).setScrollFactor(0).setDepth(298);

    const retryBorder = this.add.rectangle(
      width / 2 - 90,
      height / 2 + 95,
      140,
      42
    ).setScrollFactor(0).setDepth(298).setStrokeStyle(2, 0x70d4c6, 1);

    // Retry button
    const retryButton = this.add.text(width / 2 - 90, height / 2 + 95, '[ RETRY ]', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#70d4c6',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(299).setInteractive({ useHandCursor: true });

    retryButton.on('pointerover', () => {
      retryButton.setColor('#ffd700');
      retryBorder.setStrokeStyle(2, 0xffd700, 1);
      retryBg.setFillStyle(0x3a3a0a, 1);
    });
    retryButton.on('pointerout', () => {
      retryButton.setColor('#70d4c6');
      retryBorder.setStrokeStyle(2, 0x70d4c6, 1);
      retryBg.setFillStyle(0x0a2a28, 1);
    });
    retryButton.on('pointerdown', () => {
      // Reload the page to go back to React main menu
      window.location.reload();
    });

    // Menu button container
    const menuBg = this.add.rectangle(
      width / 2 + 90,
      height / 2 + 95,
      140,
      42,
      0x0a0a0a,
      1
    ).setScrollFactor(0).setDepth(298);

    const menuBorder = this.add.rectangle(
      width / 2 + 90,
      height / 2 + 95,
      140,
      42
    ).setScrollFactor(0).setDepth(298).setStrokeStyle(2, 0x666666, 1);

    // Main menu button
    const menuButton = this.add.text(width / 2 + 90, height / 2 + 95, '[ MAIN MENU ]', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#999999',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(299).setInteractive({ useHandCursor: true });

    menuButton.on('pointerover', () => {
      menuButton.setColor('#ffffff');
      menuBorder.setStrokeStyle(2, 0xaaaaaa, 1);
      menuBg.setFillStyle(0x1a1a1a, 1);
    });
    menuButton.on('pointerout', () => {
      menuButton.setColor('#999999');
      menuBorder.setStrokeStyle(2, 0x666666, 1);
      menuBg.setFillStyle(0x0a0a0a, 1);
    });
    menuButton.on('pointerdown', () => {
      // Reload the page to go back to React main menu
      window.location.reload();
    });

    // Make main camera ignore these UI elements
    this.cameras.main.ignore([
      overlay, shadow, panel, borderOuter, borderInner, headerBar,
      titleShadow, title, subtitle, divider, stats,
      retryBg, retryBorder, retryButton,
      menuBg, menuBorder, menuButton
    ]);
  }

  // ====== SEARCHABLE OBJECTS ======

  private createSearchables(searchables: Searchable[]) {
    this.createRevealedMimicTexture();
    const accent = floorVisualProfile(this.authoritativeSimulation.state.floor).accent;
    searchables.forEach((searchable, index) => {
      const sprite = this.createSearchableSprite(searchable, index);
      const halo = this.createInteractableHalo(sprite.x, sprite.y, accent, 22);
      this.searchableSprites.push({
        sprite,
        halo,
        data: searchable,
        searched: false,
      });
    });
  }

  private createRevealedMimicTexture() {
    if (this.textures.exists('mimic_revealed')) return;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x28202a, 1);
    graphics.fillEllipse(0, 3, 24, 16);
    graphics.fillStyle(0x8c3246, 1);
    graphics.fillEllipse(0, 1, 17, 10);
    graphics.fillStyle(0xe8d6c4, 1);
    for (let tooth = -6; tooth <= 6; tooth += 4) graphics.fillTriangle(tooth - 2, -2, tooth + 2, -2, tooth, 3);
    graphics.fillStyle(0xffd2b3, 1);
    graphics.fillCircle(-4, -5, 2);
    graphics.fillCircle(4, -5, 2);
    graphics.generateTexture('mimic_revealed', 28, 24);
    graphics.destroy();
  }

  private createSearchableSprite(searchable: Searchable, searchableIndex: number): Phaser.GameObjects.Sprite {
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

    // Add subtle twitch animation for mimics (tick-based)
    if (searchable.isMimic) {
      // Initialize mimic twitch: schedule first twitch 2-5 seconds from now
      this.mimicTwitchStates.set(sprite, {
        nextTick: this.simulationEngine.getTick() + firstMimicTwitchDelay(searchableIndex),
        entityId: searchableIndex,
      });
    }

    return sprite;
  }

  private playerDeath() {
    // Disable inpu
    if (this.input.keyboard) {
      this.input.keyboard.enabled = false;
    }

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

  // ====== SECONDARY ENEMIES ======

  private createSecondaryEnemySprites() {
    const state = this.authoritativeSimulation.state;
    state.crawlers.forEach((crawler) => {
      const graphics = this.add.graphics();
      graphics.fillStyle(0x41454a, 1);
      graphics.fillEllipse(0, 1, 23, 12);
      graphics.fillStyle(0x687078, 1);
      graphics.fillEllipse(-3, 0, 12, 9);
      graphics.lineStyle(1, 0x92979a, 0.7);
      graphics.strokeEllipse(0, -1, 22, 10);
      graphics.lineStyle(2, 0x686b6c, 1);
      for (const side of [-1, 1]) {
        graphics.lineBetween(side * 5, 1, side * 10, -5);
        graphics.lineBetween(side * 7, 3, side * 12, 8);
        graphics.lineBetween(side * 1, 4, side * 5, 9);
      }
      graphics.fillStyle(0xd5a69a, 0.92);
      graphics.fillCircle(-5, -2, 1.7);
      graphics.fillCircle(2, -2, 1.7);
      graphics.generateTexture(`crawler_${crawler.id}`, 28, 20);
      graphics.destroy();

      const sprite = this.add.sprite(crawler.x / FIXED_SCALE, crawler.y / FIXED_SCALE, `crawler_${crawler.id}`);
      sprite.setDepth(8);
      const exposure = enemyPresentationExposure(this.floorData, state, crawler.x, crawler.y);
      sprite.setAlpha(exposure * 0.76);
      this.crawlerSprites.push(sprite);
    });

    // Create watcher sprites
    state.watchers.forEach((watcher) => {
      const graphics = this.add.graphics();
      graphics.fillStyle(0x222632, 0.78);
      graphics.fillEllipse(0, 2, 25, 34);
      graphics.fillStyle(0x5b6474, 0.38);
      graphics.fillEllipse(0, -4, 15, 24);
      graphics.lineStyle(1, 0xaab7c3, 0.52);
      graphics.strokeEllipse(0, 1, 29, 39);
      graphics.fillStyle(0xb7a1b5, 0.8);
      graphics.fillCircle(-4, -7, 1.9);
      graphics.fillCircle(4, -7, 1.9);
      graphics.generateTexture(`watcher_${watcher.id}`, 34, 44);
      graphics.destroy();

      const sprite = this.add.sprite(watcher.x / FIXED_SCALE, watcher.y / FIXED_SCALE, `watcher_${watcher.id}`);
      sprite.setDepth(8);
      const exposure = enemyPresentationExposure(this.floorData, state, watcher.x, watcher.y);
      sprite.setAlpha(watcher.active ? exposure * 0.76 : 0);
      this.watcherSprites.push(sprite);
    });
  }

  private createAmbusherSprites() {
    this.authoritativeSimulation.state.ambushers.forEach((ambusher) => {
      const graphics = this.add.graphics();
      // Darker, more menacing figure
      graphics.fillStyle(0x211b20, 1);
      graphics.fillEllipse(0, -7, 16, 19);
      graphics.fillStyle(0x33252a, 1);
      graphics.fillTriangle(-9, -2, 9, -2, 0, 16);
      graphics.lineStyle(1, 0x987c78, 0.72);
      graphics.strokeEllipse(0, -7, 17, 20);
      graphics.fillStyle(0xd28b69, 0.95);
      graphics.fillCircle(-4, -8, 2.4);
      graphics.fillCircle(4, -8, 2.4);
      graphics.lineStyle(1, 0xc1977d, 0.62);
      graphics.lineBetween(-5, 3, -9, 12);
      graphics.lineBetween(5, 3, 9, 12);
      graphics.generateTexture(`ambusher_${ambusher.id}`, 28, 38);
      graphics.destroy();

      const sprite = this.add.sprite(ambusher.x / FIXED_SCALE, ambusher.y / FIXED_SCALE, `ambusher_${ambusher.id}`);
      sprite.setDepth(9);
      sprite.setAlpha(0); // Start invisible
      this.ambusherSprites.push(sprite);
    });
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
        this.screenGlitch(); // Reuse existing jumpscare effec
        break;
    }
  }

  /** Cosmetic overlay only; the triggering corruption state comes from simulation ticks. */
  private screenGlitch() {
    const glitchOverlay = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0xff0000,
      0.3,
    ).setScrollFactor(0).setDepth(150);
    this.cameras.main.ignore(glitchOverlay);
    this.tweens.add({
      targets: glitchOverlay,
      alpha: 0,
      duration: 100,
      repeat: 3,
      yoyo: true,
      onComplete: () => glitchOverlay.destroy(),
    });
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
    void worldWidth; void worldHeight;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x141116, 1);
    graphics.fillEllipse(0, -10, 14, 16);
    graphics.fillStyle(0x38232c, 1);
    graphics.fillTriangle(-9, -7, 9, -7, 0, 18);
    graphics.lineStyle(1, 0x9b707b, 0.78);
    graphics.strokeEllipse(0, -10, 15, 17);
    graphics.lineStyle(3, 0x29212a, 1);
    graphics.lineBetween(-4, 0, -11, 17);
    graphics.lineBetween(4, 0, 11, 17);
    graphics.lineBetween(-2, 11, -4, 24);
    graphics.lineBetween(2, 11, 5, 24);
    graphics.lineStyle(2, 0x55404a, 0.9);
    graphics.lineBetween(-10, 15, -12, 24);
    graphics.lineBetween(10, 15, 12, 24);
    graphics.fillStyle(0xe3a1a0, 0.96);
    graphics.fillCircle(-3.5, -12, 1.8);
    graphics.fillCircle(3.5, -12, 1.8);
    graphics.generateTexture('stalker', 32, 52);
    graphics.destroy();

    const stalker = this.authoritativeSimulation.state.stalker;
    this.stalkerSprite = this.add.sprite(stalker.x / FIXED_SCALE, stalker.y / FIXED_SCALE, 'stalker');
    this.stalkerSprite.setDepth(9); // Just below player
    this.stalkerSprite.setAlpha(stalker.visible ? enemyPresentationExposure(this.floorData, this.authoritativeSimulation.state, stalker.x, stalker.y) * 0.76 : 0);
  }

  private showGameOver() {
    this.cameras.main.fadeIn(300);

    const { width, height } = this.cameras.main;

    // Dark overlay with vignette effec
    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.85
    ).setScrollFactor(0).setDepth(295);

    // Modal background panel
    const panelWidth = 450;
    const panelHeight = 340;

    // Shadow (offset slightly)
    const shadow = this.add.rectangle(
      width / 2 + 4,
      height / 2 + 4,
      panelWidth,
      panelHeight,
      0x000000,
      0.5
    ).setScrollFactor(0).setDepth(296);

    // Main panel background
    const panel = this.add.rectangle(
      width / 2,
      height / 2,
      panelWidth,
      panelHeight,
      0x1a1a1a,
      1
    ).setScrollFactor(0).setDepth(297);

    // Red accent border (double line)
    const borderOuter = this.add.rectangle(
      width / 2,
      height / 2,
      panelWidth,
      panelHeight
    ).setScrollFactor(0).setDepth(297).setStrokeStyle(2, 0xff4444, 1);

    const borderInner = this.add.rectangle(
      width / 2,
      height / 2,
      panelWidth - 8,
      panelHeight - 8
    ).setScrollFactor(0).setDepth(297).setStrokeStyle(1, 0x663333, 0.5);

    // Header bar
    const headerBar = this.add.rectangle(
      width / 2,
      height / 2 - panelHeight / 2 + 35,
      panelWidth - 4,
      50,
      0x0d0d0d,
      1
    ).setScrollFactor(0).setDepth(298);

    // Title with text shadow effec
    const titleShadow = this.add.text(width / 2 + 2, height / 2 - 140 + 2, 'YOU DIED', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#000000',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(298);

    const title = this.add.text(width / 2, height / 2 - 140, 'YOU DIED', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(299);

    const subtitle = this.add.text(width / 2, height / 2 - 95, 'CONSUMED BY THE DARKNESS', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#999999',
      letterSpacing: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(299);

    // Divider line
    const divider = this.add.rectangle(
      width / 2,
      height / 2 - 60,
      panelWidth - 80,
      1,
      0x333333,
      1
    ).setScrollFactor(0).setDepth(299);

    const elapsed = Math.floor((Date.now() - this.runState.timeStarted) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    const stats = this.add.text(width / 2, height / 2 - 15, [
      `FINAL SCORE: ${this.runState.score}`,
      `TIME: ${minutes}:${seconds.toString().padStart(2, '0')}`,
      `FLOORS CLEARED: ${this.runState.floorsCompleted}`,
    ].join('\n'), {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#cccccc',
      align: 'center',
      lineSpacing: 10,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(299);

    // Button container backgrounds
    const retryBg = this.add.rectangle(
      width / 2 - 90,
      height / 2 + 95,
      140,
      42,
      0x2a0a0a,
      1
    ).setScrollFactor(0).setDepth(298);

    const retryBorder = this.add.rectangle(
      width / 2 - 90,
      height / 2 + 95,
      140,
      42
    ).setScrollFactor(0).setDepth(298).setStrokeStyle(2, 0xff4444, 1);

    // Retry button
    const retryButton = this.add.text(width / 2 - 90, height / 2 + 95, '[ RETRY ]', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ff4444',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(299).setInteractive({ useHandCursor: true });

    retryButton.on('pointerover', () => {
      retryButton.setColor('#ffd700');
      retryBorder.setStrokeStyle(2, 0xffd700, 1);
      retryBg.setFillStyle(0x3a2a0a, 1);
    });
    retryButton.on('pointerout', () => {
      retryButton.setColor('#ff4444');
      retryBorder.setStrokeStyle(2, 0xff4444, 1);
      retryBg.setFillStyle(0x2a0a0a, 1);
    });
    retryButton.on('pointerdown', () => {
      // Reload the page to go back to React main menu
      window.location.reload();
    });

    // Menu button container
    const menuBg = this.add.rectangle(
      width / 2 + 90,
      height / 2 + 95,
      140,
      42,
      0x0a0a0a,
      1
    ).setScrollFactor(0).setDepth(298);

    const menuBorder = this.add.rectangle(
      width / 2 + 90,
      height / 2 + 95,
      140,
      42
    ).setScrollFactor(0).setDepth(298).setStrokeStyle(2, 0x666666, 1);

    // Main menu button
    const menuButton = this.add.text(width / 2 + 90, height / 2 + 95, '[ MAIN MENU ]', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#999999',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(299).setInteractive({ useHandCursor: true });

    menuButton.on('pointerover', () => {
      menuButton.setColor('#ffffff');
      menuBorder.setStrokeStyle(2, 0xaaaaaa, 1);
      menuBg.setFillStyle(0x1a1a1a, 1);
    });
    menuButton.on('pointerout', () => {
      menuButton.setColor('#999999');
      menuBorder.setStrokeStyle(2, 0x666666, 1);
      menuBg.setFillStyle(0x0a0a0a, 1);
    });
    menuButton.on('pointerdown', () => {
      // Reload the page to go back to React main menu
      window.location.reload();
    });

    // Make main camera ignore these UI elements
    this.cameras.main.ignore([
      overlay, shadow, panel, borderOuter, borderInner, headerBar,
      titleShadow, title, subtitle, divider, stats,
      retryBg, retryBorder, retryButton,
      menuBg, menuBorder, menuButton
    ]);
  }

  private getBoxScareAudioKey(type: string): string | null {
    switch (type) {
      case 'lid_slam': return AUDIO_KEYS.jumpscares.lidSlam;
      case 'hand_inside': return AUDIO_KEYS.jumpscares.handInside;
      case 'object_falls': return AUDIO_KEYS.jumpscares.objectFalls;
      case 'whisper': return AUDIO_KEYS.jumpscares.whisper;
      case 'screen_glitch': return AUDIO_KEYS.jumpscares.screenGlitch;
      case 'false_mimic': return AUDIO_KEYS.jumpscares.falseMimic;
      case 'wall_shift': return AUDIO_KEYS.jumpscares.wallShift;
      case 'shadow_figure': return AUDIO_KEYS.jumpscares.shadowFigure;
      default: return null;
    }
  }

  shutdown() {
    // Clean up event listeners to prevent memory leaks
    if (this.pauseKey) {
      this.pauseKey.removeAllListeners();
    }
    this.storyCloseKey?.removeAllListeners();
    this.closeStoryPopup?.();
    if (this.interactKey) {
      this.interactKey.removeAllListeners();
    }
    if (this.flashlightKey) {
      this.flashlightKey.removeAllListeners();
    }

    // Clear all timers
    this.time.removeAllEvents();

    // Shutdown audio director
    if (this.audioDirector) {
      this.audioDirector.shutdown();
    }

    // make.graphics(..., false) is not on the Display List, so Phaser does not
    // destroy it when the scene restarts. Explicitly release this scene-owned
    // presentation resource before its reference is replaced in init().
    if (this.lightmapGraphics) {
      this.lightmapGraphics.destroy();
    }

    this.crawlerSprites = [];
    this.watcherSprites = [];
    this.ambusherSprites = [];

    // Clear searchable sprites
    this.searchableSprites = [];
  }
}

function scaleColor(color: number, factor: number): number {
  const red = Math.max(0, Math.min(255, Math.round(((color >> 16) & 0xff) * factor)));
  const green = Math.max(0, Math.min(255, Math.round(((color >> 8) & 0xff) * factor)));
  const blue = Math.max(0, Math.min(255, Math.round((color & 0xff) * factor)));
  return (red << 16) | (green << 8) | blue;
}
