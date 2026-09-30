import { type WorldObjectType } from './protocol.ts';

export interface ObjectBody {
    bodyWidth: number;
    bodyHeight: number;
}

export const OBJECT_BODIES: Partial<Record<WorldObjectType, ObjectBody>> = {
    tree: { bodyWidth: 12, bodyHeight: 8 },
    appleTree: { bodyWidth: 12, bodyHeight: 8 },
    rock: { bodyWidth: 12, bodyHeight: 10 },
    strawberryBush: { bodyWidth: 12, bodyHeight: 8 },
    bush: { bodyWidth: 12, bodyHeight: 8 }
};
