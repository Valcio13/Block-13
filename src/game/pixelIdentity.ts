/** Pixel-grid sprite primitives. Rectangles are integer-aligned native texels. */
export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
  color: keyof typeof PIXEL_PALETTE;
}

export const PIXEL_PALETTE = {
  outline: 0x11131a,
  coat: 0x3b4b52,
  coatLight: 0x607078,
  shirt: 0x222b31,
  reflective: 0xb69c5d,
  skin: 0xb48770,
  hair: 0x28252a,
  pants: 0x28323c,
  boot: 0x171b20,
  flashlight: 0xe8dfb7,
  lens: 0xc1d6d2,
  stalkerBody: 0x281d29,
  stalkerEdge: 0x765261,
  stalkerHighlight: 0x9b707b,
  stalkerEye: 0xcf8b9a,
  stair: 0x9ba8a8,
  stairLight: 0xd0d6cc,
  pit: 0x11141b,
  locked: 0xc45658,
  unlocked: 0x70d4c6,
  key: 0xe0c56e,
  keyShade: 0x74603c,
} as const;

export const PLAYER_PIXEL_RECTS: readonly PixelRect[] = [
  { x: 7, y: 2, width: 6, height: 5, color: 'outline' },
  { x: 8, y: 3, width: 4, height: 4, color: 'hair' },
  { x: 8, y: 5, width: 4, height: 2, color: 'skin' },
  { x: 4, y: 9, width: 12, height: 9, color: 'outline' },
  { x: 3, y: 10, width: 3, height: 6, color: 'outline' },
  { x: 14, y: 9, width: 3, height: 6, color: 'coat' },
  { x: 5, y: 10, width: 10, height: 7, color: 'coat' },
  { x: 6, y: 11, width: 8, height: 4, color: 'coatLight' },
  { x: 6, y: 15, width: 8, height: 1, color: 'reflective' },
  { x: 3, y: 14, width: 2, height: 2, color: 'skin' },
  { x: 14, y: 14, width: 2, height: 2, color: 'skin' },
  { x: 15, y: 7, width: 3, height: 2, color: 'outline' },
  { x: 16, y: 7, width: 2, height: 1, color: 'flashlight' },
  { x: 17, y: 6, width: 1, height: 1, color: 'lens' },
  { x: 6, y: 18, width: 8, height: 3, color: 'outline' },
  { x: 6, y: 19, width: 3, height: 5, color: 'pants' },
  { x: 11, y: 19, width: 3, height: 5, color: 'pants' },
  { x: 5, y: 24, width: 4, height: 2, color: 'boot' },
  { x: 11, y: 24, width: 4, height: 2, color: 'boot' },
];

export const STALKER_PIXEL_RECTS: readonly PixelRect[] = [
  { x: 13, y: 3, width: 6, height: 8, color: 'outline' },
  { x: 14, y: 4, width: 4, height: 6, color: 'stalkerBody' },
  { x: 14, y: 7, width: 1, height: 1, color: 'stalkerEye' },
  { x: 17, y: 7, width: 1, height: 1, color: 'stalkerEye' },
  { x: 10, y: 10, width: 12, height: 6, color: 'outline' },
  { x: 11, y: 11, width: 10, height: 4, color: 'stalkerBody' },
  { x: 11, y: 11, width: 1, height: 3, color: 'stalkerEdge' },
  { x: 20, y: 11, width: 1, height: 3, color: 'stalkerEdge' },
  { x: 12, y: 15, width: 8, height: 15, color: 'outline' },
  { x: 13, y: 15, width: 6, height: 13, color: 'stalkerBody' },
  { x: 13, y: 17, width: 1, height: 9, color: 'stalkerEdge' },
  { x: 18, y: 18, width: 1, height: 8, color: 'stalkerEdge' },
  { x: 7, y: 12, width: 5, height: 18, color: 'outline' },
  { x: 8, y: 13, width: 3, height: 15, color: 'stalkerBody' },
  { x: 8, y: 14, width: 1, height: 12, color: 'stalkerEdge' },
  { x: 20, y: 12, width: 5, height: 18, color: 'outline' },
  { x: 21, y: 13, width: 3, height: 15, color: 'stalkerBody' },
  { x: 23, y: 14, width: 1, height: 12, color: 'stalkerEdge' },
  { x: 5, y: 27, width: 7, height: 4, color: 'outline' },
  { x: 20, y: 27, width: 7, height: 4, color: 'outline' },
  { x: 11, y: 27, width: 5, height: 22, color: 'outline' },
  { x: 12, y: 28, width: 3, height: 19, color: 'stalkerBody' },
  { x: 12, y: 30, width: 1, height: 15, color: 'stalkerEdge' },
  { x: 17, y: 27, width: 5, height: 23, color: 'outline' },
  { x: 18, y: 28, width: 3, height: 20, color: 'stalkerBody' },
  { x: 20, y: 30, width: 1, height: 16, color: 'stalkerEdge' },
  { x: 10, y: 47, width: 6, height: 3, color: 'outline' },
  { x: 17, y: 48, width: 7, height: 3, color: 'outline' },
];

export const KEY_PIXEL_RECTS: readonly PixelRect[] = [
  { x: 3, y: 2, width: 8, height: 2, color: 'keyShade' },
  { x: 2, y: 4, width: 2, height: 5, color: 'keyShade' },
  { x: 10, y: 4, width: 2, height: 5, color: 'keyShade' },
  { x: 3, y: 9, width: 8, height: 2, color: 'keyShade' },
  { x: 4, y: 4, width: 6, height: 5, color: 'key' },
  { x: 9, y: 6, width: 3, height: 14, color: 'key' },
  { x: 10, y: 15, width: 6, height: 2, color: 'key' },
  { x: 10, y: 19, width: 5, height: 2, color: 'key' },
];

export const STAIR_PIXEL_RECTS = (unlocked: boolean): readonly PixelRect[] => [
  { x: 3, y: 4, width: 26, height: 24, color: 'outline' },
  { x: 5, y: 6, width: 22, height: 20, color: 'pit' },
  { x: 6, y: 20, width: 19, height: 4, color: 'stair' },
  { x: 9, y: 16, width: 16, height: 4, color: 'stairLight' },
  { x: 12, y: 12, width: 13, height: 4, color: 'stair' },
  { x: 15, y: 8, width: 10, height: 4, color: 'stairLight' },
  { x: 6, y: 20, width: 19, height: 1, color: 'outline' },
  { x: 9, y: 16, width: 16, height: 1, color: 'outline' },
  { x: 12, y: 12, width: 13, height: 1, color: 'outline' },
  { x: 15, y: 8, width: 10, height: 1, color: 'outline' },
  ...(unlocked
    ? [
      { x: 24, y: 5, width: 3, height: 5, color: 'unlocked' as const },
      { x: 22, y: 5, width: 2, height: 2, color: 'unlocked' as const },
      { x: 24, y: 7, width: 3, height: 3, color: 'pit' as const },
    ]
    : [
      { x: 23, y: 5, width: 5, height: 5, color: 'locked' as const },
      { x: 24, y: 6, width: 3, height: 3, color: 'pit' as const },
    ]),
];

export function pixelRectsAreValid(rects: readonly PixelRect[], width: number, height: number): boolean {
  return rects.every(rect => Number.isInteger(rect.x) && Number.isInteger(rect.y)
    && Number.isInteger(rect.width) && Number.isInteger(rect.height)
    && rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0
    && rect.x + rect.width <= width && rect.y + rect.height <= height
    && Object.hasOwn(PIXEL_PALETTE, rect.color));
}
