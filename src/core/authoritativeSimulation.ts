import { generateFloor, type Floor, type FloorLootRng } from './floor';
import type { InputState } from './inputRecorder';
import { PCG32 } from './pcg32';
import { nextProgressionFloor, isOutsideFloor, isBlock13Arrival } from './progression';

/** Deterministic gameplay world. No Phaser, DOM, timers, or wall clock imports. */
export const FIXED_SCALE = 256; // one world pixel = 256 subpixels
export const SIMULATION_HZ = 60;
export const PLAYER_SPEED_SUBPIXELS_PER_SECOND = 160 * FIXED_SCALE;
export const INTERACTION_RANGE_SUBPIXELS = 48 * FIXED_SCALE;
export const PLAYER_RADIUS_SUBPIXELS = 7 * FIXED_SCALE;
export const PLAYER_COLLISION_HALF_EXTENT_SUBPIXELS = PLAYER_RADIUS_SUBPIXELS;

export type SimulationEvent =
  | { type: 'loot_searched'; index: number; result: Floor['searchables'][number]['result'] }
  | { type: 'key_collected' }
  | { type: 'floor_transition'; fromFloor: number; toFloor: number; floorsCompleted: number }
  | { type: 'damage'; amount: number; hp: number }
  | { type: 'mimic_revealed'; index: number };
export interface SimulationTickResult { state: AuthoritativeState; events: SimulationEvent[] }

/** Floor generator input: low 32 bits of the unsigned canonical seed. The
 * generator itself applies its existing floor-specific XOR domain mix. */
export function floorSeedFromCanonicalSeed(seed: bigint): number {
  return Number(seed & 0xffff_ffffn);
}

export interface AuthoritativeState {
  tick: number;
  playerMoveRemainderX: number;
  playerMoveRemainderY: number;
  floor: number;
  floorsCompleted: number;
  x: number;
  y: number;
  hp: number;
  battery: number;
  curse: number;
  score: number;
  status: 'playing' | 'won' | 'lost';
  flashlightOn: boolean;
  hasKey: boolean;
  searched: boolean[];
  invulnerableUntilTick: number;
  scareLockoutUntilTick: number;
  facingX: number;
  facingY: number;
  stalker: StalkerSnapshot;
  crawlers: CrawlerSnapshot[];
  watchers: WatcherSnapshot[];
  ambushers: AmbusherSnapshot[];
  mimics: MimicSnapshot[];
  corruption: CorruptionSnapshot;
  boxScare: BoxScareSnapshot;
  scareEventId: number;
  damageEventId: number;
  lastDamage: number;
}

export type StalkerSnapshot = {
  state: 'dormant' | 'roaming' | 'investigating' | 'hunting' | 'retreating';
  x: number; y: number; targetX: number; targetY: number;
  ticksRemaining: number; chaseStartTick: number; lastChaseEndTick: number;
  visible: boolean; moveRemainder: number;
};
export type CrawlerSnapshot = { id: number; x: number; y: number; targetX: number; targetY: number; chasing: boolean; chaseStartTick: number; moveRemainder: number };
export type WatcherSnapshot = { id: number; x: number; y: number; active: boolean; illuminatedTicks: number; decayRemainder: number; curseRemainder: number };
export type AmbusherSnapshot = { id: number; x: number; y: number; state: 'hidden' | 'warning' | 'jumpscare' | 'inactive'; warningTicks: number; damageAtTick: number; damage: number; hasTriggered: boolean };
export type MimicSnapshot = { searchableIndex: number; x: number; y: number; targetX: number; targetY: number; moveRemainder: number; revealed: boolean; chaseUntilTick: number; active: boolean };
export type CorruptionSnapshot = { lastTriggerTick: number; effectId: number; effectType: number; intensityPermille: number; durationTicks: number };
export type BoxScareSnapshot = { lastTriggerTick: number; lastType: number; availableTypes: number[] };

export interface SimulationSnapshot {
  state: AuthoritativeState;
  floor: Floor;
  rng: Record<string, { state: string; increment: string }>;
}

const cloneState = (s: AuthoritativeState): AuthoritativeState => ({
  ...s, searched: [...s.searched], stalker: { ...s.stalker }, crawlers: s.crawlers.map(e => ({ ...e })),
  watchers: s.watchers.map(e => ({ ...e })), ambushers: s.ambushers.map(e => ({ ...e })),
  mimics: s.mimics.map(e => ({ ...e })), corruption: { ...s.corruption }, boxScare: { ...s.boxScare, availableTypes: [...s.boxScare.availableTypes] },
});
const cloneFloor = (floor: Floor): Floor => ({
  ...floor,
  tiles: floor.tiles.map(row => [...row]), start: [...floor.start], key: [...floor.key], exit: [...floor.exit],
  rooms: floor.rooms.map(room => ({ ...room })), doors: floor.doors.map(door => [...door]),
  searchables: floor.searchables.map(item => ({ ...item, result: { ...item.result } })),
});
const square = (n: number) => n * n;
const TILE = 32 * FIXED_SCALE;
const CENTER = 16 * FIXED_SCALE;
const STALKER_SPECS = {
  4: { dormant: 9500, roam: 40, hunt: 120, detect: 120, investigate: 120 },
  3: { dormant: 8500, roam: 50, hunt: 140, detect: 150, investigate: 180 },
  2: { dormant: 5000, roam: 70, hunt: 160, detect: 200, investigate: 240 },
  1: { dormant: 2000, roam: 90, hunt: 180, detect: 250, investigate: 300 },
  0: { dormant: 1000, roam: 100, hunt: 200, detect: 300, investigate: 360 },
} as const;

