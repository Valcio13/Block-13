import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AuthoritativeSimulation } from '../src/core/authoritativeSimulation';
import { AMBUSHER_JUMPSCARE_ASSET, AMBUSHER_JUMPSCARE_VARIANT_ASSETS } from '../src/game/enemyAssets';
import {
  advanceAmbusherJumpscare,
  ambusherCameraKickIntensity,
  ambusherFrameForAccessibility,
  avoidImmediateAmbusherRepeat,
  ambusherLocalPreviewVariant,
  AMBUSHER_JUMPSCARE_TIMING,
  AMBUSHER_JUMPSCARE_TOTAL_MS,
  ambusherImpactStarted,
  ambusherJumpscareFrame,
  ambusherJumpscareFraming,
  ambusherJumpscareLayout,
  ambusherJumpscareTextureKey,
  ambusherJumpscareVariant,
  AMBUSHER_JUMPSCARE_VARIANTS,
} from '../src/game/ambusherJumpscare';

describe('screen-space Ambusher jumpscare', () => {
  it('uses a compact warning-gap-impact-afterimage-recovery sequence', () => {
    expect(AMBUSHER_JUMPSCARE_TIMING).toEqual({ microGapMs: 55, impactMs: 500, impactPunchMs: 180, impactFlashMs: 38, afterimageMs: 220, cameraKickMs: 300 });
    expect(AMBUSHER_JUMPSCARE_TOTAL_MS).toBe(775);
    expect(ambusherJumpscareFrame(0).phase).toBe('micro-gap');
    expect(ambusherJumpscareFrame(54).imageVisible).toBe(false);
    expect(ambusherJumpscareFrame(55).phase).toBe('impact');
    expect(ambusherJumpscareFrame(55).imageVisible).toBe(true);
    expect(ambusherJumpscareFrame(70).veilAlpha).toBe(0.14);
    expect(ambusherJumpscareFrame(70).punch).toBeLessThan(1.08);
    expect(ambusherJumpscareFrame(234).punch).toBeGreaterThan(1);
    expect(ambusherJumpscareFrame(235).punch).toBe(1);
    expect(ambusherJumpscareFrame(554).imageVisible).toBe(true);
    expect(ambusherJumpscareFrame(555).phase).toBe('afterimage');
    expect(ambusherJumpscareFrame(555).imageVisible).toBe(false);
    expect(ambusherJumpscareFrame(774).veilAlpha).toBeGreaterThan(0);
    expect(ambusherJumpscareFrame(775).phase).toBe('recovery');
  });

  it('starts the impact exactly once at the first image frame, even after a stalled render frame', () => {
    let elapsed = 0;
    let played = false;
    let hits = 0;
    for (const delta of [16, 16, 16, 16, 16, 16, 16, 16, 16, 16]) {
      const next = advanceAmbusherJumpscare(elapsed, delta, played);
      elapsed = next.elapsedMs;
      if (next.impactBegins) { played = true; hits++; }
    }
    expect(hits).toBe(1);
    expect(advanceAmbusherJumpscare(54, 1, false)).toEqual({ elapsedMs: 55, impactBegins: true });
    expect(advanceAmbusherJumpscare(20, 600, false)).toEqual({ elapsedMs: 55, impactBegins: true });
    expect(advanceAmbusherJumpscare(55, 16, true).impactBegins).toBe(false);
  });

  it('shows impact art only on the jumpscare edge, never during warning', () => {
    const previous = Object.freeze([{ id: 2, state: 'warning' }]);
    const warning = Object.freeze([{ id: 2, state: 'warning' }]);
    const impact = Object.freeze([{ id: 2, state: 'jumpscare' }]);
    expect(ambusherImpactStarted(previous, warning)).toBeUndefined();
    expect(ambusherImpactStarted(previous, impact)).toEqual(impact[0]);
    expect(ambusherImpactStarted(impact, impact)).toBeUndefined();
    expect(previous[0].state).toBe('warning');
  });

  it('selects four stable authored compositions without RNG and avoids consecutive repeats only in presentation', () => {
    expect(AMBUSHER_JUMPSCARE_VARIANTS).toEqual(['face', 'side_peek', 'open_maw', 'wrong_face']);
    const first = ambusherJumpscareVariant(1, 240);
    expect(first).toBe(ambusherJumpscareVariant(1, 240));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(4);
    expect(new Set(Array.from({ length: 40 }, (_, tick) => ambusherJumpscareVariant(tick % 3, tick))).size).toBe(4);
    expect(avoidImmediateAmbusherRepeat(first, first)).not.toBe(first);
    expect(avoidImmediateAmbusherRepeat(first, (first + 1) % 4)).toBe(first);
    expect(ambusherJumpscareFraming(1, 240)).toBe(ambusherJumpscareFraming(1, 240));
    const presentation = readFileSync(new URL('../src/game/ambusherJumpscare.ts', import.meta.url), 'utf8');
    expect(presentation).not.toContain('Math.random');
    expect(presentation).not.toContain('PCG32');
  });

  it('allows explicit variant inspection only through the Local development presentation gate', () => {
    expect(ambusherLocalPreviewVariant('?ambusherVariant=A')).toBe(0);
    expect(ambusherLocalPreviewVariant('?ambusherVariant=B')).toBe(1);
    expect(ambusherLocalPreviewVariant('?ambusherVariant=C')).toBe(2);
    expect(ambusherLocalPreviewVariant('?ambusherVariant=D')).toBe(3);
    expect(ambusherLocalPreviewVariant('?ambusherVariant=wrong_face')).toBe(3);
    expect(ambusherLocalPreviewVariant('?ambusherVariant=unknown')).toBeUndefined();
    const scene = readFileSync(new URL('../src/game/scenes/FloorScene.ts', import.meta.url), 'utf8');
    expect(scene).toContain('import.meta.env.DEV && !this.runState.manifest');
    expect(scene).toContain('ambusherLocalPreviewVariant(window.location.search) ?? selectedVariant');
  });

  it('fits the optional 16:9 texture without distortion and falls back through existing Ambusher art', () => {
    expect(AMBUSHER_JUMPSCARE_ASSET).toMatchObject({
      key: 'ambusher_jumpscare', path: '/assets/sprites/enemies/ambusher/ambusher_jumpscare.png', width: 576, height: 324,
    });
    const normal = ambusherJumpscareLayout(1280, 720, 576, 324, 1, 1);
    const punched = ambusherJumpscareLayout(1280, 720, 576, 324, 1, 1.08);
    expect(normal.scale * 576).toBe(1152);
    expect(normal.scale * 324).toBe(648);
    expect(punched.scale).toBeGreaterThan(normal.scale);
    expect(ambusherJumpscareTextureKey('side_peek', key => key === 'ambusher_jumpscare_side_peek', 'ambusher_0')).toBe('ambusher_jumpscare_side_peek');
    expect(ambusherJumpscareTextureKey('open_maw', key => key === 'ambusher_jumpscare', 'ambusher_0')).toBe('ambusher_jumpscare');
    expect(ambusherJumpscareTextureKey('wrong_face', key => key === 'ambusher_warning', 'ambusher_0')).toBe('ambusher_warning');
    expect(ambusherJumpscareTextureKey('wrong_face', () => false, 'ambusher_0')).toBe('ambusher_0');
    expect(Object.values(AMBUSHER_JUMPSCARE_VARIANT_ASSETS)).toHaveLength(4);
    for (const asset of Object.values(AMBUSHER_JUMPSCARE_VARIANT_ASSETS)) expect(asset).toMatchObject({ width: 576, height: 324 });
    const boot = readFileSync(new URL('../src/game/scenes/BootScene.ts', import.meta.url), 'utf8');
    expect(boot).toContain('Object.values(AMBUSHER_JUMPSCARE_VARIANT_ASSETS)');
    const asset = readFileSync(new URL('../public/assets/sprites/enemies/ambusher/ambusher_jumpscare.png', import.meta.url));
    expect(asset.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(asset.readUInt32BE(16)).toBe(576);
    expect(asset.readUInt32BE(20)).toBe(324);
    expect(asset[25]).toBe(2); // PNG truecolor RGB, without alpha
  });

  it('registers the three delivered B/C/D files at their exact paths as opaque 576×324 RGB PNGs', () => {
    for (const variant of ['side_peek', 'open_maw', 'wrong_face'] as const) {
      const asset = AMBUSHER_JUMPSCARE_VARIANT_ASSETS[variant];
      expect(asset.path).toBe(`/assets/sprites/enemies/ambusher/ambusher_jumpscare_${variant}.png`);
      const bytes = readFileSync(new URL(`../public${asset.path}`, import.meta.url));
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(bytes.readUInt32BE(16)).toBe(576);
      expect(bytes.readUInt32BE(20)).toBe(324);
      expect(bytes[25]).toBe(2);
      expect(ambusherJumpscareTextureKey(variant, key => key === asset.key, 'ambusher_0')).toBe(asset.key);
      expect(ambusherJumpscareTextureKey(variant, key => key === 'ambusher_jumpscare', 'ambusher_0')).toBe('ambusher_jumpscare');
      expect(ambusherJumpscareTextureKey(variant, key => key === 'ambusher_warning', 'ambusher_0')).toBe('ambusher_warning');
      expect(ambusherJumpscareTextureKey(variant, () => false, 'ambusher_0')).toBe('ambusher_0');
    }
  });

  it('keeps the production close-up in screen space and starts sound and camera kick with its first impact frame once', () => {
    const scene = readFileSync(new URL('../src/game/scenes/FloorScene.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const start = scene.slice(scene.indexOf('  private startAmbusherJumpscare('), scene.indexOf('  private updateAmbusherJumpscare('));
    const update = scene.slice(scene.indexOf('  private updateAmbusherJumpscare('), scene.indexOf('  private refreshAmbusherJumpscareFrame('));
    const refresh = scene.slice(scene.indexOf('  private refreshAmbusherJumpscareFrame('), scene.indexOf('  private clearAmbusherJumpscare('));
    expect(start).not.toContain('sfx_jumpscare_hit');
    expect(start).not.toContain('.shake(');
    expect(update.indexOf('this.refreshAmbusherJumpscareFrame()')).toBeLessThan(update.indexOf('playAmbusherImpact('));
    expect(update).toContain('advanceAmbusherJumpscare(this.ambusherJumpscareElapsedMs, delta, this.ambusherJumpscareImpactPlayed)');
    expect(update).toContain('if (nextFrame.impactBegins)');
    expect(update.match(/playAmbusherImpact/g)).toHaveLength(1);
    expect(update).toContain('this.audioDirector?.setCategoryDucking(\'ambience\', 1)');
    expect(update).toContain('ambusherCameraKickIntensity(reduced)');
    expect(refresh).toContain('ambusherFrameForAccessibility');
    expect(update.indexOf('this.refreshAmbusherJumpscareFrame()')).toBeLessThan(update.indexOf('playAmbusherImpact('));
    expect(start).toContain("setCategoryDucking('ambience', AMBUSHER_PRE_IMPACT_AMBIENCE_GAIN)");
    expect(refresh).toContain('this.cameras.main.ignore(this.ambusherJumpscareImage)');
    expect(refresh).toContain('ambusherJumpscareTextureKey');
    expect(scene).toContain('ambusherTextureKey(key => this.textures.exists(key)');
    expect(scene).not.toContain("setTexture('ambusher_jumpscare')");
    expect(scene).toContain('this.lastAmbusherJumpscareVariantIndex = this.ambusherJumpscareVariantIndex');
  });

  it('reduces only the rendered scare envelope when accessibility is enabled', () => {
    const impact = ambusherJumpscareFrame(80);
    expect(ambusherFrameForAccessibility(impact, false)).toBe(impact);
    const reduced = ambusherFrameForAccessibility(impact, true);
    expect(reduced.imageVisible).toBe(impact.imageVisible);
    expect(reduced.phase).toBe(impact.phase);
    expect(reduced.veilAlpha).toBeLessThanOrEqual(0.045);
    expect(reduced.punch).toBeLessThan(impact.punch);
    expect(ambusherCameraKickIntensity(true)).toBeLessThan(ambusherCameraKickIntensity(false));
  });

  it('uses restrained composition-specific framing and punch without hiding the afterimage cutoff', () => {
    const base = ambusherJumpscareLayout(1280, 720, 576, 324, 1, 1, 'face');
    const peek = ambusherJumpscareLayout(1280, 720, 576, 324, 1, 1, 'side_peek');
    const maw = ambusherJumpscareLayout(1280, 720, 576, 324, 1, 1, 'open_maw');
    const wrong = ambusherJumpscareLayout(1280, 720, 576, 324, 0, 1, 'wrong_face');
    expect(peek.x).toBeLessThan(base.x);
    expect(maw.scale).toBeGreaterThan(base.scale);
    expect(Math.abs(wrong.x - base.x)).toBeLessThan(10);
    expect(ambusherJumpscareFrame(55, 'open_maw').punch).toBe(1.1);
    expect(ambusherJumpscareFrame(55, 'wrong_face').punch).toBe(1.035);
    for (const variant of AMBUSHER_JUMPSCARE_VARIANTS) {
      expect(ambusherJumpscareFrame(235, variant).punch).toBe(1);
      expect(ambusherJumpscareFrame(554, variant).imageVisible).toBe(true);
      expect(ambusherJumpscareFrame(555, variant).imageVisible).toBe(false);
    }
  });

  it('uses scene-owned screen effects and clears them on pause, transition, terminal state, and shutdown', () => {
    const source = readFileSync(new URL('../src/game/scenes/FloorScene.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const start = source.indexOf('  private startAmbusherJumpscare(');
    const clear = source.indexOf('  private clearAmbusherJumpscare()', start);
    const clearBody = source.slice(clear, source.indexOf('\n  private ', clear + 10));
    expect(source.slice(start, clear)).toContain('.setScrollFactor(0)');
    expect(source.slice(start, clear)).toContain('this.cameras.main.ignore');
    expect(clearBody).toContain('ambusherJumpscareImage?.destroy()');
    expect(clearBody).toContain('ambusherJumpscareVeil?.destroy()');
    for (const method of ['showPauseMenu', 'completeFloor', 'playerDeath', 'shutdown']) {
      const methodStart = source.indexOf(`  private ${method}(`) >= 0 ? source.indexOf(`  private ${method}(`) : source.indexOf(`  ${method}()`);
      expect(source.slice(methodStart, methodStart + 700)).toContain('clearAmbusherJumpscare()');
    }
    expect(source).toContain("if (state.status === 'won') {\n        this.clearAmbusherJumpscare();");
    expect(source).toContain("} else if (state.status === 'lost') {\n        this.clearAmbusherJumpscare();");
  });

  it('does not mutate an authoritative state snapshot when deriving the presentation variant', () => {
    const sim = new AuthoritativeSimulation(1313n);
    const state = sim.state;
    const before = JSON.stringify(state);
    const event = ambusherImpactStarted(
      Object.freeze([{ id: 4, state: 'warning' }]),
      Object.freeze([{ id: 4, state: 'jumpscare' }]),
    );
    if (event) ambusherJumpscareVariant(event.id, state.tick);
    expect(JSON.stringify(state)).toBe(before);
    expect(sim.state).toEqual(state);
  });
});
