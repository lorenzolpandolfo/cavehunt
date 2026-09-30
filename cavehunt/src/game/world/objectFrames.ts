import { type WorldObjectType } from './worldObjects.ts';

export interface ObjectFrame {
    x: number;
    y: number;
    width: number;
    height: number;
    bodyWidth?: number;
    bodyHeight?: number;
}

export const OBJECT_FRAMES: Record<WorldObjectType, readonly [ObjectFrame, ObjectFrame]> = {
    tree: [
        { x: 16, y: 0, width: 32, height: 32, bodyWidth: 12, bodyHeight: 8 },
        { x: 48, y: 0, width: 32, height: 32, bodyWidth: 12, bodyHeight: 8 }
    ],
    rock: [
        { x: 80, y: 64, width: 16, height: 16, bodyWidth: 12, bodyHeight: 10 },
        { x: 80, y: 48, width: 16, height: 16, bodyWidth: 12, bodyHeight: 10 }
    ],
    smallRock: [
        { x: 96, y: 64, width: 16, height: 16 },
        { x: 96, y: 48, width: 16, height: 16 }
    ],
    strawberryBush: [
        { x: 0, y: 48, width: 16, height: 16, bodyWidth: 12, bodyHeight: 8 },
        { x: 0, y: 48, width: 16, height: 16, bodyWidth: 12, bodyHeight: 8 }
    ],
    plainBush: [
        { x: 16, y: 48, width: 16, height: 16, bodyWidth: 12, bodyHeight: 8 },
        { x: 16, y: 48, width: 16, height: 16, bodyWidth: 12, bodyHeight: 8 }
    ],
    mediumBush: [
        { x: 0, y: 64, width: 16, height: 16, bodyWidth: 12, bodyHeight: 8 },
        { x: 16, y: 64, width: 16, height: 16, bodyWidth: 12, bodyHeight: 8 }
    ],
    smallBush: [
        { x: 128, y: 64, width: 16, height: 16 },
        { x: 128, y: 64, width: 16, height: 16 }
    ],
    flower: [
        { x: 112, y: 0, width: 16, height: 16 },
        { x: 128, y: 0, width: 16, height: 16 }
    ],
    plant: [
        { x: 96, y: 32, width: 16, height: 16 },
        { x: 112, y: 32, width: 16, height: 16 }
    ],
    mushroom: [
        { x: 48, y: 32, width: 16, height: 16 },
        { x: 64, y: 32, width: 16, height: 16 }
    ],
    waterLily: [
        { x: 112, y: 64, width: 16, height: 16 },
        { x: 112, y: 64, width: 16, height: 16 }
    ]
};
