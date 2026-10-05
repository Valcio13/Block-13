import { BLOCK_13_FLOOR, isBlock13Floor, isOutsideFloor, START_FLOOR } from '../core/progression';

/** Player-facing labels; internal progression IDs and canonical names stay unchanged. */
export function playerBlockName(floor: number): string {
  if (isOutsideFloor(floor)) return 'OUTSIDE';
  if (isBlock13Floor(floor)) return 'BLOCK 13';
  if (Number.isInteger(floor) && floor >= 1 && floor <= START_FLOOR) return `BLOCK ${floor}`;
  throw new RangeError(`invalid progression floor: ${floor}`);
}

export const OPENING_STORY_LINES = [
  '11:47 PM',
  'Your shift ended seventeen minutes ago.',
  'The elevator is out again.',
  "You'll have to take the stairs down from Block 4.",
  'Just get outside.',
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
  if (fromFloor === 1 && toFloor === BLOCK_13_FLOOR) {
    return [
      { text: 'BLOCK 1 CLEARED' },
      { text: 'GROUND FLOOR' },
      { text: '…' },
      { text: 'ROUTE NOT FOUND', glitch: true },
      { text: '…' },
      { text: 'BLOCK 13' },
      { text: 'THIS BLOCK DOES NOT EXIST.' },
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
  { text: 'Four blocks.', durationMs: 900 },
  { text: 'Four keys.', durationMs: 900 },
  { text: 'One way down.', durationMs: 1100 },
  { text: 'You should have reached the ground floor.', durationMs: 1500 },
  { text: '', durationMs: 1200 },
  { text: 'But you remember the hallway.', durationMs: 1200 },
  { text: 'The thing that followed you.', durationMs: 1200 },
  { text: 'The door marked 13.', durationMs: 1500 },
  { text: 'You look back.', durationMs: 2600, visual: 'look-back' },
  { text: '', durationMs: 1200 },
  { text: 'Four blocks.', durationMs: 1000 },
  { text: 'Just like there have always been.', durationMs: 1400 },
  { text: '', durationMs: 800, visual: 'blackout' },
  { text: 'There is no Block 13.', durationMs: 3000 },
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

interface WatcherExposureState extends HudWarningState {
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  watchers: Array<{ x: number; y: number; active: boolean }>;
}

export function objectiveCopy(floor: number, hasKey: boolean, stalkerHunting = false): string {
  if (isBlock13Floor(floor)) {
    if (hasKey && stalkerHunting) return 'OBJECTIVE: GET OUT NOW';
    return hasKey ? 'OBJECTIVE: GET OUT' : 'OBJECTIVE: FIND THE KEY';
  }
  return hasKey ? 'OBJECTIVE: RETURN TO STAIRS' : 'OBJECTIVE: FIND THE KEY';
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
  const range = 150 * 256;
  const rangeSquared = range * range;
  return state.watchers.some(watcher => {
    if (!watcher.active) return false;
    const dx = watcher.x - state.x;
    const dy = watcher.y - state.y;
    const distanceSquared = dx * dx + dy * dy;
    const facingDot = dx * state.facingX + dy * state.facingY;
    const facing = facingDot > 0
      && 4 * facingDot * facingDot >= distanceSquared * (state.facingX * state.facingX + state.facingY * state.facingY);
    return facing && distanceSquared < rangeSquared;
  });
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
