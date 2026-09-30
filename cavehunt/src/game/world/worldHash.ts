import { GENERATOR_VERSION, type WorldConfig } from './worldConfig.ts';

function hashSeed(seed: string): number
{
    let hash = 2166136261;

    for (let index = 0; index < seed.length; index++)
    {
        hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
    }

    return hash >>> 0;
}

export function hashWorld(config: WorldConfig, x: number, y: number, salt: number): number
{
    if (config.generatorVersion !== GENERATOR_VERSION)
    {
        throw new Error(`Unsupported generator version: ${config.generatorVersion}`);
    }

    let hash = hashSeed(config.seed) ^ salt ^ Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca6b);
    hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
    hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
    return (hash ^ (hash >>> 16)) >>> 0;
}
