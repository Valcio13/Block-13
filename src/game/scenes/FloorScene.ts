import Phaser from 'phaser';
import { type CorruptionEffect } from '../../core/corruption';
import { AudioDirector, AUDIO_KEYS } from '../../core/audioDirector';
import { SimulationEngine } from '../../core/simulationEngine';
import { InputPipeline, InputRecorder, InputReplayer, LiveInputSource, type InputSource, type InputState } from '../../core/inputRecorder';
import { firstMimicTwitchDelay, mimicTwitch } from '../../core/cosmeticAnimation';
import { AMBUSHER_PRE_IMPACT_AMBIENCE_GAIN, audioCuesForEvents, audioCuesForStateChange, floorAmbienceKeys, floorMusicTrack, FLOOR_MUSIC_PREVIEW, playAmbusherImpact, type AudioCue, type FloorMusicTrack } from '../../core/presentationAudio';
import type { Floor, Searchable } from '../../core/floor';
import type { RunState } from '../../core/run';
import { AuthoritativeSimulation, FIXED_SCALE, type AuthoritativeState } from '../../core/authoritativeSimulation';
import { encodeFinalStateV1, finalStateV1FromSimulation, hashFinalStateV1 } from '../../core/finalStateV1';
import { keccak256, toHex } from 'viem';
import { getAuthoredClueForSearchId } from '../../core/clues';
import { addNotebookDiscovery, addNotebookSearchEvents, discoveredObjectiveSteps, emptyNotebookJournal, type NotebookEntry, type NotebookJournal } from '../investigationNotebook';
import { memoryFragmentDisplay, recordsMayBeCompared } from '../puzzlePresentation';
import { formatFixedPointPercent, formatWholePercent } from '../../core/uiFormatting';
import { architecturalMarkAt, corruptionVisualStrength, floorAmbientVisibility, floorFlashlightContrast, floorVisualProfile, flashlightVisualFactor, surfaceColorGrade, tileDressingAt } from '../../core/visualAtmosphere';
import {
  BLOCK13_ASSET_MANIFEST,
  BLOCK13_MAP_TEXTURE_KEY,
  block13BranchPlacements,
  block13HubRingPlacements,
  block13HasOffsetThreshold,
  block13OverlayAssetAt,
  block13SurfaceAssetAt,
  block13WallEdgeRotations,
} from '../block13Assets';
import { isBlock13Floor, START_FLOOR } from '../../core/progression';
import { enemyPresentationExposure, hasPresentationLineOfSight } from '../presentationVisibility';
import { collectOccludedLightRays, type OccludedRay } from '../lightOcclusion';
import {
  ambusherCameraKickIntensity,
  ambusherFrameForAccessibility,
  advanceAmbusherJumpscare,
  avoidImmediateAmbusherRepeat,
  ambusherLocalPreviewVariant,
  ambusherJumpscareFrame,
  ambusherJumpscareFraming,
  ambusherImpactStarted,
  ambusherJumpscareLayout,
  ambusherJumpscareTextureKey,
  ambusherJumpscareVariant,
  AMBUSHER_JUMPSCARE_TIMING,
  AMBUSHER_JUMPSCARE_TOTAL_MS,
  AMBUSHER_JUMPSCARE_VARIANTS,
} from '../ambusherJumpscare';
import { blockTransitionBeats, EpilogueAdvanceGate, hudWarningCopy, nextEpilogueBeat, objectiveCopy, playerBlockName, shouldBeginVictoryEpilogue, VICTORY_EPILOGUE, watcherIndividuallyCausingCurse, watcherIsCausingCurse } from '../contestUx';
import { KEY_PIXEL_RECTS, PIXEL_PALETTE, PLAYER_PIXEL_RECTS, pixelRectsAreValid, STAIR_PIXEL_RECTS, STALKER_PIXEL_RECTS } from '../pixelIdentity';
import {
  PLAYER_WALK_CYCLE_DURATION_MS,
  playerMovedBetween,
  playerTextureKeyForFacing,
  playerTextureKeyForPresentation,
} from '../playerAssets';
import {
  ORDINARY_ENVIRONMENT_ASSET_MANIFEST,
  ordinaryOverlayAssetsForMap,
  ordinaryOverlayPlacementAllowed,
  ordinaryMapDecorationPlacements,
  ordinaryEnvironmentCoordinateHash,
  ordinaryThresholdTreatment,
  ordinarySurfaceAssetsForMap,
  resolveOrdinaryOverlayAsset,
  ordinarySurfaceAssetAt,
  resolveOrdinaryContainerTexture,
  resolveOrdinarySurfaceAsset,
  type OrdinaryEnvironmentAssetName,
} from '../environmentAssets';
import {
  inferStalkerVisualFacing,
  stalkerMovedBetween,
  stalkerTextureKeyForFacing,
  stalkerTextureKeyForPresentation,
  STALKER_WALK_CYCLE_DURATION_MS,
  type StalkerVisualFacing,
} from '../stalkerAssets';
import {
  CONTAINER_SCARE_VARIANT_ASSETS,
  containerScareAssetForSearchIndex,
  lampJumpscareAssetForEvent,
  ambusherTextureKey,
  crawlerMovedBetween,
  crawlerPresentationPhaseOffsetMs,
  crawlerTextureKeyForPresentation,
  CRAWLER_WALK_CYCLE_DURATION_MS,
  MIMIC_REVEAL_PULSE_DURATION_MS,
  mimicRevealPulseScale,
  mimicTextureKey,
  ambusherWarningAlpha,
  watcherGazeEyeAlpha,
  watcherGazeAudioPosition,
  watcherTextureKey,
} from '../enemyAssets';
import { NARRATIVE_ASSET_MANIFEST, OPENING_CINEMATIC, shouldPlayOpeningCinematic, victoryExteriorScale } from '../narrativeAssets';
import { HauntingDirector, HorrorPacingModel, HauntingSilence, hauntingPresentationAllowed, hauntingWhisperLine, type HauntingEvent, type HauntingEventType } from '../hauntingDirector';
import { interactionPrompt, rejectedInteractionFeedback } from '../interactionPresentation';
import { hashAuthoritativeState } from '../../core/runRecovery';
import { PLAYER_FOOTSTEP_COOLDOWN_MS, PLAYER_FOOTSTEP_VARIANT_GAINS, shouldPlayFootstep } from '../footstepMix';
import { CONTAINER_SCARE_STATUS_TEXT, containerScareSearchIndex, containerScareShouldPlay, containerScareStyle } from '../containerScare';
import { stalkerNearMissCueAvailable, stalkerNearMissState } from '../stalkerPresentation';
import { accessiblePresentationIntensity, finalChaseAmbienceGain, genericScareCameraKick, stalkerHuntScale } from '../accessibilityPresentation';
import {
  BLOCK3_REFINED_EXPERIMENT_ASSETS,
  block3RoomNoticeTile,
  block3SurfaceTextureAt,
  block3ExperimentTextureForAsset,
  block3VisualModeLabel,
  nextBlock3VisualMode,
  type Block3ExperimentTextureKey,
  type Block3VisualMode,
} from '../block3VisualExperiment';

interface FloorSceneData {
  runState: RunState;
  /** Optional encoded run log, supplied by a replay launcher. */
  replayLog?: Uint8Array;
  recoveryLog?: Uint8Array;
}

interface SearchableSprite {
  sprite: Phaser.GameObjects.Sprite;
  halo: Phaser.GameObjects.Arc;
  evidenceLabel?: Phaser.GameObjects.Text;
  data: Searchable;
  searched: boolean;
}

const FLASHLIGHT_HALF_ANGLES = [35, 32, 28, 24, 20].map(angle => Phaser.Math.DegToRad(angle));

