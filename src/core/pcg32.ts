/**
 * PCG32 - Permuted Congruential Generator
 * 
 * A high-quality, fast pseudo-random number generator with good statistical properties.
 * Better than simple LCG for game RNG where predictability and fairness matter.
 * 
 * Reference: https://www.pcg-random.org/
 */

export class PCG32 {
  private state: bigint;
  private inc: bigint;

  constructor(seed: bigint, sequence: bigint = 1n) {
    this.state = 0n;
    this.inc = (sequence << 1n) | 1n;
    this.nextInt();
    this.state += seed;
    this.nextInt();
  }

  /**
   * Generate next 32-bit unsigned integer
   */
  nextInt(): number {
    const oldState = this.state;
    // LCG step: state = state * 6364136223846793005 + inc
    this.state = (oldState * 6364136223846793005n + this.inc) & 0xFFFFFFFFFFFFFFFFn;
    
    // PCG output function (XSH-RR variant)
    const xorshifted = Number((((oldState >> 18n) ^ oldState) >> 27n) & 0xFFFFFFFFn);
    const rot = Number(oldState >> 59n);
    
    return ((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0;
  }

  /**
   * Generate float in range [0, 1)
   */
  nextFloat(): number {
    return this.nextInt() / 0x100000000;
  }

  /**
   * Generate integer in range [min, max] (inclusive)
   */
  nextRange(min: number, max: number): number {
    return min + Math.floor(this.nextFloat() * (max - min + 1));
  }

  /**
   * Generate boolean with given probability (0.0 to 1.0)
   */
  nextBool(probability: number = 0.5): boolean {
    return this.nextFloat() < probability;
  }

  /**
   * Shuffle array in-place using Fisher-Yates
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextRange(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Pick random element from array
   */
  pick<T>(array: T[]): T {
    return array[this.nextRange(0, array.length - 1)];
  }
}

/**
 * Convert hex string to BigInt for PCG32
 */
export function hexToBigInt(hex: string): bigint {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return BigInt('0x' + cleanHex);
}

/**
 * Convert bytes32 to PCG32-compatible seed
 */
export function bytes32ToPCGSeed(bytes32: string): bigint {
  return hexToBigInt(bytes32);
}
