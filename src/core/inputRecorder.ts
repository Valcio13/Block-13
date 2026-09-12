/**
 * Input Recorder for Deterministic Replay
 * 
 * Records gameplay-affecting inputs in a compact format for verification.
 * Only records actual state changes (press/release), not held states.
 */

export enum InputAction {
  MOVE_LEFT = 0,
  MOVE_RIGHT = 1,
  MOVE_UP = 2,
  MOVE_DOWN = 3,
  TOGGLE_FLASHLIGHT = 4,
  INTERACT = 5,
}

export interface InputEvent {
  tick: number;       // Simulation tick when input changed
  action: InputAction; // Which input
  state: boolean;     // true = pressed, false = released
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  flashlight: boolean; // Just pressed (not held)
  interact: boolean;   // Just pressed (not held)
}

/**
 * Records input events for replay verification
 */
export class InputRecorder {
  private events: InputEvent[] = [];
  private previousState: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    flashlight: false,
    interact: false,
  };

  /**
   * Record input state at current tick
   * Only records when state changes (press/release)
   */
  recordTick(tick: number, currentState: InputState) {
    // Check for state changes and record events
    if (currentState.left !== this.previousState.left) {
      this.events.push({ tick, action: InputAction.MOVE_LEFT, state: currentState.left });
    }
    if (currentState.right !== this.previousState.right) {
      this.events.push({ tick, action: InputAction.MOVE_RIGHT, state: currentState.right });
    }
    if (currentState.up !== this.previousState.up) {
      this.events.push({ tick, action: InputAction.MOVE_UP, state: currentState.up });
    }
    if (currentState.down !== this.previousState.down) {
      this.events.push({ tick, action: InputAction.MOVE_DOWN, state: currentState.down });
    }

    // Flashlight and interact are toggle/single-press actions
    // Record when pressed (state becomes true)
    if (currentState.flashlight && !this.previousState.flashlight) {
      this.events.push({ tick, action: InputAction.TOGGLE_FLASHLIGHT, state: true });
    }
    if (currentState.interact && !this.previousState.interact) {
      this.events.push({ tick, action: InputAction.INTERACT, state: true });
    }

    // Update previous state
    this.previousState = { ...currentState };
  }

  /**
   * Get recorded input log
   */
  getEvents(): InputEvent[] {
    return [...this.events];
  }

  /**
   * Clear recorded events (for new run)
   */
  clear() {
    this.events = [];
    this.previousState = {
      left: false,
      right: false,
      up: false,
      down: false,
      flashlight: false,
      interact: false,
    };
  }

  /**
   * Get event count
   */
  getEventCount(): number {
    return this.events.length;
  }

  /**
   * Encode input log to binary format
   * 
   * Format:
   * - Header: "BLK13INP" (8 bytes) + version uint16 (2 bytes) + count uint16 (2 bytes)
   * - Events: tick uint32 (4 bytes) + action uint8 (1 byte) + state uint8 (1 byte)
   * 
   * Total: 12 + (6 * eventCount) bytes
   */
  encodeBinary(): Uint8Array {
    const eventCount = this.events.length;
    const size = 12 + (eventCount * 6);
    const buffer = new Uint8Array(size);
    const view = new DataView(buffer.buffer);

    // Header
    const magic = new TextEncoder().encode('BLK13INP');
    buffer.set(magic, 0);
    view.setUint16(8, 1, false); // Version 1
    view.setUint16(10, eventCount, false); // Event count

    // Events
    let offset = 12;
    for (const event of this.events) {
      view.setUint32(offset, event.tick, false); // Big-endian
      view.setUint8(offset + 4, event.action);
      view.setUint8(offset + 5, event.state ? 1 : 0);
      offset += 6;
    }

    return buffer;
  }

  /**
   * Decode binary input log
   */
  static decodeBinary(buffer: Uint8Array): InputEvent[] {
    const view = new DataView(buffer.buffer);

    // Verify magic
    const magic = new TextDecoder().decode(buffer.slice(0, 8));
    if (magic !== 'BLK13INP') {
      throw new Error('Invalid input log magic');
    }

    // Read header
    const version = view.getUint16(8, false);
    if (version !== 1) {
      throw new Error(`Unsupported input log version: ${version}`);
    }

    const eventCount = view.getUint16(10, false);
    const events: InputEvent[] = [];

    // Read events
    let offset = 12;
    for (let i = 0; i < eventCount; i++) {
      const tick = view.getUint32(offset, false);
      const action = view.getUint8(offset + 4) as InputAction;
      const state = view.getUint8(offset + 5) === 1;

      events.push({ tick, action, state });
      offset += 6;
    }

    return events;
  }

  /**
   * Encode input log to JSON (human-readable debug format)
   */
  encodeJSON(): string {
    return JSON.stringify({
      version: '1.0',
      eventCount: this.events.length,
      events: this.events.map(e => ({
        tick: e.tick,
        action: InputAction[e.action],
        state: e.state ? 'pressed' : 'released',
      })),
    }, null, 2);
  }

  /**
   * Decode JSON input log
   */
  static decodeJSON(json: string): InputEvent[] {
    const data = JSON.parse(json);
    
    if (data.version !== '1.0') {
      throw new Error(`Unsupported JSON version: ${data.version}`);
    }

    return data.events.map((e: any) => ({
      tick: e.tick,
      action: InputAction[e.action as keyof typeof InputAction] as InputAction,
      state: e.state === 'pressed',
    }));
  }

  /**
   * Generate canonical input hash for blockchain
   * Uses deterministic encoding: tick:action:state sorted by tick
   */
  generateInputHash(): string {
    // Sort by tick (should already be sorted, but ensure it)
    const sorted = [...this.events].sort((a, b) => a.tick - b.tick);

    // Canonical encoding
    const canonical = sorted
      .map(e => `${e.tick}:${e.action}:${e.state ? 1 : 0}`)
      .join('|');

    // Simple hash for now - in production use viem's keccak256
    const encoder = new TextEncoder();
    const data = encoder.encode(canonical);
    
    // For now, use a simple hash
    // TODO: Replace with keccak256 from viem for Solidity compatibility
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data[i];
      hash = hash & hash; // Convert to 32-bit integer
    }

    return '0x' + Math.abs(hash).toString(16).padStart(64, '0');
  }
}

