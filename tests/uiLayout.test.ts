import { describe, expect, it } from 'vitest';
import { clueModalHeight, temporaryMessageDuration, temporaryMessageLayout } from '../src/game/uiLayout';

describe('responsive transient UI layout', () => {
  it('keeps notification text inside safe viewport margins and above controls', () => {
    const wide = temporaryMessageLayout(1280, 720);
    const narrow = temporaryMessageLayout(640, 360);
    expect(wide.width + 48).toBeLessThanOrEqual(1280);
    expect(narrow.width + 48).toBeLessThanOrEqual(640);
    expect(wide.y).toBeLessThan(720 - 100);
    expect(narrow.y).toBeLessThan(360 - 100);
  });

  it('gives wrapped messages enough reading time', () => {
    expect(temporaryMessageDuration('short', 1100)).toBeGreaterThanOrEqual(1100);
    expect(temporaryMessageDuration('A'.repeat(120), 1100)).toBeGreaterThan(1100);
  });

  it('sizes short document panels below the long-document maximum', () => {
    expect(clueModalHeight('one short line', 720, 600)).toBeLessThan(420);
    expect(clueModalHeight('A'.repeat(900), 720, 600)).toBe(420);
    expect(clueModalHeight('A'.repeat(900), 360, 300)).toBeLessThanOrEqual(328);
  });
});
