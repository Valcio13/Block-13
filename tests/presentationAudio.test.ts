import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuthoritativeSimulation, FIXED_SCALE } from '../src/core/authoritativeSimulation';
import { mimicTwitch, firstMimicTwitchDelay } from '../src/core/cosmeticAnimation';
import { AUDIO_ASSET_CATALOG, AUDIO_ASSET_MANIFEST } from '../src/core/audioAssetManifest';
import { audioCuesForEvents, audioCuesForStateChange, floorAmbienceKeys } from '../src/core/presentationAudio';
import type { SimulationEvent } from '../src/core/authoritativeSimulation';
import { finalStateV1FromTerminalState, hashFinalStateV1 } from '../src/core/finalStateV1';
import type { RunManifest } from '../src/core/seedDerivation';
import { InputRecorder, InputReplayer } from '../src/core/inputRecorder';
import { corruptionVisualStrength, floorVisualProfile, flashlightVisualFactor, tileDressingAt } from '../src/core/visualAtmosphere';

const manifest: RunManifest = {
  runId: 1n,
  player: '0x1111111111111111111111111111111111111111',
  gameVersion: `0x${'22'.repeat(32)}`,
  rulesHash: `0x${'33'.repeat(32)}`,
  btcBlockHash: `0x${'44'.repeat(32)}`,
  hemiBlockHash: `0x${'55'.repeat(32)}`,
  ethBlockHash: `0x${'66'.repeat(32)}`,
  hemiTxHash: `0x${'77'.repeat(32)}`,
  startedAt: 0,
};

