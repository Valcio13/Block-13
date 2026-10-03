import type { InputState } from './inputRecorder';

export interface Velocity {
  x: number;
  y: number;
}

/** Shared movement calculation used by the Phaser scene and replay verification. */
export function getPlayerVelocity(inputs: InputState, speed = 160): Velocity {
  let x = inputs.left ? -speed : inputs.right ? speed : 0;
  let y = inputs.up ? -speed : inputs.down ? speed : 0;
  if ((inputs.left || inputs.right) && (inputs.up || inputs.down)) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y };
}

/** Shared toggle transition used by the scene and replay verification. */
export function nextFlashlightState(current: boolean, inputs: InputState): boolean {
  return inputs.flashlight ? !current : current;
}
