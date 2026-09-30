# Game Design Vision

This document primarily describes planned functionality, not implemented features. The current online game provides a server-generated surface with forests, plains, natural objects, walkable rivers and lakes, server-simulated cows and chickens, streamed chunks and synchronized player movement. The server persists generated chunks and characters in one JSON file. See [architecture.md](architecture.md) for the current technical state and [the roadmap](../docs/roadmap.md) for incremental delivery.

## Experience and core loop

Cavehunt is a 2D top-down survival RPG inspired by Stardew Valley, Terraria, and Core Keeper, with exploration, preparation, and increasingly challenging underground discovery.

1. Explore the surface and gather wood, stone, minerals, and food during the day.
2. Discover caves and obtain rare materials and treasure.
3. Craft equipment, research technologies, farm, and build a base.
4. Defend players and structures against nighttime monster waves.
5. Venture deeper with improved equipment and repeat the cycle.

Players move in eight directions with normalized diagonals and server-authoritative obstacle collisions. Holding Shift requests triple movement speed as the existing debug option. Building placement follows a grid even though movement is free.

## Surface and caves

The planned surface includes mountains, swamps, deserts, minerals, ruins, and cave entrances alongside the implemented forests, plains, rivers, lakes, vegetation, trees, rocks, cows, and chickens. Current water is walkable for players; animals stay on land. The server sends nearby chunks as players move; clients unload chunks outside their received window. The surface uses 16 by 16 pixel tiles and 32 by 32 tile chunks.

Caves contain procedural rooms and corridors, enemies, minerals, chests, breakable containers, hidden areas, rare structures, and passages to deeper levels. Greater depth brings rarer resources, stronger enemies, distinct environments, and eventual bosses. Not every cave reaches every depth.

## Survival, combat, and items

A continuous day/night cycle governs preparation and increasingly difficult nighttime waves. Monsters can attack players and their bases. Cave encounters and surface waves may use different spawning rules.

Real-time combat supports melee and ranged weapons, armor, and offensive, defensive, and utility magic. Enemies can pursue, defend, attack at range, or use special abilities. Items include tools, resources, weapons, armor, potions, food, seeds, building materials, and rare artifacts.

## Crafting, building, and progression

Resource gathering supplies crafting and construction. Bases can include walls, doors, floors, fences, gates, storage, lighting, and defensive structures.

Functional stations include workbenches, furnaces, anvils, armor stations, research stations, magic tables, alchemy stations, and cooking stations. Stations enable recipes; research using resources and discoveries unlocks equipment, structures, stations, magic, and technologies.

Farming includes soil preparation, seeds, planting, growth, water requirements, and harvesting. Nearby rivers and lakes can improve moisture. Irrigation, wells, water channels, fertilizers, and specialized crops are later possibilities.

## Persistent and shared worlds

Online connection, shared player movement and JSON persistence of generated chunks/characters are implemented. Characters are recovered by nickname without passwords. Shared animal movement is synchronized. Combat, construction, resources, caves and progression remain planned.

The first playable milestone is a procedural forest where the player can walk, gather resources, and discover cave entrances. The initial MVP also includes a basic day/night cycle and saving/loading. Advanced systems should arrive incrementally through the roadmap.
