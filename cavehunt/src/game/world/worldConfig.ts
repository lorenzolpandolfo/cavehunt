export const GENERATOR_VERSION = 6;
export const WORLD_SEED = 'cavehunt';

export interface WorldConfig {
    seed: string;
    generatorVersion: number;
}

export const WORLD_CONFIG: WorldConfig = {
    seed: WORLD_SEED,
    generatorVersion: GENERATOR_VERSION
};