export class AuthoritativeSimulation {
  private worldRng: PCG32;
  private economyRng: PCG32;
  private eventRng: PCG32;
  private cosmeticRng: PCG32;
  private stalkerRng: PCG32;
  private crawlerRng: PCG32;
  private watcherRng: PCG32;
  private ambusherRng: PCG32;
  private stateValue: AuthoritativeState;
  private floorValue: Floor;
  private readonly seed: bigint;
  private boxScareRng: PCG32;
  private tickEvents: SimulationEvent[] = [];

  constructor(seed: bigint, state?: Partial<AuthoritativeState>) {
    this.seed = seed;
    // Domain separation via fixed 64-bit xor salts. Streams are never shared.
    const mask = 0xffff_ffff_ffff_ffffn;
    this.worldRng = new PCG32((seed ^ 0x574f524c44n) & mask);
    this.economyRng = new PCG32((seed ^ 0x45434f4e4f4d59n) & mask);
    this.eventRng = new PCG32((seed ^ 0x4556454e54n) & mask);
    this.cosmeticRng = new PCG32((seed ^ 0x434f534d45544943n) & mask);
    this.stalkerRng = new PCG32((seed ^ 0x5354414c4b4552n) & mask);
    this.crawlerRng = new PCG32((seed ^ 0x435241574c4552n) & mask);
    this.watcherRng = new PCG32((seed ^ 0x57415443484552n) & mask);
    this.ambusherRng = new PCG32((seed ^ 0x414d425553484552n) & mask);
    this.boxScareRng = new PCG32((seed ^ 0x424f585343415245n) & mask);
    const floorNumber = state?.floor ?? 4;
    this.floorValue = generateFloor(this.floorSeed(), floorNumber, this.economyLootRng());
    this.stateValue = {
      tick: 0, playerMoveRemainderX: 0, playerMoveRemainderY: 0, floor: floorNumber,
      floorsCompleted: 0,
      x: (this.floorValue.start[0] * 32 + 16) * FIXED_SCALE,
      y: (this.floorValue.start[1] * 32 + 16) * FIXED_SCALE,
      hp: 100, battery: 100 * FIXED_SCALE, curse: 0, score: 0,
      status: 'playing', flashlightOn: false, hasKey: false,
      searched: this.floorValue.searchables.map(() => false),
      invulnerableUntilTick: 0, scareLockoutUntilTick: 0,
      facingX: 0, facingY: 1,
      stalker: { state: 'dormant', x: 0, y: 0, targetX: 0, targetY: 0, ticksRemaining: 0, chaseStartTick: 0, lastChaseEndTick: -600, visible: false, moveRemainder: 0 },
      crawlers: [], watchers: [], ambushers: [],
      mimics: this.floorValue.searchables.flatMap((item, searchableIndex) => item.isMimic ? [{ searchableIndex, x: (item.x * 32 + 16) * FIXED_SCALE, y: (item.y * 32 + 16) * FIXED_SCALE, targetX: (item.x * 32 + 16) * FIXED_SCALE, targetY: (item.y * 32 + 16) * FIXED_SCALE, moveRemainder: 0, revealed: false, chaseUntilTick: 0, active: true }] : []),
      corruption: { lastTriggerTick: -1_000_000, effectId: 0, effectType: 0, intensityPermille: 0, durationTicks: 0 },
      boxScare: { lastTriggerTick: -1_000_000, lastType: -1, availableTypes: [] },
      scareEventId: 0, damageEventId: 0, lastDamage: 0,
      ...state,
    };
    if (this.stateValue.battery === 0) this.stateValue.flashlightOn = false;
    this.resetBoxScares();
    if (!state?.stalker) this.spawnFloorEntities();
  }

