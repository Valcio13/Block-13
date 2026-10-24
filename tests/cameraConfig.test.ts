import { describe, expect, it } from 'vitest';
import { activeCameraZoom, BASELINE_CAMERA_ZOOM, CAMERA_ZOOM_CANDIDATES, DEVELOPMENT_CAMERA_ZOOM } from '../src/game/cameraConfig';

describe('development camera framing', () => {
  it('keeps the requested comparison candidates in one presentation-only config', () => {
    expect(CAMERA_ZOOM_CANDIDATES).toEqual([1.4, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4]);
    expect(DEVELOPMENT_CAMERA_ZOOM).toBe(2.2);
    expect(BASELINE_CAMERA_ZOOM).toBe(2.2);
  });

  it('uses the closer candidate only in development', () => {
    expect(activeCameraZoom(true)).toBe(2.2);
    expect(activeCameraZoom(false)).toBe(2.2);
  });
});