describe('presentation audio mapping', () => {
  it('maps authoritative interaction results to distinct audio cues', () => {
    const events: SimulationEvent[] = [
      { type: 'key_collected' },
      { type: 'damage', amount: 8, hp: 92 },
      { type: 'loot_searched', index: 0, result: { type: 'health', amount: 12 } },
      { type: 'loot_searched', index: 1, result: { type: 'battery', amount: 10 } },
      { type: 'mimic_revealed', index: 2 },
    ];
    expect(audioCuesForEvents(events).map(({ key }) => key)).toEqual([
      'sfx_key_pickup', 'sfx_player_hurt', 'sfx_interaction_search', 'sfx_item_heal',
      'sfx_interaction_search', 'sfx_item_pickup', 'sfx_mimic_reveal',
    ]);
    expect(audioCuesForEvents(events).every(event => event.cooldownMs >= 0)).toBe(true);
  });

  it('maps state edges for flashlight, battery, corruption, enemies, scare, and ending', () => {
    const sim = new AuthoritativeSimulation(123n);
    const base = sim.state;
    const changed = {
      ...base,
      floor: 0,
      flashlightOn: true,
      battery: 20 * FIXED_SCALE,
      scareEventId: base.scareEventId + 1,
      corruption: { ...base.corruption, effectId: base.corruption.effectId + 1 },
      stalker: { ...base.stalker, state: 'hunting' as const, visible: true },
      status: 'won' as const,
    };
    expect(audioCuesForStateChange(base, changed).map(({ key }) => key)).toEqual([
      'sfx_flashlight_on', 'sfx_battery_warning', 'sfx_corruption_pulse',
      'sfx_stalker_presence', 'sfx_danger_stinger', 'sfx_final_chase_stinger', 'sfx_escape',
    ]);
  });

  it('maps enemy state changes and floor/death events without scene-owned gameplay decisions', () => {
    const sim = new AuthoritativeSimulation(456n);
    const state = sim.state;
    const before = {
      ...state,
      crawlers: [{ id: 1, x: 100, y: 120, targetX: 0, targetY: 0, chasing: false, chaseStartTick: 0, moveRemainder: 0 }],
      watchers: [{ id: 2, x: 200, y: 220, active: false, illuminatedTicks: 0, decayRemainder: 0, curseRemainder: 0 }],
      ambushers: [{ id: 3, x: 300, y: 320, state: 'hidden' as const, warningTicks: 0, damageAtTick: 0, damage: 5, hasTriggered: false }],
    };
    const after = {
      ...before,
      crawlers: [{ id: 1, x: 100, y: 120, targetX: 0, targetY: 0, chasing: true, chaseStartTick: 1, moveRemainder: 0 }],
      watchers: [{ id: 2, x: 200, y: 220, active: true, illuminatedTicks: 0, decayRemainder: 0, curseRemainder: 0 }],
      ambushers: [{ id: 3, x: 300, y: 320, state: 'warning' as const, warningTicks: 10, damageAtTick: 0, damage: 5, hasTriggered: true }],
      status: 'lost' as const,
    };
    expect(audioCuesForStateChange(before, after).map(({ key }) => key)).toEqual([
      'sfx_crawler_skitter', 'sfx_watcher_presence', 'sfx_ambusher_warning', 'sfx_player_death',
    ]);
    expect(audioCuesForEvents([{ type: 'floor_transition', fromFloor: 4, toFloor: 3, floorsCompleted: 1 }]).map(({ key }) => key))
      .toEqual(['sfx_floor_transition']);
  });

  it('selects the dedicated floor loop and only preloads checked-in audio', () => {
    expect(floorAmbienceKeys(4)).toEqual(['amb_floor_4']);
    expect(floorAmbienceKeys(1)).toEqual(['amb_floor_1']);
    expect(floorAmbienceKeys(0)).toEqual(['amb_block13']);
    expect(floorAmbienceKeys(-1)).toEqual([]);
    for (const path of Object.values(AUDIO_ASSET_MANIFEST)) {
      expect(existsSync(resolve(process.cwd(), 'public', path.slice(1)))).toBe(true);
    }
    expect(Object.keys(AUDIO_ASSET_CATALOG)).toContain('sfx_final_chase_stinger');
  });

  it('keeps mimic twitch timing and offsets repeatable without RNG stream consumption', () => {
    expect(firstMimicTwitchDelay(7)).toBe(firstMimicTwitchDelay(7));
    expect(mimicTwitch(7, 240)).toEqual(mimicTwitch(7, 240));
    expect(mimicTwitch(7, 240)).not.toEqual(mimicTwitch(8, 240));
  });

  it('keeps palette, tile dressing, lighting variation, and effects cosmetic to replay state and hash', () => {
    const recorder = new InputRecorder();
    for (let tick = 0; tick < 600; tick++) {
      const input = { left: tick >= 200 && tick < 300, right: tick < 200, up: false, down: tick >= 300, flashlight: tick === 15, interact: tick === 350 };
      recorder.recordTick(tick, input);
    }
    recorder.setTerminalTick(600);
    const inputLog = recorder.encodeBinary();
    const replay = (withCosmeticUpdates: boolean) => {
      const sim = new AuthoritativeSimulation(0xabc123n, { hp: 1000 });
      const source = InputReplayer.fromBinary(inputLog);
      for (let tick = 0; tick < source.terminalTick; tick++) {
        sim.step(source.getStateAtTick(tick));
        if (withCosmeticUpdates) {
          for (let id = 0; id < 6; id++) mimicTwitch(id, tick);
          for (let floor = 0; floor <= 4; floor++) {
            floorVisualProfile(floor);
            tileDressingAt(floor, tick % 53, (tick * 7) % 41, tick % 2 === 0);
            flashlightVisualFactor(tick, floor);
            corruptionVisualStrength(floor, (tick * 13) % 1001);
          }
        }
      }
      return sim;
    };
    const clean = replay(false);
    const cosmetic = replay(true);
    expect(cosmetic.snapshot()).toEqual(clean.snapshot());
    const cleanTerminal = { ...clean.state, status: 'lost' as const, hp: 0 };
    const cosmeticTerminal = { ...cosmetic.state, status: 'lost' as const, hp: 0 };
    expect(hashFinalStateV1(finalStateV1FromTerminalState(manifest, cosmeticTerminal)))
      .toBe(hashFinalStateV1(finalStateV1FromTerminalState(manifest, cleanTerminal)));
  });

  it('uses stable floor palettes and coordinate-only dressing without simulation RNG', () => {
    expect(floorVisualProfile(0)).not.toEqual(floorVisualProfile(4));
    expect(tileDressingAt(1, 17, 29, true)).toBe(tileDressingAt(1, 17, 29, true));
    expect(flashlightVisualFactor(100, 2)).toBe(flashlightVisualFactor(100, 2));
    expect(corruptionVisualStrength(0, 1000)).toBeGreaterThan(corruptionVisualStrength(4, 0));
    const sim = new AuthoritativeSimulation(987654321n);
    const initialSnapshot = sim.snapshot();
    for (let y = 0; y < sim.floor.height; y++) {
      for (let x = 0; x < sim.floor.width; x++) tileDressingAt(sim.state.floor, x, y, sim.floor.tiles[y][x]);
    }
    expect(sim.snapshot()).toEqual(initialSnapshot);
  });
});
