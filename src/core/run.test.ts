import { describe, it, expect } from 'vitest';
import { createRun, completeFloor } from './run';
import { deriveSeeds, type RunManifest } from './seedDerivation';

describe('Run State Management', () => {
  it('creates a new run with initial state', () => {
    const run = createRun(); // Local run without manifest
    
    expect(run.seed).toBeGreaterThan(0); // Random seed
    expect(run.floor).toBe(4); // Now starting on Floor 4
    expect(run.battery).toBe(100);
    expect(run.hp).toBe(100);
    expect(run.curse).toBe(0);
    expect(run.score).toBe(0);
    expect(run.status).toBe('playing');
    expect(run.floorsCompleted).toBe(0);
    expect(run.manifest).toBeUndefined(); // Local run
  });

  it('keeps the complete manifest-derived world seed as an exact decimal BigInt', () => {
    const manifest: RunManifest = {
      runId: 9n,
      player: '0x1111111111111111111111111111111111111111',
      gameVersion: `0x${'22'.repeat(32)}`,
      rulesHash: `0x${'33'.repeat(32)}`,
      btcBlockHash: `0x${'44'.repeat(32)}`,
      hemiBlockHash: `0x${'55'.repeat(32)}`,
      ethBlockHash: `0x${'66'.repeat(32)}`,
      hemiTxHash: `0x${'77'.repeat(32)}`,
      startedAt: 0,
    };
    const run = createRun(manifest);
    const exact = deriveSeeds(manifest).world;
    expect(run.canonicalSeed).toBe(exact.toString(10));
    expect(run.seed).toBe(Number(exact & 0xffff_ffffn));
  });

  it('progresses through floors correctly', () => {
    let run = createRun();
    
    // Floor 4 -> 3
    run = completeFloor(run);
    expect(run.floor).toBe(3);
    expect(run.floorsCompleted).toBe(1);
    expect(run.score).toBe(400); // 100 * 4
    expect(run.curse).toBe(8);
    expect(run.status).toBe('playing');
    
    // Floor 3 -> 2
    run = completeFloor(run);
    expect(run.floor).toBe(2);
    expect(run.floorsCompleted).toBe(2);
    expect(run.score).toBe(700); // 400 + (100 * 3)
    expect(run.curse).toBe(16);
    expect(run.status).toBe('playing');
    
    // Floor 2 -> 1
    run = completeFloor(run);
    expect(run.floor).toBe(1);
    expect(run.floorsCompleted).toBe(3);
    expect(run.score).toBe(900); // 700 + (100 * 2)
    expect(run.curse).toBe(24);
    expect(run.status).toBe('playing');
    
    // Floor 1 -> Block 13 (floor 0)
    run = completeFloor(run);
    expect(run.floor).toBe(0); // Block 13
    expect(run.floorsCompleted).toBe(4);
    expect(run.score).toBe(1000); // 900 + (100 * 1)
    expect(run.status).toBe('playing'); // Still playing on Block 13
    
    // Block 13 complete
    run = completeFloor(run);
    expect(run.floor).toBe(-1);
    expect(run.status).toBe('won');
  });

  it('adds 8 curse per transition while normal progression can reach the terminal threshold', () => {
    let run = createRun();
    
    expect(run.curse).toBe(0);
    
    run = completeFloor(run);
    expect(run.curse).toBe(8);
    
    run = completeFloor(run);
    expect(run.curse).toBe(16);
    
    run = completeFloor(run);
    expect(run.curse).toBe(24);

    run.curse = 92;
    run = completeFloor(run);
    expect(run.curse).toBe(85); // The Floor 1 -> Block 13 arrival cap only.
    run.curse = 99;
    run = completeFloor(run);
    expect(run.curse).toBe(107); // Block 13 exit is not subject to the entry cap.
  });

  it('awards more points for higher floors', () => {
    let run = createRun();
    const initialScore = run.score;
    
    run = completeFloor(run); // Floor 4 -> 3
    const floor4Points = run.score - initialScore;
    expect(floor4Points).toBe(400);
    
    run = completeFloor(run); // Floor 3 -> 2
    const floor3Points = run.score - initialScore - floor4Points;
    expect(floor3Points).toBe(300);
    
    run = completeFloor(run); // Floor 2 -> 1
    const floor2Points = run.score - initialScore - floor4Points - floor3Points;
    expect(floor2Points).toBe(200);
  });

  it('restores battery slightly on floor completion', () => {
    let run = createRun();
    run.battery = 50; // Simulate battery drain
    
    run = completeFloor(run);
    expect(run.battery).toBe(70); // 50 + 20
    
    run.battery = 85;
    run = completeFloor(run);
    expect(run.battery).toBe(100); // Capped at 100
  });

  it('maintains seed across floor progression', () => {
    let run = createRun();
    const seed = run.seed;
    
    expect(run.seed).toBe(seed);
    
    run = completeFloor(run);
    expect(run.seed).toBe(seed);
    
    run = completeFloor(run);
    expect(run.seed).toBe(seed);
    
    run = completeFloor(run);
    expect(run.seed).toBe(seed);
  });
});
