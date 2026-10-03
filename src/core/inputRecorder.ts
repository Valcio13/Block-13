import { keccak256, toHex } from 'viem';

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

/** A source of per-tick gameplay input, independent of the simulation consumer. */
export interface InputSource {
  getStateAtTick(tick: number): InputState;
}

/** Samples live controls through a reader supplied by the platform adapter. */
export class LiveInputSource implements InputSource {
  constructor(private readonly read: () => InputState) {}

  getStateAtTick(_tick: number): InputState {
    return { ...this.read() };
  }
}

/** The single input path used by the game: sample source, simulate, then record. */
export class InputPipeline {
  constructor(
    private readonly source: InputSource,
    private readonly recorder: InputRecorder,
  ) {}

  step<T>(tick: number, simulate: (inputs: InputState) => T): T {
    const inputs = this.source.getStateAtTick(tick);
    const result = simulate(inputs);
    this.recorder.recordTick(tick, inputs);
    return result;
  }
}

/**
 * Records input events for replay verification
 */
export class InputRecorder {
  private events: InputEvent[] = [];
  private terminalTick = 0;
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
    if (!Number.isSafeInteger(tick) || tick < 0 || tick > 0xffffffff) throw new RangeError('tick must fit uint32');
    this.terminalTick = Math.max(this.terminalTick, tick + 1);
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

    // These controls are one-tick impulses, not held states. Record every
    // active tick so adjacent presses remain distinguishable in replay.
    if (currentState.flashlight) {
      this.events.push({ tick, action: InputAction.TOGGLE_FLASHLIGHT, state: true });
    }
    if (currentState.interact) {
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

  getTerminalTick(): number { return this.terminalTick; }
  setTerminalTick(tick: number) {
    if (!Number.isSafeInteger(tick) || tick < this.terminalTick || tick > 0xffffffff) {
      throw new RangeError('terminal tick must be uint32 and cannot precede recorded input');
    }
    this.terminalTick = tick;
  }

  /**
   * Clear recorded events (for new run)
   */
  clear() {
    this.events = [];
    this.terminalTick = 0;
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
   * - Header: "BLK13INP" (8 bytes) + version uint16 (2 bytes) + count uint16 (2 bytes) + terminalTick uint32 (4 bytes)
   * - Events: tick uint32 (4 bytes) + action uint8 (1 byte) + state uint8 (1 byte)
   * 
   * Total: 16 + (6 * eventCount) bytes
   */
  encodeBinary(): Uint8Array {
    const eventCount = this.events.length;
    if (eventCount > 0xffff) throw new RangeError('Input log exceeds the uint16 event limit');
    const size = 16 + (eventCount * 6);
    const buffer = new Uint8Array(size);
    const view = new DataView(buffer.buffer);

    // Header
    const magic = new TextEncoder().encode('BLK13INP');
    buffer.set(magic, 0);
    view.setUint16(8, 2, false); // Version 2 includes terminal simulation tick
    view.setUint16(10, eventCount, false); // Event count
    view.setUint32(12, this.terminalTick, false);

    // Events
    let offset = 16;
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
    if (buffer.length < 16) throw new Error('Input log is truncated');
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // Verify magic
    const magic = new TextDecoder().decode(buffer.slice(0, 8));
    if (magic !== 'BLK13INP') {
      throw new Error('Invalid input log magic');
    }

    // Read header
    const version = view.getUint16(8, false);
    if (version !== 2) {
      throw new Error(`Unsupported input log version: ${version}`);
    }

    const eventCount = view.getUint16(10, false);
    const terminalTick = view.getUint32(12, false);
    if (buffer.length !== 16 + eventCount * 6) throw new Error('Input log length does not match event count');
    const events: InputEvent[] = [];

    // Read events
    let offset = 16;
    for (let i = 0; i < eventCount; i++) {
      const tick = view.getUint32(offset, false);
      const actionValue = view.getUint8(offset + 4);
      const stateValue = view.getUint8(offset + 5);
      if (actionValue > InputAction.INTERACT || stateValue > 1) throw new Error('Invalid input event encoding');
      const action = actionValue as InputAction;
      const state = stateValue === 1;

      events.push({ tick, action, state });
      offset += 6;
    }

    Object.defineProperty(events, 'terminalTick', { value: terminalTick, enumerable: false });
    return events;
  }

  /** Canonical input hash: Ethereum keccak256 over the one canonical binary encoding. */
  async generateInputHash(): Promise<string> {
    return keccak256(toHex(this.encodeBinary()));
  }
}

/**
 * Replay engine that reconstructs input state from event log
 */
export class InputReplayer implements InputSource {
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
  readonly terminalTick: number;

  constructor(events: InputEvent[]) {
    this.terminalTick = (events as InputEvent[] & { terminalTick?: number }).terminalTick
      ?? (events.reduce((max, event) => Math.max(max, event.tick + 1), 0));
    // Stable sort preserves event order when multiple controls change on one tick.
    this.events = events.map((event, order) => ({ event, order }))
      .sort((a, b) => a.event.tick - b.event.tick || a.order - b.order)
      .map(({ event }) => event);
  }

  static fromBinary(binaryLog: Uint8Array): InputReplayer {
    return new InputReplayer(InputRecorder.decodeBinary(binaryLog));
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
