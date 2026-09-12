/**
 * Fixed Timestep Simulation Engine
 * 
 * Provides deterministic simulation independent of framerate.
 * Uses accumulator pattern to run fixed updates at exactly 60 Hz.
 */

export class SimulationEngine {
  // Fixed simulation rate
  public static readonly TICK_RATE = 60; // 60 Hz
  public static readonly FIXED_DELTA_MS = 1000 / SimulationEngine.TICK_RATE; // 16.666ms
  public static readonly FIXED_DELTA_SEC = 1 / SimulationEngine.TICK_RATE; // 0.01666s

  private accumulator: number = 0;
  private simulationTick: number = 0;
  private maxAccumulator: number = SimulationEngine.FIXED_DELTA_MS * 10; // Cap at 10 ticks to prevent spiral of death

  /**
   * Get current simulation tick
   */
  getTick(): number {
    return this.simulationTick;
  }

  /**
   * Reset simulation to tick 0
   */
  reset() {
    this.accumulator = 0;
    this.simulationTick = 0;
  }

  /**
   * Update simulation with variable delta
   * Runs fixed updates until caught up
   * 
   * @param realDelta - Real-world delta time in milliseconds
   * @param fixedUpdateCallback - Function called each fixed tick
   * @returns Number of ticks executed this frame
   */
  update(realDelta: number, fixedUpdateCallback: (fixedDelta: number, tick: number) => void): number {
    // Add real delta to accumulator
    this.accumulator += realDelta;

    // Cap accumulator to prevent spiral of death on lag spikes
    if (this.accumulator > this.maxAccumulator) {
      console.warn(`[SimulationEngine] Capping accumulator at ${this.maxAccumulator}ms (was ${this.accumulator}ms)`);
      this.accumulator = this.maxAccumulator;
    }

    let ticksExecuted = 0;

    // Run fixed updates until caught up
    while (this.accumulator >= SimulationEngine.FIXED_DELTA_MS) {
      // Execute fixed update with FIXED delta
      fixedUpdateCallback(SimulationEngine.FIXED_DELTA_MS, this.simulationTick);

      this.simulationTick++;
      this.accumulator -= SimulationEngine.FIXED_DELTA_MS;
      ticksExecuted++;

      // Safety limit: don't run more than 10 ticks per frame
      if (ticksExecuted >= 10) {
        console.warn(`[SimulationEngine] Executed 10 ticks in one frame, discarding remaining accumulator`);
        this.accumulator = 0;
        break;
      }
    }

    return ticksExecuted;
  }

  /**
   * Get interpolation alpha for smooth rendering
   * Use this to interpolate between previous and current state for smooth visuals
   * 
   * @returns Alpha value between 0 and 1
   */
  getInterpolationAlpha(): number {
    return this.accumulator / SimulationEngine.FIXED_DELTA_MS;
  }

  /**
   * Convert ticks to milliseconds
   */
  static ticksToMs(ticks: number): number {
    return ticks * SimulationEngine.FIXED_DELTA_MS;
  }

  /**
   * Convert ticks to seconds
   */
  static ticksToSec(ticks: number): number {
    return ticks * SimulationEngine.FIXED_DELTA_SEC;
  }

  /**
   * Convert milliseconds to ticks
   */
  static msToTicks(ms: number): number {
    return Math.floor(ms / SimulationEngine.FIXED_DELTA_MS);
  }

  /**
   * Convert seconds to ticks
   */
  static secToTicks(sec: number): number {
    return Math.floor(sec * SimulationEngine.TICK_RATE);
  }
}

/**
 * Cooldown manager using simulation ticks instead of Date.now()
 */
export class TickCooldown {
  private lastTriggerTick: number = -Infinity;
  private cooldownTicks: number;

  constructor(cooldownMs: number) {
    this.cooldownTicks = SimulationEngine.msToTicks(cooldownMs);
  }

  /**
   * Check if cooldown has elapsed
   */
  isReady(currentTick: number): boolean {
    return (currentTick - this.lastTriggerTick) >= this.cooldownTicks;
  }

  /**
   * Trigger cooldown
   */
  trigger(currentTick: number) {
    this.lastTriggerTick = currentTick;
  }

  /**
   * Get remaining ticks until ready
   */
  getRemainingTicks(currentTick: number): number {
    const elapsed = currentTick - this.lastTriggerTick;
    return Math.max(0, this.cooldownTicks - elapsed);
  }

  /**
   * Reset cooldown (make immediately ready)
   */
  reset() {
    this.lastTriggerTick = -Infinity;
  }
}

/**
 * Timer using simulation ticks instead of Date.now()
 */
export class TickTimer {
  private startTick: number = 0;
  private durationTicks: number;
  private running: boolean = false;

  constructor(durationMs: number) {
    this.durationTicks = SimulationEngine.msToTicks(durationMs);
  }

  /**
   * Start timer
   */
  start(currentTick: number) {
    this.startTick = currentTick;
    this.running = true;
  }

  /**
   * Stop timer
   */
  stop() {
    this.running = false;
  }

  /**
   * Check if timer has elapsed
   */
  isComplete(currentTick: number): boolean {
    if (!this.running) return false;
    return (currentTick - this.startTick) >= this.durationTicks;
  }

  /**
   * Get elapsed ticks
   */
  getElapsedTicks(currentTick: number): number {
    if (!this.running) return 0;
    return currentTick - this.startTick;
  }

  /**
   * Get remaining ticks
   */
  getRemainingTicks(currentTick: number): number {
    if (!this.running) return 0;
    const elapsed = currentTick - this.startTick;
    return Math.max(0, this.durationTicks - elapsed);
  }

  /**
   * Check if timer is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Reset timer
   */
  reset() {
    this.running = false;
    this.startTick = 0;
  }
}

/**
 * Interval for recurring events (e.g., spawn enemy every 300 ticks)
 */
export class TickInterval {
  private lastTriggerTick: number = 0;
  private intervalTicks: number;

  constructor(intervalMs: number) {
    this.intervalTicks = SimulationEngine.msToTicks(intervalMs);
  }

  /**
   * Check if interval has elapsed and trigger if so
   * Returns true if triggered
   */
  check(currentTick: number): boolean {
    if ((currentTick - this.lastTriggerTick) >= this.intervalTicks) {
      this.lastTriggerTick = currentTick;
      return true;
    }
    return false;
  }

  /**
   * Reset interval to current tick
   */
  reset(currentTick: number) {
    this.lastTriggerTick = currentTick;
  }

  /**
   * Get ticks until next trigger
   */
  getTicksUntilNext(currentTick: number): number {
    const elapsed = currentTick - this.lastTriggerTick;
    return Math.max(0, this.intervalTicks - elapsed);
  }
}
