export type ItemCategory = 'tool' | 'consumable' | 'equippable';
export type ItemId = 'strawberry' | 'training_axe' | 'test_amulet';

export interface ItemDefinition {
    id: ItemId;
    title: string;
    description: string;
    texture: { key: 'biome-objects'; x: number; y: number; width: number; height: number };
    category: ItemCategory;
    stackable: boolean;
}

export const ITEMS: Record<ItemId, ItemDefinition> = {
    strawberry: {
        id: 'strawberry', title: 'Strawberry', description: 'A small red fruit.',
        texture: { key: 'biome-objects', x: 0, y: 48, width: 16, height: 16 },
        category: 'consumable', stackable: true
    },
    training_axe: {
        id: 'training_axe', title: 'Training Axe', description: 'A practice tool.',
        texture: { key: 'biome-objects', x: 112, y: 16, width: 16, height: 16 },
        category: 'tool', stackable: false
    },
    test_amulet: {
        id: 'test_amulet', title: 'Test Amulet', description: 'A simple keepsake.',
        texture: { key: 'biome-objects', x: 96, y: 32, width: 16, height: 16 },
        category: 'equippable', stackable: false
    }
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
