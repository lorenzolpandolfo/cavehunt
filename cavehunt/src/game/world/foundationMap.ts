export const TILE_SIZE = 16;

export interface TilePosition {
    x: number;
    y: number;
}

export interface BlockedArea extends TilePosition {
    width: number;
    height: number;
}

export interface FoundationMap {
    width: number;
    height: number;
    spawn: TilePosition;
    blockedAreas: readonly BlockedArea[];
    trees: readonly TilePosition[];
}

export const FOUNDATION_MAP: FoundationMap = {
    width: 64,
    height: 48,
    spawn: { x: 32, y: 24 },
    blockedAreas: [
        { x: 8, y: 8, width: 8, height: 2 },
        { x: 47, y: 8, width: 2, height: 11 },
        { x: 9, y: 35, width: 12, height: 2 },
        { x: 44, y: 35, width: 9, height: 2 },
        { x: 20, y: 18, width: 2, height: 7 }
    ],
    trees: [
        { x: 24, y: 19 }, { x: 39, y: 22 }, { x: 27, y: 31 },
        { x: 13, y: 26 }, { x: 50, y: 27 }, { x: 34, y: 12 }
    ]
};

export function isInsideMap(map: FoundationMap, x: number, y: number): boolean
{
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function isBlockedTile(map: FoundationMap, x: number, y: number): boolean
{
    if (!isInsideMap(map, x, y) || x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1)
    {
        return true;
    }

    return map.blockedAreas.some(area => x >= area.x && x < area.x + area.width && y >= area.y && y < area.y + area.height);
}

export function isWalkableTile(map: FoundationMap, x: number, y: number): boolean
{
    return !isBlockedTile(map, x, y) && !map.trees.some(tree => tree.x === x && tree.y === y);
}
