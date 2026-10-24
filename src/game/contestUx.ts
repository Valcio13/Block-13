import { BLOCK_13_FLOOR, isBlock13Floor, isOutsideFloor, START_FLOOR } from '../core/progression';

/** Player-facing floor labels; internal progression IDs stay unchanged. */
export function playerBlockName(floor: number): string {
  if (isOutsideFloor(floor)) return 'OUTSIDE';
  if (isBlock13Floor(floor)) return 'FLOOR 13';
  if (Number.isInteger(floor) && floor >= 1 && floor <= START_FLOOR) return `FLOOR ${floor}`;
  throw new RangeError(`invalid progression floor: ${floor}`);
}

export const OPENING_STORY_LINES = [
  'The building was removed from the official property records.',
  'No demolition record. No public photographs. No explanation.',
  'Then a message arrived from an unknown number.',
  '“Fourth floor. You need to see this.”',
  'You came to find out why.',
] as const;

/** Returns the next line index, or -1 when the player skips/completes the story. */
export function nextOpeningStoryIndex(index: number, skip = false): number {
  if (!Number.isInteger(index) || index < 0 || index >= OPENING_STORY_LINES.length) {
    throw new RangeError(`invalid opening story index: ${index}`);
  }
  return skip || index === OPENING_STORY_LINES.length - 1 ? -1 : index + 1;
}

export type BlockTransitionBeat = { text: string; glitch?: boolean };

/** Presentation-only fiction layered over the already-authoritative transition. */
export function blockTransitionBeats(fromFloor: number, toFloor: number): BlockTransitionBeat[] {
  if (fromFloor === 4 && toFloor === 3) {
    return [
      { text: 'FLOOR 4' },
      { text: 'THE STAIRWELL IS COLDER.' },
      { text: 'THE DOOR SHUTS BEHIND YOU.' },
      { text: 'THE LIGHTS GO OUT.', glitch: true },
      { text: 'FLOOR 3' },
    ];
  }
  if (fromFloor === 1 && toFloor === BLOCK_13_FLOOR) {
    return [
      { text: 'FLOOR 1' },
      { text: 'GROUND FLOOR' },
      { text: '…' },
      { text: 'ROUTE NOT FOUND', glitch: true },
      { text: '…' },
      { text: 'FLOOR 13' },
      { text: 'THIS FLOOR DOES NOT EXIST.' },
    ];
  }
  return [];
}

export interface EpilogueBeat {
  text: string;
  durationMs: number;
  visual?: 'outside' | 'look-back' | 'blackout';
}

export const VICTORY_EPILOGUE: readonly EpilogueBeat[] = [
  { text: 'You push through the final door.', durationMs: 1200 },
  { text: 'For the first time tonight...', durationMs: 1500 },
  { text: 'everything is quiet.', durationMs: 2000 },
  { text: '', durationMs: 1000 },
  { text: '12:13 AM', durationMs: 1000 },
  { text: 'Cold air fills your lungs.', durationMs: 1200, visual: 'outside' },
  { text: "You're outside.", durationMs: 2200 },
  { text: '', durationMs: 1200 },
  { text: 'OFFICIAL PROPERTY RECORD', durationMs: 1100 },
  { text: 'REGISTERED FLOORS: 4', durationMs: 1100 },
  { text: 'RECORDED FATALITIES: 0', durationMs: 1100 },
  { text: 'INCIDENT REPORT: NONE', durationMs: 1100 },
  { text: '', durationMs: 1200 },
  { text: 'But you remember the hallway.', durationMs: 1200 },
  { text: 'The thing that followed you.', durationMs: 1200 },
  { text: 'The door marked 13.', durationMs: 1500 },
  { text: 'You look back.', durationMs: 2600, visual: 'look-back' },
  { text: '', durationMs: 1200 },
  { text: '', durationMs: 800, visual: 'blackout' },
  { text: 'There is no Floor 13.', durationMs: 3000 },
  { text: 'FLOOR 13: THE BUILDING THAT NEVER EXISTED', durationMs: 2200 },
  { text: 'They erased the people. Not what happened to them.', durationMs: 2400 },
  { text: '', durationMs: 1000 },
];

export const VICTORY_EPILOGUE_DURATION_MS = VICTORY_EPILOGUE.reduce((total, beat) => total + beat.durationMs, 0);

export function shouldBeginVictoryEpilogue(outcome: string): boolean {
  return outcome === 'won';
}

/** Losses go straight to the result screen; wins wait until the epilogue ends. */
export function resultHandoffReady(outcome: string, epilogueComplete: boolean): boolean {
  return outcome === 'lost' || (outcome === 'won' && epilogueComplete);
}

/** Returns the next beat index, or -1 when skipped/completed. */
export function nextEpilogueBeat(index: number, skip = false): number {
  if (!Number.isInteger(index) || index < 0 || index >= VICTORY_EPILOGUE.length) {
    throw new RangeError(`invalid epilogue beat index: ${index}`);
  }
  return skip || index === VICTORY_EPILOGUE.length - 1 ? -1 : index + 1;
}

/** One accepted advance per physical press; repeat keydown events are ignored. */
export class EpilogueAdvanceGate {
  private pressed = false;

  press(repeat = false): boolean {
    if (repeat || this.pressed) return false;
    this.pressed = true;
    return true;
  }

