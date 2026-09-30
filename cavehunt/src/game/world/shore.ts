const GRASS_TILE_INDEXES = [55, 56, 57, 60, 12, 12, 12, 12, 12, 12, 12];

export function shoreTileIndex(
  isWater: (offsetX: number, offsetY: number) => boolean,
  variant = 4,
): number {
  const top = isWater(0, -1);
  const bottom = isWater(0, 1);
  const left = isWater(-1, 0);
  const right = isWater(1, 0);

  if (top && bottom && left && right) return 36;
  if (top && left && right) return 3;
  if (bottom && left && right) return 25;
  if (top && bottom && left) return 33;
  if (top && bottom && right) return 35;
  if (top && bottom) return 34;
  if (left && right) return 14;
  if (top && left) return 0;
  if (top && right) return 2;
  if (bottom && left) return 22;
  if (bottom && right) return 24;
  if (top) return 1;
  if (bottom) return 23;
  if (left) return 11;
  if (right) return 13;
  if (isWater(-1, -1)) return 28;
  if (isWater(1, -1)) return 27;
  if (isWater(-1, 1)) return 17;
  if (isWater(1, 1)) return 16;
  return GRASS_TILE_INDEXES[
    Math.abs(variant) % GRASS_TILE_INDEXES.length
  ];
}
