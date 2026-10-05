/** Canonical internal floor progression. 0 is Block 13; -1 is Outside. */
export const START_FLOOR = 4;
export const BLOCK_13_FLOOR = 0;
export const OUTSIDE_FLOOR = -1;
export const TOTAL_FLOORS = START_FLOOR - OUTSIDE_FLOOR;

export function nextProgressionFloor(floor: number): number {
  if (!Number.isInteger(floor) || floor < OUTSIDE_FLOOR || floor > START_FLOOR) {
    throw new RangeError(`invalid progression floor: ${floor}`);
  }
  return Math.max(OUTSIDE_FLOOR, floor - 1);
}

export const isBlock13Floor = (floor: number): boolean => floor === BLOCK_13_FLOOR;
export const isOutsideFloor = (floor: number): boolean => floor === OUTSIDE_FLOOR;
export const isBlock13Arrival = (fromFloor: number): boolean => nextProgressionFloor(fromFloor) === BLOCK_13_FLOOR;
export const floorsCompletedAt = (floor: number): number => START_FLOOR - floor;

export function progressionName(floor: number): string {
  if (isOutsideFloor(floor)) return 'OUTSIDE';
  if (isBlock13Floor(floor)) return 'BLOCK 13';
  if (floor >= 1 && floor <= START_FLOOR) return `FLOOR ${floor}`;
  throw new RangeError(`invalid progression floor: ${floor}`);
}
