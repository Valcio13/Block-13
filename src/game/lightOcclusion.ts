import type { Floor } from '../core/floor';

export interface OccludedRay {
  angle: number;
  distance: number;
}

const ANGLE_EPSILON = 0.0005;
const CORNER_EPSILON = 1e-7;
const WALL_SURFACE_REVEAL = 2;
const TAU = Math.PI * 2;

/**
 * Presentation-only grid ray. A wall blocks at its entry edge; exact diagonal
 * corner crossings use a supercover rule, so touching either side wall blocks.
 */
export function traceLightRay(
  tiles: boolean[][],
  tileSize: number,
  originX: number,
  originY: number,
  angle: number,
  maxDistance: number,
  output?: OccludedRay,
): OccludedRay {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  let tileX = Math.floor(originX / tileSize);
  let tileY = Math.floor(originY / tileSize);
  const stepX = dirX < 0 ? -1 : 1;
  const stepY = dirY < 0 ? -1 : 1;
  const deltaX = Math.abs(dirX) < CORNER_EPSILON ? Infinity : tileSize / Math.abs(dirX);
  const deltaY = Math.abs(dirY) < CORNER_EPSILON ? Infinity : tileSize / Math.abs(dirY);
  let maxX = Math.abs(dirX) < CORNER_EPSILON
    ? Infinity
    : ((dirX < 0 ? tileX * tileSize : (tileX + 1) * tileSize) - originX) / dirX;
  let maxY = Math.abs(dirY) < CORNER_EPSILON
    ? Infinity
    : ((dirY < 0 ? tileY * tileSize : (tileY + 1) * tileSize) - originY) / dirY;

  while (true) {
    const nextDistance = Math.min(maxX, maxY);
    if (nextDistance > maxDistance || !Number.isFinite(nextDistance)) break;

    if (Math.abs(maxX - maxY) <= CORNER_EPSILON) {
      const sideXOpen = Boolean(tiles[tileY]?.[tileX + stepX]);
      const sideYOpen = Boolean(tiles[tileY + stepY]?.[tileX]);
      if (!sideXOpen || !sideYOpen) return rayAt(angle, nextDistance, output);
      tileX += stepX;
      tileY += stepY;
      maxX += deltaX;
      maxY += deltaY;
      if (!tiles[tileY]?.[tileX]) return rayAt(angle, nextDistance, output);
      continue;
    }

    if (maxX < maxY) {
      tileX += stepX;
      const distance = maxX;
      maxX += deltaX;
      if (!tiles[tileY]?.[tileX]) return rayAt(angle, distance, output);
    } else {
      tileY += stepY;
      const distance = maxY;
      maxY += deltaY;
      if (!tiles[tileY]?.[tileX]) return rayAt(angle, distance, output);
    }
  }
  return rayAt(angle, maxDistance, output);
}

function rayAt(angle: number, distance: number, output?: OccludedRay): OccludedRay {
  if (output) {
    output.angle = angle;
    output.distance = distance;
    return output;
  }
  return { angle, distance };
}

/**
 * Collect angular samples across a light sector plus rays grazing nearby wall
 * corners. Caller-owned buffers can be reused each render frame.
 */
