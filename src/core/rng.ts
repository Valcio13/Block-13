export class SeededRng {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0 || 1; }
  next() { let x = this.state; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (this.state = x >>> 0) / 0x100000000; }
  int(max: number) { return Math.floor(this.next() * max); }
}
