/**
 * Development-only framing candidates for the world camera.
 * Keep the active candidate here so camera comparisons never touch simulation.
 */
export const CAMERA_ZOOM_CANDIDATES = [1.4, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4] as const;
export type CameraZoom = typeof CAMERA_ZOOM_CANDIDATES[number];

/** Preferred initial experiment. Change this one value when comparing frames. */
export const DEVELOPMENT_CAMERA_ZOOM: CameraZoom = 2.2;
export const BASELINE_CAMERA_ZOOM: CameraZoom = 2.2;

/** Shared baseline for both builds; the active experiment is now approved for production. */
export function activeCameraZoom(isDevelopment = import.meta.env.DEV): CameraZoom {
  return isDevelopment ? DEVELOPMENT_CAMERA_ZOOM : BASELINE_CAMERA_ZOOM;
}