export function collectOccludedLightRays(
  floor: Floor,
  originX: number,
  originY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  angularStepDegrees: number,
  boundaryAngles: number[] = [],
  angleBuffer: number[] = [],
  rayBuffer: OccludedRay[] = [],
): OccludedRay[] {
  angleBuffer.length = 0;
  rayBuffer.length = 0;
  const span = endAngle - startAngle;
  const fullCircle = span >= TAU - 1e-6;
  const addAngle = (angle: number) => {
    let normalized = angle;
    while (normalized < startAngle) normalized += TAU;
    while (normalized > startAngle + TAU) normalized -= TAU;
    if (fullCircle || (normalized >= startAngle - 1e-8 && normalized <= endAngle + 1e-8)) {
      angleBuffer.push(normalized);
    }
  };

  const step = Math.max(0.5, angularStepDegrees) * Math.PI / 180;
  for (let angle = startAngle; angle < endAngle; angle += step) addAngle(angle);
  addAngle(endAngle);
  for (const angle of boundaryAngles) addAngle(angle);

  const tileSize = 32;
  const minTileX = Math.max(0, Math.floor((originX - radius) / tileSize));
  const maxTileX = Math.min(floor.width - 1, Math.floor((originX + radius) / tileSize));
  const minTileY = Math.max(0, Math.floor((originY - radius) / tileSize));
  const maxTileY = Math.min(floor.height - 1, Math.floor((originY + radius) / tileSize));
  const radiusSquared = radius * radius;
  for (let y = minTileY; y <= maxTileY; y++) {
    for (let x = minTileX; x <= maxTileX; x++) {
      if (floor.tiles[y]?.[x]) continue;
      const left = x * tileSize, right = left + tileSize;
      const top = y * tileSize, bottom = top + tileSize;
      addWallCorner(left, top, originX, originY, radiusSquared, startAngle, endAngle, fullCircle, angleBuffer);
      addWallCorner(right, top, originX, originY, radiusSquared, startAngle, endAngle, fullCircle, angleBuffer);
      addWallCorner(right, bottom, originX, originY, radiusSquared, startAngle, endAngle, fullCircle, angleBuffer);
      addWallCorner(left, bottom, originX, originY, radiusSquared, startAngle, endAngle, fullCircle, angleBuffer);
    }
  }

  angleBuffer.sort((a, b) => a - b);
  let write = 0;
  for (let read = 0; read < angleBuffer.length; read++) {
    if (write > 0 && Math.abs(angleBuffer[read] - angleBuffer[write - 1]) < 1e-7) continue;
    angleBuffer[write++] = angleBuffer[read];
  }
  angleBuffer.length = write;

  for (let i = 0; i < angleBuffer.length; i++) {
    const ray = rayBuffer[i] ?? { angle: 0, distance: 0 };
    traceLightRay(floor.tiles, tileSize, originX, originY, angleBuffer[i], radius, ray);
    // Give the visible wall face a slim lit surface while keeping the endpoint
    // inside solid geometry; this cannot illuminate the room beyond it.
    if (ray.distance < radius) ray.distance = Math.min(radius, ray.distance + WALL_SURFACE_REVEAL);
    rayBuffer[i] = ray;
  }
  rayBuffer.length = angleBuffer.length;
  return rayBuffer;
}

function addWallCorner(
  x: number,
  y: number,
  originX: number,
  originY: number,
  radiusSquared: number,
  startAngle: number,
  endAngle: number,
  fullCircle: boolean,
  buffer: number[],
) {
  const dx = x - originX, dy = y - originY;
  if (dx * dx + dy * dy > radiusSquared) return;
  let angle = Math.atan2(dy, dx);
  while (angle < startAngle) angle += TAU;
  while (angle > startAngle + TAU) angle -= TAU;
  if (!fullCircle && (angle < startAngle || angle > endAngle)) return;
  let before = angle - ANGLE_EPSILON;
  let after = angle + ANGLE_EPSILON;
  while (before < startAngle) before += TAU;
  while (before > startAngle + TAU) before -= TAU;
  while (after < startAngle) after += TAU;
  while (after > startAngle + TAU) after -= TAU;
  if (fullCircle || (before >= startAngle && before <= endAngle)) buffer.push(before);
  if (fullCircle || (after >= startAngle && after <= endAngle)) buffer.push(after);
}

/** Build a small deterministic fixture map for tests without Phaser. */
export function visibilityPointIsUnoccluded(floor: Floor, fromX: number, fromY: number, toX: number, toY: number): boolean {
  const dx = toX - fromX, dy = toY - fromY;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return true;
  const ray = traceLightRay(floor.tiles, 32, fromX, fromY, Math.atan2(dy, dx), distance);
  return ray.distance >= distance - 1e-6;
}
