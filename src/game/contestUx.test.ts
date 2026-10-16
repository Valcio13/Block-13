import { describe, expect, it } from 'vitest';
import { blockTransitionBeats, EpilogueAdvanceGate, hudWarningCopy, nextEpilogueBeat, nextOpeningStoryIndex, objectiveCopy, onchainStartupCopy, OPENING_STORY_LINES, playerBlockName, resultHandoffReady, runMenuActions, shouldBeginVictoryEpilogue, startupErrorCopy, terminalSubmissionStatus, VICTORY_EPILOGUE, VICTORY_EPILOGUE_DURATION_MS, watcherIsCausingCurse } from './contestUx';
import { BLOCK_13_FLOOR, nextProgressionFloor, OUTSIDE_FLOOR, START_FLOOR } from '../core/progression';

describe('contest UX presentation helpers', () => {
  it('uses Floor labels without changing the canonical progression IDs', () => {
    expect([START_FLOOR, 3, 2, 1, BLOCK_13_FLOOR, OUTSIDE_FLOOR]).toEqual([4, 3, 2, 1, 0, -1]);
    expect([4, 3, 2, 1, 0, -1].map(playerBlockName)).toEqual([
      'FLOOR 4', 'FLOOR 3', 'FLOOR 2', 'FLOOR 1', 'FLOOR 13', 'OUTSIDE',
    ]);
    expect([4, 3, 2, 1, 0].map(nextProgressionFloor)).toEqual([3, 2, 1, 0, -1]);
  });

  it('provides the new premise and only uses the fake-out for Floor 1 to Floor 13', () => {
    expect(OPENING_STORY_LINES).toHaveLength(5);
    expect(OPENING_STORY_LINES[0]).toContain('building disappeared');
    expect(nextOpeningStoryIndex(0)).toBe(1);
    expect(nextOpeningStoryIndex(OPENING_STORY_LINES.length - 1)).toBe(-1);
    expect(nextOpeningStoryIndex(1, true)).toBe(-1);
    expect(blockTransitionBeats(1, 0).map(beat => beat.text)).toEqual([
      'FLOOR 1', 'GROUND FLOOR', '…', 'ROUTE NOT FOUND', '…', 'FLOOR 13', 'THIS FLOOR DOES NOT EXIST.',
    ]);
    expect(blockTransitionBeats(4, 3).map(beat => beat.text)).toEqual([
      'FLOOR 4', 'THE STAIRWELL IS COLDER.', 'THE DOOR SHUTS BEHIND YOU.', 'THE LIGHTS GO OUT.', 'FLOOR 3',
    ]);
    expect(blockTransitionBeats(2, 1)).toEqual([]);
  });

  it('runs the ending epilogue only for wins and hands off losses immediately', () => {
    expect(shouldBeginVictoryEpilogue('won')).toBe(true);
    expect(shouldBeginVictoryEpilogue('lost')).toBe(false);
    expect(resultHandoffReady('lost', false)).toBe(true);
    expect(resultHandoffReady('won', false)).toBe(false);
    expect(resultHandoffReady('won', true)).toBe(true);
  });

  it('keeps the intended epilogue order, breathing room, final line, and bounded duration', () => {
    const lines = VICTORY_EPILOGUE.map(beat => beat.text).filter(Boolean);
    expect(lines).toEqual([
      'You push through the final door.', 'For the first time tonight...', 'everything is quiet.',
      '12:13 AM', 'Cold air fills your lungs.', "You're outside.", 'Four floors.', 'One address.',
      'One way down.', 'You should have reached the street.', 'But you remember the hallway.',
      'The thing that followed you.', 'The door marked 13.', 'You look back.', 'Four floors.',
      'Just like there have always been.', 'There is no Floor 13.',
    ]);
    expect(lines.at(-1)).toBe('There is no Floor 13.');
    expect(VICTORY_EPILOGUE_DURATION_MS).toBeLessThanOrEqual(35_000);
    expect(VICTORY_EPILOGUE_DURATION_MS).toBeGreaterThanOrEqual(25_000);
  });

  it('advances/skips the epilogue and ignores held/repeated advance keys', () => {
    const gate = new EpilogueAdvanceGate();
    expect(gate.press()).toBe(true);
    expect(gate.press(true)).toBe(false);
    expect(gate.press()).toBe(false);
    gate.release();
    expect(gate.press()).toBe(true);
    expect(nextEpilogueBeat(0)).toBe(1);
    expect(nextEpilogueBeat(4, true)).toBe(-1);
    expect(nextEpilogueBeat(VICTORY_EPILOGUE.length - 1)).toBe(-1);
  });

  it('keeps frozen terminal result data unchanged while presentation beats advance', () => {
    const terminal = Object.freeze({ outcome: 0, score: 812, terminalTick: 4567, finalStateHash: '0xabc' });
    const before = JSON.stringify(terminal);
    let index = 0;
    while (index >= 0) index = nextEpilogueBeat(index);
    expect(JSON.stringify(terminal)).toBe(before);
  });

  it('keeps Local Run available across wallet, network, and startup states', () => {
    const states = [
      { connected: false, network: false, busy: false, ready: false }, // disconnected
      { connected: false, network: false, busy: true, ready: false }, // wallet connecting
      { connected: true, network: false, busy: false, ready: false }, // wrong network
      { connected: true, network: false, busy: true, ready: false }, // network switching
      { connected: true, network: true, busy: true, ready: false }, // entropy / TX1 lifecycle
      { connected: true, network: true, busy: false, ready: false }, // ready to start
      { connected: true, network: true, busy: true, ready: true }, // confirmed run
    ];
    for (const state of states) {
      expect(runMenuActions(state.connected, state.network, state.busy, state.ready).localEnabled).toBe(true);
    }
  });

  it('maps the Hemi action to the current wallet/network lifecycle', () => {
    expect(runMenuActions(false, false, false, false).hemi).toBe('connect');
    expect(runMenuActions(true, false, false, false).hemi).toBe('switch-network');
    expect(runMenuActions(true, true, false, false).hemi).toBe('start');
    expect(runMenuActions(true, true, true, false).hemi).toBe('busy');
    expect(runMenuActions(true, true, false, true).hemi).toBe('enter');
  });

  it('maps only real onchain lifecycle phases and gives wallet rejection recovery copy', () => {
    expect(onchainStartupCopy('entropy')).toBe('GETTING RUN DATA…');
    expect(onchainStartupCopy('wallet')).toBe('CONFIRM RUN IN WALLET…');
    expect(onchainStartupCopy('submitted')).toBe('WAITING FOR HEMI…');
    expect(onchainStartupCopy('confirmed')).toBe('RUN CONFIRMED');
    expect(startupErrorCopy(new Error('User rejected the request'))).toContain('PLAY LOCAL');
    expect(startupErrorCopy(new Error('Bitcoin entropy unavailable'))).toContain('retry');
  });

  it('shows clear objectives on ordinary floors and Floor 13', () => {
    expect(objectiveCopy(4, false)).toBe('OBJECTIVE: OPEN THE MAINTENANCE LOCKBOX');
    expect(objectiveCopy(1, true)).toBe('OBJECTIVE: REACH THE EXIT');
    expect(objectiveCopy(0, false)).toBe('OBJECTIVE: RECOVER THE FINAL MEMORY');
    expect(objectiveCopy(0, true)).toBe('OBJECTIVE: GET OUT');
    expect(objectiveCopy(0, true, true)).toBe('OBJECTIVE: GET OUT NOW');
  });

  it('maps low resources to readable text warnings', () => {
    expect(hudWarningCopy({ hp: 25, battery: 20, curse: 85 })).toEqual([
      'CRITICAL HP', 'LOW BATTERY', 'CRITICAL CURSE',
    ]);
    expect(hudWarningCopy({ hp: 100, battery: 0, curse: 0 })).toEqual(['LOW BATTERY', 'FLASHLIGHT OUT']);
    expect(hudWarningCopy({ hp: 100, battery: 100, curse: 51 })).toEqual(['HIGH CURSE']);
    expect(hudWarningCopy({ hp: 100, battery: 100, curse: 50 })).toEqual([]);
  });

  it('identifies an active Watcher in the authoritative facing/range cone', () => {
    const state = {
      hp: 100, battery: 100, curse: 1,
      x: 0, y: 0, facingX: 1, facingY: 0,
      watchers: [{ x: 100 * 256, y: 0, active: true }],
    };
    expect(watcherIsCausingCurse(state)).toBe(true);
    expect(watcherIsCausingCurse({ ...state, facingX: -1 })).toBe(false);
    expect(watcherIsCausingCurse({ ...state, watchers: [{ x: 200 * 256, y: 0, active: true }] })).toBe(false);
    expect(watcherIsCausingCurse({ ...state, watchers: [{ x: 100 * 256, y: 0, active: false }] })).toBe(false);
  });

  it('maps TX2 terminal lifecycle to truthful status and button copy', () => {
    expect(terminalSubmissionStatus('idle')).toMatchObject({ label: 'READY', disabled: false });
    expect(terminalSubmissionStatus('wallet')).toMatchObject({ label: 'CONFIRM IN WALLET', disabled: true });
    expect(terminalSubmissionStatus('submitted')).toMatchObject({ label: 'SUBMITTED — WAITING FOR HEMI…', disabled: true });
    expect(terminalSubmissionStatus('confirmed')).toMatchObject({ label: 'CONFIRMED', disabled: true });
    expect(terminalSubmissionStatus('failed')).toMatchObject({ label: 'FAILED — RETRY', disabled: false });
  });
});
