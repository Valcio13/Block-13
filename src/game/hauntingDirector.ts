/** Deterministic, presentation-local horror events. No simulation/RNG imports. */
export type HauntingEventType = 'false_footstep' | 'silence' | 'silhouette' | 'fake_stalker' | 'environment_shift' | 'whisper';
export type HorrorPacingStage = 'unease' | 'suspicion' | 'dread';
export interface HauntingEvent { type: HauntingEventType; durationMs: number; id: number; }
export interface HauntingInput { floor: number; tick: number; tileX: number; tileY: number; }

const FLOOR_BUDGET: Record<number, number> = { 4: 1, 3: 3, 2: 4, 1: 5, 0: 6 };
const FLOOR_CADENCE: Record<number, number> = { 4: 1800, 3: 1200, 2: 900, 1: 720, 0: 600 };
const FLOOR_PROBABILITY: Record<number, number> = { 4: 2, 3: 12, 2: 18, 1: 22, 0: 25 };
const EVENT_COOLDOWN_TICKS: Record<number, number> = { 4: 5400, 3: 3600, 2: 2700, 1: 2160, 0: 1800 };
export const HAUNTING_SEARCH_COOLDOWN_TICKS: Readonly<Record<number, number>> = { 3: 480, 2: 540, 1: 600, 0: 720 };
export const HAUNTING_WHISPER_LINES = [
  'Over here.', 'I found the key.', "Don't turn around.", 'Help me.',
  "It's behind you.", 'Wrong way.', 'I can see you.', 'You missed something.',
] as const;

export function hauntingWhisperLine(eventId: number, tileX: number, tileY: number): string {
  const index = (Math.imul(eventId ^ (tileX * 31 + tileY), 0x45d9f3b) >>> 0) % HAUNTING_WHISPER_LINES.length;
  return HAUNTING_WHISPER_LINES[index];
}

export function hauntingHash(input: HauntingInput, salt = 0): number {
  let hash = Math.imul((input.tileX + 0x9e3779b9) | 0, 0x85ebca6b);
  hash = Math.imul(hash ^ (input.tileY + 0x7f4a7c15), 0xc2b2ae35);
  hash = Math.imul(hash ^ (input.floor * 31 + salt), 0x27d4eb2d);
  return Math.imul(hash ^ Math.trunc(input.tick), 0x165667b1) >>> 0;
}

/** Pure event pick used by the stateful local budget manager and tests. */
export function hauntingEventFor(input: HauntingInput, eventIndex = 0, stage: HorrorPacingStage = 'suspicion'): HauntingEvent | null {
  const floor = Math.max(0, Math.min(4, Math.trunc(input.floor)));
  const cadence = FLOOR_CADENCE[floor];
  if (input.tick <= 0 || input.tick % cadence !== 0) return null;
  const roll = hauntingHash(input, eventIndex) % 100;
  if (roll >= FLOOR_PROBABILITY[floor]) return null;
  const floorOptions: HauntingEventType[] = floor === 4
    ? ['environment_shift', 'false_footstep']
    : floor === 3
      ? ['false_footstep', 'silence', 'silhouette', 'environment_shift']
      : floor === 2
        ? ['false_footstep', 'silence', 'silhouette', 'environment_shift']
        : ['false_footstep', 'silence', 'silhouette', 'environment_shift', 'whisper'];
  const options = floorOptions.filter(type => stage === 'dread'
    || (stage === 'unease' ? type === 'false_footstep' || type === 'environment_shift'
      : type !== 'silence' && type !== 'fake_stalker'));
  if (stage === 'dread' && floor <= 2) options.push('fake_stalker');
  const type = options[hauntingHash(input, eventIndex + 97) % options.length];
  if (floor === 4 && type === 'fake_stalker') return null;
  return {
    type,
    durationMs: type === 'silence' ? 800 + hauntingHash(input, eventIndex + 211) % 1201
      : type === 'fake_stalker' ? 300 + hauntingHash(input, eventIndex + 307) % 301
        : type === 'silhouette' ? 150 + hauntingHash(input, eventIndex + 401) % 351
          : type === 'whisper' ? 1400 + hauntingHash(input, eventIndex + 419) % 1201
          : type === 'environment_shift' ? 1800 : 0,
    id: hauntingHash(input, eventIndex + 503),
  };
}

