import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const floorScene = readFileSync(resolve(process.cwd(), 'src/game/scenes/FloorScene.ts'), 'utf8');

describe('floor music presentation integration', () => {
  it('starts one floor-selected looping track and uses presentation-only fades', () => {
    const start = floorScene.slice(floorScene.indexOf('  private startFloorMusic('), floorScene.indexOf('  private bindDevelopmentAudioPreview('));
    expect(start.indexOf("stopCategory('music')")).toBeGreaterThanOrEqual(0);
    expect(start.indexOf("stopCategory('music')")).toBeLessThan(start.indexOf("play(track.key, 'music'"));
    expect(start).toContain('{ loop: true, volume: track.gain }');
    expect(start).toContain("fadeInCategory('music', fadeMs)");
    expect(floorScene).toContain('floorMusicTrack(this.authoritativeSimulation.state.floor)');
    expect(floorScene).toContain("fadeOutCategory('music', 850)");
    expect(floorScene).toContain('this.audioDirector.shutdown()');
  });

  it('keeps preview controls development-only and removes their input listener on shutdown', () => {
    expect(floorScene).toContain('if (import.meta.env.DEV && !this.runState.manifest) this.bindDevelopmentAudioPreview()');
    const previewStart = floorScene.indexOf('  private bindDevelopmentAudioPreview()');
    const previewEnd = floorScene.indexOf('  private beginVictoryEpilogue()', previewStart);
    const preview = floorScene.slice(previewStart, previewEnd);
    for (const key of ['F1', 'F2', 'F3', 'F4', 'F5', 'F12']) expect(preview).toContain(`${key}: { key:`);
    for (const key of ['F6', 'F7', 'F9', 'F10', 'F11']) expect(preview).toContain(`event.code === '${key}'`);
    expect(preview).not.toContain("event.code === 'F8'");
    expect(preview).toContain("volume: reduced ? 0.46 : 0.82");
    expect(floorScene).toContain("this.input.keyboard?.off('keydown', this.audioPreviewKeyHandler)");
  });
});
