/**
 * Stateless presentation variation. The tick and stable entity id determine
 * the result without advancing any authoritative random stream.
 */
export interface MimicTwitch {
  offsetX: number;
  offsetY: number;
  nextDelayTicks: number;
}

export function mimicTwitch(entityId: number, tick: number): MimicTwitch {
  let value = (Math.imul((entityId + 1) | 0, 0x45d9f3b) ^ Math.imul((tick + 1) | 0, 0x27d4eb2d)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  const axisX = value & 0xffff;
  const axisY = value >>> 16;
  return {
    offsetX: (axisX / 0xffff - 0.5) * 2,
    offsetY: (axisY / 0xffff - 0.5) * 2,
    nextDelayTicks: 120 + ((value >>> 8) % 181),
  };
}

export function firstMimicTwitchDelay(entityId: number): number {
  return 120 + ((Math.imul((entityId + 1) | 0, 0x9e3779b1) >>> 0) % 181);
}
