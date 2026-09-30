import { type WorldObjectType } from "./worldObjects.ts";

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
    { x: 16, y: 0, width: 32, height: 32, bodyWidth: 12, bodyHeight: 8 },
    { x: 16, y: 0, width: 32, height: 32, bodyWidth: 12, bodyHeight: 8 },
  ],
  appleTree: [
    { x: 48, y: 0, width: 32, height: 32, bodyWidth: 12, bodyHeight: 8 },
    { x: 48, y: 0, width: 32, height: 32, bodyWidth: 12, bodyHeight: 8 },
  ],
  rock: [
    { x: 112, y: 16, width: 16, height: 16, bodyWidth: 12, bodyHeight: 10 },
    { x: 128, y: 16, width: 16, height: 16, bodyWidth: 12, bodyHeight: 10 },
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
    { x: 0, y: 48, width: 16, height: 16, bodyWidth: 12, bodyHeight: 8 },
    { x: 0, y: 48, width: 16, height: 16, bodyWidth: 12, bodyHeight: 8 },
  ],
  bush: [
    { x: 16, y: 48, width: 16, height: 16, bodyWidth: 12, bodyHeight: 8 },
    { x: 16, y: 48, width: 16, height: 16, bodyWidth: 12, bodyHeight: 8 },
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