export class FloorScene extends Phaser.Scene {
  private runState!: RunState;
  private floorData!: Floor;
  private tileSize = 32;
  private ordinaryEnvironmentImage?: Phaser.GameObjects.Image;
  private block3VisualMode: Block3VisualMode = 'original';
  private block3VisualKeyHandler?: (event: KeyboardEvent) => void;
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key };
  private flashlightKey!: Phaser.Input.Keyboard.Key;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private keySprite!: Phaser.GameObjects.Sprite;
  private keyLabel!: Phaser.GameObjects.Text;
  private stairsSprite!: Phaser.GameObjects.Sprite;
  private stairsLabel!: Phaser.GameObjects.Text;
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
  private mimicRevealElapsedMs = new Map<Phaser.GameObjects.Sprite, number>();
  private statusText!: Phaser.GameObjects.Text;
  private interactPrompt!: Phaser.GameObjects.Text;
  private puzzlePanel?: Phaser.GameObjects.Rectangle;
  private puzzlePanelText?: Phaser.GameObjects.Text;
  private puzzlePanelArt?: Phaser.GameObjects.Graphics;
  private notebookOpen = false;
  private notebookJournal!: NotebookJournal;
  private notebookElements: Phaser.GameObjects.GameObject[] = [];
  private notebookKeyHandler?: (event: KeyboardEvent) => void;
  private notebookToggleKey?: Phaser.Input.Keyboard.Key;
  private puzzleHintKey?: Phaser.Input.Keyboard.Key;
  private notebookFloor = 4;
  private notebookEntryIndex = 0;
  private notebookHintStage = 0;
  private puzzleDeviceMarker?: Phaser.GameObjects.Graphics;
  private puzzleFallbackMarker?: Phaser.GameObjects.Graphics;
  private puzzleFallbackLabel?: Phaser.GameObjects.Text;
  private puzzleCloseRequested = false;
  private controlsHint!: Phaser.GameObjects.Text;
  private healthBarBg!: Phaser.GameObjects.Rectangle;
  private healthBarFill!: Phaser.GameObjects.Graphics;
  private healthBarText!: Phaser.GameObjects.Text;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera; // Dedicated UI camera
  private flashlightOn = false;
  private lightmapTexture!: Phaser.GameObjects.RenderTexture;
  private lightmapGraphics!: Phaser.GameObjects.Graphics;
  private ambientRayAngles: number[] = [];
  private ambientLightRays: OccludedRay[] = [];
  private flashlightRayAngles: number[] = [];
  private flashlightLightRays: OccludedRay[] = [];
  private flashlightBoundaryAngles: number[] = new Array(FLASHLIGHT_HALF_ANGLES.length * 2).fill(0);
  private flickeringLampPositions: Array<{ x: number; y: number; phase: number; seed: number; signal: boolean }> = [];
  private flickeringLampFixtures: Phaser.GameObjects.Graphics[] = [];
  private lastLampJumpscareTick = Number.NEGATIVE_INFINITY;
  private damageVignette!: Phaser.GameObjects.Graphics;
  private corruptionVignette!: Phaser.GameObjects.Graphics;
  private playerFacingAngle = 0;
  private playerIsMoving = false;
  private playerWalkAnimationElapsedMs = 0;
  private stalkerSprite!: Phaser.GameObjects.Sprite;
  private stalkerVisualFacing: StalkerVisualFacing = 'down';
  private stalkerIsMoving = false;
  private stalkerWalkAnimationElapsedMs = 0;
  private stalkerNearMissActive = false;
  private stalkerNearMissNextCueAt = Number.NEGATIVE_INFINITY;
  private lastFootstepTick = -10000;
  private finalChaseAudioActive = false;
  private finalChaseAmbienceGain = 1;
  private finalChaseAmbienceTween?: { gain: number };
  private audioDirector!: AudioDirector;
  private audioPreviewKeyHandler?: (event: KeyboardEvent) => void;
  private audioPreviewIndex = -1;
  private ambusherSprites: Phaser.GameObjects.Sprite[] = [];
  private ambusherJumpscareVeil?: Phaser.GameObjects.Rectangle;
  private ambusherJumpscareImage?: Phaser.GameObjects.Image;
  private ambusherJumpscareElapsedMs = 0;
  private ambusherJumpscareVariantIndex = 0;
  private ambusherJumpscareFramingIndex = 0;
  private lastAmbusherJumpscareVariantIndex?: number;
  private ambusherJumpscareImpactPlayed = false;
  private crawlerSprites: Phaser.GameObjects.Sprite[] = [];
  private crawlerPresentation = new Map<number, { moving: boolean; elapsedMs: number }>();
  private crawlerWarningNextCueAt = new Map<number, number>();
  private watcherSprites: Phaser.GameObjects.Sprite[] = [];
  private watcherEyeGlints: Phaser.GameObjects.Graphics[] = [];
  private hauntingDirector = new HauntingDirector();
  private horrorPacing = new HorrorPacingModel();
  private hauntingSilence = new HauntingSilence();
  private hauntingVisual?: Phaser.GameObjects.Image;
  private hauntingWhisper?: Phaser.GameObjects.Text;
  private hauntingVisualRemainingMs = 0;
  private hauntingWhisperRemainingMs = 0;
  private containerScareImage?: Phaser.GameObjects.Image;
  private containerScareStatusText?: Phaser.GameObjects.Text;
  private containerScareAudio?: Phaser.Sound.BaseSound;
  private containerScareRemainingMs = 0;
  private lampJumpscareImage?: Phaser.GameObjects.Image;
  private lampJumpscareRemainingMs = 0;
  private appliedHauntingAmbienceGain = 1;
  private hauntingDebugKeyHandler?: (event: KeyboardEvent) => void;
  private temporaryMessageQueue: Array<{ text: string; color: string; duration: number }> = [];
  private temporaryMessageActive = false;
  private temporaryMessageObject?: Phaser.GameObjects.Text;
  private isPaused = false; // Track pause state
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private isTransitioning = false; // Track floor transitions
  private block13ObjectiveStatus = '';
  private storyPopupOpen = false; // Track if story popup is displayed
  private closeStoryPopup?: () => void;
  private storyCloseKey?: Phaser.Input.Keyboard.Key;
  private openingStoryOpen = false;
  private openingStoryEligible = true;
  private openingStoryIndex = 0;
  private openingStoryTimer?: Phaser.Time.TimerEvent;
  private openingStoryElements: Phaser.GameObjects.GameObject[] = [];
  private openingStoryText?: Phaser.GameObjects.Text;
  private openingStoryImage?: Phaser.GameObjects.Image;
  private openingAdvanceKey?: Phaser.Input.Keyboard.Key;
  private endingEpilogueOpen = false;
  private endingEpilogueIndex = 0;
  private endingEpilogueTimer?: Phaser.Time.TimerEvent;
  private endingEpilogueElements: Phaser.GameObjects.GameObject[] = [];
  private endingEpilogueText?: Phaser.GameObjects.Text;
  private endingEpilogueVeil?: Phaser.GameObjects.Rectangle;
  private endingExterior?: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
  private endingExteriorPlayer?: Phaser.GameObjects.Sprite;
  private endingAdvanceGate = new EpilogueAdvanceGate();
  private endingKeyDownHandler?: (event: KeyboardEvent) => void;
  private endingKeyUpHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super({ key: 'FloorScene' });
  }

  init(data: FloorSceneData) {
    // CRITICAL: Always use registry as single source of truth
    // scene.restart() data params are unreliable in Phaser
    const registryState = this.registry.get('runState') as RunState | undefined;
    this.runState = registryState || data.runState;
    const notebookSeed = BigInt(this.runState.canonicalSeed).toString();
    const savedJournal = this.registry.get('investigationNotebook') as NotebookJournal | undefined;
    this.notebookJournal = savedJournal?.seed === notebookSeed ? savedJournal : emptyNotebookJournal(notebookSeed);
    this.notebookFloor = this.runState.floor;
    this.notebookEntryIndex = 0;
    this.notebookOpen = false;
    this.notebookElements = [];
    this.notebookHintStage = 0;
    this.block3VisualMode = 'original';
    this.ordinaryEnvironmentImage = undefined;
    this.block3VisualKeyHandler = undefined;

    // Reset per-floor state
    this.hasKey = false;
    this.stairsUnlocked = false;
    this.flashlightOn = false;
    this.playerIsMoving = false;
    this.playerWalkAnimationElapsedMs = 0;
    this.searchableSprites = [];
    this.crawlerPresentation.clear();
    this.crawlerWarningNextCueAt.clear();
    this.watcherSprites = [];
    this.watcherEyeGlints = [];
    this.mimicRevealElapsedMs.clear();
    this.hauntingDirector = new HauntingDirector();
    this.horrorPacing = new HorrorPacingModel();
    this.hauntingSilence.clear();
    this.hauntingVisual = undefined;
    this.hauntingWhisper = undefined;
    this.hauntingVisualRemainingMs = 0;
    this.hauntingWhisperRemainingMs = 0;
    this.containerScareImage = undefined;
    this.containerScareStatusText = undefined;
    this.containerScareAudio = undefined;
    this.containerScareRemainingMs = 0;
    this.lampJumpscareImage = undefined;
    this.lampJumpscareRemainingMs = 0;
    this.stalkerNearMissActive = false;
    this.finalChaseAudioActive = false;
    this.finalChaseAmbienceGain = 1;
    this.finalChaseAmbienceTween = undefined;
    this.stalkerNearMissNextCueAt = Number.NEGATIVE_INFINITY;
    this.lastFootstepTick = -10000;
    this.appliedHauntingAmbienceGain = 1;
    this.ambusherJumpscareVeil = undefined;
    this.ambusherJumpscareImage = undefined;
    this.ambusherJumpscareElapsedMs = 0;
    this.ambusherJumpscareVariantIndex = 0;
    this.ambusherJumpscareFramingIndex = 0;
    this.ambusherJumpscareImpactPlayed = false;
    this.isTransitioning = false;
    this.block13ObjectiveStatus = '';
    this.storyPopupOpen = false;
    this.closeStoryPopup = undefined;
    this.storyCloseKey = undefined;
    this.openingStoryOpen = false;
    this.openingStoryIndex = 0;
    this.openingStoryTimer = undefined;
    this.openingStoryElements = [];
    this.openingStoryText = undefined;
    this.endingEpilogueOpen = false;
    this.endingEpilogueIndex = 0;
    this.endingEpilogueTimer = undefined;
    this.endingEpilogueElements = [];
    this.endingEpilogueText = undefined;
    this.endingEpilogueVeil = undefined;
    this.endingExterior = undefined;
    this.endingExteriorPlayer = undefined;
    this.endingAdvanceGate = new EpilogueAdvanceGate();
    this.endingKeyDownHandler = undefined;
    this.endingKeyUpHandler = undefined;
    // Phaser restarts this Scene instance. Clear every presentation reference
    // here so create() cannot accidentally touch a destroyed floor's objects.
    this.statusText = undefined as unknown as Phaser.GameObjects.Text;
    this.puzzlePanel = undefined;
    this.puzzlePanelText = undefined;
    this.puzzlePanelArt = undefined;
    this.puzzleDeviceMarker = undefined;
    this.puzzleFallbackMarker = undefined;
    this.puzzleFallbackLabel = undefined;
    this.puzzleCloseRequested = false;
    this.keyLabel = undefined as unknown as Phaser.GameObjects.Text;
    this.stairsLabel = undefined as unknown as Phaser.GameObjects.Text;
    this.healthBarBg = undefined as unknown as Phaser.GameObjects.Rectangle;
    this.healthBarFill = undefined as unknown as Phaser.GameObjects.Graphics;
    this.healthBarText = undefined as unknown as Phaser.GameObjects.Text;
    this.uiCamera = undefined as unknown as Phaser.Cameras.Scene2D.Camera;
    this.lightmapTexture = undefined as unknown as Phaser.GameObjects.RenderTexture;
    this.lightmapGraphics = undefined as unknown as Phaser.GameObjects.Graphics;
    this.ambientRayAngles = [];
    this.ambientLightRays = [];
    this.flashlightRayAngles = [];
    this.flashlightLightRays = [];
    this.flashlightBoundaryAngles = new Array(FLASHLIGHT_HALF_ANGLES.length * 2).fill(0);
    this.flickeringLampPositions = [];
    this.flickeringLampFixtures = [];
    this.lastLampJumpscareTick = Number.NEGATIVE_INFINITY;
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
    this.notebookFloor = this.authoritativeSimulation.state.floor;
    const recoveryLog = data.recoveryLog ?? this.registry.get('recoveryLog') as Uint8Array | undefined;
    if (!recoveryLog && this.authoritativeSimulation.state.tick === 0 && this.inputRecorder.getEventCount() === 0) {
      this.notebookJournal = emptyNotebookJournal(notebookSeed);
      this.registry.set('investigationNotebook', this.notebookJournal);
    }
    this.openingStoryEligible = !recoveryLog && !data.replayLog;
    const persistInitialRecovery = this.registry.get('persistRunRecovery') as ((log: Uint8Array, state: AuthoritativeState) => void) | undefined;
    if (!recoveryLog && this.authoritativeSimulation.state.tick === 0 && persistInitialRecovery) {
      persistInitialRecovery(this.inputRecorder.encodeBinary(), this.authoritativeSimulation.state);
    }
    if (recoveryLog) {
      const recoveredEvents = InputRecorder.decodeBinary(recoveryLog) as ReturnType<typeof InputRecorder.decodeBinary> & { terminalTick?: number };
      const recoveryTick = recoveredEvents.terminalTick ?? recoveredEvents.reduce((max, event) => Math.max(max, event.tick + 1), 0);
      const recoverySource = InputReplayer.fromBinary(recoveryLog);
      // Rebuild the journal from the same verified deterministic replay used
      // for recovery. A stale client cache is never trusted as discovered data.
      let rebuiltJournal = emptyNotebookJournal(notebookSeed);
      for (let tick = 0; tick < recoveryTick; tick++) {
        const floorBeforeTick = this.authoritativeSimulation.floor;
        const result = this.authoritativeSimulation.stepWithEvents(recoverySource.getStateAtTick(tick));
        rebuiltJournal = addNotebookSearchEvents(rebuiltJournal, floorBeforeTick, result.events);
      }
      this.notebookJournal = rebuiltJournal;
      this.registry.set('investigationNotebook', this.notebookJournal);
      this.inputRecorder = InputRecorder.fromBinary(recoveryLog);
      this.simulationEngine.restoreTick(recoveryTick);
      const expectedStateHash = this.registry.get('recoveryStateHash') as string | undefined;
      if (!expectedStateHash || hashAuthoritativeState(this.authoritativeSimulation.state) !== expectedStateHash) {
        throw new Error('Saved run state does not match its deterministic input replay. The run was stopped safely.');
      }
      this.runState.floor = this.authoritativeSimulation.state.floor;
      this.runState.floorsCompleted = this.authoritativeSimulation.state.floorsCompleted;
      this.runState.hp = this.authoritativeSimulation.state.hp;
      this.runState.battery = this.authoritativeSimulation.state.battery / FIXED_SCALE;
      this.runState.curse = this.authoritativeSimulation.state.curse / FIXED_SCALE;
      this.runState.score = this.authoritativeSimulation.state.score;
      this.runState.status = this.authoritativeSimulation.state.status;
      this.registry.set('inputRecorder', this.inputRecorder);
      this.registry.remove('recoveryLog');
      this.registry.remove('recoveryStateHash');
      this.registry.set('openingStorySeen', true);
    }
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

    const { width, height, tiles, start, exit, searchables } = this.floorData;

    // Calculate camera bounds
    const worldWidth = width * this.tileSize;
    const worldHeight = height * this.tileSize;

    // Set world bounds
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    // Draw floor tiles; collision is resolved only by AuthoritativeSimulation.
    this.drawFloor(tiles);
    this.createFlickeringLamps(tiles);

    // Create searchable objects
    this.createSearchables(searchables);
    this.createPuzzleMarkers();

    // Create key sprite

    // Create stairs sprite (locked initially)
    this.stairsSprite = this.createStairs(exit[0], exit[1]);

    // Create player at start position
    this.player = this.createPlayer(start[0], start[1]);
    this.updateObjectiveVisibility(this.authoritativeSimulation.state);

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
    if (floorAmbienceKeys(this.authoritativeSimulation.state.floor).length > 0) {
      this.audioDirector.fadeInCategory('ambience', 1000);
    }
    const floorMusic = floorMusicTrack(this.authoritativeSimulation.state.floor);
    if (floorMusic) this.startFloorMusic(floorMusic, 900);
    if (import.meta.env.DEV && !this.runState.manifest) this.bindDevelopmentAudioPreview();
    // Legacy managers are not constructed: AuthoritativeSimulation owns all AI,
    // random decisions, movement, damage, searches, and progression.
    this.createSecondaryEnemySprites();
    this.createAmbusherSprites();
    this.createHauntingVisual();

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
    this.input.keyboard!.addCapture(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.notebookToggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.notebookToggleKey.on('down', () => {
      if (this.notebookOpen) this.closeNotebook();
      else if (!this.storyPopupOpen && !this.openingStoryOpen && !this.endingEpilogueOpen && !this.isPaused && !this.isTransitioning) this.openNotebook();
    });
    this.puzzleHintKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.puzzleHintKey.on('down', () => {
      if (this.authoritativeSimulation.state.puzzle.active) {
        const discovered = discoveredObjectiveSteps(this.floorData, this.authoritativeSimulation.state.searched);
        if (this.floorData.puzzle.kind === 'circuit' && discovered.has(0)) this.notebookHintStage = (this.notebookHintStage + 1) % 3;
        this.updatePuzzlePanel(this.authoritativeSimulation.state);
      }
    });
    this.pauseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.bindDevelopmentBlock3VisualToggle();
    if (!this.inputSource) {
      this.inputSource = new LiveInputSource(() => this.readKeyboardInput());
      this.registry.set('inputSource', this.inputSource);
    }
    this.inputPipeline = new InputPipeline(this.inputSource, this.inputRecorder);

    // Setup pause key handler
    this.pauseKey.on('down', () => {
      if (this.authoritativeSimulation.state.puzzle.active) {
        this.puzzleCloseRequested = true;
        return;
      }
      if (this.openingStoryOpen) {
        this.skipOpeningStory();
        return;
      }
      if (this.endingEpilogueOpen) {
        this.finishVictoryEpilogue();
        return;
      }
      if (this.storyPopupOpen) {
        this.closeStoryPopup?.();
        return;
      }
      if (!this.isPaused) {
        this.showPauseMenu();
      }
    });
    this.storyCloseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.storyCloseKey.on('down', () => {
      if (this.openingStoryOpen) this.advanceOpeningStory();
      else if (!this.endingEpilogueOpen) this.closeStoryPopup?.();
    });
    this.openingAdvanceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.openingAdvanceKey.on('down', () => {
      if (this.openingStoryOpen) this.advanceOpeningStory();
    });
    if (import.meta.env.DEV && !this.runState.manifest) this.bindHauntingDebugControls();

    // Ensure keyboard is enabled
    if (this.input.keyboard) {
      this.input.keyboard.enabled = true;
    }

    // Floor info with run state
    this.statusText = this.add.text(16, 16, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#70d4c6',
      backgroundColor: '#070d12',
      padding: { x: 12, y: 8 },
      lineSpacing: 4,
    }).setScrollFactor(0).setDepth(100);
    const compactHud = this.scale.height < 420 || this.scale.width < 640;
    const puzzlePanelW = Math.min(600, this.scale.width - 28);
    const puzzlePanelH = Math.min(430, this.scale.height - 28);
    this.puzzlePanel = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, puzzlePanelW, puzzlePanelH, 0x0c1012, 0.98)
      .setScrollFactor(0).setDepth(600).setStrokeStyle(2, 0xb07956, 1).setVisible(false);
    this.puzzlePanelText = this.add.text(this.scale.width / 2 + 22, this.scale.height / 2, '', {
      fontFamily: 'monospace', fontSize: compactHud ? '9px' : '13px', color: '#eee8f2', align: 'left',
      wordWrap: { width: puzzlePanelW - 90 }, lineSpacing: compactHud ? 2 : 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(601).setVisible(false);
    this.puzzlePanelArt = this.createPuzzlePanelArt(puzzlePanelW, puzzlePanelH);
    this.cameras.main.ignore([this.puzzlePanel, this.puzzlePanelText, this.puzzlePanelArt]);


    // Interaction prompt (hidden initially)
    this.interactPrompt = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height - 92,
      '',
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffd700',
        backgroundColor: '#080c12',
        padding: { x: 12, y: 8 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false);

    // Compact controls legend. Detailed controls remain available in pause.
    this.controlsHint = this.add.text(16, this.cameras.main.height - 100, [
      'WASD / ARROWS MOVE  ·  F LIGHT  ·  E INTERACT', 'TAB NOTEBOOK  ·  ESC PAUSE',
      ...(this.isDevelopmentBlock3VisualComparisonAvailable() ? ['F8 - BLOCK 3 ART: ORIGINAL'] : []),
    ].join('\n'), {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#a5b6b5',
      backgroundColor: '#07090d',
      padding: { x: 8, y: 4 },
      lineSpacing: 3,
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

    // All lifecycle-owned HUD objects must be recreated before any updater
    // touches them. updateStatusText also updates the health bar.
    this.updateStatusText();

    // FloorScene is only entered after local setup or TX1 confirmation, so the
    // opening story cannot delay either wallet flow. It is presentation-only.
    if (shouldPlayOpeningCinematic({
      floor: this.authoritativeSimulation.state.floor,
      tick: this.authoritativeSimulation.state.tick,
      replay: false, // init() already folded replay/recovery eligibility into this flag.
      recovery: !this.openingStoryEligible,
      alreadySeen: this.registry.get('openingStorySeen') === true,
    })) {
      this.showOpeningStory();
    }
  }

  update(time: number, delta: number) {
    // Wall-clock accumulation drives only the cosmetic walk-frame selection.
    if (this.playerIsMoving && Number.isFinite(delta) && delta > 0) {
      this.playerWalkAnimationElapsedMs = (this.playerWalkAnimationElapsedMs + delta) % PLAYER_WALK_CYCLE_DURATION_MS;
    }
    if (this.stalkerIsMoving && Number.isFinite(delta) && delta > 0) {
      this.stalkerWalkAnimationElapsedMs = (this.stalkerWalkAnimationElapsedMs + delta) % STALKER_WALK_CYCLE_DURATION_MS;
    }
    if (Number.isFinite(delta) && delta > 0) {
      for (const presentation of this.crawlerPresentation.values()) {
        if (presentation.moving) presentation.elapsedMs = (presentation.elapsedMs + delta) % CRAWLER_WALK_CYCLE_DURATION_MS;
      }
    }
    this.updateAmbusherJumpscare(delta);
    this.updateHauntingPresentation(delta);
    this.updateContainerScare(delta);
    this.updateLampJumpscare(delta);

    // Story and pause overlays freeze simulation ticks. Dismissing a note is UI
    // input only, so it is neither recorded nor allowed to consume a gameplay tick.
    if (!this.storyPopupOpen && !this.openingStoryOpen && !this.endingEpilogueOpen && !this.isTransitioning && !this.isPaused) {
      this.simulationEngine.update(delta, (fixedDelta, tick) => {
        this.fixedUpdate(fixedDelta, tick);
      }, () => this.storyPopupOpen || this.openingStoryOpen || this.endingEpilogueOpen || this.isTransitioning || this.isPaused);
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
    if (this.isTransitioning || this.isPaused || this.storyPopupOpen || this.openingStoryOpen || this.endingEpilogueOpen) {
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
      this.renderAuthoritativeState(before, state, result.events, fixedDelta);
      this.presentSimulationEvents(result.events);
      if (inputs.interact && before.puzzle.active && result.events.length === 0) {
        const evidenceFound = this.floorData.objectives.searchableIndices.filter(index => state.searched[index]).length;
        if (state.puzzle.fallbackActive) this.showTemporaryMessage('NORMAL ENTRY IS DISABLED — USE THE FALLBACK.', '#d4c6f0', 1100);
        else if (evidenceFound < this.floorData.objectives.searchableIndices.length) this.showTemporaryMessage('FIND ALL EVIDENCE BEFORE SUBMITTING.', '#d4c6f0', 1100);
      } else if (inputs.interact && result.events.length === 0) {
        const feedback = rejectedInteractionFeedback(state, this.floorData);
        if (feedback) this.showTemporaryMessage(feedback, '#a5b6b5', 1100);
      }
      if (state.status === 'won') {
        this.clearAmbusherJumpscare();
        this.beginVictoryEpilogue();
      } else if (state.status === 'lost') {
        this.clearAmbusherJumpscare();
        this.audioDirector.stopCategory('ambience');
        this.playerDeath();
      }
    });

    const persistRecovery = this.registry.get('persistRunRecovery') as ((log: Uint8Array, state: AuthoritativeState) => void) | undefined;
    if (persistRecovery && (tick % 60 === 59 || this.authoritativeSimulation.state.status !== 'playing')) {
      persistRecovery(this.inputRecorder.encodeBinary(), this.authoritativeSimulation.state);
    }

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
    for (const audioCue of audioCuesForEvents(events, this.authoritativeSimulation.state)) this.playAudioCue(audioCue);
    for (const event of events) {
      if (event.type === 'key_collected') {
        this.showTemporaryMessage(this.authoritativeSimulation.state.floor === 0
          ? 'EXIT KEY RECOVERED — FIND THE WAY OUT' : 'STAIR KEY RECOVERED — RETURN TO THE STAIRS', '#ffd700');
      }
      else if (event.type === 'objective_updated') this.showTemporaryMessage(
        event.complete ? (event.floor === 1 ? 'RECORDS RECONSTRUCTED — THE EXIT IS OPEN' : 'PUZZLE COMPLETE — PROGRESSION UNLOCKED') : `EVIDENCE FOUND ${event.progress}/${event.total}`,
        event.complete ? '#ffd700' : '#d4c6f0',
      );
      else if (event.type === 'puzzle_wrong_answer') {
        const reduced = this.audioDirector?.getSettings().reduceJumpscareIntensity ?? false;
        if (event.floor === 4 && event.failures === 1) {
          const flicker = reduced ? 30 : 90;
          this.cameras.main.flash(100, flicker, flicker, flicker);
        }
        if (event.floor === 4 && event.failures === 2) this.playAudioCue({ key: `${AUDIO_KEYS.player.footstep}_${(this.runState.seed % 3) + 1}`, cooldownMs: 0, volume: reduced ? 0.08 : 0.14 });
        if (event.failures === 3) {
          this.showHauntingVisual('silhouette', 13_000 + event.floor, reduced ? 650 : 900);
          this.showTemporaryMessage(`THE PUZZLE IS LOCKED — FIND THE ${this.puzzleFallbackItemLabel(event.floor)}`, '#e8c6d4', 1800);
        } else if (event.floor === 3 && event.failures === 1) {
          const evidence = this.searchableSprites[this.floorData.objectives.searchableIndices[0]]?.sprite;
          if (evidence) this.tweens.add({ targets: evidence, angle: 180, duration: 180, yoyo: true, hold: 350 });
          this.showTemporaryMessage('THE RESIDENT RECORD HAS TURNED FACE DOWN.', '#d4c6f0', 1500);
        } else if (event.floor === 3 && event.failures === 2) {
          const evidence = this.searchableSprites[this.floorData.objectives.searchableIndices[1]]?.sprite;
          if (evidence) this.tweens.add({ targets: evidence, alpha: 0.12, duration: 280, yoyo: true, hold: 500 });
          this.showTemporaryMessage('ONE NAME HAS VANISHED FROM THE DIRECTORY.', '#d4c6f0', 1500);
        }
        else this.showTemporaryMessage(event.floor === 2 ? 'THE CIRCUIT IS STILL INCOMPLETE.'
          : event.floor === 1 ? 'THE RECORDS STILL CONTRADICT.' : 'THE MEMORIES DO NOT ALIGN.', '#d4c6f0', 1300);
      }
      else if (event.type === 'puzzle_fallback_item_found') {
        if (event.floor === 3) {
          const resident = this.floorData.puzzle.residents![this.floorData.puzzle.correctResident!];
          const content = `The sealed original names ${resident.name}, apartment ${resident.apartment}, as the resident removed from the register. Return to the directory to recover the key.`;
          this.recordNotebookEntry({ id: `${event.floor}:archival-addendum`, floor: event.floor, title: 'ARCHIVAL ADDENDUM', content, important: true });
          this.showClueModal('ARCHIVAL ADDENDUM', content, true);
        } else this.showTemporaryMessage(`${this.puzzleFallbackItemLabel(event.floor)} FOUND — RETURN TO THE PUZZLE`, '#ffca86', 1800);
      }
      else if (event.type === 'puzzle_solved') {
        if (event.floor === 4) {
          const content = 'The three records agree on one point: the failures were scheduled, repeated, and then marked repaired without inspection. Someone made the building unsafe on purpose.';
          this.recordNotebookEntry({ id: `${event.floor}:sabotage-revelation`, floor: event.floor, title: 'THE FIRST WARNING', content, important: true });
          this.showClueModal('THE FIRST WARNING', content, true);
        } else if (event.floor === 1) {
          const sequence = this.floorData.puzzle.recordOrder!.map(index => this.floorData.puzzle.recordEvents![index]).join('\n→ ');
          const content = `${sequence}\n\nThe official index was altered. This is the sequence preserved by the three independent records.`;
          this.recordNotebookEntry({ id: `${event.floor}:unaltered-sequence`, floor: event.floor, title: 'THE UNALTERED SEQUENCE', content, important: true });
          this.showClueModal('THE UNALTERED SEQUENCE', content, true);
        } else if (event.floor === 3) {
          const resident = this.floorData.puzzle.residents![this.floorData.puzzle.correctResident!];
          const content = `${resident.name} — APARTMENT ${resident.apartment}\n\nThe directory accepts the match, then opens a sealed maintenance file:\n\nREMOVED FROM REGISTER. DO NOT RETURN THE ORIGINAL TO THE TENANT FOLDER.\n\nThe resident had been collecting evidence of the building's failures.`;
          this.recordNotebookEntry({ id: `${event.floor}:name-they-removed`, floor: event.floor, title: 'THE NAME THEY REMOVED', content, important: true });
          this.showClueModal('THE NAME THEY REMOVED', content, true);
        } else if (event.floor === 2) {
          const content = 'The archive confirms that emergency systems were disabled by order, not by accident. The resident\'s warnings were filed, crossed out, and left beside the locked-exit instructions.';
          this.recordNotebookEntry({ id: `${event.floor}:archive-confirmation`, floor: event.floor, title: 'THE ARCHIVE CONFIRMATION', content, important: true });
          this.showClueModal('THE ARCHIVE CONFIRMATION', content, true);
        } else if (event.floor === 0) {
          const state = this.authoritativeSimulation.state;
          const eventId = Math.imul(this.runState.seed ^ state.tick, 0x45d9f3b) >>> 0;
          this.audioDirector?.setCategoryDucking('ambience', 0.08, 'final-memory-reveal');
          const content = 'I heard them outside the door.\n\nThey\'re still waiting for someone to open it.\n\nI told them help was coming.\n\nI don\'t know what else to tell them.\n\nThe whistleblower died trying to reach the others.';
          this.recordNotebookEntry({ id: `${event.floor}:last-message`, floor: event.floor, title: 'THE LAST MESSAGE', content, important: true });
          this.showClueModal('THE LAST MESSAGE', content, true, () => {
            this.audioDirector?.setCategoryDucking('ambience', 1, 'final-memory-reveal');
            this.showHauntingVisual('silhouette', eventId, 1800);
            this.showTemporaryMessage('THE MEMORY WILL NOT STAY BURIED.', '#e8c6d4', 2300);
          });
        } else this.showTemporaryMessage(
          event.floor === 2 ? 'ARCHIVE POWER RESTORED' : 'PUZZLE SOLVED', '#ffd700', 1800,
        );
      }
      else if (event.type === 'damage') this.showTemporaryMessage(`HURT -${event.amount} HP`, '#ff6666');
      else if (event.type === 'loot_searched') {
        const result = event.result;
        if (result.type === 'staircase_key') continue;
        if (result.type === 'battery') this.showTemporaryMessage(`BATTERY +${result.amount}%`, '#70d4c6');
        else if (result.type === 'health') this.showTemporaryMessage(`HEALTH +${result.amount} HP`, '#70d4c6');
        else if (result.type === 'collectible') this.showTemporaryMessage(`GOLD +${result.score} POINTS`, '#ffd700');
        else if (result.type === 'clue') {
          this.recordNotebookEvents(this.floorData, [event]);
          const objectiveStep = this.floorData.searchables[event.index]?.objectiveStep;
          const clue = getAuthoredClueForSearchId(result.id);
          const puzzleClue = objectiveStep === undefined ? undefined : this.floorData.puzzle.clueTexts[objectiveStep];
          this.showClueModal(puzzleClue ? `${this.floorData.puzzle.title} // EVIDENCE ${objectiveStep! + 1}` : clue?.title ?? 'NOTE FOUND', puzzleClue ?? clue?.content ?? 'The writing is too faded to read.', true);
        } else if (result.type === 'nothing') this.showTemporaryMessage('EMPTY', '#a5b6b5');
        else this.showTemporaryMessage('MIMIC REVEALED — RUN', '#ff6666');
      } else if (event.type === 'floor_transition' && event.toFloor >= 0) {
        this.showTemporaryMessage(`${playerBlockName(event.toFloor)} UNLOCKED`, '#ffd700');
      }
      if (event.type === 'loot_searched' && this.authoritativeSimulation.state.status === 'playing') {
        const state = this.authoritativeSimulation.state;
        const anomaly = this.canStartHaunting(state) ? this.hauntingDirector.evaluateSearch({
          floor: state.floor, tick: state.tick,
          tileX: Math.floor(state.x / FIXED_SCALE / this.tileSize),
          tileY: Math.floor(state.y / FIXED_SCALE / this.tileSize),
        }, event.index, this.horrorPacing.stage) : null;
        if (anomaly) this.presentHauntingEvent(anomaly);
      }
    }
  }

  private createHauntingVisual() {
    const texture = this.textures.exists('forgotten_appearance') ? 'forgotten_appearance'
      : this.textures.exists('stalker_idle_up') ? 'stalker_idle_up' : 'stalker';
    this.hauntingVisual = this.add.image(0, 0, texture).setOrigin(0.5).setDepth(8).setVisible(false);
    this.hauntingWhisper = this.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '9px', color: '#d5cbd7',
      backgroundColor: '#090811cc', padding: { x: 3, y: 2 },
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 0, fill: true },
    }).setOrigin(0.5).setDepth(12).setVisible(false);
    if (texture !== 'stalker') this.markTextureNearest(texture);
    // This object deliberately has no physics body and is never added to sim state.
  }

  private realEnemyThreatActive(state: AuthoritativeState): boolean {
    const px = state.x / FIXED_SCALE, py = state.y / FIXED_SCALE;
    const near = (x: number, y: number, range: number) => Math.hypot(x / FIXED_SCALE - px, y / FIXED_SCALE - py) <= range;
    return state.stalker.visible
      || watcherIsCausingCurse(state)
      || state.crawlers.some(enemy => enemy.chasing && near(enemy.x, enemy.y, 180))
      || state.mimics.some(enemy => enemy.active && enemy.revealed && near(enemy.x, enemy.y, 220))
      || state.ambushers.some(enemy => enemy.state === 'warning' || enemy.state === 'jumpscare');
  }

  private canStartHaunting(state: AuthoritativeState): boolean {
    return hauntingPresentationAllowed({
      tick: state.tick,
      status: state.status,
      paused: this.isPaused,
      transitioning: this.isTransitioning,
      modalOpen: this.storyPopupOpen || this.openingStoryOpen || this.endingEpilogueOpen,
      presentationActive: Boolean(this.ambusherJumpscareVeil?.active || this.containerScareImage?.active
        || this.containerScareStatusText?.active
        || this.lampJumpscareImage?.active
        || this.hauntingSilence.isActive || this.hauntingVisual?.visible || this.hauntingWhisper?.visible),
      realThreatActive: this.realEnemyThreatActive(state),
      recoveryUntilTick: this.hauntingDirector.recoveryUntilTick,
    });
  }

  private presentHauntingEvent(event: HauntingEvent) {
    if (!this.canStartHaunting(this.authoritativeSimulation.state)) return;
    this.hauntingVisual?.setVisible(false);
    this.hauntingWhisper?.setVisible(false);
    switch (event.type) {
      case 'false_footstep': {
        // The checked-in player-step recording is the only suitable neutral one-shot.
        // Select a variant by local hash so AudioDirector's RNG is not advanced.
        const key = `${AUDIO_KEYS.player.footstep}_${event.id % 3 + 1}`;
        const reduced = this.audioDirector?.getSettings().reduceJumpscareIntensity ?? false;
        if (this.audioDirector?.hasLoadedAsset(key)) this.audioDirector.playWithCooldown(key, 'sfx', 8000, { volume: reduced ? 0.08 : 0.14 });
        break;
      }
      case 'silence':
        if (!this.hauntingSilence.isActive) this.hauntingSilence.start(event.durationMs);
        break;
      case 'silhouette':
      case 'fake_stalker':
      case 'environment_shift':
        this.showHauntingVisual(event.type, event.id, event.durationMs);
        break;
      case 'whisper':
        this.showHauntingWhisper(event.id, event.durationMs);
        break;
    }
  }

  private showHauntingWhisper(eventId: number, durationMs: number) {
    if (!this.hauntingWhisper) return;
    this.hauntingVisual?.setVisible(false);
    const tile = this.findHauntingTile(true, eventId);
    if (!tile) return;
    this.hauntingWhisper.setText(hauntingWhisperLine(eventId, tile[0], tile[1]))
      .setPosition(tile[0] * this.tileSize + 16, tile[1] * this.tileSize + 16)
      .setAlpha(0.88).setVisible(true);
    this.hauntingWhisperRemainingMs = durationMs;
  }

  private findHauntingTile(walkable: boolean, eventId: number): [number, number] | undefined {
    const state = this.authoritativeSimulation.state;
    const px = state.x / FIXED_SCALE, py = state.y / FIXED_SCALE;
    const centerX = Math.floor(px / this.tileSize), centerY = Math.floor(py / this.tileSize);
    const protectedTiles = new Set<string>([
      `${this.floorData.start[0]},${this.floorData.start[1]}`,
      `${this.floorData.key[0]},${this.floorData.key[1]}`,
      `${this.floorData.exit[0]},${this.floorData.exit[1]}`,
      ...this.floorData.searchables.map(item => `${item.x},${item.y}`),
      ...this.floorData.doors.map(([x, y]) => `${x},${y}`),
    ]);
    const candidates: [number, number][] = [];
    for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
      const distance = Math.hypot(dx, dy);
      if (distance < 3.25 || distance > 7 || Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;
      const x = centerX + dx, y = centerY + dy;
      if (Boolean(this.floorData.tiles[y]?.[x]) !== walkable || protectedTiles.has(`${x},${y}`)) continue;
      const worldX = x * this.tileSize + this.tileSize / 2;
      const worldY = y * this.tileSize + this.tileSize / 2;
      if (Math.abs(worldX - px) > this.cameras.main.width / this.cameras.main.zoom * 0.46
        || Math.abs(worldY - py) > this.cameras.main.height / this.cameras.main.zoom * 0.46) continue;
      if (walkable && !hasPresentationLineOfSight(this.floorData, px, py, worldX, worldY)) continue;
      candidates.push([x, y]);
    }
    if (!candidates.length) return undefined;
    // Event identity and stable tile coordinates choose the placement; no RNG.
    let index = Math.imul(eventId ^ (centerX * 31 + centerY), 0x45d9f3b) >>> 0;
    index %= candidates.length;
    return candidates[index];
  }

  private showHauntingVisual(type: HauntingEventType, eventId: number, durationMs: number) {
    if (!this.hauntingVisual) return;
    this.hauntingWhisper?.setVisible(false);
    const environment = type === 'environment_shift';
    const tile = this.findHauntingTile(!environment, eventId);
    if (!tile) return;
    let textureKey: string;
    if (!environment) {
      textureKey = this.textures.exists('forgotten_appearance') ? 'forgotten_appearance'
        : type === 'silhouette' && this.textures.exists('watcher_idle') ? 'watcher_idle'
          : this.textures.exists('stalker_idle_up') ? 'stalker_idle_up' : 'stalker';
    } else {
      const floor = this.authoritativeSimulation.state.floor;
      const candidates = floor === 0
        ? ['b13_impossible_wall_seam', 'b13_repeated_panel', 'b13_broken_ring_segment']
        : floor === 1 ? ['env_b1_wall_spall_01', 'env_b1_fracture_overlay_01']
          : floor === 2 ? ['env_b2_breaker_panel_01', 'env_b2_maintenance_marking_01']
            : floor === 3 ? ['env_b3_wall_peel_01', 'env_b3_wall_peel_02']
              : ['env_wall_variant_02', 'env_wall_base'];
      textureKey = candidates.find(key => this.textures.exists(key)) ?? 'stalker';
    }
    if (!this.textures.exists(textureKey)) return;
    const [x, y] = tile;
    const width = textureKey === 'forgotten_appearance' ? 32
      : environment && textureKey === 'env_b2_breaker_panel_01' ? 24 : this.tileSize;
    const height = textureKey === 'forgotten_appearance' ? 52
      : environment && textureKey === 'env_b2_breaker_panel_01' ? 32 : this.tileSize;
    const reduceIntensity = this.audioDirector?.getSettings().reduceJumpscareIntensity ?? false;
    const rawAlpha = environment ? 0.62 : type === 'fake_stalker' ? 0.32 : 0.28;
    this.hauntingVisual.setTexture(textureKey).setPosition(x * this.tileSize + 16, y * this.tileSize + 16)
      .setDisplaySize(width, height).setTint(environment ? 0xffffff : type === 'fake_stalker' ? 0x8c7d99 : 0x55505b)
      .setAlpha(accessiblePresentationIntensity(rawAlpha, reduceIntensity)).setVisible(true);
    this.markTextureNearest(textureKey);
    this.hauntingVisualRemainingMs = durationMs;
  }

  private updateHauntingPresentation(delta: number) {
    if (this.isPaused || this.isTransitioning || this.storyPopupOpen || this.openingStoryOpen
      || this.endingEpilogueOpen || this.authoritativeSimulation?.state.status !== 'playing') {
      this.clearHauntingPresentation();
      return;
    }
    const safeDelta = Number.isFinite(delta) && delta > 0 ? delta : 0;
    const gain = this.hauntingSilence.update(safeDelta);
    if (gain !== this.appliedHauntingAmbienceGain) {
      this.audioDirector?.setCategoryDucking('ambience', gain);
      this.appliedHauntingAmbienceGain = gain;
    }
    if (this.hauntingWhisper?.visible) {
      this.hauntingWhisperRemainingMs -= safeDelta;
      const state = this.authoritativeSimulation.state;
      const px = state.x / FIXED_SCALE, py = state.y / FIXED_SCALE;
      const distance = Phaser.Math.Distance.Between(px, py, this.hauntingWhisper.x, this.hauntingWhisper.y);
      const blocked = !hasPresentationLineOfSight(this.floorData, px, py, this.hauntingWhisper.x, this.hauntingWhisper.y);
      if (this.hauntingWhisperRemainingMs <= 0 || distance < 56 || blocked || !this.cameras.main.worldView.contains(this.hauntingWhisper.x, this.hauntingWhisper.y)) {
        this.hauntingWhisper.setVisible(false);
      }
    }
    if (!this.hauntingVisual?.visible) return;
    this.hauntingVisualRemainingMs -= safeDelta;
    const state = this.authoritativeSimulation.state;
    const playerX = state.x / FIXED_SCALE, playerY = state.y / FIXED_SCALE;
    const distance = Phaser.Math.Distance.Between(playerX, playerY, this.hauntingVisual.x, this.hauntingVisual.y);
    const visualTileX = Math.floor(this.hauntingVisual.x / this.tileSize);
    const visualTileY = Math.floor(this.hauntingVisual.y / this.tileSize);
    const beyondCamera = !this.cameras.main.worldView.contains(this.hauntingVisual.x, this.hauntingVisual.y);
    const walkableVisual = Boolean(this.floorData.tiles[visualTileY]?.[visualTileX]);
    const lostSight = walkableVisual
      && !hasPresentationLineOfSight(this.floorData, playerX, playerY, this.hauntingVisual.x, this.hauntingVisual.y);
    const revealed = walkableVisual && enemyPresentationExposure(
      this.floorData, state, visualTileX * this.tileSize * FIXED_SCALE + 16 * FIXED_SCALE,
      visualTileY * this.tileSize * FIXED_SCALE + 16 * FIXED_SCALE,
    ) >= 0.7;
    if (this.hauntingVisualRemainingMs <= 0 || distance < 76 || beyondCamera || lostSight || revealed) {
      this.hauntingVisual.setVisible(false);
    }
  }

  private clearHauntingPresentation() {
    this.hauntingSilence.clear();
    this.appliedHauntingAmbienceGain = 1;
    this.audioDirector?.setCategoryDucking('ambience', 1);
    this.hauntingVisual?.setVisible(false);
    this.hauntingVisualRemainingMs = 0;
    this.hauntingWhisper?.setVisible(false);
    this.hauntingWhisperRemainingMs = 0;
    this.clearLampJumpscare();
  }

  /** Screen-space scare used only by the rare dark-lamp presentation event. */
  private startLampJumpscare(eventId: number) {
    this.clearLampJumpscare();
    const preferredAsset = lampJumpscareAssetForEvent(eventId);
    const asset = this.textures.exists(preferredAsset.key) ? preferredAsset : lampJumpscareAssetForEvent(0);
    if (!this.uiCamera || !this.textures.exists(asset.key)) return false;
    const image = this.add.image(this.uiCamera.width / 2, this.uiCamera.height / 2, asset.key)
      .setOrigin(0.5).setScrollFactor(0).setDepth(201).setAlpha(0);
    image.setScale(Math.max(this.uiCamera.width / asset.width, this.uiCamera.height / asset.height) * 1.04);
    this.cameras.main.ignore(image);
    this.lampJumpscareImage = image;
    this.lampJumpscareRemainingMs = 560;
    this.markTextureNearest(asset.key);
    return true;
  }

  private updateLampJumpscare(delta: number) {
    if (!this.lampJumpscareImage) return;
    if (this.isPaused || this.isTransitioning || this.storyPopupOpen || this.openingStoryOpen
      || this.endingEpilogueOpen || this.authoritativeSimulation?.state.status !== 'playing') {
      this.clearLampJumpscare();
      return;
    }
    this.lampJumpscareRemainingMs -= Number.isFinite(delta) && delta > 0 ? delta : 0;
    const reduced = this.audioDirector?.getSettings().reduceJumpscareIntensity ?? false;
    this.lampJumpscareImage.setAlpha(Math.max(0, Math.min(1, this.lampJumpscareRemainingMs / 260)) * (reduced ? 0.72 : 1));
    if (this.lampJumpscareRemainingMs <= 0) this.clearLampJumpscare();
  }

  private clearLampJumpscare() {
    this.lampJumpscareImage?.destroy();
    this.lampJumpscareImage = undefined;
    this.lampJumpscareRemainingMs = 0;
  }

  private bindHauntingDebugControls() {
    this.hauntingDebugKeyHandler = (event: KeyboardEvent) => {
      if (event.repeat || this.isPaused || this.isTransitioning) return;
      const keys: Record<string, HauntingEventType> = {
        h: 'false_footstep', j: 'silence', k: 'silhouette', l: 'fake_stalker', i: 'environment_shift',
      };
      const type = keys[event.key.toLowerCase()];
      if (!type) return;
      event.preventDefault();
      const state = this.authoritativeSimulation.state;
      this.presentHauntingEvent({ type, id: ((state.tick * 2654435761) >>> 0), durationMs: type === 'silence' ? 1200 : type === 'fake_stalker' ? 450 : type === 'silhouette' ? 300 : 1800 });
    };
    this.input.keyboard?.on('keydown', this.hauntingDebugKeyHandler);
  }

  /** A compact wall-clock presentation timeline, isolated from simulation state and RNG. */
  private startAmbusherJumpscare(enemyId: number, eventTick: number) {
    this.clearAmbusherJumpscare();
    this.clearContainerScare();
    this.clearHauntingPresentation();
    this.ambusherJumpscareElapsedMs = 0;
    this.audioDirector?.setCategoryDucking('ambience', AMBUSHER_PRE_IMPACT_AMBIENCE_GAIN);
    const selectedVariant = avoidImmediateAmbusherRepeat(
      ambusherJumpscareVariant(enemyId, eventTick), this.lastAmbusherJumpscareVariantIndex,
    );
    this.ambusherJumpscareVariantIndex = import.meta.env.DEV && !this.runState.manifest
      ? ambusherLocalPreviewVariant(window.location.search) ?? selectedVariant
      : selectedVariant;
    this.lastAmbusherJumpscareVariantIndex = this.ambusherJumpscareVariantIndex;
    this.ambusherJumpscareFramingIndex = ambusherJumpscareFraming(enemyId, eventTick);
    const { width, height } = this.uiCamera;
    this.ambusherJumpscareVeil = this.add.rectangle(width / 2, height / 2, width, height, 0x03020a, 0.86)
      .setScrollFactor(0).setDepth(500);
    this.cameras.main.ignore(this.ambusherJumpscareVeil);
    this.refreshAmbusherJumpscareFrame();
  }

  private updateAmbusherJumpscare(delta: number) {
    if (!this.ambusherJumpscareVeil) return;
    if (this.isPaused || this.isTransitioning || this.authoritativeSimulation?.state.status !== 'playing') {
      this.clearAmbusherJumpscare();
      return;
    }
    const nextFrame = advanceAmbusherJumpscare(this.ambusherJumpscareElapsedMs, delta, this.ambusherJumpscareImpactPlayed);
    this.ambusherJumpscareElapsedMs = nextFrame.elapsedMs;
    if (this.ambusherJumpscareElapsedMs >= AMBUSHER_JUMPSCARE_TOTAL_MS) {
      this.clearAmbusherJumpscare();
      return;
    }
    this.refreshAmbusherJumpscareFrame();
    if (nextFrame.impactBegins) {
      this.ambusherJumpscareImpactPlayed = true;
      this.audioDirector?.setCategoryDucking('ambience', 1);
      const reduced = this.audioDirector?.getSettings().reduceJumpscareIntensity ?? false;
      if (this.audioDirector) playAmbusherImpact(this.audioDirector, reduced);
      this.cameras.main.shake(reduced ? Math.round(AMBUSHER_JUMPSCARE_TIMING.cameraKickMs * 0.46) : AMBUSHER_JUMPSCARE_TIMING.cameraKickMs,
        ambusherCameraKickIntensity(reduced));
    }
  }

  private refreshAmbusherJumpscareFrame() {
    const composition = AMBUSHER_JUMPSCARE_VARIANTS[this.ambusherJumpscareVariantIndex];
    const reduceIntensity = this.audioDirector?.getSettings().reduceJumpscareIntensity ?? false;
    const frame = ambusherFrameForAccessibility(ambusherJumpscareFrame(this.ambusherJumpscareElapsedMs, composition), reduceIntensity);
    this.ambusherJumpscareVeil?.setFillStyle(frame.veilColor, frame.veilAlpha);
    if (!frame.imageVisible) {
      this.ambusherJumpscareImage?.setVisible(false);
      return;
    }
    if (!this.ambusherJumpscareImage) {
      const enemyId = this.authoritativeSimulation.state.ambushers.find(enemy => enemy.state === 'jumpscare')?.id ?? 0;
      const textureKey = ambusherJumpscareTextureKey(composition, key => this.textures.exists(key), `ambusher_${enemyId}`);
      if (!this.textures.exists(textureKey)) return;
      this.markTextureNearest(textureKey);
      this.ambusherJumpscareImage = this.add.image(this.uiCamera.width / 2, this.uiCamera.height / 2, textureKey)
        .setOrigin(0.5).setScrollFactor(0).setDepth(501);
      this.cameras.main.ignore(this.ambusherJumpscareImage);
    }
    const source = this.textures.get(this.ambusherJumpscareImage.texture.key).getSourceImage();
    const layout = ambusherJumpscareLayout(
      this.uiCamera.width, this.uiCamera.height, source.width, source.height,
      this.ambusherJumpscareFramingIndex, frame.punch, composition,
    );
    this.ambusherJumpscareImage.setPosition(layout.x, layout.y).setScale(layout.scale).setAlpha(1).setVisible(true);
  }

  private clearAmbusherJumpscare() {
    this.audioDirector?.setCategoryDucking('ambience', 1);
    this.ambusherJumpscareImage?.destroy();
    this.ambusherJumpscareVeil?.destroy();
    this.ambusherJumpscareImage = undefined;
    this.ambusherJumpscareVeil = undefined;
    this.ambusherJumpscareElapsedMs = 0;
    this.ambusherJumpscareImpactPlayed = false;
  }

  /** Full-screen container scare. The authoritative box scare selects the
   * moment; this presentation cannot alter its result. */
  private startContainerScare(searchableIndex: number) {
    this.clearHauntingPresentation();
    this.clearContainerScare();
    const reduced = this.audioDirector?.getSettings().reduceJumpscareIntensity ?? false;
    const style = containerScareStyle(reduced);
    const preferredAsset = containerScareAssetForSearchIndex(searchableIndex);
    const asset = this.textures.exists(preferredAsset.key) || preferredAsset.key === CONTAINER_SCARE_VARIANT_ASSETS[0].key
      ? preferredAsset
      : CONTAINER_SCARE_VARIANT_ASSETS[0];
    if (this.textures.exists(asset.key) && this.uiCamera) {
      const image = this.add.image(this.uiCamera.width / 2, this.uiCamera.height / 2, asset.key)
        .setOrigin(0.5).setScrollFactor(0).setDepth(201).setAlpha(0);
      const coverScale = Math.max(this.uiCamera.width / asset.width, this.uiCamera.height / asset.height) * 1.04;
      image.setScale(coverScale);
      this.cameras.main.ignore(image);
      this.containerScareImage = image;
    }
    this.containerScareStatusText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 82,
      CONTAINER_SCARE_STATUS_TEXT,
      {
        fontFamily: 'monospace',
        fontSize: reduced ? '12px' : '14px',
        color: reduced ? '#e8c9ad' : '#ffd5b0',
        backgroundColor: '#140c12',
        padding: { x: 10, y: 7 },
        align: 'center',
        stroke: '#050308',
        strokeThickness: 2,
      },
    ).setOrigin(0.5).setScrollFactor(0).setDepth(202).setAlpha(0);
    this.cameras.main.ignore(this.containerScareStatusText);
    this.containerScareRemainingMs = style.durationMs;
    if (this.audioDirector?.hasLoadedAsset('sfx_jumpscare_hit')) {
      this.containerScareAudio = this.audioDirector.playWithCooldown('sfx_jumpscare_hit', 'sfx', 1800, { volume: reduced ? 0.34 : 0.5 }) ?? undefined;
    }
  }

  private updateContainerScare(delta: number) {
    if (!this.containerScareImage && !this.containerScareStatusText) return;
    if (this.isPaused || this.isTransitioning || this.storyPopupOpen || this.openingStoryOpen
      || this.endingEpilogueOpen || this.authoritativeSimulation?.state.status !== 'playing') {
      this.clearContainerScare();
      return;
    }
    this.containerScareRemainingMs -= Number.isFinite(delta) && delta > 0 ? delta : 0;
    const reduced = this.audioDirector?.getSettings().reduceJumpscareIntensity ?? false;
    this.containerScareImage?.setAlpha(Math.max(0, Math.min(1, this.containerScareRemainingMs / (reduced ? 190 : 250)))
      * (reduced ? 0.76 : 1));
    this.containerScareStatusText?.setAlpha(Math.max(0, Math.min(1, this.containerScareRemainingMs / (reduced ? 160 : 200))));
    if (this.containerScareRemainingMs <= 0) this.clearContainerScare();
  }

  private clearContainerScare() {
    this.containerScareImage?.destroy();
    this.containerScareImage = undefined;
    this.containerScareStatusText?.destroy();
    this.containerScareStatusText = undefined;
    this.containerScareRemainingMs = 0;
    this.containerScareAudio?.stop();
    this.containerScareAudio = undefined;
  }

  private playAudioCue(audioCue: AudioCue) {
    const director = this.audioDirector;
    if (!director) return;
    if (audioCue.key === 'sfx_player_hurt') {
      director.playVariantWithCooldown(audioCue.key, AUDIO_KEYS.player.hurtVariants, 'sfx', audioCue.cooldownMs, { volume: 0.46 });
    } else if (audioCue.key === 'sfx_crawler_skitter' && audioCue.positional) {
      director.playPositionalVariantWithCooldown(audioCue.key, 2, {
        x: audioCue.positional.x / FIXED_SCALE,
        y: audioCue.positional.y / FIXED_SCALE,
        maxDistance: 420,
        category: 'sfx',
        volume: audioCue.volume ?? 0.5,
      }, this.player.x, this.player.y, audioCue.cooldownMs);
    } else if (audioCue.key === 'sfx_flashlight_on' || audioCue.key === 'sfx_flashlight_off') {
      director.playWithCooldown(audioCue.key, 'sfx', audioCue.cooldownMs, { volume: 0.56 });
    } else if (audioCue.key === 'sfx_interaction_search') {
      director.playWithCooldown(audioCue.key, 'sfx', audioCue.cooldownMs, { volume: 0.46 });
    } else if (audioCue.key === 'sfx_puzzle_solved') {
      director.playWithCooldown(audioCue.key, 'sfx', audioCue.cooldownMs, { volume: 0.62 });
    } else if (audioCue.key === 'sfx_key_pickup') {
      director.playWithCooldown(audioCue.key, 'sfx', audioCue.cooldownMs, { volume: 0.58 });
    } else if (audioCue.key === 'sfx_item_pickup' || audioCue.key === 'sfx_item_heal') {
      director.playWithCooldown(audioCue.key, 'sfx', audioCue.cooldownMs, { volume: 0.48 });
    } else if (audioCue.key === 'sfx_floor_transition') {
      director.playWithCooldown(audioCue.key, 'sfx', audioCue.cooldownMs, { volume: 0.5 });
    } else if (audioCue.positional) {
      const reduced = director.getSettings().reduceJumpscareIntensity;
      const intensityScale = reduced && audioCue.key === 'sfx_ambusher_warning' ? 0.56 : 1;
      director.playPositionalWithCooldown({
        key: audioCue.key,
        x: audioCue.positional.x / FIXED_SCALE,
        y: audioCue.positional.y / FIXED_SCALE,
        maxDistance: audioCue.key === 'sfx_stalker_hunt' ? 520 : audioCue.key === 'sfx_mimic_reveal' ? 360 : 420,
        category: 'sfx',
        volume: (audioCue.volume ?? 0.75) * intensityScale,
      }, this.player.x, this.player.y, audioCue.cooldownMs);
    } else {
      director.playWithCooldown(audioCue.key, 'sfx', audioCue.cooldownMs, { volume: 0.56 });
    }
  }

  /** Duck only the active Block 13 ambience loop during pursuit, respecting the live mix settings. */
  private setFinalChaseAmbience(active: boolean, reduceIntensity: boolean) {
    this.finalChaseAudioActive = active;
    const targetGain = active ? finalChaseAmbienceGain(reduceIntensity) : 1;
    if (this.finalChaseAmbienceTween) this.tweens.killTweensOf(this.finalChaseAmbienceTween);
    const progress = { gain: this.finalChaseAmbienceGain };
    this.finalChaseAmbienceTween = progress;
    try {
      this.tweens.add({
        targets: progress,
        gain: targetGain,
        duration: active ? 520 : 760,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          this.finalChaseAmbienceGain = progress.gain;
          this.audioDirector?.setCategoryDucking('ambience', progress.gain, 'final-stalker-chase');
        },
        onComplete: () => {
          this.finalChaseAmbienceGain = targetGain;
          this.finalChaseAmbienceTween = undefined;
          this.audioDirector?.setCategoryDucking('ambience', targetGain, 'final-stalker-chase');
        },
      });
    } catch {
      this.finalChaseAmbienceGain = targetGain;
      this.finalChaseAmbienceTween = undefined;
      this.audioDirector?.setCategoryDucking('ambience', targetGain, 'final-stalker-chase');
    }
  }

  /** Drop pursuit-only ambience ducking when gameplay presentation suspends or ends. */
  private clearFinalChaseAmbience() {
    if (this.finalChaseAmbienceTween) this.tweens.killTweensOf(this.finalChaseAmbienceTween);
    this.finalChaseAmbienceTween = undefined;
    this.finalChaseAudioActive = false;
    this.finalChaseAmbienceGain = 1;
    this.audioDirector?.setCategoryDucking('ambience', 1, 'final-stalker-chase');
  }

  /** Presentation adapter: every moving enemy/object comes from an immutable sim snapshot. */
  private renderAuthoritativeState(previous: AuthoritativeState, state: AuthoritativeState, events: ReturnType<AuthoritativeSimulation['stepWithEvents']>['events'], presentationDeltaMs: number) {
    const watcherGazeNow = watcherIsCausingCurse(state);
    const watcherGazeBefore = watcherIsCausingCurse(previous);
    const encounterStarted = (!previous.stalker.visible && state.stalker.visible)
      || (previous.stalker.state !== 'hunting' && state.stalker.state === 'hunting')
      || (!watcherGazeBefore && watcherGazeNow)
      || state.crawlers.some(enemy => enemy.chasing && !previous.crawlers.find(old => old.id === enemy.id)?.chasing)
      || state.ambushers.some(enemy => ['warning', 'jumpscare'].includes(enemy.state)
        && !['warning', 'jumpscare'].includes(previous.ambushers.find(old => old.id === enemy.id)?.state ?? 'hidden'))
      || events.some(event => event.type === 'mimic_revealed')
      || previous.damageEventId !== state.damageEventId
      || previous.boxScare.lastTriggerTick !== state.boxScare.lastTriggerTick;
    const threatActive = this.realEnemyThreatActive(state);
    this.hauntingDirector.prepareFloor(state.floor);
    if (encounterStarted) {
      this.clearHauntingPresentation();
      this.hauntingDirector.registerMajorEncounter(state.tick);
    }
    const stage = this.horrorPacing.observe({
      floor: state.floor,
      tileX: Math.floor(state.x / FIXED_SCALE / this.tileSize),
      tileY: Math.floor(state.y / FIXED_SCALE / this.tileSize),
      deltaMs: presentationDeltaMs,
      moving: playerMovedBetween(previous, state),
      realThreatActive: threatActive,
      encounterStarted,
    });
    if (state.status === 'playing' && state.tick !== previous.tick) {
      const event = this.canStartHaunting(state) ? this.hauntingDirector.evaluate({
        floor: state.floor, tick: state.tick,
        tileX: Math.floor(state.x / FIXED_SCALE / this.tileSize),
        tileY: Math.floor(state.y / FIXED_SCALE / this.tileSize),
      }, stage) : null;
      if (event) this.presentHauntingEvent(event);
    }
    const objectiveProgress = this.floorData.objectives.searchableIndices.filter(index => state.searched[index]).length;
    this.block13ObjectiveStatus = state.puzzle.fallbackActive && !state.puzzle.fallbackItemFound
      ? `OBJECTIVE: FIND THE ${this.puzzleFallbackItemLabel(state.floor)}`
      : objectiveCopy(state.floor, state.hasKey, state.stalker.state === 'hunting', state.objectiveComplete, objectiveProgress, this.floorData.objectives.searchableIndices.length);
    if (this.registry.get('stalkerHintShown') !== true && state.stalker.visible) {
      this.registry.set('stalkerHintShown', true);
      this.showTemporaryMessage('FLASHLIGHT CAN REPEL IT', '#ffd700', 2200);
    }
    if (previous.stalker.state === 'hunting' && state.stalker.state === 'retreating' && state.flashlightOn) {
      this.showTemporaryMessage('STALKER REPELLED', '#70d4c6');
    }
    if (!watcherGazeBefore && watcherGazeNow) {
      const gazePosition = watcherGazeAudioPosition(previous, state);
      if (gazePosition) this.playAudioCue({ key: 'sfx_watcher_gaze', cooldownMs: 2500, positional: gazePosition, volume: 0.22 });
      this.showTemporaryMessage('WATCHER GAZE — TURN AWAY', '#d4c6f0', 1800);
    } else if (watcherGazeBefore && !watcherGazeNow && state.watchers.some(watcher => watcher.active)) {
      this.showTemporaryMessage('GAZE BROKEN', '#70d4c6', 1100);
    }
    if (watcherGazeNow && this.registry.get('watcherHintShown') !== true) {
      this.registry.set('watcherHintShown', true);
      this.showTemporaryMessage('WATCHER IN SIGHT\nLOOK AWAY TO STOP CURSE • HOLD LIGHT ON IT TO DRIVE IT OFF', '#d4c6f0', 3000);
    }
    this.updatePlayerPresentationFacing(previous, state);
    this.hasKey = state.hasKey;
    this.stairsUnlocked = state.objectiveComplete;
    const block13 = isBlock13Floor(state.floor);
    this.updateObjectiveVisibility(state);
    this.stairsSprite.setTexture(this.stairsUnlocked ? 'stairs_unlocked' : 'stairs_locked');
    this.searchableSprites.forEach((entry, index) => {
      const wasSearched = entry.searched;
      entry.searched = state.searched[index] ?? true;
      if (!wasSearched && entry.searched && !entry.data.isMimic) this.showContainerSearchPulse(entry);
      const mimic = state.mimics.find(m => m.searchableIndex === index);
      if (mimic?.revealed) {
        const wasRevealed = previous.mimics.find(old => old.searchableIndex === mimic.searchableIndex)?.revealed ?? false;
        if (!wasRevealed) this.mimicRevealElapsedMs.set(entry.sprite, 0);
        this.mimicTwitchStates.delete(entry.sprite);
        const exposure = enemyPresentationExposure(this.floorData, state, mimic.x, mimic.y);
        entry.sprite.setVisible(mimic.active && exposure > 0);
        entry.sprite.setTexture(mimicTextureKey(true, key => this.textures.exists(key), 'mimic_revealed'));
        entry.sprite.setPosition(mimic.x / FIXED_SCALE, mimic.y / FIXED_SCALE);
        entry.sprite.setTint(exposure >= 0.7 ? 0xffe4dc : 0xc5a8ae).setAlpha(exposure);
        const revealElapsed = this.mimicRevealElapsedMs.get(entry.sprite);
        entry.sprite.setScale(revealElapsed === undefined ? 1.2 : mimicRevealPulseScale(revealElapsed));
        if (revealElapsed !== undefined) {
          const nextElapsed = revealElapsed + Math.max(0, presentationDeltaMs);
          if (nextElapsed >= MIMIC_REVEAL_PULSE_DURATION_MS) this.mimicRevealElapsedMs.delete(entry.sprite);
          else this.mimicRevealElapsedMs.set(entry.sprite, nextElapsed);
        }
      } else {
        this.mimicRevealElapsedMs.delete(entry.sprite);
        const textureName = entry.data.isMimic
          ? mimicTextureKey(false, key => this.textures.exists(key), `mimic_${entry.data.x}_${entry.data.y}`)
          : this.searchableTextureName(entry.data, entry.searched);
        if (!this.textures.exists(textureName)) this.createOpenContainerFallbackTexture(entry.data);
        if (entry.sprite.texture.key !== textureName) {
          entry.sprite.setTexture(textureName);
          if (textureName.startsWith('env_')) this.markTextureNearest(textureName);
        }
        entry.sprite.setTint(0xffffff).setScale(1);
        entry.sprite.setVisible(entry.data.isMimic ? !entry.searched : true);
      }
    });
    // Disguised mimics keep their old twitching presentation; it only moves
    // sprites and never feeds position back into authoritative state.
    this.updateMimicTwitches(state.tick);

    const stalker = state.stalker;
    const previousStalkerFacing = this.stalkerVisualFacing;
    this.stalkerVisualFacing = inferStalkerVisualFacing(previous.stalker, stalker, previousStalkerFacing);
    const stalkerMoving = stalkerMovedBetween(previous.stalker, stalker);
    if (stalkerMoving !== this.stalkerIsMoving || (stalkerMoving && this.stalkerVisualFacing !== previousStalkerFacing)) {
      this.stalkerWalkAnimationElapsedMs = 0;
    }
    this.stalkerIsMoving = stalkerMoving;
    const stalkerTexture = stalkerTextureKeyForPresentation(
      this.stalkerVisualFacing,
      stalkerMoving,
      this.stalkerWalkAnimationElapsedMs,
      key => this.textures.exists(key),
    );
    if (this.stalkerSprite?.texture.key !== stalkerTexture) {
      this.stalkerSprite?.setTexture(stalkerTexture);
      if (stalkerTexture !== 'stalker') this.markTextureNearest(stalkerTexture);
    }
    this.stalkerSprite?.setPosition(stalker.x / FIXED_SCALE, stalker.y / FIXED_SCALE);
    const stalkerExposure = enemyPresentationExposure(this.floorData, state, stalker.x, stalker.y);
    this.stalkerSprite?.setAlpha(stalker.visible
      ? Math.max(stalkerExposure * (stalker.state === 'hunting' ? 0.98 : 0.76), stalker.state === 'hunting' ? 0.54 : 0.27)
      : 0);
    const finalChase = isBlock13Floor(state.floor) && state.hasKey && stalker.state === 'hunting';
    const reduceJumpscareIntensity = this.audioDirector?.getSettings().reduceJumpscareIntensity ?? false;
    if (finalChase !== this.finalChaseAudioActive) this.setFinalChaseAmbience(finalChase, reduceJumpscareIntensity);
    this.stalkerSprite?.setScale(stalker.visible && stalker.state === 'hunting'
      ? stalkerHuntScale(reduceJumpscareIntensity, finalChase) : 1);
    const stalkerDistance = Math.hypot(stalker.x - state.x, stalker.y - state.y) / FIXED_SCALE;
    const proximity = stalkerNearMissState(stalkerDistance, stalker.state === 'hunting', this.stalkerNearMissActive);
    this.stalkerNearMissActive = proximity.active;
    this.stalkerSprite?.setTint(proximity.active ? 0xffc9c1
      : stalker.state === 'hunting' && stalkerExposure >= 0.7 ? 0xffb7b0
        : stalkerExposure >= 0.7 ? 0xe0d1d8 : 0xffffff);
    if (proximity.entered && !this.ambusherJumpscareVeil?.active && stalkerNearMissCueAvailable(this.time.now, this.stalkerNearMissNextCueAt)) {
      this.cameras.main.shake(130, accessiblePresentationIntensity(0.0024, reduceJumpscareIntensity));
      this.cameras.main.flash(reduceJumpscareIntensity ? 28 : 52, 210, 176, 184);
      this.playAudioCue({ key: 'sfx_stalker_hunt', cooldownMs: 8000, positional: { x: stalker.x, y: stalker.y }, volume: reduceJumpscareIntensity ? 0.24 : 0.28 });
      this.stalkerNearMissNextCueAt = this.time.now;
    }
    state.crawlers.forEach((enemy, index) => {
      const sprite = this.crawlerSprites[index];
      const previousCrawler = previous.crawlers.find(old => old.id === enemy.id) ?? enemy;
      const moving = crawlerMovedBetween(previousCrawler, enemy);
      const presentation = this.crawlerPresentation.get(enemy.id) ?? { moving: false, elapsedMs: 0 };
      if (moving !== presentation.moving) presentation.elapsedMs = 0;
      presentation.moving = moving;
      this.crawlerPresentation.set(enemy.id, presentation);
      const textureKey = crawlerTextureKeyForPresentation(
        moving, presentation.elapsedMs, key => this.textures.exists(key), `crawler_${enemy.id}`,
        crawlerPresentationPhaseOffsetMs(enemy.id),
      );
      if (sprite && sprite.texture.key !== textureKey) {
        sprite.setTexture(textureKey);
        if (textureKey !== `crawler_${enemy.id}`) this.markTextureNearest(textureKey);
      }
      const exposure = enemyPresentationExposure(this.floorData, state, enemy.x, enemy.y);
      sprite?.setPosition(enemy.x / FIXED_SCALE, enemy.y / FIXED_SCALE);
      sprite?.setAlpha(exposure * (enemy.chasing ? 1 : 0.76));
      sprite?.setTint(exposure >= 0.7 ? 0xe3d5bd : 0xffffff);
      sprite?.setScale(enemy.chasing ? 1 + Math.sin(state.tick * 0.16 + enemy.id) * 0.045 : 1);
      const crawlerDistance = Math.hypot(enemy.x - state.x, enemy.y - state.y) / FIXED_SCALE;
      const nextWarningAt = this.crawlerWarningNextCueAt.get(enemy.id) ?? Number.NEGATIVE_INFINITY;
      if (!enemy.chasing && exposure > 0.18 && crawlerDistance <= 180 && this.time.now >= nextWarningAt) {
        this.playAudioCue({ key: 'sfx_crawler_skitter', cooldownMs: 900, positional: { x: enemy.x, y: enemy.y }, volume: 0.34 });
        this.crawlerWarningNextCueAt.set(enemy.id, this.time.now + 1800);
      }
      if (sprite) sprite.setFlipX(enemy.targetX < enemy.x);
    });
    state.watchers.forEach((enemy, index) => {
      const sprite = this.watcherSprites[index];
      const textureKey = watcherTextureKey(key => this.textures.exists(key), `watcher_${enemy.id}`);
      if (sprite && sprite.texture.key !== textureKey) {
        sprite.setTexture(textureKey);
        if (textureKey !== `watcher_${enemy.id}`) this.markTextureNearest(textureKey);
      }
      const exposure = enemyPresentationExposure(this.floorData, state, enemy.x, enemy.y);
      sprite?.setPosition(enemy.x / FIXED_SCALE, enemy.y / FIXED_SCALE);
      sprite?.setAlpha(enemy.active ? Math.max(exposure, 0.34) * (0.82 + Math.sin(state.tick * 0.045 + enemy.id) * 0.06) : 0);
      sprite?.setTint(exposure >= 0.7 ? 0xd9d4ef : 0xffffff);
      const gazeAlpha = watcherGazeEyeAlpha(
        enemy.active,
        watcherIndividuallyCausingCurse(state, enemy),
        exposure,
      );
      this.watcherEyeGlints[index]?.setPosition(enemy.x / FIXED_SCALE, enemy.y / FIXED_SCALE)
        .setVisible(gazeAlpha > 0).setAlpha(gazeAlpha);
    });
    const ambusherImpact = state.status === 'playing' ? ambusherImpactStarted(previous.ambushers, state.ambushers) : undefined;
    if (ambusherImpact) this.startAmbusherJumpscare(ambusherImpact.id, state.tick);
    else {
      const searchedIndices = events.filter(event => event.type === 'loot_searched').map(event => event.index);
      const searchableIndex = containerScareSearchIndex(previous.boxScare, state.boxScare, searchedIndices);
      const canPresent = state.status === 'playing' && !this.isPaused && !this.isTransitioning
        && !this.storyPopupOpen && !this.openingStoryOpen && !this.endingEpilogueOpen && !this.ambusherJumpscareVeil;
      if (containerScareShouldPlay(searchableIndex !== null, Boolean(this.ambusherJumpscareVeil?.active), canPresent) && searchableIndex !== null) {
        const searchable = this.searchableSprites[searchableIndex]?.data;
        if (searchable) this.startContainerScare(searchableIndex);
      }
    }
    state.ambushers.forEach((enemy, index) => {
      const sprite = this.ambusherSprites[index];
      const textureKey = ambusherTextureKey(key => this.textures.exists(key), `ambusher_${enemy.id}`);
      if (sprite && sprite.texture.key !== textureKey) {
        sprite.setTexture(textureKey);
        if (textureKey !== `ambusher_${enemy.id}`) this.markTextureNearest(textureKey);
      }
      const exposure = enemyPresentationExposure(this.floorData, state, enemy.x, enemy.y);
      sprite?.setPosition(enemy.x / FIXED_SCALE, enemy.y / FIXED_SCALE);
      const activePresentation = enemy.state === 'warning' || enemy.state === 'jumpscare';
      sprite?.setVisible(activePresentation && exposure > 0);
      sprite?.setAlpha(enemy.state === 'warning' ? ambusherWarningAlpha(exposure, state.tick, enemy.id) : enemy.state === 'jumpscare' ? exposure : 0);
      sprite?.setTint(enemy.state === 'warning' ? 0xffdca0 : 0xffaaa0);
    });
    this.updatePuzzlePanel(state);
    this.updateInteractionFeedback(state);
    this.updateCorruptionAtmosphere(state);
    this.updateAuthoritativePrompt(state);
    if (state.hp !== previous.hp) this.updateHealthBar();
    if ((state.x !== previous.x || state.y !== previous.y) && shouldPlayFootstep(this.lastFootstepTick, state.tick)) {
      this.audioDirector?.playVariantWithCooldown(
        AUDIO_KEYS.player.footstep,
        AUDIO_KEYS.player.footstepVariants,
        'sfx',
        PLAYER_FOOTSTEP_COOLDOWN_MS,
        undefined,
        PLAYER_FOOTSTEP_VARIANT_GAINS,
      );
      this.lastFootstepTick = state.tick;
    }
    for (const audioCue of audioCuesForStateChange(previous, state, events)) this.playAudioCue(audioCue);
    if (state.damageEventId !== previous.damageEventId) {
      this.cameras.main.shake(150, 0.0035);
      this.flashDamageVignette();
    }
    if (state.scareEventId !== previous.scareEventId && !ambusherImpact) {
      const kick = genericScareCameraKick(this.audioDirector?.getSettings().reduceJumpscareIntensity ?? false);
      this.cameras.main.shake(kick.durationMs, kick.intensity);
    }
    if (finalChase && previous.stalker.state !== 'hunting') {
      this.cameras.main.shake(reduceJumpscareIntensity ? 160 : 260, reduceJumpscareIntensity ? 0.0025 : 0.0045);
    }
    if (state.corruption.effectId !== previous.corruption.effectId) {
      const names: CorruptionEffect['type'][] = ['horizontal_shift', 'scanline', 'chromatic', 'hud_flicker', 'static_noise', 'camera_shake', 'visual_glitch'];
      this.executeCorruptionEffect({
        type: names[state.corruption.effectType] ?? 'visual_glitch',
        intensity: accessiblePresentationIntensity(
          state.corruption.intensityPermille / 1000,
          this.audioDirector?.getSettings().reduceJumpscareIntensity ?? false,
        ),
        duration: SimulationEngine.ticksToMs(state.corruption.durationTicks),
      });
    }
  }

  private updateAuthoritativePrompt(state: AuthoritativeState) {
    const prompt = interactionPrompt(state, this.floorData);
    this.interactPrompt.setText(prompt);
    this.interactPrompt.setVisible(prompt.length > 0);
  }

  private updatePuzzlePanel(state: AuthoritativeState) {
    const puzzle = this.floorData.puzzle;
    const run = state.puzzle;
    const visible = run.active;
    this.puzzleFallbackMarker?.setVisible(run.fallbackActive && !run.fallbackItemFound);
    this.puzzleFallbackLabel?.setVisible(run.fallbackActive && !run.fallbackItemFound);
    this.puzzlePanel?.setVisible(visible);
    this.puzzlePanelText?.setVisible(visible);
    this.puzzlePanelArt?.setVisible(visible);
    const panelAccents: Record<Floor['puzzle']['kind'], number> = {
      combination: 0xd6a362, resident: 0xb6a9a0, circuit: 0x88b5a1, records: 0xb69ab8, memory: 0xa893c7,
    };
    this.puzzlePanel?.setStrokeStyle(2, panelAccents[puzzle.kind], 1);
    if (!visible || !this.puzzlePanelText) return;
    const discoveredSteps = discoveredObjectiveSteps(this.floorData, state.searched);
    const evidence = discoveredSteps.size;
    const lines = [`${puzzle.title}`, `OBJECTIVE  ·  ${this.puzzleObjectiveCopy(puzzle.kind)}`,
      `EVIDENCE RECOVERED  ${evidence}/${this.floorData.objectives.searchableIndices.length}`, ''];
    if (puzzle.kind === 'combination') {
      const currentCode = run.enteredCode.map(digit => digit === 0 ? '_' : String(digit)).join(' ');
      lines.push('READ ALL THREE NOTES. CALCULATE EACH EXPRESSION.', 'KEEP ONLY THE FINAL / ONES DIGIT FROM EACH.', 'ENTER POSITION 1 → POSITION 2 → POSITION 3.', `CURRENT CODE  [ ${currentCode} ]`, `SELECTED  ·  POSITION ${run.selectedIndex + 1}`, '',
        ...puzzle.combinationExpressions!.map((expression, index) => `${index === run.selectedIndex ? '▶ ' : '  '}POSITION ${index + 1}  ${expression.left} ${expression.operator} ${expression.right}  → FINAL DIGIT [ ${run.enteredCode[index]} ]`),
        '', '← / → POSITION   ↑ / ↓ CHANGE DIGIT   E SUBMIT CODE');
    } else if (puzzle.kind === 'resident') {
      lines.push('FIND THE ONE RESIDENT MATCHING BOTH RULES.', 'SAME BICYCLE • OPPOSITE NIGHT SHIFT.', `SELECTED  ·  RESIDENT ${run.selectedIndex + 1}`, `EVIDENCE NOTES  ·  ${evidence}/2 RECOVERED`, '', ...puzzle.residents!.map((resident, index) => `${index === run.selectedIndex ? '▶ ' : '  '}${resident.name} — APT ${resident.apartment} — BIKE ${resident.hasBicycle ? 'YES' : 'NO'} — NIGHTS ${resident.worksNights ? 'YES' : 'NO'}`), '↑ / ↓ SELECT RESIDENT   E CHECK BOTH RULES');
    } else if (puzzle.kind === 'circuit') {
      const expectedNext = puzzle.circuitOrder![run.circuitSequence.length];
      lines.push('TURN ON EXACTLY TWO FEEDS IN THE RECOVERED ORDER.', 'SELECT A FEED, TOGGLE IT ON, THEN TEST THE ROUTE.', `SEQUENCE  ·  ${run.circuitSequence.map(index => puzzle.circuitLabels![index]).join(' → ') || '—'}`, `CHECKPOINT  ·  ${expectedNext === undefined ? 'ROUTE COMPLETE' : `${run.circuitSequence.length}/2 FEEDS RECORDED`}`, `SELECTED  ·  FEED ${run.selectedIndex + 1}`, '', ...puzzle.circuitLabels!.map((label, index) => `${index === run.selectedIndex ? '▶ ' : '  '}FEED ${index + 1}  ─ ${run.switchMask & (1 << index) ? '[ON ]' : '[OFF]'} ${label}  ─▶ RELAY`), '← / → SELECT FEED   ↑ TOGGLE   E TEST ROUTE');
      if (discoveredSteps.has(0) && this.notebookHintStage === 1) lines.push('', 'HINT 1 / 2  ·  THE DIAGRAM IDENTIFIES TWO FEEDS. MATCH THOSE LABELS; LEAVE THE OTHER TWO OFF.');
      else if (discoveredSteps.has(0) && this.notebookHintStage === 2) lines.push('', 'RECOVERED DIAGRAM:', puzzle.clueTexts[0]);
      else if (discoveredSteps.has(0)) lines.push('', 'H  OPTIONAL HINT 1 / 2  ·  READ THE MAINTENANCE DIAGRAM');
      else lines.push('', 'SEARCH FOR THE AMBER PUZZLE EVIDENCE MARKER.');
    } else if (puzzle.kind === 'records') {
      lines.push('PLACE ALL THREE EVENTS IN TIME ORDER.', `CHAIN  ·  ${run.recordOrder.length}/3 EVENTS PLACED`, 'Use the recovered rules: FIRST → SECOND → THIRD.', `SELECTED  ·  EVENT ${run.selectedIndex + 1}`, '');
      if (recordsMayBeCompared(puzzle, discoveredSteps)) {
        lines.push(`ORDER  ·  ${run.recordOrder.map(index => puzzle.recordEvents![index]).join('  →  ') || '—'}`,
          ...puzzle.recordEvents!.map((event, index) => `${index === run.selectedIndex ? '▶ ' : '  '}${run.recordOrder.includes(index) ? '✓ ' : '  '}${event}`), '↑ / ↓ SELECT EVENT   E PLACE NEXT EVENT');
      } else lines.push('RECOVER ALL THREE DOCUMENTS TO OPEN THE INDEX.');
    } else {
      lines.push('MATCH EACH RECOVERED MEMORY TO THE PLACE IT NAMES.', `LINKS CONFIRMED  ·  ${run.memoryConfirmedMask.toString(2).replace(/0/g, '').length}/3`, 'SELECT A FRAGMENT, CHOOSE ITS PLACE, THEN CONFIRM.', `SELECTED  ·  FRAGMENT ${run.selectedIndex + 1}`, '');
      puzzle.memoryFragments!.forEach((fragment, index) => {
        const display = memoryFragmentDisplay(fragment, puzzle.memoryChoices![run.memoryAnswers[index]], index, discoveredSteps);
        lines.push(discoveredSteps.has(index)
          ? `${run.memoryConfirmedMask & (1 << index) ? '✓ ' : index === run.selectedIndex ? '▶ ' : '  '}${display}`
          : `  ${display}`);
      });
      lines.push('← / → SELECT FRAGMENT   ↑ / ↓ CHANGE PLACE   E CONFIRM MATCH');
    }
    if (run.fallbackActive) lines.push('', `LOCKED  ·  FIND THE ${this.puzzleFallbackItemLabel(state.floor)} TO CONTINUE.`);
    else lines.push('', `ATTEMPTS REMAINING  ·  ${run.attemptsRemaining}`);
    if (evidence < this.floorData.objectives.searchableIndices.length) lines.push('', `SUBMIT LOCKED  ·  FIND ALL ${this.floorData.objectives.searchableIndices.length} EVIDENCE NOTES FIRST.`);
    lines.push('', 'TAB NOTEBOOK     E SUBMIT / CONFIRM     F OR ESC CLOSE');
    this.puzzlePanelText.setText(lines.join('\n'));
  }

  private puzzleObjectiveCopy(kind: Floor['puzzle']['kind']): string {
    switch (kind) {
      case 'combination': return 'OPEN THE LOCK WITH THREE FOUND DIGITS';
      case 'resident': return 'CROSS-REFERENCE THE RESIDENT RECORDS';
      case 'circuit': return 'RESTORE POWER TO THE ARCHIVE RELAY';
      case 'records': return 'RECONSTRUCT THE TRUE EVENT ORDER';
      case 'memory': return 'RECONNECT THE MEMORIES YOU HAVE FOUND';
    }
  }

  private puzzleFallbackItemLabel(floor: number): string {
    switch (floor) {
      case 4: return 'MAINTENANCE TOOL';
      case 3: return 'ARCHIVAL CLUE';
      case 2: return 'RELAY OVERRIDE';
      case 1: return 'UNALTERED INDEX';
      default: return 'MEMORY FRAGMENT';
    }
  }

  /** Crisp, locally drawn puzzle emblems; no external raster UI assets. */
  private createPuzzlePanelArt(panelW: number, panelH: number): Phaser.GameObjects.Graphics {
    const art = this.add.graphics().setScrollFactor(0).setDepth(602).setVisible(false);
    const cx = this.scale.width / 2, cy = this.scale.height / 2;
    const x = cx - panelW / 2 + 18, y = cy - 12;
    const palette: Record<Floor['puzzle']['kind'], number> = {
      combination: 0xd6a362, resident: 0xb6a9a0, circuit: 0x88b5a1, records: 0xb69ab8, memory: 0xa893c7,
    };
    const color = palette[this.floorData.puzzle.kind];
    art.lineStyle(1, color, 0.9).fillStyle(color, 0.12);
    switch (this.floorData.puzzle.kind) {
      case 'combination':
        for (let i = 0; i < 3; i++) {
          art.fillRect(x + i * 11, y - 11, 9, 22).strokeRect(x + i * 11, y - 11, 9, 22);
          art.fillRect(x + 3 + i * 11, y - 2, 3, 3);
        }
        break;
      case 'resident':
        art.strokeRect(x - 1, y - 13, 27, 26).fillRect(x + 2, y - 9, 5, 5);
        art.lineBetween(x + 11, y - 8, x + 22, y - 8).lineBetween(x + 2, y + 1, x + 23, y + 1)
          .lineBetween(x + 2, y + 6, x + 19, y + 6);
        break;
      case 'circuit':
        art.lineBetween(x, y - 11, x + 17, y - 11).lineBetween(x, y - 4, x + 17, y - 4)
          .lineBetween(x, y + 4, x + 17, y + 4).lineBetween(x, y + 11, x + 17, y + 11)
          .lineBetween(x + 17, y - 11, x + 17, y + 11).lineBetween(x + 17, y, x + 26, y);
        for (let i = 0; i < 4; i++) art.fillRect(x + 3, y - 13 + i * 7, 4, 4);
        art.fillRect(x + 24, y - 2, 4, 4);
        break;
      case 'records':
        art.strokeRect(x, y - 12, 22, 8).strokeRect(x + 3, y - 2, 22, 8).strokeRect(x + 6, y + 8, 22, 8);
        break;
      case 'memory':
        art.lineBetween(x + 3, y - 9, x + 22, y).lineBetween(x + 3, y + 9, x + 22, y)
          .lineBetween(x + 22, y, x + 11, y);
        art.fillCircle(x + 3, y - 9, 3).fillCircle(x + 3, y + 9, 3).fillCircle(x + 22, y, 3).fillCircle(x + 11, y, 3);
        break;
    }
    void panelH;
    return art;
  }

  private createPuzzleMarkers() {
    const [deviceX, deviceY] = this.floorData.puzzleDevice;
    if (!(this.floorData.puzzle.floor === 4)) {
      const marker = this.add.graphics().setDepth(4);
      const x = deviceX * this.tileSize + 16, y = deviceY * this.tileSize + 16;
      marker.fillStyle(0x17151e, 0.96).fillRect(x - 10, y - 9, 20, 18);
      marker.lineStyle(1, 0x9b8aa6, 0.9).strokeRect(x - 10, y - 9, 20, 18);
      marker.lineStyle(1, 0xe0a86f, 0.85).lineBetween(x - 6, y - 3, x + 6, y - 3).lineBetween(x - 6, y + 1, x + 6, y + 1).lineBetween(x - 6, y + 5, x + 3, y + 5);
      this.puzzleDeviceMarker = marker;
    }
    if (this.floorData.puzzleFallbackSite) {
      const [x, y] = this.floorData.puzzleFallbackSite;
      const marker = this.add.graphics().setDepth(4).setVisible(false);
      const px = x * this.tileSize + 16, py = y * this.tileSize + 16;
      marker.fillStyle(0x231b13, 0.96).fillRect(px - 9, py - 9, 18, 18);
      marker.lineStyle(1, 0xffbf72, 1).strokeRect(px - 9, py - 9, 18, 18);
      marker.lineStyle(2, 0xffbf72, 0.95).lineBetween(px - 5, py + 4, px + 5, py - 4).lineBetween(px - 1, py + 1, px + 3, py + 5);
      this.puzzleFallbackMarker = marker;
      const label = this.add.text(px, py - 24,
        this.puzzleFallbackItemLabel(this.authoritativeSimulation.state.floor),
        {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#ffcf86',
          backgroundColor: '#171017',
          padding: { x: 4, y: 2 },
          stroke: '#050308',
          strokeThickness: 2,
        },
      ).setOrigin(0.5).setDepth(5).setVisible(false);
      this.puzzleFallbackLabel = label;
    }
  }

  /** Brief world-space confirmation on a completed search; it reads sim state only. */
  private showContainerSearchPulse(entry: SearchableSprite) {
    const accent = entry.data.objectType === 'maintenance_lockbox'
      ? 0xd0a465 : floorVisualProfile(this.authoritativeSimulation.state.floor).accent;
    const pulse = this.add.circle(entry.sprite.x, entry.sprite.y, 12)
      .setFillStyle(accent, 0)
      .setStrokeStyle(2, accent, 0.82)
      .setDepth(13);
    this.tweens.add({
      targets: pulse,
      scale: 1.9,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => pulse.destroy(),
    });
  }

  private updateObjectiveVisibility(state: AuthoritativeState) {
    const block13 = isBlock13Floor(state.floor);
    const playerX = state.x / FIXED_SCALE, playerY = state.y / FIXED_SCALE;
    const keyX = this.floorData.key[0] * 32 + 16, keyY = this.floorData.key[1] * 32 + 16;
    const exitX = this.floorData.exit[0] * 32 + 16, exitY = this.floorData.exit[1] * 32 + 16;
    const keyInSight = !block13 || hasPresentationLineOfSight(this.floorData, playerX, playerY, keyX, keyY);
    const exitInSight = !block13 || hasPresentationLineOfSight(this.floorData, playerX, playerY, exitX, exitY);
    this.keySprite?.setVisible(block13 && !state.hasKey && keyInSight);
    this.keyLabel?.setVisible(block13 && !state.hasKey && keyInSight);
    this.stairsSprite.setVisible(exitInSight);
    this.stairsLabel.setVisible(exitInSight);
  }

  private updateInteractionFeedback(state: AuthoritativeState) {
    const px = state.x / FIXED_SCALE;
    const py = state.y / FIXED_SCALE;
    const block13 = isBlock13Floor(state.floor);
    const tickPulse = 0.78 + (Math.sin(state.tick * (block13 ? 0.065 : 0.09)) + 1) * (block13 ? 0.14 : 0.11);
    const updateHalo = (halo: Phaser.GameObjects.Arc, x: number, y: number, eligible: boolean) => {
      const dx = px - x, dy = py - y;
      const nearby = dx * dx + dy * dy <= 104 * 104;
      const visible = eligible && nearby && this.hasPresentationLineOfSight(px, py, x, y);
      halo.setVisible(visible);
      halo.setAlpha(tickPulse);
    };

    const keyX = this.floorData.key[0] * this.tileSize + this.tileSize / 2;
    const keyY = this.floorData.key[1] * this.tileSize + this.tileSize / 2;
    if (this.keyHalo) updateHalo(this.keyHalo, keyX, keyY, block13 && !state.hasKey);
    const exitX = this.floorData.exit[0] * this.tileSize + this.tileSize / 2;
    const exitY = this.floorData.exit[1] * this.tileSize + this.tileSize / 2;
    updateHalo(this.stairsHalo, exitX, exitY, true);
    if (block13) {
      const finalChase = state.hasKey && state.stalker.state === 'hunting';
      const reduced = this.audioDirector?.getSettings().reduceJumpscareIntensity ?? false;
      const chasePulse = finalChase ? (Math.sin(state.tick * 0.045) + 1) * 0.5 : 0;
      const pulseScale = reduced ? 0.035 : 0.06;
      this.stairsHalo.setScale(finalChase ? 1 + pulseScale * chasePulse : 1);
      this.stairsHalo.setFillStyle(finalChase ? 0xa75775 : state.hasKey ? 0xc07883 : 0x8c6e81,
        finalChase ? 0.08 + chasePulse * 0.035 : state.hasKey ? 0.1 : 0.035);
      this.stairsHalo.setStrokeStyle(state.hasKey ? 2 : 1,
        finalChase ? 0xf09aaf : state.hasKey ? 0xf0a0a9 : 0x9b8298,
        finalChase ? 0.68 + chasePulse * 0.12 : state.hasKey ? 0.72 : 0.36);
    }
    this.searchableSprites.forEach((entry, index) => {
      const x = entry.data.x * this.tileSize + this.tileSize / 2;
      const y = entry.data.y * this.tileSize + this.tileSize / 2;
      const unsearched = !state.searched[index] && entry.sprite.visible;
      updateHalo(entry.halo, x, y, unsearched);
      if (entry.evidenceLabel) {
        const dx = px - x, dy = py - y;
        const nearby = dx * dx + dy * dy <= 192 * 192;
        entry.evidenceLabel.setVisible(unsearched && nearby && this.hasPresentationLineOfSight(px, py, x, y));
        entry.evidenceLabel.setAlpha(tickPulse);
      }
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
    return this.add.circle(x, y, radius, color, 0.075)
      .setStrokeStyle(2, color, 0.68)
      .setDepth(3)
      .setVisible(false);
  }

  /**
   * Capture current input state
   */
  private readKeyboardInput(): InputState {
    const justPressedF = Phaser.Input.Keyboard.JustDown(this.flashlightKey);
    const justPressedE = Phaser.Input.Keyboard.JustDown(this.interactKey);
    const closePuzzle = this.puzzleCloseRequested;
    this.puzzleCloseRequested = false;

    return {
      left: this.cursors.left.isDown || this.wasd.a.isDown,
      right: this.cursors.right.isDown || this.wasd.d.isDown,
      up: this.cursors.up.isDown || this.wasd.w.isDown,
      down: this.cursors.down.isDown || this.wasd.s.isDown,
      flashlight: justPressedF || closePuzzle,
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
    const ambientVisibility = floorAmbientVisibility(state.floor);
    const beamContrast = floorFlashlightContrast(state.floor);

    this.lightmapGraphics.clear();
    this.lightmapGraphics.fillStyle(profile.darkness, 1);
    this.lightmapGraphics.fillRect(0, 0, worldWidth, worldHeight);

    const originX = this.player.x;
    const originY = this.player.y;
    const ambientRays = collectOccludedLightRays(
      this.floorData, originX, originY, 88, -Math.PI, Math.PI, 4,
      [], this.ambientRayAngles, this.ambientLightRays,
    );
    // Concentric clipped polygons preserve soft falloff while respecting walls.
    this.drawOccludedLightShape(ambientRays, originX, originY, 88, scaleColor(profile.ambient, 0.34 * ambientVisibility));
    this.drawOccludedLightShape(ambientRays, originX, originY, 76, scaleColor(profile.ambient, 0.48 * ambientVisibility));
    this.drawOccludedLightShape(ambientRays, originX, originY, 62, scaleColor(profile.ambient, 0.62 * ambientVisibility));
    this.drawOccludedLightShape(ambientRays, originX, originY, 48, scaleColor(profile.ambient, 0.82 * ambientVisibility));
    this.drawOccludedLightShape(ambientRays, originX, originY, 34, scaleColor(profile.ambient, 1.08 * ambientVisibility));

    // Wall lamps are presentation-only. Their positions come from stable tile
    // coordinates and their flicker is derived from the existing presentation
    // tick; no gameplay RNG or authoritative state is consumed or changed.
    for (let lampIndex = 0; lampIndex < this.flickeringLampPositions.length; lampIndex++) {
      const lamp = this.flickeringLampPositions[lampIndex];
      const phase = lamp.phase + state.tick * 0.17;
      const secondary = Math.sin(lamp.phase * 1.7 + state.tick * 0.43);
      // Stable hash samples create an irregular per-lamp sequence without
      // advancing an authoritative RNG stream or coupling lamps together.
      const flickerBucket = Math.floor(state.tick / 4);
      const noise = ordinaryEnvironmentCoordinateHash(lamp.seed, flickerBucket, Math.floor(state.tick / 19)) / 0xffff_ffff;
      const flutter = Math.sin(phase) * 0.12 + secondary * 0.06 + (noise - 0.5) * 0.24;
      const pulse = noise < 0.035 ? -0.28 : noise > 0.965 ? 0.16 : 0;
      const signalPulse = lamp.signal
        ? Math.max(0, 1 - Math.min(1, (state.tick % 360) / 42)) * 0.3
        : 0;
      const intensity = Math.max(0.34, Math.min(1.18, 0.78 + flutter + pulse + signalPulse));
      this.flickeringLampFixtures[lampIndex]?.setAlpha(0.56 + intensity * 0.4);
      const playerDistance = Math.hypot(lamp.x - originX, lamp.y - originY);
      // Rare, but reachable during a normal run: being near a lamp is enough;
      // the player's flashlight no longer suppresses this presentation scare.
      if (playerDistance <= 138 && state.tick - this.lastLampJumpscareTick >= 900
        && state.tick % 10 === 0 && noise < 0.002 && this.canStartHaunting(state)) {
        const eventId = Math.imul(lamp.seed ^ state.tick, 0x45d9f3b) >>> 0;
        const authoredScareShown = this.startLampJumpscare(eventId);
        if (!authoredScareShown) this.showHauntingVisual('silhouette', eventId, 560);
        if (this.lampJumpscareImage?.visible || this.hauntingVisual?.visible) {
          const reduced = this.audioDirector?.getSettings().reduceJumpscareIntensity ?? false;
          this.cameras.main.flash(reduced ? 22 : 38, 190, 166, 178);
          this.playAudioCue({ key: 'sfx_jumpscare_hit', cooldownMs: 1800, volume: reduced ? 0.08 : 0.12 });
          this.hauntingDirector.registerMajorEncounter(state.tick, 180);
          this.lastLampJumpscareTick = state.tick;
        }
      }
      const lampRays = collectOccludedLightRays(
        this.floorData, lamp.x, lamp.y, lamp.signal ? 82 : 58, -Math.PI, Math.PI,
        3, [], [], [],
      );
      this.drawOccludedLightShape(
        lampRays, lamp.x, lamp.y, lamp.signal ? 82 : 58,
        scaleColor(profile.ambient, 0.44 * intensity),
      );
      this.drawOccludedLightShape(
        lampRays, lamp.x, lamp.y, 34,
        scaleColor(profile.ambient, 0.66 * intensity),
      );
    }

    if (this.flashlightOn) {
      const factor = flashlightVisualFactor(state.tick, state.floor);
      for (let i = 0; i < FLASHLIGHT_HALF_ANGLES.length; i++) {
        this.flashlightBoundaryAngles[i * 2] = this.playerFacingAngle - FLASHLIGHT_HALF_ANGLES[i];
        this.flashlightBoundaryAngles[i * 2 + 1] = this.playerFacingAngle + FLASHLIGHT_HALF_ANGLES[i];
      }
      const flashlightRays = collectOccludedLightRays(
        this.floorData, originX, originY, 286,
        this.playerFacingAngle - FLASHLIGHT_HALF_ANGLES[0], this.playerFacingAngle + FLASHLIGHT_HALF_ANGLES[0],
        2, this.flashlightBoundaryAngles, this.flashlightRayAngles, this.flashlightLightRays,
      );
      this.drawOccludedLightShape(flashlightRays, originX, originY, 286, scaleColor(profile.flashlight, 0.3 * factor * beamContrast), FLASHLIGHT_HALF_ANGLES[0]);
      this.drawOccludedLightShape(flashlightRays, originX, originY, 270, scaleColor(profile.flashlight, 0.42 * factor * beamContrast), FLASHLIGHT_HALF_ANGLES[1]);
      this.drawOccludedLightShape(flashlightRays, originX, originY, 248, scaleColor(profile.flashlight, 0.62 * factor * beamContrast), FLASHLIGHT_HALF_ANGLES[2]);
      this.drawOccludedLightShape(flashlightRays, originX, originY, 226, scaleColor(profile.flashlight, 0.82 * factor * beamContrast), FLASHLIGHT_HALF_ANGLES[3]);
      this.drawOccludedLightShape(flashlightRays, originX, originY, 210, scaleColor(profile.flashlight, factor * beamContrast), FLASHLIGHT_HALF_ANGLES[4]);
    }

    // Draw the finished grayscale lightmap into the RenderTexture
    this.lightmapTexture.clear();
    this.lightmapTexture.draw(this.lightmapGraphics, 0, 0);
  }

  private drawOccludedLightShape(
    rays: OccludedRay[],
    originX: number,
    originY: number,
    radius: number,
    color: number,
    halfAngle?: number,
  ) {
    if (rays.length < 3) return;
    const centerAngle = this.playerFacingAngle;
    const lowerAngle = halfAngle === undefined ? -Infinity : centerAngle - halfAngle - 1e-8;
    const upperAngle = halfAngle === undefined ? Infinity : centerAngle + halfAngle + 1e-8;
    const graphics = this.lightmapGraphics;
    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(originX, originY);
    let points = 0;
    for (const ray of rays) {
      if (ray.angle < lowerAngle || ray.angle > upperAngle) continue;
      const distance = Math.min(radius, ray.distance);
      graphics.lineTo(originX + Math.cos(ray.angle) * distance, originY + Math.sin(ray.angle) * distance);
      points++;
    }
    if (points < 2) return;
    graphics.closePath();
    graphics.fillPath();
  }

  /** Creates a few deterministic wall fixtures without changing map geometry. */
  private createFlickeringLamps(tiles: boolean[][]) {
    this.flickeringLampPositions = [];
    this.flickeringLampFixtures.forEach(fixture => fixture.destroy());
    this.flickeringLampFixtures = [];
    const floor = this.authoritativeSimulation.state.floor;
    const importantTiles = new Set<string>([
      `${this.floorData.start[0]},${this.floorData.start[1]}`,
      `${this.floorData.key[0]},${this.floorData.key[1]}`,
      `${this.floorData.exit[0]},${this.floorData.exit[1]}`,
      ...this.floorData.searchables.map(item => `${item.x},${item.y}`),
    ]);
    const candidates: Array<{ x: number; y: number; score: number }> = [];
    if (floor >= 1 && floor <= 4) {
      const decorations = ordinaryMapDecorationPlacements(floor, tiles, this.floorData.doors, importantTiles);
      for (const placement of decorations) {
        if (placement.asset !== 'wall_lamp_01') continue;
        candidates.push({ x: placement.x, y: placement.y, score: ordinaryEnvironmentCoordinateHash(floor, placement.x, placement.y) });
      }
    } else {
      // Block 13 has no ordinary lamp asset, so choose a few clean wall cells
      // and draw a restrained fixture directly as presentation geometry.
      for (let y = 1; y < tiles.length - 1; y++) for (let x = 1; x < tiles[y].length - 1; x++) {
        if (tiles[y]?.[x] || importantTiles.has(`${x},${y}`)) continue;
        if (![tiles[y - 1]?.[x], tiles[y]?.[x + 1], tiles[y + 1]?.[x], tiles[y]?.[x - 1]].some(Boolean)) continue;
        const score = ordinaryEnvironmentCoordinateHash(floor, x, y);
        if (score % 173 > 8) continue;
        candidates.push({ x, y, score });
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    for (const [index, candidate] of candidates.slice(0, 5).entries()) {
      const worldX = candidate.x * this.tileSize + 16;
      const worldY = candidate.y * this.tileSize + 16;
      const phase = (candidate.score % 628) / 100;
      this.flickeringLampPositions.push({ x: worldX, y: worldY, phase, seed: candidate.score, signal: index === 0 });
      const fixture = this.add.graphics().setDepth(2);
      fixture.fillStyle(floor === 0 ? 0x8c6678 : 0xc4a46d, 0.9);
      fixture.fillRect(worldX - 3, worldY - 3, 6, 4);
      fixture.fillStyle(floor === 0 ? 0xd29aaf : 0xf2d798, 0.95);
      fixture.fillRect(worldX - 2, worldY - 2, 4, 2);
      this.flickeringLampFixtures.push(fixture);
    }
  }

  private createCircleTexture(size: number, fillStyle: any): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(size / 2, size / 2, size / 2);
    return graphics;
  }

  private markTextureNearest(textureKey: string) {
    this.textures.get(textureKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  private generatePixelTexture(textureKey: string, width: number, height: number, rects: readonly { x: number; y: number; width: number; height: number; color: keyof typeof PIXEL_PALETTE }[]) {
    if (!pixelRectsAreValid(rects, width, height)) throw new RangeError(`Invalid pixel sprite definition: ${textureKey}`);
    const graphics = this.add.graphics();
    for (const rect of rects) {
      graphics.fillStyle(PIXEL_PALETTE[rect.color], 1);
      graphics.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    graphics.generateTexture(textureKey, width, height);
    graphics.destroy();
    this.markTextureNearest(textureKey);
  }

  private showTemporaryMessage(text: string, color: string, duration: number = 1200) {
    if (this.temporaryMessageObject?.text === text || this.temporaryMessageQueue.some(message => message.text === text)) return;
    this.temporaryMessageQueue.push({ text, color, duration });
    if (this.temporaryMessageQueue.length > 4) this.temporaryMessageQueue.shift();
    if (this.temporaryMessageActive) return;
    this.presentNextTemporaryMessage();
  }

  private presentNextTemporaryMessage() {
    const next = this.temporaryMessageQueue.shift();
    if (!next) { this.temporaryMessageActive = false; return; }
    this.temporaryMessageActive = true;
    const msg = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height - 54,
      next.text,
      {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: next.color,
        backgroundColor: '#080c12',
        padding: { x: 12, y: 8 },
        align: 'center',
        wordWrap: { width: Math.min(520, Math.max(260, this.cameras.main.width - 72)), useAdvancedWrap: true },
        stroke: '#020306',
        strokeThickness: 2,
      },
    ).setOrigin(0.5).setScrollFactor(0).setDepth(205).setAlpha(0);
    this.temporaryMessageObject = msg;

    // Make main camera ignore this, let UI camera render i
    this.cameras.main.ignore(msg);

    this.tweens.add({
      targets: msg,
      alpha: 1,
      duration: 150,
      onComplete: () => {
        this.time.delayedCall(next.duration, () => {
          this.tweens.add({
            targets: msg,
            alpha: 0,
            duration: 200,
            onComplete: () => {
              msg.destroy();
              this.temporaryMessageObject = undefined;
              this.presentNextTemporaryMessage();
            },
          });
        });
      }
    });
  }

  private recordNotebookEntry(entry: NotebookEntry | undefined) {
    this.notebookJournal = addNotebookDiscovery(this.notebookJournal, entry);
    this.registry.set('investigationNotebook', this.notebookJournal);
  }

  private recordNotebookEvents(floor: Floor, events: readonly { type: string; index?: number }[]) {
    this.notebookJournal = addNotebookSearchEvents(this.notebookJournal, floor, events);
    this.registry.set('investigationNotebook', this.notebookJournal);
  }

  private showClueModal(title: string, content: string, recorded = false, onClose?: () => void) {
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
    const closeButton = this.add.text(centerX, centerY + panelHeight / 2 - 34, recorded ? 'RECORDED IN NOTEBOOK [TAB]  ·  CLOSE [SPACE / ESC]' : 'CLOSE NOTE  ·  [SPACE / ESC]', {
      fontFamily: 'monospace', fontSize: '13px', color: '#70d4c6',
      backgroundColor: '#202a2a', padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2).setInteractive();
    const elements = [overlay, panel, heading, note, closeButton];
    this.cameras.main.ignore(elements);

    const close = () => {
      this.storyPopupOpen = false;
      elements.forEach(element => element.destroy());
      this.closeStoryPopup = undefined;
      onClose?.();
    };
    this.closeStoryPopup = close;
    closeButton.on('pointerdown', close);
  }

  private openNotebook() {
    if (this.notebookOpen || !this.uiCamera) return;
    this.notebookOpen = true;
    this.storyPopupOpen = true;
    this.interactPrompt?.setVisible(false);
    this.notebookFloor = this.authoritativeSimulation.state.floor;
    this.notebookEntryIndex = 0;
    this.closeStoryPopup = () => this.closeNotebook();
    this.renderNotebook();
    this.notebookKeyHandler = event => {
      if (!this.notebookOpen) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const floors = [4, 3, 2, 1, 0];
        const at = floors.indexOf(this.notebookFloor);
        this.notebookFloor = floors[(at + (event.key === 'ArrowRight' ? 1 : floors.length - 1)) % floors.length];
        this.notebookEntryIndex = 0;
        this.renderNotebook();
        event.preventDefault();
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const entries = this.notebookEntriesForFloor(this.notebookFloor);
        this.notebookEntryIndex = Phaser.Math.Clamp(this.notebookEntryIndex + (event.key === 'ArrowDown' ? 1 : -1), 0, Math.max(0, entries.length - 1));
        this.renderNotebook();
        event.preventDefault();
      } else if (event.key === 'Escape') {
        this.closeNotebook();
        event.preventDefault();
      } else if (event.code === 'Space') {
        this.closeNotebook();
        event.preventDefault();
      }
    };
    this.input.keyboard?.on('keydown', this.notebookKeyHandler);
  }

  private notebookEntriesForFloor(floor: number): NotebookEntry[] {
    return this.notebookJournal.entries.filter(entry => entry.floor === floor);
  }

  private renderNotebook() {
    this.notebookElements.forEach(element => element.destroy());
    this.notebookElements = [];
    const width = this.uiCamera.width, height = this.uiCamera.height;
    const cx = width / 2, cy = height / 2;
    const compact = width < 760 || height < 520;
    const panelW = Math.min(900, width - (compact ? 20 : 48)), panelH = Math.min(620, height - (compact ? 20 : 48));
    const left = cx - panelW / 2, top = cy - panelH / 2;
    const add = <T extends Phaser.GameObjects.GameObject>(element: T): T => {
      this.cameras.main.ignore(element);
      this.notebookElements.push(element);
      return element;
    };
    add(this.add.rectangle(cx, cy, width, height, 0x03070b, 0.88).setScrollFactor(0).setDepth(700).setInteractive());
    add(this.add.rectangle(cx, cy, panelW, panelH, 0x111a22, 1).setScrollFactor(0).setDepth(701).setStrokeStyle(2, 0x536573, 1));
    add(this.add.rectangle(cx, cy, panelW - 12, panelH - 12, 0x17232c, 1).setScrollFactor(0).setDepth(702).setStrokeStyle(1, 0x293b48, 1));
    add(this.add.rectangle(cx, top + 70, panelW - 14, 1, 0x425663, 0.9).setScrollFactor(0).setDepth(703));
    add(this.add.text(left + 22, top + 16, 'FIELD NOTES', {
      fontFamily: 'monospace', fontSize: compact ? '16px' : '20px', color: '#f0ede4', fontStyle: 'bold', letterSpacing: 2,
    }).setScrollFactor(0).setDepth(704));
    add(this.add.text(left + 22, top + 43, 'RECOVERED DOCUMENTS', {
      fontFamily: 'monospace', fontSize: compact ? '10px' : '11px', color: '#aebbc2', letterSpacing: 1,
    }).setScrollFactor(0).setDepth(704));

    const floorLabels: Array<[number, string]> = [[4, 'FLOOR 4'], [3, 'FLOOR 3'], [2, 'FLOOR 2'], [1, 'FLOOR 1'], [0, 'FLOOR 13']];
    const tabY = top + 86;
    const tabX = left + 14;
    const tabWidth = (panelW - 28) / floorLabels.length;
    floorLabels.forEach(([floor, label], index) => {
      const shortLabel = `BLOCK ${floor === 0 ? '13' : floor}`;
      const x = tabX + tabWidth * (index + 0.5);
      const active = floor === this.notebookFloor;
      const count = this.notebookEntriesForFloor(floor).length;
      const tab = add(this.add.rectangle(x, tabY, tabWidth - 6, 36, active ? 0x354957 : 0x202d36, 1)
        .setScrollFactor(0).setDepth(704).setStrokeStyle(1, active ? 0xe29354 : 0x40515c, 1)
        .setInteractive({ useHandCursor: true }));
      add(this.add.text(x, tabY - 4, shortLabel, {
        fontFamily: 'monospace', fontSize: compact ? '9px' : '11px', color: active ? '#f3eee6' : '#b6c0c4', fontStyle: active ? 'bold' : 'normal',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(705));
      add(this.add.text(x, tabY + 10, `${count} ${count === 1 ? 'NOTE' : 'NOTES'}`, {
        fontFamily: 'monospace', fontSize: compact ? '8px' : '9px', color: active ? '#e9a263' : '#81919a',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(705));
      tab.on('pointerdown', () => { this.notebookFloor = floor; this.notebookEntryIndex = 0; this.renderNotebook(); });
    });

    const entries = this.notebookEntriesForFloor(this.notebookFloor);
    const contentTop = top + 116;
    const contentBottom = top + panelH - 50;
    const railX = left + 18, railW = Math.max(138, panelW * 0.31);
    const detailX = railX + railW + 16, detailW = left + panelW - 18 - detailX;
    add(this.add.rectangle(railX + railW / 2, (contentTop + contentBottom) / 2, railW, contentBottom - contentTop, 0x0d151c, 1)
      .setScrollFactor(0).setDepth(703).setStrokeStyle(1, 0x2f414c, 1));
    add(this.add.text(railX + 14, contentTop + 12, `${this.notebookFloor === 0 ? 'BLOCK 13' : `BLOCK ${this.notebookFloor}`}  ·  ${entries.length} FOUND`, {
      fontFamily: 'monospace', fontSize: compact ? '9px' : '10px', color: '#bdc7cb', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(704));
    add(this.add.rectangle(railX + railW / 2, contentTop + 34, railW - 20, 1, 0x354751, 1).setScrollFactor(0).setDepth(704));
    add(this.add.rectangle(detailX + detailW / 2, (contentTop + contentBottom) / 2, detailW, contentBottom - contentTop, 0xd5d9d6, 1)
      .setScrollFactor(0).setDepth(703).setStrokeStyle(1, 0x71818a, 1));
    if (entries.length === 0) {
      add(this.add.text(detailX + 22, contentTop + 28, 'NO DOCUMENTS RECOVERED', {
        fontFamily: 'monospace', fontSize: compact ? '12px' : '15px', color: '#263139', fontStyle: 'bold',
      }).setScrollFactor(0).setDepth(704));
      add(this.add.text(detailX + 22, contentTop + 62, 'Evidence you collect on this block will be filed here.', {
        fontFamily: 'monospace', fontSize: compact ? '11px' : '13px', color: '#46535a', lineSpacing: 5,
        wordWrap: { width: detailW - 44, useAdvancedWrap: true },
      }).setScrollFactor(0).setDepth(704));
    } else {
      const rowPitch = compact ? 34 : 42;
      const visibleLimit = Math.max(1, Math.min(compact ? 5 : 8, Math.floor((contentBottom - contentTop - 64) / rowPitch)));
      const visibleStart = Math.min(Math.max(0, this.notebookEntryIndex - Math.floor(visibleLimit / 2)), Math.max(0, entries.length - visibleLimit));
      entries.slice(visibleStart, visibleStart + visibleLimit).forEach((entry, offset) => {
        const index = visibleStart + offset;
        const rowY = contentTop + 54 + offset * rowPitch;
        const selected = index === this.notebookEntryIndex;
        const row = add(this.add.rectangle(railX + railW / 2, rowY, railW - 20, rowPitch - 3, selected ? 0x2c414e : 0x111c24, 1)
          .setScrollFactor(0).setDepth(704).setStrokeStyle(1, selected ? 0xe29354 : 0x25353f, 1)
          .setInteractive({ useHandCursor: true }));
        add(this.add.text(railX + 20, rowY, `${entry.important ? '◆ ' : '· '}${entry.title}`, {
          fontFamily: 'monospace', fontSize: compact ? '10px' : '11px', color: selected ? '#f4eee5' : '#b5c0c4',
          wordWrap: { width: railW - 48, useAdvancedWrap: true }, maxLines: 2,
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(705));
        row.on('pointerdown', () => { this.notebookEntryIndex = index; this.renderNotebook(); });
      });
      const selected = entries[this.notebookEntryIndex] ?? entries[0];
      add(this.add.text(detailX + 22, contentTop + 20, `DOCUMENT ${String(this.notebookEntryIndex + 1).padStart(2, '0')} / ${String(entries.length).padStart(2, '0')}`, {
        fontFamily: 'monospace', fontSize: compact ? '9px' : '10px', color: '#53636a', letterSpacing: 1,
      }).setScrollFactor(0).setDepth(704));
      add(this.add.text(detailX + 22, contentTop + 48, selected.title, {
        fontFamily: 'monospace', fontSize: compact ? '13px' : '17px', color: '#17242a', fontStyle: 'bold',
        wordWrap: { width: detailW - 44, useAdvancedWrap: true },
      }).setScrollFactor(0).setDepth(704));
      const dividerY = contentTop + (compact ? 92 : 104);
      add(this.add.rectangle(detailX + detailW / 2, dividerY, detailW - 44, 1, 0x9aa5a4, 1).setScrollFactor(0).setDepth(704));
      add(this.add.text(detailX + 22, dividerY + 18, selected.content, {
        fontFamily: 'monospace', fontSize: compact ? '12px' : '14px', color: '#252f33', lineSpacing: compact ? 4 : 8,
        wordWrap: { width: detailW - 44, useAdvancedWrap: true },
      }).setScrollFactor(0).setDepth(704));
    }
    add(this.add.text(cx, top + panelH - 24, '← / → BLOCK     ↑ / ↓ NOTE     TAB / SPACE / ESC CLOSE', {
      fontFamily: 'monospace', fontSize: compact ? '9px' : '11px', color: '#d5dfe2', letterSpacing: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(704).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.closeNotebook()));
  }

  private closeNotebook() {
    if (!this.notebookOpen) return;
    this.notebookOpen = false;
    this.storyPopupOpen = false;
    if (this.notebookKeyHandler) this.input.keyboard?.off('keydown', this.notebookKeyHandler);
    this.notebookKeyHandler = undefined;
    this.closeStoryPopup = undefined;
    this.notebookElements.forEach(element => element.destroy());
    this.notebookElements = [];
  }

  private showOpeningStory() {
    if (this.openingStoryOpen || !this.uiCamera) return;
    this.openingStoryOpen = true;
    this.openingStoryIndex = 0;

    const { width, height } = this.cameras.main;
    const image = this.add.image(width / 2, height / 2, OPENING_CINEMATIC[0].texture)
      .setDisplaySize(width, height).setScrollFactor(0).setDepth(500).setAlpha(0);
    const veil = this.add.rectangle(width / 2, height / 2, width, height, 0x030609, 0.16)
      .setScrollFactor(0).setDepth(501).setInteractive();
    const timeLabel = this.add.text(width / 2, 34, 'FLOOR 13  //  THE BUILDING THAT NEVER EXISTED', {
      fontFamily: 'monospace', fontSize: '12px', color: '#d3d5d0', letterSpacing: 2,
      backgroundColor: '#090b10aa', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(502);
    const storyText = this.add.text(width / 2, height - 76, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#f1eee4', align: 'center',
      backgroundColor: '#090b10c9', padding: { x: 16, y: 10 },
      wordWrap: { width: Math.min(620, width - 64), useAdvancedWrap: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(502);
    const hint = this.add.text(width - 22, height - 22, '[SPACE / ENTER] CONTINUE  ·  [ESC] SKIP', {
      fontFamily: 'monospace', fontSize: '11px', color: '#d0d0ca', letterSpacing: 1,
      backgroundColor: '#090b10aa', padding: { x: 8, y: 5 },
    }).setOrigin(1).setScrollFactor(0).setDepth(502);
    this.openingStoryImage = image;
    this.openingStoryElements = [image, veil, timeLabel, storyText, hint];
    this.openingStoryText = storyText;
    this.cameras.main.ignore(this.openingStoryElements);
    veil.on('pointerdown', () => this.advanceOpeningStory());
    this.renderOpeningStoryLine();
  }

  private renderOpeningStoryLine() {
    if (!this.openingStoryOpen || !this.openingStoryText || !this.openingStoryImage) return;
    const scene = OPENING_CINEMATIC[this.openingStoryIndex];
    this.openingStoryText.setText(scene.caption);
    this.openingStoryTimer?.remove(false);
    this.openingStoryImage.setTexture(scene.texture).setDisplaySize(this.uiCamera.width, this.uiCamera.height).setAlpha(1);
    this.tweens.killTweensOf(this.openingStoryImage);
    this.openingStoryTimer = this.time.delayedCall(scene.durationMs, () => this.advanceOpeningStory());
  }

  private advanceOpeningStory() {
    if (!this.openingStoryOpen) return;
    if (this.openingStoryIndex >= OPENING_CINEMATIC.length - 1) {
      this.closeOpeningStory();
      return;
    }
    this.openingStoryIndex++;
    this.renderOpeningStoryLine();
  }

  private skipOpeningStory() {
    if (!this.openingStoryOpen) return;
    this.closeOpeningStory();
  }

  private closeOpeningStory() {
    if (!this.openingStoryOpen) return;
    this.openingStoryOpen = false;
    this.openingStoryTimer?.remove(false);
    this.openingStoryTimer = undefined;
    if (this.openingStoryImage) this.tweens.killTweensOf(this.openingStoryImage);
    this.openingStoryElements.forEach(element => element.destroy());
    this.openingStoryElements = [];
    this.openingStoryImage = undefined;
    this.openingStoryText = undefined;
    this.registry.set('openingStorySeen', true);
  }

  private showPauseMenu() {
    this.isPaused = true;
    this.clearFinalChaseAmbience();
    this.audioDirector?.pausePresentation();
    this.clearAmbusherJumpscare();
    this.clearHauntingPresentation();

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
      menuHeight + 54,
      0x1a1a1a,
      1
    ).setScrollFactor(0).setDepth(301);

    // Menu border
    const border = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      menuWidth,
      menuHeight + 54
    ).setScrollFactor(0).setDepth(301).setStrokeStyle(2, 0x70d4c6, 1);

    // Pause title
    const title = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 125,
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
      this.cameras.main.height / 2 - 58,
      'RESUME',
      {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#d9f3ea',
        backgroundColor: '#2a2a2a',
        padding: { x: 20, y: 10 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(302).setInteractive();

    const settingsButton = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      'AUDIO SETTINGS',
      { fontFamily: 'monospace', fontSize: '17px', color: '#d9f3ea', backgroundColor: '#2a2a2a', padding: { x: 16, y: 8 } },
    ).setOrigin(0.5).setScrollFactor(0).setDepth(302).setInteractive();

    // Main menu button
    const mainMenuButton = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 54,
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
      this.cameras.main.height / 2 + 125,
      '[ESC] RESUME  ·  [TAB/↑/↓] SELECT  ·  [ENTER] CONFIRM',
      {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#6b7280',
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(302);

    const pauseElements = [overlay, menu, border, title, resumeButton, settingsButton, mainMenuButton, instructions];
    const pauseActions = [resumeButton, settingsButton, mainMenuButton];
    let selectedAction = 0;
    const showSelectedAction = () => pauseActions.forEach((button, index) => {
      const selected = index === selectedAction;
      button.setStyle({ color: selected ? '#ffd700' : '#d9f3ea', backgroundColor: selected ? '#3a3a0a' : '#2a2a2a' });
    });
    showSelectedAction();

    // Button hover effects
    resumeButton.on('pointerover', () => {
      selectedAction = 0;
      showSelectedAction();
    });
    resumeButton.on('pointerout', () => {
      showSelectedAction();
    });

    settingsButton.on('pointerover', () => {
      selectedAction = 1;
      showSelectedAction();
    });
    settingsButton.on('pointerout', showSelectedAction);
    settingsButton.on('pointerdown', () => window.dispatchEvent(new Event('block13:open-audio-settings')));

    mainMenuButton.on('pointerover', () => {
      selectedAction = 2;
      showSelectedAction();
    });
    mainMenuButton.on('pointerout', () => {
      showSelectedAction();
    });

    // Close pause menu handler
    const closePauseMenu = () => {
      this.isPaused = false;
      this.audioDirector?.resumePresentation();
      const state = this.authoritativeSimulation.state;
      this.setFinalChaseAmbience(isBlock13Floor(state.floor) && state.hasKey && state.stalker.state === 'hunting',
        this.audioDirector?.getSettings().reduceJumpscareIntensity ?? false);
      pauseElements.forEach(el => el.destroy());
      this.pauseKey.off('down', escHandler);
      this.input.keyboard?.off('keydown', pauseKeyboardHandler);
    };

    // Resume button click
    resumeButton.on('pointerdown', () => {
      closePauseMenu();
    });

    // Main menu button click
    mainMenuButton.on('pointerdown', () => {
      window.location.reload(); // Return to React shell
    });

    const pauseKeyboardHandler = (event: KeyboardEvent) => {
      if (event.key === 'Tab' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        selectedAction = event.key === 'ArrowUp'
          ? (selectedAction + pauseActions.length - 1) % pauseActions.length
          : (selectedAction + 1) % pauseActions.length;
        showSelectedAction();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        pauseActions[selectedAction].emit('pointerdown');
      }
    };
    this.input.keyboard?.on('keydown', pauseKeyboardHandler);

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
    const floorDisplay = isBlock13Floor(this.runState.floor)
      ? playerBlockName(this.runState.floor)
      : `${playerBlockName(this.runState.floor)}/${START_FLOOR}`;
    const simulationState = this.authoritativeSimulation.state;
    const objectiveProgress = this.floorData.objectives.searchableIndices.filter(index => simulationState.searched[index]).length;
    this.block13ObjectiveStatus = simulationState.puzzle.fallbackActive && !simulationState.puzzle.fallbackItemFound
      ? `OBJECTIVE: FIND THE ${this.puzzleFallbackItemLabel(simulationState.floor)}`
      : objectiveCopy(simulationState.floor, simulationState.hasKey, simulationState.stalker.state === 'hunting', simulationState.objectiveComplete, objectiveProgress, this.floorData.objectives.searchableIndices.length);

    const lines = [
      floorDisplay,
      ...(this.block13ObjectiveStatus ? [this.block13ObjectiveStatus] : []),
      '',
      `HP: ${Math.floor(this.runState.hp)}/100`,
      `CURSE: ${formatWholePercent(this.runState.curse)}%`,
      `BATTERY: ${formatWholePercent(this.runState.battery)}%`,
      `SCORE: ${this.runState.score}`,
      `LIGHT: ${flashStatus}`,
      ...(hudWarningCopy({ hp: simulationState.hp, battery: simulationState.battery / FIXED_SCALE, curse: simulationState.curse / FIXED_SCALE }).length
        ? ['', ...hudWarningCopy({ hp: simulationState.hp, battery: simulationState.battery / FIXED_SCALE, curse: simulationState.curse / FIXED_SCALE })]
        : []),
    ];
    this.statusText.setText(lines.join('\n'));

    // Update color based on most critical resource
    if (this.runState.hp <= 25) {
      this.statusText.setColor(hpColor);
    } else if (this.runState.battery <= 20) {
      this.statusText.setColor(batteryColor);
    } else if (this.runState.curse >= 85) {
      this.statusText.setColor('#ff4444');
    } else if (this.runState.curse > 50) {
      this.statusText.setColor('#ffd700');
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
    if (isBlock13Floor(this.authoritativeSimulation.state.floor) && this.drawAuthoredBlock13Floor(tiles)) return;
    if (!isBlock13Floor(this.authoritativeSimulation.state.floor) && this.drawAuthoredOrdinaryFloor(tiles)) return;
    this.drawProceduralFloor(tiles);
  }

  /** Composes authored ordinary-floor art into one static texture beneath lighting. */
  private drawAuthoredOrdinaryFloor(tiles: boolean[][]): boolean {
    const floor = this.authoritativeSimulation.state.floor;
    if (floor < 1 || floor > 4) return false;
    const mapWidth = this.floorData.width * this.tileSize;
    const mapHeight = this.floorData.height * this.tileSize;
    const profile = floorVisualProfile(floor);
    const sources = new Map<OrdinaryEnvironmentAssetName, CanvasImageSource>();
    for (const name of Object.keys(ORDINARY_ENVIRONMENT_ASSET_MANIFEST) as OrdinaryEnvironmentAssetName[]) {
      const source = this.getOrdinaryEnvironmentAssetSource(name);
      if (source) sources.set(name, source);
    }
    const useRefinedBlock3 = import.meta.env.DEV && floor === 3 && this.block3VisualMode === 'refined';
    const experimentSources = new Map<Block3ExperimentTextureKey, CanvasImageSource>();
    if (useRefinedBlock3) {
      for (const { key } of BLOCK3_REFINED_EXPERIMENT_ASSETS) {
        const source = this.getBlock3ExperimentAssetSource(key);
        if (source) experimentSources.set(key, source);
      }
      for (const name of Object.keys(ORDINARY_ENVIRONMENT_ASSET_MANIFEST) as OrdinaryEnvironmentAssetName[]) {
        const key = block3ExperimentTextureForAsset(name);
        if (!key) continue;
        const source = this.getBlock3ExperimentAssetSource(key);
        if (!source) return false;
        sources.set(name, source);
      }
    }
    if (!sources.has('floor_base') || !sources.has('wall_base')) return false;

    const textureKey = 'ordinary_composed_environment';
    // Reuse the existing canvas texture and image when F8 rebuilds Block 3.
    // This preserves the image's camera filters and display-list slot while
    // replacing only the static surface pixels.
    const composed = (this.textures.exists(textureKey)
      ? this.textures.get(textureKey)
      : this.textures.createCanvas(textureKey, mapWidth, mapHeight)) as Phaser.Textures.CanvasTexture | null;
    if (!composed) return false;
    const context = composed.getContext();
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, mapWidth, mapHeight);

    const importantTiles = new Set<string>([
      `${this.floorData.start[0]},${this.floorData.start[1]}`,
      `${this.floorData.key[0]},${this.floorData.key[1]}`,
      `${this.floorData.exit[0]},${this.floorData.exit[1]}`,
      ...this.floorData.searchables.map(item => `${item.x},${item.y}`),
    ]);
    const doorTiles = new Set(this.floorData.doors.map(([x, y]) => `${x},${y}`));
    const protectedTiles = new Set([...importantTiles, ...doorTiles]);
    const surfaceAssets = ordinarySurfaceAssetsForMap(floor, tiles, protectedTiles);
    const authoredOverlayAssets = ordinaryOverlayAssetsForMap(floor, tiles, protectedTiles);

    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        const walkable = tiles[y][x];
        const requested = surfaceAssets[y][x] ?? ordinarySurfaceAssetAt(floor, x, y, walkable)!;
        const resolved = resolveOrdinarySurfaceAsset(requested, name => sources.has(name));
        const nextToWall = walkable && [tiles[y - 1]?.[x], tiles[y]?.[x + 1], tiles[y + 1]?.[x], tiles[y]?.[x - 1]].some(value => value === false);
        const refinedSurface = useRefinedBlock3
          ? experimentSources.get(block3SurfaceTextureAt(x, y, walkable, nextToWall, protectedTiles.has(`${x},${y}`)))
          : undefined;
        const px = x * this.tileSize;
        const py = y * this.tileSize;
        if (refinedSurface || resolved) {
          context.drawImage(refinedSurface ?? sources.get(resolved!)!, px, py, this.tileSize, this.tileSize);
          this.applySurfaceColorGrade(context, floor, x, y, walkable);
        } else {
          context.fillStyle = `#${(walkable ? profile.floorBase : profile.wallBase).toString(16).padStart(6, '0')}`;
          context.fillRect(px, py, this.tileSize, this.tileSize);
          context.strokeStyle = `#${profile.grid.toString(16).padStart(6, '0')}`;
          context.globalAlpha = walkable ? 0.18 : 0.54;
          context.strokeRect(px + 0.5, py + 0.5, this.tileSize - 1, this.tileSize - 1);
          context.globalAlpha = 1;
        }
      }
    }

    // Edges are composed from existing occupancy only; no tile data is changed.
    const wallEdge = sources.get('wall_edge');
    if (wallEdge) {
      for (let y = 0; y < tiles.length; y++) {
        for (let x = 0; x < tiles[y].length; x++) {
          if (tiles[y][x]) continue;
          const rotations = block13WallEdgeRotations({
            up: Boolean(tiles[y - 1]?.[x]),
            right: Boolean(tiles[y]?.[x + 1]),
            down: Boolean(tiles[y + 1]?.[x]),
            left: Boolean(tiles[y]?.[x - 1]),
          });
          for (const rotation of rotations) {
            context.save();
            context.translate(x * this.tileSize + 16, y * this.tileSize + 16);
            context.rotate(rotation);
            context.drawImage(wallEdge, -16, -16, 32, 32);
            context.restore();
          }
        }
      }
    }

    // Existing coordinate-derived marks choose their authored block-specific replacement.
    const authoredOverlayTiles = new Set<string>();
    const authoredReplacementTiles = new Set<string>();
    if (!useRefinedBlock3) for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        const id = `${x},${y}`;
        const requestedAsset = authoredOverlayAssets[y][x];
        const asset = requestedAsset ? resolveOrdinaryOverlayAsset(requestedAsset, name => sources.has(name)) : null;
        const source = asset ? sources.get(asset) : undefined;
        if (!asset || !source) continue;
        authoredReplacementTiles.add(id);
        if (!ordinaryOverlayPlacementAllowed(asset, importantTiles.has(id), doorTiles.has(id))) continue;
        const dimensions = ORDINARY_ENVIRONMENT_ASSET_MANIFEST[asset].width;
        const height = ORDINARY_ENVIRONMENT_ASSET_MANIFEST[asset].height;
        context.drawImage(source,
          x * this.tileSize + (this.tileSize - dimensions) / 2,
          y * this.tileSize + (this.tileSize - height) / 2,
          dimensions,
          height,
        );
        authoredOverlayTiles.add(id);
      }
    }

    // Retain coordinate-derived dressing that does not duplicate an authored mark.
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        const id = `${x},${y}`;
        const dressing = useRefinedBlock3 ? 'none' : tileDressingAt(floor, x, y, tiles[y][x]);
        const overlayDrawn = authoredOverlayTiles.has(id);
        const dressingConflicts = overlayDrawn && (
          (floor === 3 && dressing === 'crack')
          || (floor === 2 && dressing === 'warning')
          || (floor === 1 && (dressing === 'crack' || dressing === 'corruption'
            || (authoredOverlayTiles.has(id) && authoredOverlayAssets[y][x] === 'damaged_floor_panel_01' && dressing !== 'none')))
        );
        if (!dressingConflicts) this.drawTileDressingOnCanvas(context, dressing, x, y, tiles[y][x], profile);
        if (!useRefinedBlock3 && !authoredReplacementTiles.has(id) && !protectedTiles.has(id)) {
          this.drawArchitecturalMarkOnCanvas(context, architecturalMarkAt(floor, x, y, tiles[y][x]), x, y, profile);
        }
      }
    }

    // Small wall-mounted details stay in the static map layer, beneath actors
    // and the existing runtime lighting composition.
    const decorations = ordinaryMapDecorationPlacements(floor, tiles, this.floorData.doors, importantTiles);
    const propPlacement = useRefinedBlock3 ? decorations.find(item => item.asset === 'wall_lamp_01') : undefined;
    const decorativeProp = useRefinedBlock3 ? this.getBlock3ExperimentAssetSource('dev_b3_decorative_prop') : null;
    const roomNoticeTile = useRefinedBlock3 ? block3RoomNoticeTile(tiles, this.floorData.doors, protectedTiles) : null;
    for (const { asset, x, y } of decorations) {
      if (decorativeProp && propPlacement?.x === x && propPlacement.y === y) continue;
      if (roomNoticeTile?.[0] === x && roomNoticeTile[1] === y) {
        const notice = experimentSources.get('dev_b3_room_notice');
        if (notice) context.drawImage(notice, x * this.tileSize, y * this.tileSize, 32, 32);
        continue;
      }
      const source = sources.get(asset);
      if (!source) continue;
      const experimentalKey = useRefinedBlock3 ? block3ExperimentTextureForAsset(asset) : null;
      const experimentalSize = experimentalKey && BLOCK3_REFINED_EXPERIMENT_ASSETS.find(item => item.key === experimentalKey);
      const { width, height } = experimentalSize ?? ORDINARY_ENVIRONMENT_ASSET_MANIFEST[asset];
      context.drawImage(source,
        x * this.tileSize + (this.tileSize - width) / 2,
        y * this.tileSize + (this.tileSize - height) / 2,
        width,
        height,
      );
    }
    if (roomNoticeTile && !decorations.some(item => item.x === roomNoticeTile[0] && item.y === roomNoticeTile[1])) {
      const notice = experimentSources.get('dev_b3_room_notice');
      if (notice) context.drawImage(notice, roomNoticeTile[0] * this.tileSize, roomNoticeTile[1] * this.tileSize, 32, 32);
    }
    if (decorativeProp && propPlacement) {
      // One stable wall-mounted prop; its lower edge aligns to the wall tile.
      context.drawImage(decorativeProp,
        propPlacement.x * this.tileSize,
        propPlacement.y * this.tileSize - 16,
        this.tileSize,
        48,
      );
    }

    // These coordinates already represent open passages in Floor.doors.
    const threshold = sources.get('threshold');
    for (const [x, y] of this.floorData.doors) {
      if (!tiles[y]?.[x]) continue;
      const horizontal = Boolean(tiles[y]?.[x - 1] && tiles[y]?.[x + 1]);
      const vertical = Boolean(tiles[y - 1]?.[x] && tiles[y + 1]?.[x]);
      if (horizontal === vertical) continue;
      const centerX = x * this.tileSize + 16;
      const centerY = y * this.tileSize + 16;
      if (threshold) {
        context.save();
        context.translate(centerX, centerY);
        if (!horizontal) context.rotate(Math.PI / 2);
        context.drawImage(threshold, -16, -16, 32, 32);
        this.drawOrdinaryThresholdMark(context, floor);
        context.restore();
      } else {
        context.fillStyle = `#${profile.accent.toString(16).padStart(6, '0')}`;
        context.globalAlpha = 0.48;
        if (horizontal) {
          context.fillRect(x * this.tileSize + 13, y * this.tileSize + 3, 6, 2);
          context.fillRect(x * this.tileSize + 13, y * this.tileSize + 27, 6, 2);
        } else {
          context.fillRect(x * this.tileSize + 3, y * this.tileSize + 13, 2, 6);
          context.fillRect(x * this.tileSize + 27, y * this.tileSize + 13, 2, 6);
        }
        context.globalAlpha = 1;
      }
    }

    composed.refresh();
    composed.setFilter(Phaser.Textures.FilterMode.NEAREST);
    if (!this.ordinaryEnvironmentImage?.active) {
      this.ordinaryEnvironmentImage = this.add.image(0, 0, textureKey).setOrigin(0).setDepth(0);
    }
    // Initial floor composition runs before uiCamera is created. Reassert this
    // filter after every rebuild so a hot-switched world layer never leaks into
    // the fixed HUD camera.
    this.uiCamera?.ignore(this.ordinaryEnvironmentImage);
    return true;
  }

  private isDevelopmentBlock3VisualComparisonAvailable(): boolean {
    return import.meta.env.DEV
      && this.authoritativeSimulation?.state.floor === 3
      && BLOCK3_REFINED_EXPERIMENT_ASSETS.every(asset => this.textures.exists(asset.key));
  }

  private bindDevelopmentBlock3VisualToggle() {
    if (!this.isDevelopmentBlock3VisualComparisonAvailable()) return;
    this.block3VisualKeyHandler = event => {
      if (event.repeat || event.code !== 'F8') return;
      this.block3VisualMode = nextBlock3VisualMode(this.block3VisualMode);
      // Recompose only the floor's static background texture. No simulation,
      // RNG, input-log, player, camera, or interactable state is touched here.
      this.drawFloor(this.floorData.tiles);
      this.controlsHint?.setText([
        'WASD / ARROWS - MOVE', 'F - FLASHLIGHT', 'E - INTERACT', 'ESC - PAUSE',
        `F8 - BLOCK 3 ART: ${block3VisualModeLabel(this.block3VisualMode)}`,
      ].join('\n'));
    };
    this.input.keyboard?.on('keydown', this.block3VisualKeyHandler);
  }

  private getBlock3ExperimentAssetSource(key: Block3ExperimentTextureKey): CanvasImageSource | null {
    if (!this.textures.exists(key)) return null;
    const metadata = BLOCK3_REFINED_EXPERIMENT_ASSETS.find(asset => asset.key === key);
    if (!metadata) return null;
    const texture = this.textures.get(key);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const source = texture.getSourceImage() as CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
    const width = source.naturalWidth || source.width;
    const height = source.naturalHeight || source.height;
    return width === metadata.width && height === metadata.height ? source : null;
  }

  /** Small floor-specific paint on valid passage tiles; art only, never geometry. */
  private drawOrdinaryThresholdMark(context: CanvasRenderingContext2D, floor: number) {
    const treatment = ordinaryThresholdTreatment(floor);
    if (!treatment) return;
    context.save();
    context.fillStyle = `#${treatment.color.toString(16).padStart(6, '0')}`;
    context.strokeStyle = context.fillStyle;
    context.globalAlpha = treatment.alpha;
    switch (treatment.style) {
      case 'orderly':
        context.fillRect(-10, -10, 20, 1);
        context.fillRect(-10, 9, 20, 1);
        break;
      case 'worn':
        context.fillRect(-9, -10, 7, 1);
        context.fillRect(3, -10, 5, 1);
        context.fillRect(-6, 9, 12, 1);
        break;
      case 'hazard':
        for (const x of [-9, -3, 3, 9]) {
          context.fillRect(x - 1, -11, 2, 3);
          context.fillRect(x - 1, 8, 2, 3);
        }
        break;
      case 'fracture':
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(-9, -10);
        context.lineTo(-3, -6);
        context.lineTo(-5, 0);
        context.lineTo(2, 4);
        context.lineTo(0, 10);
        context.stroke();
        break;
      default:
        break;
    }
    context.restore();
  }

  private getOrdinaryEnvironmentAssetSource(name: OrdinaryEnvironmentAssetName): CanvasImageSource | null {
    const asset = ORDINARY_ENVIRONMENT_ASSET_MANIFEST[name];
    if (!this.textures.exists(asset.key)) return null;
    const texture = this.textures.get(asset.key);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const source = texture.getSourceImage() as CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
    const width = source.naturalWidth || source.width;
    const height = source.naturalHeight || source.height;
    return width === asset.width && height === asset.height ? source : null;
  }

  /** Apply a restrained floor-identity hue to material pixels without changing luminance. */
  private applySurfaceColorGrade(context: CanvasRenderingContext2D, floor: number, tileX: number, tileY: number, walkable: boolean) {
    const grade = surfaceColorGrade(floor, walkable);
    context.save();
    context.globalCompositeOperation = 'color';
    context.globalAlpha = grade.alpha;
    context.fillStyle = `#${grade.tint.toString(16).padStart(6, '0')}`;
    context.fillRect(tileX * this.tileSize, tileY * this.tileSize, this.tileSize, this.tileSize);
    context.restore();
  }

  private drawTileDressingOnCanvas(
    context: CanvasRenderingContext2D,
    dressing: ReturnType<typeof tileDressingAt>,
    tileX: number,
    tileY: number,
    walkable: boolean,
    profile: ReturnType<typeof floorVisualProfile>,
  ) {
    const x = tileX * this.tileSize, y = tileY * this.tileSize;
    const color = (value: number) => `#${value.toString(16).padStart(6, '0')}`;
    switch (dressing) {
      case 'stain':
        context.fillStyle = color(profile.stain);
        context.globalAlpha = 0.72;
        context.beginPath();
        context.ellipse(x + 15 + ((tileX * 7 + tileY * 3) % 7), y + 15 + ((tileX * 2 + tileY * 5) % 7), 8.5, 4.5, 0, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
        break;
      case 'crack':
        context.strokeStyle = color(profile.grime);
        context.globalAlpha = walkable ? 0.62 : 0.72;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x + 6, y + 8);
        context.lineTo(x + 13, y + 14);
        context.lineTo(x + 10, y + 22);
        context.moveTo(x + 13, y + 14);
        context.lineTo(x + 22, y + 18);
        context.stroke();
        context.globalAlpha = 1;
        break;
      case 'pipe':
        context.strokeStyle = color(profile.grime);
        context.globalAlpha = 0.72;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(x + 5, y + 4);
        context.lineTo(x + 5, y + 28);
        context.stroke();
        context.strokeStyle = color(profile.accent);
        context.globalAlpha = 0.25;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x + 8, y + 4);
        context.lineTo(x + 8, y + 28);
        context.stroke();
        context.globalAlpha = 1;
        break;
      case 'warning':
        context.fillStyle = color(profile.accent);
        context.globalAlpha = 0.48;
        context.fillRect(x + 5, y + 6, 20, 3);
        context.fillRect(x + 5, y + 23, 20, 3);
        context.globalAlpha = 1;
        break;
      case 'corruption':
        context.strokeStyle = color(profile.corruption);
        context.globalAlpha = 0.64;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x + 4, y + 7);
        context.lineTo(x + 13, y + 12);
        context.lineTo(x + 9, y + 20);
        context.lineTo(x + 27, y + 25);
        context.stroke();
        context.fillStyle = color(profile.corruption);
        context.globalAlpha = 0.28;
        context.beginPath();
        context.arc(x + 22, y + 9, 2, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
        break;
      case 'none':
        break;
    }
  }

  private drawArchitecturalMarkOnCanvas(
    context: CanvasRenderingContext2D,
    mark: ReturnType<typeof architecturalMarkAt>,
    tileX: number,
    tileY: number,
    profile: ReturnType<typeof floorVisualProfile>,
  ) {
    const x = tileX * this.tileSize, y = tileY * this.tileSize;
    const color = (value: number) => `#${value.toString(16).padStart(6, '0')}`;
    switch (mark) {
      case 'orderly_seam':
        context.fillStyle = color(profile.grid);
        context.globalAlpha = 0.52;
        context.fillRect(x + 4, y + 27, 24, 1);
        break;
      case 'clean_wall':
        context.fillStyle = color(profile.accent);
        context.globalAlpha = 0.2;
        context.fillRect(x + 4, y + 3, 24, 1);
        context.fillStyle = '#080b10';
        context.globalAlpha = 0.22;
        context.fillRect(x + 4, y + 28, 24, 2);
        break;
      case 'peel':
        context.fillStyle = color(profile.grime);
        context.globalAlpha = 0.78;
        context.fillRect(x + 6, y + 7, 12, 2);
        context.fillRect(x + 8, y + 9, 8, 2);
        context.fillRect(x + 20, y + 18, 5, 2);
        context.fillStyle = color(profile.accent);
        context.globalAlpha = 0.2;
        context.fillRect(x + 6, y + 6, 10, 1);
        break;
      case 'warning_repeat':
        context.fillStyle = color(profile.accent);
        context.globalAlpha = 0.68;
        context.fillRect(x + 6, y + 8, 3, 12);
        context.fillRect(x + 14, y + 8, 3, 12);
        context.fillRect(x + 22, y + 8, 3, 12);
        context.fillStyle = color(profile.wallBase);
        context.globalAlpha = 0.8;
        context.fillRect(x + 6, y + 11, 3, 3);
        context.fillRect(x + 14, y + 15, 3, 3);
        context.fillRect(x + 22, y + 11, 3, 3);
        break;
      case 'fracture':
        context.fillStyle = color(profile.corruption);
        context.globalAlpha = 0.68;
        context.fillRect(x + 14, y + 3, 2, 6);
        context.fillRect(x + 10, y + 9, 6, 2);
        context.fillRect(x + 10, y + 11, 2, 7);
        context.fillRect(x + 10, y + 17, 9, 2);
        context.fillRect(x + 17, y + 17, 2, 9);
        context.fillRect(x + 17, y + 24, 8, 2);
        break;
      default:
        break;
    }
    context.globalAlpha = 1;
  }

  /** Block 13 art composites to a single static texture; tile/object state stays simulation-owned. */
  private drawAuthoredBlock13Floor(tiles: boolean[][]): boolean {
    const floorBase = this.getBlock13AssetSource('floor_base');
    const wallBase = this.getBlock13AssetSource('wall_base');
    if (!floorBase || !wallBase) return false;

    if (this.textures.exists(BLOCK13_MAP_TEXTURE_KEY)) this.textures.remove(BLOCK13_MAP_TEXTURE_KEY);
    const mapWidth = this.floorData.width * this.tileSize;
    const mapHeight = this.floorData.height * this.tileSize;
    const composed = this.textures.createCanvas(BLOCK13_MAP_TEXTURE_KEY, mapWidth, mapHeight);
    if (!composed) return false;

    const context = composed.getContext();
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, mapWidth, mapHeight);

    const sources = new Map<string, CanvasImageSource>();
    for (const name of Object.keys(BLOCK13_ASSET_MANIFEST) as (keyof typeof BLOCK13_ASSET_MANIFEST)[]) {
      const source = this.getBlock13AssetSource(name);
      if (source) sources.set(name, source);
    }

    const drawAsset = (name: string, centerX: number, centerY: number, rotation = 0): boolean => {
      const source = sources.get(name);
      if (!source) return false;
      const asset = BLOCK13_ASSET_MANIFEST[name as keyof typeof BLOCK13_ASSET_MANIFEST];
      const width = asset?.width ?? this.tileSize;
      const height = asset?.height ?? this.tileSize;
      context.save();
      if (rotation !== 0) {
        context.translate(centerX, centerY);
        context.rotate(rotation);
        context.drawImage(source, -width / 2, -height / 2, width, height);
      } else {
        context.drawImage(source, centerX - width / 2, centerY - height / 2, width, height);
      }
      context.restore();
      return true;
    };

    const profile = floorVisualProfile(0);
    const importantTiles = new Set<string>([
      `${this.floorData.start[0]},${this.floorData.start[1]}`,
      `${this.floorData.key[0]},${this.floorData.key[1]}`,
      `${this.floorData.exit[0]},${this.floorData.exit[1]}`,
      ...this.floorData.searchables.map(item => `${item.x},${item.y}`),
    ]);
    const hub = this.floorData.block13Hub;

    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        const walkable = tiles[y][x];
        const centerX = x * this.tileSize + this.tileSize / 2;
        const centerY = y * this.tileSize + this.tileSize / 2;
        const tileAsset = block13SurfaceAssetAt(0, x, y, walkable);
        const didDrawBase = tileAsset ? drawAsset(tileAsset, centerX, centerY) : false;
        if (didDrawBase) this.applySurfaceColorGrade(context, 0, x, y, walkable);
        if (!didDrawBase) {
          context.fillStyle = `#${(walkable ? profile.floorBase : profile.wallBase).toString(16).padStart(6, '0')}`;
          context.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
          context.strokeStyle = `#${profile.grid.toString(16).padStart(6, '0')}`;
          context.globalAlpha = walkable ? 0.18 : 0.54;
          context.strokeRect(x * this.tileSize + 0.5, y * this.tileSize + 0.5, this.tileSize - 1, this.tileSize - 1);
          context.globalAlpha = 1;
        }

        if (walkable) continue;
        const edgeRotations = block13WallEdgeRotations({
          up: Boolean(tiles[y - 1]?.[x]),
          right: Boolean(tiles[y]?.[x + 1]),
          down: Boolean(tiles[y + 1]?.[x]),
          left: Boolean(tiles[y]?.[x - 1]),
        });
        for (const rotation of edgeRotations) drawAsset('wall_edge', centerX, centerY, rotation);
      }
    }

    // Sparse authored fractures and impossible seams are coordinate-derived and stay off objectives.
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        const walkable = tiles[y][x];
        const asset = block13OverlayAssetAt(0, x, y, walkable);
        if (!asset) continue;
        if (asset === 'corruption_overlay') {
          if (importantTiles.has(`${x},${y}`)) continue;
          if (hub && Math.abs(x - hub[0]) <= 2 && Math.abs(y - hub[1]) <= 2) continue;
        }
        drawAsset(asset, x * this.tileSize + this.tileSize / 2, y * this.tileSize + this.tileSize / 2);
      }
    }

    // Thresholds decorate only the existing passage coordinates and remain visibly open.
    for (const [x, y] of this.floorData.doors) {
      if (!tiles[y]?.[x]) continue;
      const horizontal = Boolean(tiles[y]?.[x - 1] && tiles[y]?.[x + 1]);
      const vertical = Boolean(tiles[y - 1]?.[x] && tiles[y + 1]?.[x]);
      if (horizontal === vertical) continue;
      const centerX = x * this.tileSize + 16;
      const centerY = y * this.tileSize + 16;
      if (!drawAsset('threshold', centerX, centerY, horizontal ? 0 : Math.PI / 2)) {
        context.fillStyle = `#${profile.accent.toString(16).padStart(6, '0')}`;
        context.globalAlpha = 0.48;
        if (horizontal) {
          context.fillRect(x * this.tileSize + 13, y * this.tileSize + 3, 6, 2);
          context.fillRect(x * this.tileSize + 13, y * this.tileSize + 27, 6, 2);
        } else {
          context.fillRect(x * this.tileSize + 3, y * this.tileSize + 13, 2, 6);
          context.fillRect(x * this.tileSize + 27, y * this.tileSize + 13, 2, 6);
        }
        context.globalAlpha = 1;
      }
      if (block13HasOffsetThreshold(x, y)) {
        drawAsset('threshold_offset_echo', centerX, centerY, horizontal ? 0 : Math.PI / 2);
      }
    }

    // A larger, interrupted frame echoes only the real final exit coordinate.
    // Its transparent center leaves the existing stairs and floor readable.
    drawAsset('exit_echo_frame', this.floorData.exit[0] * this.tileSize + 16, this.floorData.exit[1] * this.tileSize + 16);

    if (hub) {
      const hubX = hub[0] * this.tileSize + 16;
      const hubY = hub[1] * this.tileSize + 16;
      if (!drawAsset('hub_medallion', hubX, hubY)) {
        const fallback = this.add.graphics().setDepth(1);
        this.drawBlock13Landmarks(fallback, hub);
      }
      for (const placement of block13HubRingPlacements()) {
        drawAsset(placement.asset, hubX + placement.xOffset, hubY + placement.yOffset, placement.rotation);
      }

      const branches = block13BranchPlacements(hub, [this.floorData.start, this.floorData.key, this.floorData.exit]);
      const placed = new Set<string>();
      for (const branch of branches) {
        const id = `${branch.x},${branch.y}`;
        if (placed.has(id) || !tiles[branch.y]?.[branch.x] || importantTiles.has(id)) continue;
        placed.add(id);
        drawAsset(branch.asset, branch.x * this.tileSize + 16, branch.y * this.tileSize + 16, branch.rotation);
      }
    }

    composed.refresh();
    composed.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.add.image(0, 0, BLOCK13_MAP_TEXTURE_KEY).setOrigin(0).setDepth(0);
    return true;
  }

  private getBlock13AssetSource(name: keyof typeof BLOCK13_ASSET_MANIFEST): CanvasImageSource | null {
    const asset = BLOCK13_ASSET_MANIFEST[name];
    if (!this.textures.exists(asset.key)) return null;
    const texture = this.textures.get(asset.key);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const source = texture.getSourceImage() as CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
    const width = source.naturalWidth || source.width;
    const height = source.naturalHeight || source.height;
    return width === asset.width && height === asset.height ? source : null;
  }

  private drawProceduralFloor(tiles: boolean[][]) {
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
          graphics.lineStyle(1, profile.grid, floor === 4 ? 0.12 : 0.18);
          graphics.strokeRect(posX, posY, this.tileSize, this.tileSize);
        } else {
          graphics.fillStyle(profile.wallBase, 1);
          graphics.fillRect(posX, posY, this.tileSize, this.tileSize);
          graphics.lineStyle(1, profile.grid, 0.54);
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

        this.drawArchitecturalMark(graphics, architecturalMarkAt(floor, x, y, walkable), posX, posY, profile);
      }
    }
    this.drawThresholdMarks(graphics, tiles, profile);
    if (floor === 0 && this.floorData.block13Hub) this.drawBlock13Landmarks(graphics, this.floorData.block13Hub);
  }

  private drawArchitecturalMark(
    graphics: Phaser.GameObjects.Graphics,
    mark: ReturnType<typeof architecturalMarkAt>,
    x: number,
    y: number,
    profile: ReturnType<typeof floorVisualProfile>,
  ) {
    switch (mark) {
      case 'orderly_seam':
        graphics.fillStyle(profile.grid, 0.52);
        graphics.fillRect(x + 4, y + 27, 24, 1);
        break;
      case 'clean_wall':
        graphics.fillStyle(profile.accent, 0.2);
        graphics.fillRect(x + 4, y + 3, 24, 1);
        graphics.fillStyle(0x080b10, 0.22);
        graphics.fillRect(x + 4, y + 28, 24, 2);
        break;
      case 'peel':
        graphics.fillStyle(profile.grime, 0.78);
        graphics.fillRect(x + 6, y + 7, 12, 2);
        graphics.fillRect(x + 8, y + 9, 8, 2);
        graphics.fillRect(x + 20, y + 18, 5, 2);
        graphics.fillStyle(profile.accent, 0.2);
        graphics.fillRect(x + 6, y + 6, 10, 1);
        break;
      case 'warning_repeat':
        graphics.fillStyle(profile.accent, 0.68);
        graphics.fillRect(x + 6, y + 8, 3, 12);
        graphics.fillRect(x + 14, y + 8, 3, 12);
        graphics.fillRect(x + 22, y + 8, 3, 12);
        graphics.fillStyle(profile.wallBase, 0.8);
        graphics.fillRect(x + 6, y + 11, 3, 3);
        graphics.fillRect(x + 14, y + 15, 3, 3);
        graphics.fillRect(x + 22, y + 11, 3, 3);
        break;
      case 'fracture':
        graphics.fillStyle(profile.corruption, 0.68);
        graphics.fillRect(x + 14, y + 3, 2, 6);
        graphics.fillRect(x + 10, y + 9, 6, 2);
        graphics.fillRect(x + 10, y + 11, 2, 7);
        graphics.fillRect(x + 10, y + 17, 9, 2);
        graphics.fillRect(x + 17, y + 17, 2, 9);
        graphics.fillRect(x + 17, y + 24, 8, 2);
        break;
      case 'paradox_wall':
        // Broken, offset wall lines imply impossible repetition without drawing an opening.
        graphics.fillStyle(profile.accent, 0.46);
        graphics.fillRect(x + 4, y + 5, 19, 2);
        graphics.fillRect(x + 21, y + 5, 2, 8);
        graphics.fillRect(x + 9, y + 12, 14, 2);
        graphics.fillRect(x + 9, y + 12, 2, 8);
        graphics.fillRect(x + 9, y + 19, 19, 2);
        graphics.fillRect(x + 26, y + 19, 2, 7);
        break;
      case null:
        break;
    }
  }

  private drawThresholdMarks(graphics: Phaser.GameObjects.Graphics, tiles: boolean[][], profile: ReturnType<typeof floorVisualProfile>) {
    const seen = new Set<string>();
    graphics.fillStyle(profile.accent, 0.48);
    for (const [tileX, tileY] of this.floorData.doors) {
      const id = `${tileX},${tileY}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const horizontal = Boolean(tiles[tileY]?.[tileX - 1] && tiles[tileY]?.[tileX + 1]);
      const vertical = Boolean(tiles[tileY - 1]?.[tileX] && tiles[tileY + 1]?.[tileX]);
      if (horizontal === vertical) continue;
      const x = tileX * this.tileSize, y = tileY * this.tileSize;
      if (horizontal) {
        graphics.fillRect(x + 13, y + 3, 6, 2);
        graphics.fillRect(x + 13, y + 27, 6, 2);
      } else {
        graphics.fillRect(x + 3, y + 13, 2, 6);
        graphics.fillRect(x + 27, y + 13, 2, 6);
      }
    }
  }

  /** Static floor markings establish a hub/branch/escape shape without map UI. */
  private drawBlock13Landmarks(graphics: Phaser.GameObjects.Graphics, hub: [number, number]) {
    const centerX = hub[0] * this.tileSize + this.tileSize / 2;
    const centerY = hub[1] * this.tileSize + this.tileSize / 2;
    const accent = floorVisualProfile(0).accent;
    this.drawPixelRing(graphics, centerX, centerY, 78, accent, 0.3);
    this.drawPixelRing(graphics, centerX, centerY, 52, 0xe0a5b0, 0.42);
    this.drawPixelRing(graphics, centerX, centerY, 26, accent, 0.5);
    graphics.fillStyle(0xe0a5b0, 0.48);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const inner = 84, outer = 112;
      this.drawPixelLine(graphics,
        centerX + Math.round(Math.cos(angle) * inner), centerY + Math.round(Math.sin(angle) * inner),
        centerX + Math.round(Math.cos(angle) * outer), centerY + Math.round(Math.sin(angle) * outer), 2);
    }

    const entryX = this.floorData.start[0] * this.tileSize + this.tileSize / 2;
    const entryY = this.floorData.start[1] * this.tileSize + this.tileSize / 2;
    graphics.fillStyle(0xe0a5b0, 0.44);
    graphics.fillRect(entryX - 20, entryY - 16, 3, 34);
    graphics.fillRect(entryX + 17, entryY - 16, 3, 34);
    graphics.fillRect(entryX - 20, entryY - 16, 40, 3);
  }

  private drawPixelRing(graphics: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number, color: number, alpha: number) {
    const thickness = 2;
    const chamfer = 8;
    graphics.fillStyle(color, alpha);
    graphics.fillRect(cx - radius + chamfer, cy - radius, radius * 2 - chamfer * 2, thickness);
    graphics.fillRect(cx - radius + chamfer, cy + radius - thickness, radius * 2 - chamfer * 2, thickness);
    graphics.fillRect(cx - radius, cy - radius + chamfer, thickness, radius * 2 - chamfer * 2);
    graphics.fillRect(cx + radius - thickness, cy - radius + chamfer, thickness, radius * 2 - chamfer * 2);
    for (let i = 0; i < chamfer; i += 2) {
      graphics.fillRect(cx - radius + i, cy - radius + chamfer - i, 2, 2);
      graphics.fillRect(cx + radius - chamfer + i, cy - radius + i, 2, 2);
      graphics.fillRect(cx - radius + i, cy + radius - chamfer + i, 2, 2);
      graphics.fillRect(cx + radius - chamfer + i, cy + radius - i, 2, 2);
    }
  }

  private drawPixelLine(graphics: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, size = 2) {
    let x = x0, y = y0;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    graphics.fillStyle(0xe0a5b0, 0.48);
    while (true) {
      graphics.fillRect(x - size / 2, y - size / 2, size, size);
      if (x === x1 && y === y1) break;
      const twiceError = 2 * error;
      if (twiceError >= dy) { error += dy; x += sx; }
      if (twiceError <= dx) { error += dx; y += sy; }
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
    const block13Pressure = isBlock13Floor(state.floor)
      ? (state.hasKey ? 0.035 : 0) + (state.stalker.state === 'hunting' ? 0.055 : 0)
      : 0;
    const pulse = isBlock13Floor(state.floor) && state.hasKey ? (Math.sin(state.tick * 0.045) + 1) * 0.012 : 0;
    const strength = Math.min(0.3, corruptionVisualStrength(state.floor, state.corruption.intensityPermille) + block13Pressure + pulse);
    if (!this.corruptionVignette) return;
    const profile = floorVisualProfile(state.floor);
    this.drawEdgeVignette(this.corruptionVignette, profile.corruption, Math.min(0.62, strength * 1.8));
  }

  private playBlock13Arrival() {
    const veil = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x140b19, 0.64)
      .setScrollFactor(0).setDepth(92);
    this.cameras.main.ignore(veil);
    const reveal = this.add.text(this.scale.width / 2, this.scale.height / 2, 'FLOOR 13\nRECOVER THE FINAL MEMORY', {
      fontFamily: 'monospace', fontSize: '23px', color: '#e5c7d2', align: 'center',
      backgroundColor: '#100d18', padding: { x: 14, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(93).setAlpha(0);
    this.cameras.main.ignore(reveal);
    this.tweens.add({ targets: reveal, alpha: 1, duration: 160, yoyo: true, hold: 720, onComplete: () => reveal.destroy() });
    this.tweens.add({ targets: veil, alpha: 0, duration: 520, ease: 'Sine.easeInOut', onComplete: () => veil.destroy() });
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

    this.generatePixelTexture('key', 20, 28, KEY_PIXEL_RECTS);

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
    this.keyLabel = this.add.text(posX, posY - 30, 'KEY', {
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

    this.generatePixelTexture('stairs_locked', 32, 32, STAIR_PIXEL_RECTS(false));
    this.generatePixelTexture('stairs_unlocked', 32, 32, STAIR_PIXEL_RECTS(true));

    const stairsSprite = this.add.sprite(posX, posY, 'stairs_locked');
    stairsSprite.setDepth(5);
    this.stairsHalo = this.createInteractableHalo(posX, posY, 0x8faeae, 28);

    // Add label
    const block13Exit = isBlock13Floor(this.authoritativeSimulation.state.floor);
    this.stairsLabel = this.add.text(posX, posY - 30, block13Exit ? 'EXIT' : 'STAIRS', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: block13Exit ? '#c07883' : '#ff4444',
      backgroundColor: '#000000',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5).setName('stairsLabel');

    return stairsSprite;
  }

  private createPlayer(x: number, y: number): Phaser.GameObjects.Sprite {
    const posX = x * this.tileSize + this.tileSize / 2;
    const posY = y * this.tileSize + this.tileSize / 2;

    this.generatePixelTexture('player', 20, 28, PLAYER_PIXEL_RECTS);

    const state = this.authoritativeSimulation.state;
    const authoredTexture = playerTextureKeyForFacing(state.facingX, state.facingY);
    const textureKey = this.textures.exists(authoredTexture) ? authoredTexture : 'player';
    if (textureKey !== 'player') this.markTextureNearest(textureKey);

    const player = this.add.sprite(posX, posY, textureKey);
    player.setDepth(10);
    player.setOrigin(0.5, 0.5);
    if (textureKey === 'player') player.setRotation(Math.atan2(state.facingY, state.facingX) + Math.PI / 2);

    return player;
  }

  private updatePlayerPresentationFacing(previous: AuthoritativeState, state: AuthoritativeState) {
    if (state.facingX !== 0 || state.facingY !== 0) this.playerFacingAngle = Math.atan2(state.facingY, state.facingX);

    const moving = playerMovedBetween(previous, state);
    if (moving !== this.playerIsMoving) this.playerWalkAnimationElapsedMs = 0;
    this.playerIsMoving = moving;

    const textureKey = playerTextureKeyForPresentation(
      state.facingX,
      state.facingY,
      moving,
      this.playerWalkAnimationElapsedMs,
      key => this.textures.exists(key),
    );
    if (textureKey !== 'player') {
      if (this.player.texture.key !== textureKey) {
        this.markTextureNearest(textureKey);
        this.player.setTexture(textureKey);
      }
      this.player.setRotation(0);
      return;
    }

    if (this.player.texture.key !== 'player') this.player.setTexture('player');
    this.player.setRotation(this.playerFacingAngle + Math.PI / 2);
  }

  private completeFloor(previous: AuthoritativeState, current: AuthoritativeState) {
    this.clearFinalChaseAmbience();
    this.clearAmbusherJumpscare();
    this.clearContainerScare();
    this.clearHauntingPresentation();
    this.isTransitioning = true; // Block scares and damage during transition

    // Schedule the renderer restart before optional presentation work. The sim
    // already owns the next floor; this timer only swaps what the scene renders.
    this.time.delayedCall(2800, () => this.scene.restart({ runState: this.runState }));
    this.audioDirector?.fadeOutCategory('music', 850);
    this.audioDirector?.fadeOutCategory('ambience', 850);

    // The simulation has already advanced. Optional audio cannot stop the next floor.
    try { this.audioDirector?.playWithCooldown(AUDIO_KEYS.interaction.floorTransition, 'sfx', 1500, { volume: 0.6 }); } catch { /* optional audio */ }

    // Disable player movemen
    this.input.keyboard?.enabled && (this.input.keyboard.enabled = false);

    // Show completion message with stats
    const floorName = playerBlockName(previous.floor);
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

    const fakeoutBeats = blockTransitionBeats(previous.floor, current.floor);
    if (fakeoutBeats.length > 0) {
      const veil = this.add.rectangle(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2,
        this.cameras.main.width,
        this.cameras.main.height,
        0x020304,
        0.94,
      ).setScrollFactor(0).setDepth(199);
      this.cameras.main.ignore(veil);
      completionText.setDepth(200).setAlpha(1);
      fakeoutBeats.forEach((beat, index) => {
        this.time.delayedCall(index * 360, () => {
          if (!completionText.active) return;
          completionText.setText(beat.text);
          completionText.setColor(beat.glitch ? '#d17a9c' : '#70d4c6');
          if (beat.glitch) {
            completionText.setScale(1.04);
            this.time.delayedCall(55, () => completionText.active && completionText.setScale(1));
          }
        });
      });
    }

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

    if (fakeoutBeats.length > 0) scoreText.setVisible(false);

    try {
      this.tweens.add({ targets: [completionText, scoreText], alpha: 1, duration: 300 });
    } catch { /* presentation failure cannot hold floor progression */ }
  }

  private startFloorMusic(track: FloorMusicTrack, fadeMs: number) {
    if (!this.audioDirector) return;
    // Stop any prior floor/preview loop before creating a single replacement.
    this.audioDirector.stopCategory('music');
    if (this.audioDirector.play(track.key, 'music', { loop: true, volume: track.gain })) {
      this.audioDirector.fadeInCategory('music', fadeMs);
    }
  }

  /** Local development-only listening controls; excluded from production builds. */
  private bindDevelopmentAudioPreview() {
    this.audioPreviewKeyHandler = (event: KeyboardEvent) => {
      const cueByKey: Readonly<Record<string, { key: string; volume: number }>> = {
        F1: { key: 'sfx_ambusher_warning', volume: 0.28 },
        F2: { key: 'sfx_stalker_presence', volume: 0.38 },
        F3: { key: 'sfx_stalker_hunt', volume: 0.34 },
        F4: { key: 'sfx_watcher_presence', volume: 0.32 },
        F5: { key: 'sfx_watcher_gaze', volume: 0.22 },
        F12: { key: 'sfx_mimic_reveal', volume: 0.35 },
      };
      const cue = cueByKey[event.code];
      if (cue) {
        event.preventDefault();
        const reducedScale = event.code === 'F1' && this.audioDirector.getSettings().reduceJumpscareIntensity ? 0.56 : 1;
        const offset = this.tileSize * 4;
        this.audioDirector.playPositionalWithCooldown({
          key: cue.key,
          x: this.player.x + offset,
          y: this.player.y,
          maxDistance: cue.key === 'sfx_stalker_hunt' ? 520 : 420,
          category: 'sfx',
          volume: cue.volume * reducedScale,
        }, this.player.x, this.player.y, 500);
      } else if (event.code === 'F11') {
        event.preventDefault();
        this.audioDirector.playPositionalVariantWithCooldown('sfx_crawler_skitter', 2, {
          x: this.player.x + this.tileSize * 4,
          y: this.player.y,
          maxDistance: 420,
          category: 'sfx',
          volume: 0.42,
        }, this.player.x, this.player.y, 500);
      } else if (event.code === 'F6') {
        event.preventDefault();
        this.audioPreviewIndex = (this.audioPreviewIndex + 1) % FLOOR_MUSIC_PREVIEW.length;
        this.startFloorMusic(FLOOR_MUSIC_PREVIEW[this.audioPreviewIndex], 180);
      } else if (event.code === 'F7') {
        event.preventDefault();
        this.startAmbusherJumpscare(0, this.authoritativeSimulation.state.tick);
      } else if (event.code === 'F10') {
        event.preventDefault();
        this.audioDirector.stop('sfx_jumpscare_hit');
        playAmbusherImpact(this.audioDirector, this.audioDirector.getSettings().reduceJumpscareIntensity);
      } else if (event.code === 'F9') {
        event.preventDefault();
        this.audioDirector.stop('sfx_ambusher_impact');
        this.audioDirector.stop('sfx_jumpscare_hit');
        const reduced = this.audioDirector.getSettings().reduceJumpscareIntensity;
        this.audioDirector.playWithCooldown('sfx_jumpscare_hit', 'sfx', 0, { volume: reduced ? 0.46 : 0.82 });
      }
    };
    this.input.keyboard?.on('keydown', this.audioPreviewKeyHandler);
  }

  private beginVictoryEpilogue() {
    this.clearFinalChaseAmbience();
    this.clearAmbusherJumpscare();
    this.clearHauntingPresentation();
    this.clearContainerScare();
    if (this.endingEpilogueOpen || !shouldBeginVictoryEpilogue(this.authoritativeSimulation.state.status)) return;
    this.endingEpilogueOpen = true;
    this.endingEpilogueIndex = 0;
    this.endingAdvanceGate.release();
    try { this.audioDirector.fadeOutCategory('ambience', 800); }
    catch { this.audioDirector.stopCategory('ambience'); }
    this.playEscapeRelease();

    const { width, height } = this.cameras.main;
    const exterior = this.drawEndingExterior(width, height).setScrollFactor(0).setDepth(498).setAlpha(0);
    let exteriorPlayer: Phaser.GameObjects.Sprite | undefined;
    if (exterior instanceof Phaser.GameObjects.Image) {
      const playerTexture = this.textures.exists('player_idle_left') ? 'player_idle_left' : 'player';
      if (playerTexture !== 'player') this.markTextureNearest(playerTexture);
      exteriorPlayer = this.add.sprite(width * 0.73, height * 0.82 - 21, playerTexture)
        .setOrigin(0.5, 0.5).setScale(1.2).setScrollFactor(0).setDepth(499).setAlpha(0);
      this.endingExteriorPlayer = exteriorPlayer;
    }
    const veil = this.add.rectangle(width / 2, height / 2, width, height, 0x020407, 0)
      .setScrollFactor(0).setDepth(500).setInteractive();
    const text = this.add.text(width / 2, height / 2 - 14, '', {
      fontFamily: 'monospace', fontSize: '22px', color: '#d9e3df', align: 'center',
      wordWrap: { width: Math.min(650, width - 48), useAdvancedWrap: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(501).setAlpha(0);
    const hint = this.add.text(width / 2, height * 0.79, '[SPACE / ENTER / CLICK] CONTINUE  ·  [ESC] SKIP', {
      fontFamily: 'monospace', fontSize: '11px', color: '#82908e', letterSpacing: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(502);
    this.endingExterior = exterior;
    this.endingEpilogueVeil = veil;
    this.endingEpilogueText = text;
    this.endingEpilogueElements = [exterior, ...(exteriorPlayer ? [exteriorPlayer] : []), veil, text, hint];
    this.cameras.main.ignore(this.endingEpilogueElements);
    veil.on('pointerdown', () => this.advanceVictoryEpilogue());

    this.endingKeyDownHandler = (event: KeyboardEvent) => {
      if (!this.endingEpilogueOpen || (event.key !== ' ' && event.key !== 'Enter')) return;
      event.preventDefault();
      if (this.endingAdvanceGate.press(event.repeat)) this.advanceVictoryEpilogue();
    };
    this.endingKeyUpHandler = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') this.endingAdvanceGate.release();
    };
    this.input.keyboard?.on('keydown', this.endingKeyDownHandler);
    this.input.keyboard?.on('keyup', this.endingKeyUpHandler);
    this.tweens.add({ targets: veil, alpha: 1, duration: 650, ease: 'Sine.easeInOut' });
    this.showVictoryEpilogueBeat();
  }

  private drawEndingExterior(width: number, height: number): Phaser.GameObjects.Graphics | Phaser.GameObjects.Image {
    const asset = NARRATIVE_ASSET_MANIFEST.victory_exterior_bg;
    if (this.textures.exists(asset.key)) {
      const texture = this.textures.get(asset.key);
      const source = texture.getSourceImage() as CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
      const sourceWidth = source.naturalWidth || source.width;
      const sourceHeight = source.naturalHeight || source.height;
      if (sourceWidth === asset.width && sourceHeight === asset.height) {
        this.markTextureNearest(asset.key);
        const scale = victoryExteriorScale(width, height);
        return this.add.image(0, 0, asset.key).setOrigin(0, 0).setScale(scale.x, scale.y);
      }
    }

    const graphics = this.add.graphics();
    graphics.fillStyle(0x07111b, 1);
    graphics.fillRect(0, 0, width, height);

    // Fixed coordinate-derived stars and a quiet moon; no RNG is used.
    graphics.fillStyle(0x9ba9a8, 0.38);
    for (let i = 0; i < 22; i++) {
      const x = (i * 79 + 31) % Math.max(1, width);
      const y = (i * 43 + 17) % Math.max(1, Math.floor(height * 0.46));
      graphics.fillRect(x, y, i % 5 === 0 ? 2 : 1, 1);
    }
    graphics.fillStyle(0xb7c5c0, 0.38);
    graphics.fillCircle(width * 0.79, height * 0.2, Math.min(17, width * 0.025));

    const buildingX = width * 0.17;
    const buildingY = height * 0.25;
    const buildingWidth = width * 0.44;
    const buildingHeight = height * 0.58;
    graphics.fillStyle(0x101820, 1);
    graphics.fillRect(buildingX, buildingY, buildingWidth, buildingHeight);
    graphics.fillStyle(0x1b252b, 1);
    graphics.fillRect(buildingX - 5, buildingY - 7, buildingWidth + 10, 8);
    graphics.fillStyle(0x151e24, 0.88);
    const columns = 5;
    const rows = 5;
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const wx = buildingX + 14 + column * ((buildingWidth - 32) / columns);
        const wy = buildingY + 18 + row * ((buildingHeight - 40) / rows);
        graphics.fillRect(wx, wy, 15, 21);
      }
    }
    graphics.fillStyle(0x0b1117, 1);
    graphics.fillRect(0, height * 0.83, width, height * 0.17);
    graphics.fillStyle(0x263034, 0.9);
    graphics.fillRect(0, height * 0.82, width, 2);

    // Small still silhouette outside the building, facing back toward it.
    const playerX = width * 0.73;
    const groundY = height * 0.82;
    graphics.fillStyle(0x05090d, 1);
    graphics.fillEllipse(playerX, groundY + 2, 25, 6);
    graphics.fillRect(playerX - 6, groundY - 31, 12, 25);
    graphics.fillCircle(playerX, groundY - 37, 6);
    graphics.fillRect(playerX - 9, groundY - 27, 4, 17);
    graphics.fillRect(playerX + 5, groundY - 27, 4, 17);
    return graphics;
  }

  private showVictoryEpilogueBeat() {
    if (!this.endingEpilogueOpen || !this.endingEpilogueText) return;
    const beat = VICTORY_EPILOGUE[this.endingEpilogueIndex];
    const veil = this.endingEpilogueVeil;
    const exterior = this.endingExterior;
    if (beat.visual === 'outside') {
      this.tweens.add({ targets: exterior, alpha: 1, duration: 900, ease: 'Sine.easeInOut' });
      if (this.endingExteriorPlayer) this.tweens.add({ targets: this.endingExteriorPlayer, alpha: 1, duration: 900, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: veil, alpha: 0.24, duration: 900, ease: 'Sine.easeInOut' });
    } else if (beat.visual === 'look-back') {
      this.tweens.add({ targets: veil, alpha: 0.68, duration: 700, ease: 'Sine.easeInOut' });
    } else if (beat.visual === 'blackout') {
      this.tweens.add({ targets: veil, alpha: 1, duration: beat.durationMs, ease: 'Sine.easeInOut' });
    }
    this.tweens.killTweensOf(this.endingEpilogueText);
    this.endingEpilogueText.setText(beat.text).setAlpha(0);
    if (beat.text) this.tweens.add({ targets: this.endingEpilogueText, alpha: 1, duration: 380, ease: 'Sine.easeOut' });
    this.endingEpilogueTimer?.remove(false);
    this.endingEpilogueTimer = this.time.delayedCall(beat.durationMs, () => this.advanceVictoryEpilogue());
  }

  private advanceVictoryEpilogue() {
    if (!this.endingEpilogueOpen) return;
    const nextIndex = nextEpilogueBeat(this.endingEpilogueIndex);
    if (nextIndex < 0) {
      this.finishVictoryEpilogue();
      return;
    }
    this.endingEpilogueIndex = nextIndex;
    this.showVictoryEpilogueBeat();
  }

  private finishVictoryEpilogue() {
    if (!this.endingEpilogueOpen) return;
    this.endingEpilogueOpen = false;
    this.endingEpilogueTimer?.remove(false);
    this.endingEpilogueTimer = undefined;
    if (this.endingEpilogueVeil) this.tweens.killTweensOf(this.endingEpilogueVeil);
    if (this.endingExterior) this.tweens.killTweensOf(this.endingExterior);
    if (this.endingExteriorPlayer) this.tweens.killTweensOf(this.endingExteriorPlayer);
    if (this.endingEpilogueText) this.tweens.killTweensOf(this.endingEpilogueText);
    this.endingEpilogueText?.setText('');
    this.endingEpilogueVeil?.setAlpha(1);
    this.endingAdvanceGate.release();
    if (this.endingKeyDownHandler) this.input.keyboard?.off('keydown', this.endingKeyDownHandler);
    if (this.endingKeyUpHandler) this.input.keyboard?.off('keyup', this.endingKeyUpHandler);
    this.endingKeyDownHandler = undefined;
    this.endingKeyUpHandler = undefined;
    this.registry.set('victoryEpilogueComplete', true);
  }

  private showVictoryScreen(finalState: RunState) {
    // Retained for compatibility with the old Phaser result presentation; the
    // application result/TX2 flow now takes focus after the epilogue handoff.
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
    const titleShadow = this.add.text(width / 2 + 2, height / 2 - 140 + 2, 'OUTSIDE — YOU MADE IT', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#000000',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(298);

    const title = this.add.text(width / 2, height / 2 - 140, 'OUTSIDE — YOU MADE IT', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#70d4c6',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(299);

    const subtitle = this.add.text(width / 2, height / 2 - 95, 'YOU SURVIVED FLOOR 13', {
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
      `BLOCKS CLEARED: ${finalState.floorsCompleted}`,
    ].join('\n'), {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#d9f3ea',
      align: 'center',
      lineSpacing: 10,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(299);

    // Button containers
    const retryBg = this.add.rectangle(
      width / 2,
      height / 2 + 95,
      140,
      42,
      0x0a2a28,
      1
    ).setScrollFactor(0).setDepth(298);

    const retryBorder = this.add.rectangle(
      width / 2,
      height / 2 + 95,
      140,
      42
    ).setScrollFactor(0).setDepth(298).setStrokeStyle(2, 0x70d4c6, 1);

    // Retry button
    const retryButton = this.add.text(width / 2, height / 2 + 95, '[ NEW RUN ]', {
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

    // Make main camera ignore these UI elements
    this.cameras.main.ignore([
      overlay, shadow, panel, borderOuter, borderInner, headerBar,
      titleShadow, title, subtitle, divider, stats,
      retryBg, retryBorder, retryButton
    ]);
  }

  // ====== SEARCHABLE OBJECTS ======

  private searchableTextureName(searchable: Searchable, open = false): string {
    if (searchable.objectType === 'maintenance_lockbox') {
      const authored = ORDINARY_ENVIRONMENT_ASSET_MANIFEST[open ? 'container_lockbox_open' : 'container_lockbox_closed'].key;
      return this.textures.exists(authored) ? authored : open ? 'searchable_maintenance_lockbox_open' : 'searchable_maintenance_lockbox';
    }
    const proceduralFallback = searchable.isMimic
      ? `mimic_${searchable.x}_${searchable.y}`
      : `searchable_${searchable.objectType}`;
    if (searchable.isMimic) {
      return mimicTextureKey(false, key => this.textures.exists(key), proceduralFallback);
    }
    return resolveOrdinaryContainerTexture(
      this.authoritativeSimulation.state.floor,
      searchable.objectType,
      name => this.textures.exists(ORDINARY_ENVIRONMENT_ASSET_MANIFEST[name].key),
      open ? `${proceduralFallback}_open` : proceduralFallback,
      searchable.x,
      searchable.y,
      open,
    );
  }

  private createSearchables(searchables: Searchable[]) {
    this.createRevealedMimicTexture();
    searchables.forEach((searchable, index) => {
      const sprite = this.createSearchableSprite(searchable, index);
      if (!searchable.isMimic && !this.textures.exists(this.searchableTextureName(searchable, true))) {
        this.createOpenContainerFallbackTexture(searchable);
      }
      const accent = searchable.objectType === 'maintenance_lockbox'
        ? 0x8d6548
        : searchable.objectiveStep !== undefined ? 0xc69bc9 : floorVisualProfile(this.authoritativeSimulation.state.floor).accent;
      const isBlock2Evidence = this.authoritativeSimulation.state.floor === 2 && searchable.objectiveStep !== undefined;
      const halo = this.createInteractableHalo(sprite.x, sprite.y, isBlock2Evidence ? 0xf0c86d : accent, isBlock2Evidence ? 30 : 22);
      if (isBlock2Evidence) halo.setStrokeStyle(3, 0xffdc88, 0.96).setFillStyle(0xe6b953, 0.16);
      const evidenceLabel = isBlock2Evidence
        ? this.add.text(sprite.x, sprite.y - 18, 'PUZZLE EVIDENCE', {
          fontFamily: 'monospace', fontSize: '8px', color: '#ffe3a0',
          backgroundColor: 'rgba(18, 21, 23, 0.94)', padding: { x: 3, y: 2 },
        }).setOrigin(0.5, 1).setDepth(51).setVisible(false)
        : undefined;
      this.searchableSprites.push({
        sprite,
        halo,
        evidenceLabel,
        data: searchable,
        searched: false,
      });
    });
  }

  /** A visible open-state fallback for missing optional production art. */
  private createOpenContainerFallbackTexture(searchable: Searchable) {
    const key = searchable.objectType === 'maintenance_lockbox'
      ? 'searchable_maintenance_lockbox_open'
      : `searchable_${searchable.objectType}_open`;
    if (this.textures.exists(key)) return;
    const graphics = this.add.graphics();
    const shell = searchable.objectType === 'maintenance_lockbox' ? 0x51463d
      : searchable.objectType === 'box' ? 0x755c45
        : searchable.objectType === 'locker' ? 0x47574e
          : 0x555057;
    graphics.fillStyle(0x17171a, 1);
    graphics.fillRect(-10, -8, 20, 16);
    graphics.fillStyle(shell, 1);
    graphics.fillRect(-9, -8, 18, 7);
    graphics.fillRect(-9, 4, 18, 4);
    graphics.fillStyle(0x08090c, 1);
    graphics.fillRect(-7, 0, 14, 5);
    graphics.lineStyle(1, searchable.objectType === 'maintenance_lockbox' ? 0x987047 : 0x91877a, 1);
    graphics.lineBetween(-9, -1, 9, -1);
    graphics.fillStyle(searchable.objectType === 'maintenance_lockbox' ? 0x987047 : 0xaaa08f, 1);
    graphics.fillRect(-2, 5, 4, 2);
    graphics.generateTexture(key, 24, 24);
    graphics.destroy();
    this.markTextureNearest(key);
  }

  private createRevealedMimicTexture() {
    if (this.textures.exists('mimic_revealed')) {
      this.markTextureNearest('mimic_revealed');
      return;
    }
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
    this.markTextureNearest('mimic_revealed');
  }

  private createSearchableSprite(searchable: Searchable, searchableIndex: number): Phaser.GameObjects.Sprite {
    const posX = searchable.x * this.tileSize + this.tileSize / 2;
    const posY = searchable.y * this.tileSize + this.tileSize / 2;

    // Create texture based on object type
    const textureName = this.searchableTextureName(searchable);

    // Keep a per-searchable generated disguise available even when authored
    // Mimic art is loaded, so a missing-file fallback is always ready.
    const mimicFallback = `mimic_${searchable.x}_${searchable.y}`;
    if (searchable.isMimic && textureName !== mimicFallback && !this.textures.exists(mimicFallback)) {
      const graphics = this.add.graphics();
      graphics.fillStyle(0x6e665c, 1);
      graphics.fillRect(-8, -8, 16, 16);
      graphics.lineStyle(2, 0x998f85, 1);
      graphics.strokeRect(-8, -8, 16, 16);
      graphics.lineStyle(2, 0xccc3b9, 1);
      graphics.lineBetween(-8, -3, 8, 3);
      graphics.generateTexture(mimicFallback, 24, 24);
      graphics.destroy();
    }

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

          case 'maintenance_lockbox': {
            // Temporary authored-style procedural fallback; restrained and
            // readable only at close range under the existing lightmap.
            const floor = this.authoritativeSimulation.state.floor;
            const shell = floor <= 1 ? 0x302b31 : floor === 2 ? 0x373536 : 0x403d3b;
            graphics.fillStyle(0x19191c, 1);
            graphics.fillRect(-10, -7, 20, 15);
            graphics.fillStyle(shell, 1);
            graphics.fillRect(-9, -7, 18, 13);
            graphics.lineStyle(1, 0x625b56, 1);
            graphics.strokeRect(-9, -7, 18, 13);
            graphics.fillStyle(floor <= 1 ? 0x80523e : 0x987047, 1);
            graphics.fillRect(-7, -4, 14, 2);
            graphics.fillStyle(0x8b8274, 1);
            graphics.fillRect(-2, 1, 4, 3);
            graphics.fillStyle(0x1a1918, 1);
            graphics.fillRect(-1, 2, 2, 1);
            graphics.fillStyle(0x55463d, 1);
            graphics.fillRect(-7, 4, 2, 1);
            graphics.fillRect(5, -6, 2, 1);
            break;
          }
        }
      }

      graphics.generateTexture(textureName, 24, 24);
      graphics.destroy();
    }
    if (textureName.startsWith('env_') || textureName === 'mimic_disguise' || textureName === 'searchable_maintenance_lockbox') this.markTextureNearest(textureName);

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
    this.clearFinalChaseAmbience();
    this.clearHauntingPresentation();
    this.clearAmbusherJumpscare();
    this.clearContainerScare();
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
      this.markTextureNearest(`crawler_${crawler.id}`);

      const textureKey = crawlerTextureKeyForPresentation(false, 0, key => this.textures.exists(key), `crawler_${crawler.id}`);
      if (textureKey !== `crawler_${crawler.id}`) this.markTextureNearest(textureKey);
      const sprite = this.add.sprite(crawler.x / FIXED_SCALE, crawler.y / FIXED_SCALE, textureKey).setOrigin(0.5, 0.5);
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
      this.markTextureNearest(`watcher_${watcher.id}`);

      const textureKey = watcherTextureKey(key => this.textures.exists(key), `watcher_${watcher.id}`);
      if (textureKey !== `watcher_${watcher.id}`) this.markTextureNearest(textureKey);
      const sprite = this.add.sprite(watcher.x / FIXED_SCALE, watcher.y / FIXED_SCALE, textureKey).setOrigin(0.5, 0.5);
      sprite.setDepth(8);
      const exposure = enemyPresentationExposure(this.floorData, state, watcher.x, watcher.y);
      sprite.setAlpha(watcher.active ? exposure * 0.76 : 0);
      this.watcherSprites.push(sprite);

      // Two crisp two-pixel glints only appear while this Watcher is actually
      // contributing curse, making the gaze readable without a screen effect.
      const eyes = this.add.graphics();
      eyes.fillStyle(0x8f748d, 0.9);
      eyes.fillRect(-5, -9, 2, 2);
      eyes.fillRect(3, -9, 2, 2);
      eyes.fillStyle(0xd3a7bb, 0.9);
      eyes.fillRect(-5, -9, 1, 1);
      eyes.fillRect(3, -9, 1, 1);
      eyes.setPosition(watcher.x / FIXED_SCALE, watcher.y / FIXED_SCALE).setDepth(8.1).setVisible(false);
      this.watcherEyeGlints.push(eyes);
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
      this.markTextureNearest(`ambusher_${ambusher.id}`);

      const textureKey = ambusherTextureKey(key => this.textures.exists(key), `ambusher_${ambusher.id}`);
      if (textureKey !== `ambusher_${ambusher.id}`) this.markTextureNearest(textureKey);
      const sprite = this.add.sprite(ambusher.x / FIXED_SCALE, ambusher.y / FIXED_SCALE, textureKey).setOrigin(0.5, 0.5);
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
    this.stalkerVisualFacing = 'down';
    this.stalkerIsMoving = false;
    this.stalkerWalkAnimationElapsedMs = 0;
    this.generatePixelTexture('stalker', 32, 52, STALKER_PIXEL_RECTS);

    const stalker = this.authoritativeSimulation.state.stalker;
    const texture = stalkerTextureKeyForFacing(this.stalkerVisualFacing, key => this.textures.exists(key));
    if (texture !== 'stalker') this.markTextureNearest(texture);
    this.stalkerSprite = this.add.sprite(stalker.x / FIXED_SCALE, stalker.y / FIXED_SCALE, texture);
    this.stalkerSprite.setOrigin(0.5, 0.5);
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
      `BLOCKS CLEARED: ${this.runState.floorsCompleted}`,
    ].join('\n'), {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#cccccc',
      align: 'center',
      lineSpacing: 10,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(299);

    // Button container backgrounds
    const retryBg = this.add.rectangle(
      width / 2,
      height / 2 + 95,
      140,
      42,
      0x2a0a0a,
      1
    ).setScrollFactor(0).setDepth(298);

    const retryBorder = this.add.rectangle(
      width / 2,
      height / 2 + 95,
      140,
      42
    ).setScrollFactor(0).setDepth(298).setStrokeStyle(2, 0xff4444, 1);

    // Retry button
    const retryButton = this.add.text(width / 2, height / 2 + 95, '[ NEW RUN ]', {
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

    // Make main camera ignore these UI elements
    this.cameras.main.ignore([
      overlay, shadow, panel, borderOuter, borderInner, headerBar,
      titleShadow, title, subtitle, divider, stats,
      retryBg, retryBorder, retryButton
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
    this.temporaryMessageQueue = [];
    this.temporaryMessageObject?.destroy();
    this.temporaryMessageObject = undefined;
    this.temporaryMessageActive = false;
    this.clearFinalChaseAmbience();
    this.clearAmbusherJumpscare();
    this.clearHauntingPresentation();
    this.clearContainerScare();
    if (this.audioPreviewKeyHandler) this.input.keyboard?.off('keydown', this.audioPreviewKeyHandler);
    this.audioPreviewKeyHandler = undefined;
    if (this.hauntingDebugKeyHandler) this.input.keyboard?.off('keydown', this.hauntingDebugKeyHandler);
    this.hauntingDebugKeyHandler = undefined;
    if (this.block3VisualKeyHandler) this.input.keyboard?.off('keydown', this.block3VisualKeyHandler);
    this.block3VisualKeyHandler = undefined;
    // Clean up event listeners to prevent memory leaks
    if (this.pauseKey) {
      this.pauseKey.removeAllListeners();
    }
    this.storyCloseKey?.removeAllListeners();
    this.openingAdvanceKey?.removeAllListeners();
    this.closeOpeningStory();
    this.closeNotebook();
    this.closeStoryPopup?.();
    this.notebookToggleKey?.removeAllListeners();
    this.puzzleHintKey?.removeAllListeners();
    this.notebookToggleKey = undefined;
    this.puzzleHintKey = undefined;
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
    if (this.textures.exists(BLOCK13_MAP_TEXTURE_KEY)) {
      this.textures.remove(BLOCK13_MAP_TEXTURE_KEY);
    }
    this.ordinaryEnvironmentImage?.destroy();
    this.ordinaryEnvironmentImage = undefined;
    this.flickeringLampFixtures.forEach(fixture => fixture.destroy());
    this.flickeringLampFixtures = [];
    this.flickeringLampPositions = [];
    this.lastLampJumpscareTick = Number.NEGATIVE_INFINITY;
    if (this.textures.exists('ordinary_composed_environment')) {
      this.textures.remove('ordinary_composed_environment');
    }

    this.crawlerSprites = [];
    this.watcherSprites = [];
    this.watcherEyeGlints = [];
    this.ambusherSprites = [];
    this.mimicRevealElapsedMs.clear();

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