/** Mutable state here is explicitly presentation-local: tick budget and cooldown only. */
export class HauntingDirector {
  private floor = -1;
  private emitted = 0;
  private lastEventTick = -Infinity;
  private searchEvents = 0;
  private lastSearchTick = -Infinity;
  private encounterRecoveryUntilTick = -Infinity;
  private lastEventType?: HauntingEventType;

  /** Priority lock for real encounters; input is a simulation tick, state stays presentation-local. */
  registerMajorEncounter(tick: number, recoveryTicks = 540) {
    this.encounterRecoveryUntilTick = Math.max(this.encounterRecoveryUntilTick, Math.trunc(tick) + Math.max(0, Math.trunc(recoveryTicks)));
  }

  canPresentAt(tick: number): boolean {
    return tick >= this.encounterRecoveryUntilTick;
  }
  get recoveryUntilTick(): number { return this.encounterRecoveryUntilTick; }

  prepareFloor(floorValue: number) {
    const floor = Math.max(0, Math.min(4, Math.trunc(floorValue)));
    if (this.floor === floor) return;
    this.floor = floor;
    this.emitted = 0;
    this.lastEventTick = -Infinity;
    this.searchEvents = 0;
    this.lastSearchTick = -Infinity;
    this.encounterRecoveryUntilTick = -Infinity;
    this.lastEventType = undefined;
  }

  evaluate(input: HauntingInput, stage: HorrorPacingStage = 'suspicion'): HauntingEvent | null {
    const floor = Math.max(0, Math.min(4, Math.trunc(input.floor)));
    const cadence = FLOOR_CADENCE[floor];
    this.prepareFloor(floor);
    if (!this.canPresentAt(input.tick)) return null;
    if (this.emitted + this.searchEvents >= FLOOR_BUDGET[floor] || input.tick - this.lastEventTick < EVENT_COOLDOWN_TICKS[floor]) return null;
    // The event slot derives only from the canonical simulation tick, so the
    // same checkpoint/tile yields the same presentation selection after refresh.
    const eventSlot = Math.floor(input.tick / cadence);
    const event = nextDistinctEvent({ ...input, floor }, eventSlot, stage, this.lastEventType);
    if (!event) return null;
    this.emitted++;
    this.lastEventTick = input.tick;
    this.lastEventType = event.type;
    return event;
  }

  evaluateSearch(input: HauntingInput, searchIndex: number, stage: HorrorPacingStage = 'suspicion'): HauntingEvent | null {
    const floor = Math.max(0, Math.min(4, Math.trunc(input.floor)));
    this.prepareFloor(floor);
    if (floor >= 4 || !this.canPresentAt(input.tick)) return null;
    const budget = floor === 3 ? 1 : floor === 2 ? 2 : floor === 1 ? 3 : 4;
    const searchCooldown = HAUNTING_SEARCH_COOLDOWN_TICKS[floor];
    if (this.emitted + this.searchEvents >= FLOOR_BUDGET[floor]
      || this.searchEvents >= budget || input.tick - this.lastSearchTick < searchCooldown
      || input.tick - this.lastEventTick < 180) return null;
    const chance = floor === 3 ? 3 : floor === 2 ? 9 : floor === 1 ? 14 : 17;
    if (hauntingHash(input, searchIndex + 701) % 100 >= chance) return null;
    this.searchEvents++;
    this.lastSearchTick = input.tick;
    this.lastEventTick = input.tick;
    const floorSearchTypes: HauntingEventType[] = floor <= 1
      ? ['false_footstep', 'silence', 'silhouette', 'whisper']
      : ['false_footstep', 'silence', 'silhouette'];
    const searchTypes = floorSearchTypes.filter(type => stage === 'dread'
      || (stage === 'unease' ? type === 'false_footstep' : type !== 'silence'));
    if (searchTypes.length === 0) return null;
    let selectedType = searchTypes[hauntingHash(input, searchIndex + 809) % searchTypes.length];
    if (selectedType === this.lastEventType) selectedType = searchTypes[(searchTypes.indexOf(selectedType) + 1) % searchTypes.length];
    this.lastEventType = selectedType;
    this.lastEventTick = input.tick;
    return { type: selectedType, durationMs: selectedType === 'silence' ? 850 : selectedType === 'whisper' ? 1800 : 260, id: hauntingHash(input, searchIndex + 907) };
  }
}