/**
 * Replay engine that reconstructs input state from event log
 */
export class InputReplayer {
  private events: InputEvent[];
  private currentIndex: number = 0;
  private currentState: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    flashlight: false,
    interact: false,
  };

  constructor(events: InputEvent[]) {
    // Sort events by tick
    this.events = [...events].sort((a, b) => a.tick - b.tick);
  }

  /**
   * Get input state at given tick
   * Advances through event log and returns current input state
   */
  getStateAtTick(tick: number): InputState {
    // Process all events up to and including this tick
    while (this.currentIndex < this.events.length) {
      const event = this.events[this.currentIndex];
      
      if (event.tick > tick) {
        break; // Haven't reached this event yet
      }

      // Apply event to current state
      switch (event.action) {
        case InputAction.MOVE_LEFT:
          this.currentState.left = event.state;
          break;
        case InputAction.MOVE_RIGHT:
          this.currentState.right = event.state;
          break;
        case InputAction.MOVE_UP:
          this.currentState.up = event.state;
          break;
        case InputAction.MOVE_DOWN:
          this.currentState.down = event.state;
          break;
        case InputAction.TOGGLE_FLASHLIGHT:
          // Toggle actions are momentary - set true for one tick
          this.currentState.flashlight = event.state;
          break;
        case InputAction.INTERACT:
          this.currentState.interact = event.state;
          break;
      }

      this.currentIndex++;
    }

    // Reset toggle actions after one tick
    const state = { ...this.currentState };
    this.currentState.flashlight = false;
    this.currentState.interact = false;

    return state;
  }

  /**
   * Reset replayer to beginning
   */
  reset() {
    this.currentIndex = 0;
    this.currentState = {
      left: false,
      right: false,
      up: false,
      down: false,
      flashlight: false,
      interact: false,
    };
  }
}
