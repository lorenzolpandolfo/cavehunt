import { OBJECT_BODIES } from "../../../../shared/src/collision.ts";
import { type WorldObjectType } from "../../../../shared/src/protocol.ts";

export interface ObjectFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  bodyWidth?: number;
  bodyHeight?: number;
}

export const OBJECT_FRAMES: Record<
  WorldObjectType,
  readonly [ObjectFrame, ObjectFrame]
> = {
  tree: [
    { x: 16, y: 0, width: 32, height: 32, ...OBJECT_BODIES.tree },
    { x: 16, y: 0, width: 32, height: 32, ...OBJECT_BODIES.tree },
  ],
  appleTree: [
    { x: 48, y: 0, width: 32, height: 32, ...OBJECT_BODIES.appleTree },
    { x: 48, y: 0, width: 32, height: 32, ...OBJECT_BODIES.appleTree },
  ],
  rock: [
    { x: 112, y: 16, width: 16, height: 16, ...OBJECT_BODIES.rock },
    { x: 128, y: 16, width: 16, height: 16, ...OBJECT_BODIES.rock },
  ],
  grass: [
    { x: 80, y: 16, width: 16, height: 16 },
    { x: 96, y: 16, width: 16, height: 16 },
  ],
  redMushroom: [
    { x: 80, y: 0, width: 16, height: 16 },
    { x: 96, y: 0, width: 16, height: 16 },
  ],
  purpleMushroom: [
    { x: 112, y: 0, width: 16, height: 16 },
    { x: 128, y: 0, width: 16, height: 16 },
  ],
  strawberryBush: [
    { x: 0, y: 48, width: 16, height: 16, ...OBJECT_BODIES.strawberryBush },
    { x: 0, y: 48, width: 16, height: 16, ...OBJECT_BODIES.strawberryBush },
  ],
  bush: [
    { x: 16, y: 48, width: 16, height: 16, ...OBJECT_BODIES.bush },
    { x: 16, y: 48, width: 16, height: 16, ...OBJECT_BODIES.bush },
  ],
  yellowFlower: [
    { x: 96, y: 32, width: 16, height: 16 },
    { x: 112, y: 32, width: 16, height: 16 },
  ],
  pinkFlower: [
    { x: 96, y: 48, width: 16, height: 16 },
    { x: 112, y: 48, width: 16, height: 16 },
  ],
  blueFlower: [
    { x: 80, y: 48, width: 16, height: 16 },
    { x: 80, y: 48, width: 16, height: 16 },
  ],
  waterLily: [
    { x: 128, y: 64, width: 16, height: 16 },
    { x: 112, y: 64, width: 16, height: 16 },
  ],
};
