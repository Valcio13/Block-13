import { describe, it, expect } from 'vitest';
import { createRun, completeFloor } from './run';

describe('Run State Management', () => {
  it('creates a new run with initial state', () => {
    const seed = 12345;
    const run = createRun(seed);
    
    expect(run.seed).toBe(seed);
    expect(run.floor).toBe(3);
    expect(run.battery).toBe(100);
    expect(run.curse).toBe(0);
    expect(run.score).toBe(0);
    expect(run.status).toBe('playing');
    expect(run.floorsCompleted).toBe(0);
  });

  it('progresses through floors correctly', () => {
    const run = createRun(99999);
    
    // Complete floor 3
    const afterFloor3 = completeFloor(run);
    expect(afterFloor3.floor).toBe(2);
    expect(afterFloor3.floorsCompleted).toBe(1);
    expect(afterFloor3.score).toBe(300); // 100 * 3
    expect(afterFloor3.curse).toBe(10);
    expect(afterFloor3.status).toBe('playing');
    
    // Complete floor 2
    const afterFloor2 = completeFloor(afterFloor3);
    expect(afterFloor2.floor).toBe(1);
    expect(afterFloor2.floorsCompleted).toBe(2);
    expect(afterFloor2.score).toBe(500); // 300 + (100 * 2)
    expect(afterFloor2.curse).toBe(20);
    expect(afterFloor2.status).toBe('playing');
    
    // Complete floor 1 (final floor)
    const afterFloor1 = completeFloor(afterFloor2);
    expect(afterFloor1.floor).toBe(0);
    expect(afterFloor1.floorsCompleted).toBe(3);
    expect(afterFloor1.score).toBe(600); // 500 + (100 * 1)
    expect(afterFloor1.curse).toBe(30);
    expect(afterFloor1.status).toBe('won');
  });

  it('increases danger (curse) with each floor', () => {
    let run = createRun(11111);
    
    expect(run.curse).toBe(0);
    
    run = completeFloor(run);
    expect(run.curse).toBe(10);
    
    run = completeFloor(run);
    expect(run.curse).toBe(20);
    
    run = completeFloor(run);
    expect(run.curse).toBe(30);
  });

  it('awards more points for higher floors', () => {
    let run = createRun(22222);
    const initialScore = run.score;
    
    run = completeFloor(run); // Floor 3 -> 2
    const floor3Points = run.score - initialScore;
    expect(floor3Points).toBe(300);
    
    run = completeFloor(run); // Floor 2 -> 1
    const floor2Points = run.score - initialScore - floor3Points;
    expect(floor2Points).toBe(200);
    
    run = completeFloor(run); // Floor 1 -> 0
    const floor1Points = run.score - initialScore - floor3Points - floor2Points;
    expect(floor1Points).toBe(100);
  });

  it('restores battery slightly on floor completion', () => {
    let run = createRun(33333);
    run.battery = 50; // Simulate battery drain
    
    run = completeFloor(run);
    expect(run.battery).toBe(70); // 50 + 20
    
    run.battery = 85;
    run = completeFloor(run);
    expect(run.battery).toBe(100); // Capped at 100
  });

  it('maintains seed across floor progression', () => {
    const seed = 54321;
    let run = createRun(seed);
    
    expect(run.seed).toBe(seed);
    
    run = completeFloor(run);
    expect(run.seed).toBe(seed);
    
    run = completeFloor(run);
    expect(run.seed).toBe(seed);
    
    run = completeFloor(run);
    expect(run.seed).toBe(seed);
  });
});
