import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const scene = readFileSync(new URL('../src/game/scenes/FloorScene.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const narrative = readFileSync(new URL('../src/core/floorNarrative.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const puzzles = readFileSync(new URL('../src/core/proceduralPuzzles.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

describe('release narrative and presentation polish', () => {
  it('keeps the opening mystery compatible with the falsified-record ending', () => {
    expect(readFileSync(new URL('../src/game/contestUx.ts', import.meta.url), 'utf8')).toContain('official property records');
    expect(readFileSync(new URL('../src/game/contestUx.ts', import.meta.url), 'utf8')).not.toContain('building disappeared from every official record');
  });

  it('uses context-appropriate actions on local and Hemi results', () => {
    expect(app).toContain("isBlockchainRun ? 'NEW HEMI RUN' : 'PLAY AGAIN LOCALLY'");
    expect(app).toContain('LOCAL RUN — NO ONCHAIN SUBMISSION REQUIRED');
    expect(app).toContain('Return to the menu to begin another Hemi run.');
  });

  it('keeps protagonist identity unresolved and separates the whistleblower record', () => {
    expect(narrative).not.toMatch(/your handwriting|signature at the bottom is yours|You are in it|beside you/i);
    expect(puzzles).not.toMatch(/your handwriting/i);
    expect(scene).toContain('THE WHISTLEBLOWER RECORD');
    expect(scene).toContain('died attempting to help the other residents');
    expect(scene).toContain("I heard them outside the door.");
    expect(scene).not.toContain("The whistleblower died trying to reach the others.");
  });

  it('labels every Floor 4 code clue by lock-code position', () => {
    expect(puzzles).toContain('LOCK CODE // FIRST POSITION');
    expect(puzzles).toContain("const ordinals = ['FIRST', 'SECOND', 'THIRD'];");
    expect(puzzles).toContain('LOCK CODE // ${ordinals[index]} POSITION');
  });
});