function nextDistinctEvent(input: HauntingInput, eventSlot: number, stage: HorrorPacingStage, previous?: HauntingEventType): HauntingEvent | null {
  let candidate: HauntingEvent | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    candidate = hauntingEventFor(input, eventSlot + attempt, stage);
    if (candidate && candidate.type !== previous) return candidate;
  }
  return candidate;
}

export interface HorrorPacingInput {
  floor: number;
  tileX: number;
  tileY: number;
  deltaMs: number;
  moving: boolean;
  realThreatActive: boolean;
  encounterStarted: boolean;
}

export interface HauntingPresentationGate {
  tick: number;
  status: 'playing' | 'won' | 'lost';
  paused: boolean;
  transitioning: boolean;
  modalOpen: boolean;
  presentationActive: boolean;
  realThreatActive: boolean;
  recoveryUntilTick: number;
}

export function hauntingPresentationAllowed(gate: HauntingPresentationGate): boolean {
  return gate.status === 'playing' && !gate.paused && !gate.transitioning && !gate.modalOpen
    && !gate.presentationActive && !gate.realThreatActive && gate.tick >= gate.recoveryUntilTick;
}

/** Exploration- and encounter-driven tension; it has no timer-based escalation or visible meter. */
export class HorrorPacingModel {
  private floor = -1;
  private pressure = 0;
  private visitedTiles = new Set<string>();
  private stageValue: HorrorPacingStage = 'unease';

  observe(input: HorrorPacingInput): HorrorPacingStage {
    const floor = Math.max(0, Math.min(4, Math.trunc(input.floor)));
    if (floor !== this.floor) {
      this.floor = floor;
      this.pressure = 0;
      this.visitedTiles.clear();
      this.stageValue = 'unease';
    }
    const tile = `${Math.trunc(input.tileX)},${Math.trunc(input.tileY)}`;
    if (input.moving && !this.visitedTiles.has(tile)) {
      this.visitedTiles.add(tile);
      this.pressure += [0, 6, 5, 4, 3][floor];
    }
    if (input.encounterStarted) this.pressure += floor === 4 ? 8 : 18;
    const delta = Number.isFinite(input.deltaMs) ? Math.max(0, input.deltaMs) : 0;
    this.pressure += input.realThreatActive ? delta * 0.002 : -delta * 0.0007;
    this.pressure = Math.max(0, Math.min(100, this.pressure));
    const suspicionAt = [22, 26, 30, 34, 38][floor];
    const dreadAt = [56, 60, 66, 72, 80][floor];
    this.stageValue = this.pressure >= dreadAt ? 'dread' : this.pressure >= suspicionAt ? 'suspicion' : 'unease';
    return this.stageValue;
  }

  get stage(): HorrorPacingStage { return this.stageValue; }
  get pressureValue(): number { return this.pressure; }
}

/** Presentation-only smooth ambience dip; update returns unity after its tail. */
export class HauntingSilence {
  private elapsedMs = 0;
  private durationMs = 0;
  private active = false;

  start(durationMs: number) {
    this.elapsedMs = 0;
    this.durationMs = Math.max(0, durationMs);
    this.active = this.durationMs > 0;
  }

  update(deltaMs: number): number {
    if (!this.active) return 1;
    this.elapsedMs += Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0);
    const fadeMs = Math.min(180, this.durationMs / 3);
    if (this.elapsedMs >= this.durationMs) {
      this.active = false;
      return 1;
    }
    if (fadeMs <= 0) return 0.12;
    if (this.elapsedMs < fadeMs) return 1 - 0.88 * (this.elapsedMs / fadeMs);
    if (this.elapsedMs > this.durationMs - fadeMs) {
      return 0.12 + 0.88 * ((this.elapsedMs - (this.durationMs - fadeMs)) / fadeMs);
    }
    return 0.12;
  }

  clear(): 1 { this.active = false; this.elapsedMs = 0; this.durationMs = 0; return 1; }
  get isActive() { return this.active; }
}

/** Fake visual actors are never simulation entities and never carry gameplay effects. */
export const HAUNTING_VISUAL_ACTOR_FLAGS = Object.freeze({ authoritativeEntity: false, collision: false, damage: false });

export const HAUNTING_EVENT_BUDGET = FLOOR_BUDGET;
export const HAUNTING_EVENT_COOLDOWN_TICKS = EVENT_COOLDOWN_TICKS;