  private spawnFloorEntities() {
    const s = this.stateValue;
    const tiles = this.floorValue.tiles;
    const walkable: Array<[number, number]> = [];
    for (let y = 0; y < tiles.length; y++) for (let x = 0; x < tiles[y].length; x++) if (tiles[y][x]) walkable.push([x, y]);
    const farTile = (minimumPixels: number, maximumPixels = Number.MAX_SAFE_INTEGER, rng = this.worldRng): [number, number] => {
      const min2 = square(minimumPixels * FIXED_SCALE), max2 = square(maximumPixels * FIXED_SCALE);
      const eligible = walkable.filter(([x, y]) => {
        const dx = (x * 32 + 16) * FIXED_SCALE - s.x;
        const dy = (y * 32 + 16) * FIXED_SCALE - s.y;
        const d2 = square(dx) + square(dy);
        return d2 >= min2 && d2 <= max2;
      });
      if (eligible.length) return eligible[rng.nextRange(0, eligible.length - 1)];
      return walkable.reduce((best, cell) => {
        const d = square((cell[0] * 32 + 16) * FIXED_SCALE - s.x) + square((cell[1] * 32 + 16) * FIXED_SCALE - s.y);
        const bd = square((best[0] * 32 + 16) * FIXED_SCALE - s.x) + square((best[1] * 32 + 16) * FIXED_SCALE - s.y);
        return d > bd ? cell : best;
      }, walkable[0] ?? [this.floorValue.exit[0], this.floorValue.exit[1]]);
    };
    const center = ([x, y]: [number, number]) => [(x * 32 + 16) * FIXED_SCALE, (y * 32 + 16) * FIXED_SCALE] as const;
    const stalkerCell = farTile(300, Number.MAX_SAFE_INTEGER, this.stalkerRng);
    const [stalkerX, stalkerY] = center(stalkerCell);
    const stalkerSpec = STALKER_SPECS[s.floor as keyof typeof STALKER_SPECS] ?? STALKER_SPECS[4];
    const dormant = this.stalkerRng.nextRange(0, 9999) < stalkerSpec.dormant;
    s.stalker = {
      state: dormant ? 'dormant' : 'roaming', x: stalkerX, y: stalkerY, targetX: stalkerX, targetY: stalkerY,
      ticksRemaining: dormant ? 300 + this.stalkerRng.nextRange(0, 600) : 0,
      chaseStartTick: 0, lastChaseEndTick: -600, visible: false, moveRemainder: 0,
    };
    if (!dormant) this.pickStalkerRoamTarget();

    let crawlerCount = 0, watcherCount = 0, ambusherCount = 0;
    switch (s.floor) {
      case 4: ambusherCount = this.ambusherRng.nextInt() % 2; break;
      case 3: crawlerCount = this.crawlerRng.nextInt() % 2; watcherCount = this.watcherRng.nextInt() % 2; ambusherCount = 1; break;
      case 2: crawlerCount = 1 + this.crawlerRng.nextRange(0, 1); watcherCount = 1; ambusherCount = 1 + this.ambusherRng.nextRange(0, 1); break;
      case 1: crawlerCount = 2 + this.crawlerRng.nextRange(0, 1); watcherCount = 1 + this.watcherRng.nextRange(0, 1); ambusherCount = 2; break;
      case 0: crawlerCount = 3 + this.crawlerRng.nextRange(0, 1); watcherCount = 2 + this.watcherRng.nextRange(0, 1); ambusherCount = 2 + this.ambusherRng.nextRange(0, 1); break;
      default: break;
    }
    s.crawlers = Array.from({ length: crawlerCount }, (_, id) => {
      const [x, y] = center(farTile(250, Number.MAX_SAFE_INTEGER, this.crawlerRng));
      const [tx, ty] = center(walkable[this.crawlerRng.nextRange(0, walkable.length - 1)]);
      return { id, x, y, targetX: tx, targetY: ty, chasing: false, chaseStartTick: 0, moveRemainder: 0 };
    });
    s.watchers = Array.from({ length: watcherCount }, (_, id) => {
      const [x, y] = center(farTile(200, Number.MAX_SAFE_INTEGER, this.watcherRng));
      return { id, x, y, active: true, illuminatedTicks: 0, decayRemainder: 0, curseRemainder: 0 };
    });
    const hidingCells: [number, number][] = [];
    for (const room of this.floorValue.rooms.slice(1)) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (tiles[room.y]?.[x]) hidingCells.push([x, room.y]);
        const by = room.y + room.height - 1;
        if (tiles[by]?.[x]) hidingCells.push([x, by]);
      }
      for (let y = room.y + 1; y < room.y + room.height - 1; y++) {
        if (tiles[y]?.[room.x]) hidingCells.push([room.x, y]);
        const bx = room.x + room.width - 1;
        if (tiles[y]?.[bx]) hidingCells.push([bx, y]);
      }
    }
    s.ambushers = Array.from({ length: ambusherCount }, (_, id) => {
      const playerX = s.x, playerY = s.y;
      const valid = hidingCells.filter(([x, y]) => {
        const wx = (x * 32 + 16) * FIXED_SCALE, wy = (y * 32 + 16) * FIXED_SCALE;
        const d2 = square(wx - playerX) + square(wy - playerY);
        return d2 > square(200 * FIXED_SCALE) && d2 < square(400 * FIXED_SCALE);
      });
      const [x, y] = center(valid.length ? valid[this.ambusherRng.nextRange(0, valid.length - 1)] : farTile(200, Number.MAX_SAFE_INTEGER, this.ambusherRng));
      return { id, x, y, state: 'hidden' as const, warningTicks: 0, damageAtTick: -1, damage: 5 + this.ambusherRng.nextRange(0, 3), hasTriggered: false };
    });
  }

  private pickStalkerRoamTarget() {
    const cells: Array<[number, number]> = [];
    for (let y = 0; y < this.floorValue.height; y++) for (let x = 0; x < this.floorValue.width; x++) if (this.floorValue.tiles[y][x]) cells.push([x, y]);
    if (!cells.length) return;
    const [tx, ty] = cells[this.stalkerRng.nextRange(0, cells.length - 1)];
    this.stateValue.stalker.targetX = (tx * 32 + 16) * FIXED_SCALE;
    this.stateValue.stalker.targetY = (ty * 32 + 16) * FIXED_SCALE;
  }

  get state(): AuthoritativeState { return cloneState(this.stateValue); }
  get floor(): Floor { return cloneFloor(this.floorValue); }
  snapshot(): SimulationSnapshot {
    return { state: this.state, floor: cloneFloor(this.floorValue), rng: {
      world: this.worldRng.snapshot(), economy: this.economyRng.snapshot(), event: this.eventRng.snapshot(),
      stalker: this.stalkerRng.snapshot(), crawler: this.crawlerRng.snapshot(), watcher: this.watcherRng.snapshot(), ambusher: this.ambusherRng.snapshot(), boxScare: this.boxScareRng.snapshot(),
    } };
  }

  /** Cosmetic consumers must use this stream; it never feeds gameplay decisions. */
  nextCosmeticRandom(): number { return this.cosmeticRng.nextInt(); }

  /** Exactly one authoritative tick. Inputs are sampled before this method. */
  step(input: InputState): AuthoritativeState {
    return this.stepWithEvents(input).state;
  }

  /** Authoritative tick plus ordered transition events for presentation adapters. */
  stepWithEvents(input: InputState): SimulationTickResult {
    this.tickEvents = [];
    const s = this.stateValue;
    if (s.status !== 'playing') return { state: this.state, events: [] };
    const tick = s.tick;
    if (tick >= s.scareLockoutUntilTick) this.movePlayer(input);
    if (input.right !== input.left && (input.right || input.left)) { s.facingX = input.right ? 1 : -1; s.facingY = 0; }
    if (input.down !== input.up && (input.down || input.up)) { s.facingX = 0; s.facingY = input.down ? 1 : -1; }
    // Flashlight input cannot switch on without charge. If already on, allow
    // the authoritative drain below to reach the exact zero boundary.
    if (input.flashlight && s.battery > 0) s.flashlightOn = !s.flashlightOn;
    if (s.flashlightOn && s.battery > 0) {
      // Drain 9/256 percent per tick (0.03515625%), rounded down to the
      // integer subpercent scale; exact integer arithmetic avoids float drift.
      s.battery = Math.max(0, s.battery - 9);
    }
    if (s.battery === 0) s.flashlightOn = false;
    this.updateStalker(tick);
    this.updateCrawlers(tick);
    this.updateWatchers(tick);
    this.updateAmbushers(tick);
    this.updateMimics(tick);
    this.updateCorruption(tick);
    if (input.interact) this.interact();
    if (s.curse >= 100 * FIXED_SCALE) s.status = 'lost';
    s.tick++;
    return { state: this.state, events: [...this.tickEvents] };
  }

  private movePlayer(input: InputState) {
    let dx = (Number(input.right) - Number(input.left)) * PLAYER_SPEED_SUBPIXELS_PER_SECOND;
    let dy = (Number(input.down) - Number(input.up)) * PLAYER_SPEED_SUBPIXELS_PER_SECOND;
    if (dx && dy) { dx = Math.trunc(dx * 181 / 256); dy = Math.trunc(dy * 181 / 256); }
    const s = this.stateValue;
    s.playerMoveRemainderX += dx; s.playerMoveRemainderY += dy;
    const mx = Math.trunc(s.playerMoveRemainderX / SIMULATION_HZ);
    const my = Math.trunc(s.playerMoveRemainderY / SIMULATION_HZ);
    s.playerMoveRemainderX -= mx * SIMULATION_HZ; s.playerMoveRemainderY -= my * SIMULATION_HZ;
    this.moveAxis(mx, true);
    this.moveAxis(my, false);
  }

  private moveAxis(amount: number, horizontal: boolean) {
    if (!amount) return;
    const s = this.stateValue;
    const steps = Math.ceil(Math.abs(amount) / FIXED_SCALE);
    let moved = 0;
    for (let i = 0; i < steps; i++) {
      const remaining = amount - moved;
      const increment = Math.sign(remaining) * Math.min(FIXED_SCALE, Math.abs(remaining));
      const x = horizontal ? s.x + increment : s.x;
      const y = horizontal ? s.y : s.y + increment;
      if (!this.isPlayerFootprintWalkable(x, y)) break;
      if (horizontal) s.x = x; else s.y = y;
      moved += increment;
    }
  }

  private isPlayerFootprintWalkable(x: number, y: number): boolean {
    const half = PLAYER_COLLISION_HALF_EXTENT_SUBPIXELS;
    const minTileX = Math.floor((x - half) / TILE);
    const maxTileX = Math.floor((x + half - 1) / TILE);
    const minTileY = Math.floor((y - half) / TILE);
    const maxTileY = Math.floor((y + half - 1) / TILE);
    for (let ty = minTileY; ty <= maxTileY; ty++) for (let tx = minTileX; tx <= maxTileX; tx++) {
      if (this.floorValue.tiles[ty]?.[tx] !== true) return false;
    }
    return true;
  }

  private resetBoxScares() {
    const count = 4 + this.boxScareRng.nextRange(0, 2);
    const candidates = Array.from({ length: 8 }, (_, index) => index);
    const availableTypes: number[] = [];
    while (availableTypes.length < count) availableTypes.push(candidates.splice(this.boxScareRng.nextRange(0, candidates.length - 1), 1)[0]);
    this.stateValue.boxScare = { lastTriggerTick: -1_000_000, lastType: -1, availableTypes };
  }

  private maybeTriggerBoxScare(tick: number) {
    const scare = this.stateValue.boxScare;
    if (tick - scare.lastTriggerTick < 720) return;
    const floorChancePermille = this.stateValue.floor === 4 ? 65 : this.stateValue.floor === 3 ? 100 : this.stateValue.floor === 2 ? 150 : this.stateValue.floor === 1 ? 200 : 280;
    const chancePermillion = Math.trunc(floorChancePermille * (this.stateValue.hasKey ? 1300 : 1000));
    if (this.boxScareRng.nextRange(0, 999_999) >= chancePermillion) return;
    let choices = scare.availableTypes.filter(type => type !== scare.lastType);
    if (choices.length === 0) choices = scare.availableTypes;
    if (choices.length === 0) return;
    const type = choices[this.boxScareRng.nextRange(0, choices.length - 1)];
    scare.lastTriggerTick = tick;
    scare.lastType = type;
    // Legacy major BoxScares held movement for 1.5s; express that duration as 90 ticks.
    if (type === 1 || type === 5 || type === 7) {
      this.stateValue.scareLockoutUntilTick = Math.max(this.stateValue.scareLockoutUntilTick, tick + 90);
      this.stateValue.scareEventId++;
    }
  }

  private applyDamage(amount: number, tick: number, curseSubunits = 0): boolean {
    const s = this.stateValue;
    if (tick < s.invulnerableUntilTick || s.status !== 'playing') return false;
    s.hp = Math.max(0, s.hp - amount);
    s.curse = Math.min(100 * FIXED_SCALE, s.curse + curseSubunits);
    s.invulnerableUntilTick = tick + 90;
    s.lastDamage = amount;
    s.damageEventId++;
    this.tickEvents.push({ type: 'damage', amount, hp: s.hp });
    if (s.hp === 0 || s.curse >= 100 * FIXED_SCALE) s.status = 'lost';
    return true;
  }

  private updateStalker(tick: number) {
    const e = this.stateValue.stalker, s = this.stateValue;
    const spec = STALKER_SPECS[s.floor as keyof typeof STALKER_SPECS] ?? STALKER_SPECS[4];
    const dx = e.x - s.x, dy = e.y - s.y, d2 = square(dx) + square(dy);
    const cooldown = tick - e.lastChaseEndTick < 600;
    const distance = integerSqrt(d2);
    switch (e.state) {
      case 'dormant':
        if (e.ticksRemaining > 0) e.ticksRemaining--;
        else if (!cooldown) { e.state = 'roaming'; this.pickStalkerRoamTarget(); }
        break;
      case 'roaming':
        this.moveActor(e, spec.roam);
        if (!cooldown && distance < spec.detect * FIXED_SCALE && !s.flashlightOn) {
          e.state = 'investigating'; e.targetX = s.x; e.targetY = s.y; e.ticksRemaining = spec.investigate;
        }
        if (this.actorReached(e, 20)) this.pickStalkerRoamTarget();
        break;
      case 'investigating':
        this.moveActor(e, Math.trunc(spec.roam * 6 / 5));
        if (!cooldown && d2 < square(Math.trunc(spec.detect * 3 / 5) * FIXED_SCALE) && !s.flashlightOn) {
          e.state = 'hunting'; e.chaseStartTick = tick;
        }
        if (e.ticksRemaining > 0) e.ticksRemaining--;
        if (e.ticksRemaining === 0 || s.flashlightOn) { this.beginStalkerRetreat(tick); }
        break;
      case 'hunting':
        e.targetX = s.x; e.targetY = s.y;
        this.moveActor(e, spec.hunt);
        if (d2 < square(30 * FIXED_SCALE)) {
          if (this.applyDamage(35, tick, 30 * FIXED_SCALE)) this.stateValue.scareLockoutUntilTick = Math.max(s.scareLockoutUntilTick, tick + 120);
          this.beginStalkerRetreat(tick);
        } else if (s.flashlightOn || tick - e.chaseStartTick > 900) this.beginStalkerRetreat(tick);
        break;
      case 'retreating':
        this.moveActor(e, Math.trunc(spec.hunt * 4 / 5));
        if (e.ticksRemaining > 0) e.ticksRemaining--;
        if (e.ticksRemaining === 0 || this.actorReached(e, 20)) {
          e.state = 'dormant'; e.ticksRemaining = 300 + this.stalkerRng.nextRange(0, 300);
        }
        break;
    }
    const finalD2 = square(e.x - s.x) + square(e.y - s.y);
    e.visible = e.state === 'hunting' || (e.state === 'investigating' && finalD2 < square(200 * FIXED_SCALE)) || (e.state === 'roaming' && finalD2 < square(150 * FIXED_SCALE));
  }

  private beginStalkerRetreat(tick: number) {
    const e = this.stateValue.stalker;
    e.state = 'retreating'; e.ticksRemaining = 180; e.lastChaseEndTick = tick;
    const candidates: Array<[number, number, number]> = [];
    for (let y = 0; y < this.floorValue.height; y++) for (let x = 0; x < this.floorValue.width; x++) {
      if (!this.isTileWalkable(x, y)) continue;
      const wx = (x * 32 + 16) * FIXED_SCALE, wy = (y * 32 + 16) * FIXED_SCALE;
      candidates.push([square(wx - this.stateValue.x) + square(wy - this.stateValue.y), wx, wy]);
    }
    candidates.sort((a, b) => b[0] - a[0] || a[2] - b[2] || a[1] - b[1]);
    if (candidates[0]) { e.targetX = candidates[0][1]; e.targetY = candidates[0][2]; }
  }

  private updateCrawlers(tick: number) {
    const s = this.stateValue;
    for (const e of s.crawlers) {
      const d2 = square(e.x - s.x) + square(e.y - s.y);
      if (e.chasing) {
        e.targetX = s.x; e.targetY = s.y;
        this.moveActor(e, 100);
        if (d2 < square(25 * FIXED_SCALE)) {
          if (this.applyDamage(15, tick)) {
            const cell = this.spawnCellFar(250, this.crawlerRng);
            [e.x, e.y] = this.cellCenter(cell); e.chasing = false;
          }
        } else if (tick - e.chaseStartTick > 180 || d2 > square(300 * FIXED_SCALE)) {
          e.chasing = false;
          [e.targetX, e.targetY] = this.cellCenter(this.randomWalkableCell(this.crawlerRng));
        }
      } else {
        this.moveActor(e, 60);
        if (d2 < square(120 * FIXED_SCALE)) { e.chasing = true; e.chaseStartTick = tick; }
        if (this.actorReached(e, 15)) [e.targetX, e.targetY] = this.cellCenter(this.randomWalkableCell(this.crawlerRng));
      }
    }
  }

  private updateWatchers(tick: number) {
    const s = this.stateValue;
    for (const e of s.watchers) {
      if (!e.active) continue;
      const dx = e.x - s.x, dy = e.y - s.y, d2 = square(dx) + square(dy);
      const facingDot = dx * s.facingX + dy * s.facingY;
      const facing = facingDot > 0 && 4 * square(facingDot) >= d2 * (s.facingX * s.facingX + s.facingY * s.facingY);
      const illuminated = s.flashlightOn && d2 < square(200 * FIXED_SCALE) && facing;
      if (illuminated) {
        e.illuminatedTicks++;
        if (e.illuminatedTicks > 240) { e.active = false; continue; }
      } else {
        e.decayRemainder++;
        if (e.decayRemainder >= 2) { e.illuminatedTicks = Math.max(0, e.illuminatedTicks - 1); e.decayRemainder = 0; }
      }
      const range = 150 * FIXED_SCALE;
      if (facing && d2 < square(range)) {
        const dist = integerSqrt(d2);
        // 2 curse/sec at point blank, linearly falling to zero at 150px.
        const denominator = range * SIMULATION_HZ;
        e.curseRemainder += 512 * (range - dist);
        const gain = Math.floor(e.curseRemainder / denominator);
        if (gain) { s.curse = Math.min(100 * FIXED_SCALE, s.curse + gain); e.curseRemainder %= denominator; }
      }
    }
    if (s.curse >= 100 * FIXED_SCALE) s.status = 'lost';
  }

  private updateAmbushers(tick: number) {
    const s = this.stateValue;
    for (const e of s.ambushers) {
      if (e.state === 'hidden' && square(e.x - s.x) + square(e.y - s.y) < square(120 * FIXED_SCALE)) {
        e.state = 'warning'; e.warningTicks = 9 + this.ambusherRng.nextRange(0, 15);
      } else if (e.state === 'warning') {
        e.warningTicks--;
        if (e.warningTicks <= 0) {
          e.state = 'jumpscare'; e.hasTriggered = true; e.damageAtTick = tick + 12;
          s.scareEventId++; s.scareLockoutUntilTick = Math.max(s.scareLockoutUntilTick, tick + 48);
        }
      } else if (e.state === 'jumpscare') {
        if (tick >= e.damageAtTick) { this.applyDamage(e.damage, tick); e.state = 'inactive'; }
      }
    }
  }

  private updateMimics(tick: number) {
    const s = this.stateValue;
    for (const e of s.mimics) {
      if (!e.active || !e.revealed) continue;
      if (tick >= e.chaseUntilTick) { e.active = false; continue; }
      e.targetX = s.x; e.targetY = s.y;
      const d2 = square(e.x - s.x) + square(e.y - s.y);
      this.moveActor(e, 180);
      if (d2 < square(25 * FIXED_SCALE) && this.applyDamage(10, tick)) e.active = false;
    }
  }

  private updateCorruption(tick: number) {
    const s = this.stateValue, c = s.corruption;
    const cooldown = s.floor === 4 ? 1440 : s.floor === 3 ? 1080 : s.floor === 2 ? 720 : s.floor === 1 ? 504 : 360;
    if (tick - c.lastTriggerTick < cooldown) return;
    const dist = integerSqrt(square(s.stalker.x - s.x) + square(s.stalker.y - s.y));
    let chance = 80_000 + Math.trunc(s.curse * 2_000 / FIXED_SCALE);
    chance += dist < 300 * FIXED_SCALE ? 150_000 : dist < 500 * FIXED_SCALE ? 80_000 : 0;
    if (s.hasKey) chance += 50_000;
    const floorQuarter = Math.max(2, 6 - s.floor);
    chance = Math.trunc(chance * floorQuarter / 4);
    if (this.eventRng.nextRange(0, 999_999) >= chance) return;
    c.lastTriggerTick = tick; c.effectId++; c.effectType = this.eventRng.nextRange(0, 6);
    let intensity = 200 + this.eventRng.nextRange(0, 300);
    if (s.curse > 50 * FIXED_SCALE) intensity += 200;
    if (dist < 200 * FIXED_SCALE) intensity += 300;
    c.intensityPermille = Math.min(900, intensity);
    c.durationTicks = 9 + this.eventRng.nextRange(0, 18);
  }

  private moveActor(actor: { x: number; y: number; targetX: number; targetY: number; moveRemainder: number }, speed: number) {
    const amountNumerator = speed * FIXED_SCALE + actor.moveRemainder;
    const amount = Math.floor(amountNumerator / SIMULATION_HZ);
    actor.moveRemainder = amountNumerator % SIMULATION_HZ;
    if (!amount) return;
    const currentX = Math.floor(actor.x / TILE), currentY = Math.floor(actor.y / TILE);
    const goalX = Math.floor(actor.targetX / TILE), goalY = Math.floor(actor.targetY / TILE);
    let nextX = goalX, nextY = goalY;
    if (currentX !== goalX || currentY !== goalY) {
      const next = this.nextPathCell(currentX, currentY, goalX, goalY);
      if (!next) return;
      [nextX, nextY] = next;
      const destX = nextX * TILE + CENTER, destY = nextY * TILE + CENTER;
      if (nextX !== currentX) actor.x += Math.sign(destX - actor.x) * Math.min(amount, Math.abs(destX - actor.x));
      else actor.y += Math.sign(destY - actor.y) * Math.min(amount, Math.abs(destY - actor.y));
    } else {
      const dx = actor.targetX - actor.x, dy = actor.targetY - actor.y;
      if (Math.abs(dx) >= Math.abs(dy)) actor.x += Math.sign(dx) * Math.min(amount, Math.abs(dx));
      else actor.y += Math.sign(dy) * Math.min(amount, Math.abs(dy));
    }
  }

  private nextPathCell(sx: number, sy: number, gx: number, gy: number): [number, number] | null {
    const width = this.floorValue.width, height = this.floorValue.height;
    const start = sy * width + sx, goal = gy * width + gx;
    if (!this.isTileWalkable(gx, gy) || !this.isTileWalkable(sx, sy)) return null;
    const parent = new Int32Array(width * height); parent.fill(-2); parent[start] = -1;
    const queue = new Int32Array(width * height); let head = 0, tail = 0; queue[tail++] = start;
    const dirs: Array<[number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // north, east, south, west tie order
    while (head < tail && parent[goal] === -2) {
      const here = queue[head++], x = here % width, y = Math.floor(here / width);
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy, ni = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || parent[ni] !== -2 || !this.isTileWalkable(nx, ny)) continue;
        parent[ni] = here; queue[tail++] = ni;
      }
    }
    if (parent[goal] === -2) return null;
    let cursor = goal;
    while (parent[cursor] !== start && parent[cursor] !== -1) cursor = parent[cursor];
    return [cursor % width, Math.floor(cursor / width)];
  }

  private isTileWalkable(x: number, y: number): boolean {
    return this.floorValue.tiles[y]?.[x] === true;
  }

  private actorReached(actor: { x: number; y: number; targetX: number; targetY: number }, pixels: number): boolean {
    return square(actor.x - actor.targetX) + square(actor.y - actor.targetY) <= square(pixels * FIXED_SCALE);
  }

  private cellCenter([x, y]: [number, number]): [number, number] { return [x * TILE + CENTER, y * TILE + CENTER]; }
  private randomWalkableCell(rng = this.worldRng): [number, number] {
    const cells: Array<[number, number]> = [];
    for (let y = 0; y < this.floorValue.height; y++) for (let x = 0; x < this.floorValue.width; x++) if (this.floorValue.tiles[y][x]) cells.push([x, y]);
    return cells[rng.nextRange(0, cells.length - 1)] ?? [this.floorValue.start[0], this.floorValue.start[1]];
  }
  private spawnCellFar(minDistance: number, rng = this.worldRng): [number, number] {
    const cells: Array<[number, number]> = [];
    for (let y = 0; y < this.floorValue.height; y++) for (let x = 0; x < this.floorValue.width; x++) {
      if (!this.floorValue.tiles[y][x]) continue;
      const wx = (x * 32 + 16) * FIXED_SCALE, wy = (y * 32 + 16) * FIXED_SCALE;
      if (square(wx - this.stateValue.x) + square(wy - this.stateValue.y) > square(minDistance * FIXED_SCALE)) cells.push([x, y]);
    }
    return cells[rng.nextRange(0, Math.max(0, cells.length - 1))] ?? this.randomWalkableCell(rng);
  }

  private interact() {
    const s = this.stateValue;
    const keyX = (this.floorValue.key[0] * 32 + 16) * FIXED_SCALE;
    const keyY = (this.floorValue.key[1] * 32 + 16) * FIXED_SCALE;
    if (!s.hasKey && this.inRange(keyX, keyY)) {
      s.hasKey = true;
      this.tickEvents.push({ type: 'key_collected' });
      if (s.stalker.state === 'dormant') { s.stalker.state = 'roaming'; this.pickStalkerRoamTarget(); }
      else if (s.stalker.state === 'roaming') { s.stalker.state = 'investigating'; s.stalker.targetX = s.x; s.stalker.targetY = s.y; s.stalker.ticksRemaining = (STALKER_SPECS[s.floor as keyof typeof STALKER_SPECS] ?? STALKER_SPECS[4]).investigate; }
    }
    for (let i = 0; i < this.floorValue.searchables.length; i++) {
      if (s.searched[i]) continue;
      const item = this.floorValue.searchables[i];
      if (!this.inRange((item.x * 32 + 16) * FIXED_SCALE, (item.y * 32 + 16) * FIXED_SCALE)) continue;
      s.searched[i] = true;
      this.tickEvents.push({ type: 'loot_searched', index: i, result: { ...item.result } });
      if (item.result.type !== 'mimic_reveal') this.maybeTriggerBoxScare(s.tick);
      if (s.stalker.state === 'dormant' && this.stalkerRng.nextRange(0, 999) < 300) {
        s.stalker.state = 'investigating'; s.stalker.targetX = s.x; s.stalker.targetY = s.y;
        s.stalker.ticksRemaining = (STALKER_SPECS[s.floor as keyof typeof STALKER_SPECS] ?? STALKER_SPECS[4]).investigate;
      }
      for (const ambusher of s.ambushers) {
        if (ambusher.state === 'hidden' && square(ambusher.x - (item.x * 32 + 16) * FIXED_SCALE) + square(ambusher.y - (item.y * 32 + 16) * FIXED_SCALE) < square(150 * FIXED_SCALE)) {
          ambusher.state = 'warning'; ambusher.warningTicks = 9 + this.ambusherRng.nextRange(0, 15);
        }
      }
      const mimic = s.mimics.find(m => m.searchableIndex === i);
      if (mimic?.active) {
        mimic.revealed = true; mimic.chaseUntilTick = s.tick + 120; s.scareEventId++;
        this.tickEvents.push({ type: 'mimic_revealed', index: i });
        mimic.targetX = s.x; mimic.targetY = s.y;
        this.applyDamage(15, s.tick);
      }
      switch (item.result.type) {
        case 'battery': s.battery = Math.min(100 * FIXED_SCALE, s.battery + item.result.amount * FIXED_SCALE); break;
        case 'health': s.hp = Math.min(100, s.hp + item.result.amount); break;
        case 'collectible': s.score += item.result.score; break;
      }
      return;
    }
    const [ex, ey] = this.floorValue.exit;
    if (s.hasKey && this.inRange((ex * 32 + 16) * FIXED_SCALE, (ey * 32 + 16) * FIXED_SCALE)) {
      const fromFloor = s.floor;
      s.score += 100 * Math.max(0, s.floor);
      // The transition's danger bonus must not make arrival in Block 13
      // terminal. Curse can still reach its normal loss threshold during play.
      const curseWithBonus = s.curse + 10 * FIXED_SCALE;
      s.curse = isBlock13Arrival(s.floor)
        ? Math.max(s.curse, Math.min(99 * FIXED_SCALE, curseWithBonus))
        : curseWithBonus;
      s.battery = Math.min(100 * FIXED_SCALE, s.battery + 20 * FIXED_SCALE);
      s.floor = nextProgressionFloor(s.floor);
      s.floorsCompleted++;
      this.tickEvents.push({ type: 'floor_transition', fromFloor, toFloor: s.floor, floorsCompleted: s.floorsCompleted });
      if (isOutsideFloor(s.floor)) { s.status = 'won'; return; }
      this.floorValue = generateFloor(this.floorSeed(), s.floor, this.economyLootRng());
      s.x = (this.floorValue.start[0] * 32 + 16) * FIXED_SCALE;
      s.y = (this.floorValue.start[1] * 32 + 16) * FIXED_SCALE;
      s.hasKey = false;
      s.searched = this.floorValue.searchables.map(() => false);
      s.mimics = this.floorValue.searchables.flatMap((item, searchableIndex) => item.isMimic ? [{ searchableIndex, x: (item.x * 32 + 16) * FIXED_SCALE, y: (item.y * 32 + 16) * FIXED_SCALE, targetX: (item.x * 32 + 16) * FIXED_SCALE, targetY: (item.y * 32 + 16) * FIXED_SCALE, moveRemainder: 0, revealed: false, chaseUntilTick: 0, active: true }] : []);
      this.stateValue.corruption.lastTriggerTick = -1_000_000;
      this.resetBoxScares();
      s.playerMoveRemainderX = 0; s.playerMoveRemainderY = 0;
      this.spawnFloorEntities();
    }
  }

  private inRange(x: number, y: number): boolean {
    return square(this.stateValue.x - x) + square(this.stateValue.y - y) <= square(INTERACTION_RANGE_SUBPIXELS);
  }

  private floorSeed(): number { return floorSeedFromCanonicalSeed(this.seed); }

  private economyLootRng(): FloorLootRng {
    return { next: () => this.economyRng.nextFloat(), int: max => this.economyRng.nextRange(0, max - 1) };
  }

}

function integerSqrt(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('integer square root input must be a non-negative safe integer');
  let n = BigInt(value), x = n, y = (x + 1n) >> 1n;
  while (y < x) { x = y; y = (x + n / x) >> 1n; }
  return Number(x);
}