  release() {
    this.pressed = false;
  }
}

export interface HudWarningState {
  hp: number;
  battery: number;
  curse: number;
}

export interface WatcherExposureState extends HudWarningState {
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  watchers: Array<{ x: number; y: number; active: boolean }>;
  /** Optional presentation LOS projection; authoritative simulation owns the rule. */
  lineOfSight?: (watcher: WatcherExposureState['watchers'][number]) => boolean;
}

export function objectiveCopy(
  floor: number, hasKey: boolean, stalkerHunting = false,
  objectiveComplete = hasKey, progress = 0, total = 0,
): string {
  const ordinaryObjective: Record<number, string> = {
    4: 'OPEN THE MAINTENANCE LOCKBOX',
    3: 'IDENTIFY THE MISSING RESIDENT',
    2: 'RESTORE THE ARCHIVE CIRCUIT',
    1: 'RECONSTRUCT THE ERASED RECORDS',
  };
  if (isBlock13Floor(floor)) {
    if (objectiveComplete && stalkerHunting) return 'OBJECTIVE: GET OUT NOW';
    if (objectiveComplete) return 'OBJECTIVE: GET OUT';
    return `OBJECTIVE: RECOVER THE FINAL MEMORY${total ? ` (${progress}/${total})` : ''}`;
  }
  if (objectiveComplete) return floor === 1 ? 'OBJECTIVE: REACH THE EXIT' : 'OBJECTIVE: RETURN TO STAIRS';
  return `OBJECTIVE: ${ordinaryObjective[floor] ?? 'INVESTIGATE THE BUILDING'}${total ? ` (${progress}/${total})` : ''}`;
}

/** Presentation-only resource warnings; thresholds do not feed into simulation. */
export function hudWarningCopy(state: HudWarningState): string[] {
  const warnings: string[] = [];
  if (state.hp <= 25) warnings.push('CRITICAL HP');
  if (state.battery <= 20) warnings.push('LOW BATTERY');
  if (state.battery <= 0) warnings.push('FLASHLIGHT OUT');
  if (state.curse >= 85) warnings.push('CRITICAL CURSE');
  else if (state.curse > 50) warnings.push('HIGH CURSE');
  return warnings;
}

/** Mirrors the authoritative Watcher cone/range test for presentation feedback. */
export function watcherIsCausingCurse(state: WatcherExposureState): boolean {
  return state.watchers.some(watcher => watcherIndividuallyCausingCurse(state, watcher));
}

/** Per-entity form for localized presentation; shares the aggregate rule exactly. */
export function watcherIndividuallyCausingCurse(
  state: WatcherExposureState,
  watcher: WatcherExposureState['watchers'][number],
): boolean {
  const range = 150 * 256;
  const rangeSquared = range * range;
  if (!watcher.active) return false;
  const dx = watcher.x - state.x;
  const dy = watcher.y - state.y;
  const distanceSquared = dx * dx + dy * dy;
  const facingDot = dx * state.facingX + dy * state.facingY;
  const facing = facingDot > 0
    && 4 * facingDot * facingDot >= distanceSquared * (state.facingX * state.facingX + state.facingY * state.facingY);
  return facing && distanceSquared < rangeSquared && (state.lineOfSight?.(watcher) ?? true);
}

export type HemiAction = 'connect' | 'switch-network' | 'start' | 'busy' | 'enter';
export type OnchainStartupPhase = 'entropy' | 'wallet' | 'submitted' | 'confirmed';

export function onchainStartupCopy(phase: OnchainStartupPhase): string {
  switch (phase) {
    case 'entropy': return 'GETTING RUN DATA…';
    case 'wallet': return 'CONFIRM RUN IN WALLET…';
    case 'submitted': return 'WAITING FOR HEMI…';
    case 'confirmed': return 'RUN CONFIRMED';
  }
}

export function startupErrorCopy(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/user rejected|rejected the request|denied transaction/i.test(message)) {
    return 'Wallet request rejected. You can retry PLAY ON HEMI or start a PLAY LOCAL run.';
  }
  return `${message || 'Could not start the Hemi run.'} You can retry or PLAY LOCAL.`;
}

export function runMenuActions(isConnected: boolean, isCorrectNetwork: boolean, busy: boolean, ready: boolean) {
  const hemi: HemiAction = ready ? 'enter' : busy ? 'busy' : !isConnected ? 'connect' : !isCorrectNetwork ? 'switch-network' : 'start';
  return { localEnabled: true as const, hemi };
}

export function terminalSubmissionStatus(phase: 'idle' | 'wallet' | 'submitted' | 'confirmed' | 'failed') {
  switch (phase) {
    case 'idle': return { label: 'READY', button: 'SUBMIT RESULT TO HEMI', disabled: false };
    case 'wallet': return { label: 'CONFIRM IN WALLET', button: 'CONFIRM IN WALLET', disabled: true };
    case 'submitted': return { label: 'SUBMITTED — WAITING FOR HEMI…', button: 'SUBMITTED', disabled: true };
    case 'confirmed': return { label: 'CONFIRMED', button: 'CONFIRMED', disabled: true };
    case 'failed': return { label: 'FAILED — RETRY', button: 'FAILED — RETRY', disabled: false };
  }
}
