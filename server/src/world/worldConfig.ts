import { type WorldConfig } from '../../../shared/src/protocol.ts';
export type { WorldConfig } from '../../../shared/src/protocol.ts';
export const GENERATOR_VERSION = 8;
export const WORLD_SEED = 'cavehunt';

export const WORLD_CONFIG: WorldConfig = {
    seed: WORLD_SEED,
    generatorVersion: GENERATOR_VERSION
};
