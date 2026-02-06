// ============================================================
// DEPTHS OF VALRATH — Game Constants & Configuration
// ============================================================

const TILE_SIZE = 32;
const MAP_WIDTH = 80;
const MAP_HEIGHT = 50;
const MAX_FLOORS = 10;

// Tile types
const TILE = {
    VOID: 0,
    FLOOR: 1,
    WALL: 2,
    DOOR: 3,
    STAIRS_DOWN: 4,
    STAIRS_UP: 5,
    WATER: 6,
    LAVA: 7,
    TRAP: 8,
    SHOP_FLOOR: 9,
    CORRIDOR: 10,
    BARREL: 11,
    CRATE: 12,
    LOCKED_DOOR: 13,
    CRACKED_WALL: 14,
    SPIKE_TRAP: 15,
    DART_TRAP: 16,
    ALARM_TRAP: 17,
};

// Tile colors
const TILE_COLORS = {
    [TILE.VOID]: '#0a0a0f',
    [TILE.FLOOR]: '#2a2a35',
    [TILE.WALL]: '#555568',
    [TILE.DOOR]: '#8B6914',
    [TILE.STAIRS_DOWN]: '#44aaff',
    [TILE.STAIRS_UP]: '#ffaa44',
    [TILE.WATER]: '#1a3a6a',
    [TILE.LAVA]: '#8B2500',
    [TILE.TRAP]: '#2a2a35',
    [TILE.SHOP_FLOOR]: '#2a3a2a',
    [TILE.CORRIDOR]: '#222230',
    [TILE.BARREL]: '#7a5520',
    [TILE.CRATE]: '#6a4a18',
    [TILE.LOCKED_DOOR]: '#8B6914',
    [TILE.CRACKED_WALL]: '#505060',
    [TILE.SPIKE_TRAP]: '#2a2a35',
    [TILE.DART_TRAP]: '#2a2a35',
    [TILE.ALARM_TRAP]: '#2a2a35',
};

const TILE_CHARS = {
    [TILE.VOID]: ' ',
    [TILE.FLOOR]: '.',
    [TILE.WALL]: '#',
    [TILE.DOOR]: '+',
    [TILE.STAIRS_DOWN]: '>',
    [TILE.STAIRS_UP]: '<',
    [TILE.WATER]: '~',
    [TILE.LAVA]: '~',
    [TILE.TRAP]: '^',
    [TILE.SHOP_FLOOR]: '$',
    [TILE.CORRIDOR]: '.',
    [TILE.BARREL]: 'o',
    [TILE.CRATE]: 'o',
    [TILE.LOCKED_DOOR]: '+',
    [TILE.CRACKED_WALL]: '%',
    [TILE.SPIKE_TRAP]: '^',
    [TILE.DART_TRAP]: '^',
    [TILE.ALARM_TRAP]: '^',
};

const TILE_CHAR_COLORS = {
    [TILE.VOID]: '#0a0a0f',
    [TILE.FLOOR]: '#444455',
    [TILE.WALL]: '#777790',
    [TILE.DOOR]: '#D4A840',
    [TILE.STAIRS_DOWN]: '#66ccff',
    [TILE.STAIRS_UP]: '#ffcc66',
    [TILE.WATER]: '#4488cc',
    [TILE.LAVA]: '#ff4422',
    [TILE.TRAP]: '#cc4444',
    [TILE.SHOP_FLOOR]: '#44aa44',
    [TILE.CORRIDOR]: '#383848',
    [TILE.BARREL]: '#886630',
    [TILE.CRATE]: '#775520',
    [TILE.LOCKED_DOOR]: '#D4A840',
    [TILE.CRACKED_WALL]: '#667788',
    [TILE.SPIKE_TRAP]: '#cc4444',
    [TILE.DART_TRAP]: '#cc4444',
    [TILE.ALARM_TRAP]: '#cccc44',
};

// Fog of war states
const FOG = {
    UNEXPLORED: 0,
    EXPLORED: 1,
    VISIBLE: 2,
};

// Character classes
const CLASS = {
    WARRIOR: 'warrior',
    ROGUE: 'rogue',
    MAGE: 'mage',
    PALADIN: 'paladin',
};

const CLASS_DATA = {
    [CLASS.WARRIOR]: {
        name: 'Warrior',
        description: 'A mighty fighter with high health and strength. Excels in melee combat.',
        color: '#cc4444',
        symbol: '@',
        baseStats: { hp: 120, mp: 20, str: 14, def: 12, dex: 8, int: 5 },
        visionRadius: 7,
        abilities: [
            { name: 'Cleave', description: 'Hit all adjacent enemies', mpCost: 8, cooldown: 3, type: 'melee_aoe' },
            { name: 'Shield Bash', description: 'Stun an enemy for 2 turns', mpCost: 6, cooldown: 4, type: 'stun' },
            { name: 'Battle Cry', description: '+50% damage for 5 turns', mpCost: 10, cooldown: 8, type: 'buff_str' },
            { name: 'Whirlwind', description: 'Massive damage to all nearby', mpCost: 15, cooldown: 6, type: 'whirlwind' },
        ],
    },
    [CLASS.ROGUE]: {
        name: 'Rogue',
        description: 'A swift shadow with deadly critical strikes and keen perception.',
        color: '#44cc44',
        symbol: '@',
        baseStats: { hp: 80, mp: 30, str: 10, def: 7, dex: 16, int: 7 },
        visionRadius: 9,
        abilities: [
            { name: 'Backstab', description: '3x damage from stealth', mpCost: 8, cooldown: 2, type: 'backstab' },
            { name: 'Smoke Bomb', description: 'Become invisible for 3 turns', mpCost: 12, cooldown: 6, type: 'stealth' },
            { name: 'Poison Blade', description: 'Poison target for 5 turns', mpCost: 6, cooldown: 3, type: 'poison' },
            { name: 'Shadow Step', description: 'Teleport behind an enemy', mpCost: 10, cooldown: 4, type: 'teleport_to_enemy' },
        ],
    },
    [CLASS.MAGE]: {
        name: 'Mage',
        description: 'A master of arcane arts with devastating ranged spells.',
        color: '#6666ff',
        symbol: '@',
        baseStats: { hp: 70, mp: 80, str: 5, def: 5, dex: 8, int: 18 },
        visionRadius: 8,
        abilities: [
            { name: 'Fireball', description: 'Ranged explosion (3x3 area)', mpCost: 12, cooldown: 2, type: 'fireball' },
            { name: 'Ice Lance', description: 'Ranged attack, freezes target', mpCost: 8, cooldown: 2, type: 'ice_lance' },
            { name: 'Lightning', description: 'Chain lightning hits 3 enemies', mpCost: 15, cooldown: 4, type: 'chain_lightning' },
            { name: 'Arcane Shield', description: '+100% defense for 4 turns', mpCost: 10, cooldown: 6, type: 'buff_def' },
        ],
    },
    [CLASS.PALADIN]: {
        name: 'Paladin',
        description: 'A holy warrior balancing offense, defense, and healing.',
        color: '#dddd44',
        symbol: '@',
        baseStats: { hp: 100, mp: 50, str: 11, def: 11, dex: 8, int: 11 },
        visionRadius: 7,
        abilities: [
            { name: 'Holy Smite', description: 'Powerful light-based attack', mpCost: 10, cooldown: 2, type: 'holy_smite' },
            { name: 'Heal', description: 'Restore 30% of max HP', mpCost: 12, cooldown: 4, type: 'heal' },
            { name: 'Divine Shield', description: 'Immune to damage for 2 turns', mpCost: 20, cooldown: 10, type: 'invulnerable' },
            { name: 'Consecrate', description: 'Damage all nearby enemies over time', mpCost: 14, cooldown: 5, type: 'consecrate' },
        ],
    },
};

// Item rarities
const RARITY = {
    COMMON: 'common',
    UNCOMMON: 'uncommon',
    RARE: 'rare',
    EPIC: 'epic',
    LEGENDARY: 'legendary',
};

const RARITY_COLORS = {
    [RARITY.COMMON]: '#aaaaaa',
    [RARITY.UNCOMMON]: '#44cc44',
    [RARITY.RARE]: '#4488ff',
    [RARITY.EPIC]: '#aa44dd',
    [RARITY.LEGENDARY]: '#ffaa00',
};

const RARITY_WEIGHTS = {
    [RARITY.COMMON]: 50,
    [RARITY.UNCOMMON]: 30,
    [RARITY.RARE]: 14,
    [RARITY.EPIC]: 5,
    [RARITY.LEGENDARY]: 1,
};

// Equipment slots
const SLOT = {
    WEAPON: 'weapon',
    ARMOR: 'armor',
    SHIELD: 'shield',
    RING: 'ring',
    AMULET: 'amulet',
};

// Item types
const ITEM_TYPE = {
    WEAPON: 'weapon',
    ARMOR: 'armor',
    SHIELD: 'shield',
    RING: 'ring',
    AMULET: 'amulet',
    POTION_HP: 'potion_hp',
    POTION_MP: 'potion_mp',
    SCROLL: 'scroll',
    FOOD: 'food',
    GOLD: 'gold',
    KEY: 'key',
};

// Weapon base types
const WEAPONS = [
    { name: 'Dagger', baseDmg: 4, speed: 1.2, type: 'melee' },
    { name: 'Short Sword', baseDmg: 6, speed: 1.0, type: 'melee' },
    { name: 'Long Sword', baseDmg: 9, speed: 0.9, type: 'melee' },
    { name: 'Battleaxe', baseDmg: 12, speed: 0.7, type: 'melee' },
    { name: 'Warhammer', baseDmg: 14, speed: 0.6, type: 'melee' },
    { name: 'Staff', baseDmg: 5, speed: 1.0, type: 'melee', intBonus: 4 },
    { name: 'Bow', baseDmg: 7, speed: 1.0, type: 'ranged', range: 6 },
    { name: 'Crossbow', baseDmg: 10, speed: 0.7, type: 'ranged', range: 8 },
];

// Armor base types
const ARMORS = [
    { name: 'Cloth Robes', baseDef: 2, manaBonus: 10 },
    { name: 'Leather Armor', baseDef: 4 },
    { name: 'Chain Mail', baseDef: 7, dexPenalty: 1 },
    { name: 'Plate Armor', baseDef: 11, dexPenalty: 3 },
];

// Shield base types
const SHIELDS = [
    { name: 'Buckler', baseDef: 2, blockChance: 0.1 },
    { name: 'Round Shield', baseDef: 4, blockChance: 0.15 },
    { name: 'Tower Shield', baseDef: 7, blockChance: 0.25, dexPenalty: 2 },
];

// Item prefixes and suffixes for procedural names
const ITEM_PREFIXES = {
    [RARITY.COMMON]: [],
    [RARITY.UNCOMMON]: ['Sturdy', 'Keen', 'Hardened', 'Polished', 'Tempered'],
    [RARITY.RARE]: ['Blazing', 'Frozen', 'Thundering', 'Vampiric', 'Venomous', 'Radiant'],
    [RARITY.EPIC]: ['Dreadful', 'Celestial', 'Abyssal', 'Phantasmal', 'Runic'],
    [RARITY.LEGENDARY]: ['Godslayer', 'Eternal', 'Cataclysmic', 'Primordial', 'Mythic'],
};

const ITEM_SUFFIXES = {
    [RARITY.COMMON]: [],
    [RARITY.UNCOMMON]: ['of Might', 'of Vigor', 'of the Fox', 'of Warding'],
    [RARITY.RARE]: ['of the Inferno', 'of the Glacier', 'of the Storm', 'of Draining', 'of Venom'],
    [RARITY.EPIC]: ['of the Void', 'of Ascension', 'of the Abyss', 'of the Arcane', 'of Devastation'],
    [RARITY.LEGENDARY]: ['of the Gods', 'of Eternity', 'of World\'s End', 'of the Apocalypse'],
};

// Status effects
const STATUS = {
    POISON: 'poison',
    BURNING: 'burning',
    FROZEN: 'frozen',
    STUNNED: 'stunned',
    BLEEDING: 'bleeding',
    STEALTH: 'stealth',
    BUFF_STR: 'buff_str',
    BUFF_DEF: 'buff_def',
    INVULNERABLE: 'invulnerable',
    CONSECRATE: 'consecrate',
};

const STATUS_COLORS = {
    [STATUS.POISON]: '#44cc44',
    [STATUS.BURNING]: '#ff6622',
    [STATUS.FROZEN]: '#66ccff',
    [STATUS.STUNNED]: '#ffff44',
    [STATUS.BLEEDING]: '#cc2222',
    [STATUS.STEALTH]: '#8888aa',
    [STATUS.BUFF_STR]: '#ff4444',
    [STATUS.BUFF_DEF]: '#4444ff',
    [STATUS.INVULNERABLE]: '#ffffff',
    [STATUS.CONSECRATE]: '#ffdd44',
};

// Enemy definitions
const ENEMY_DATA = {
    // Tier 1 (Floors 1-3)
    rat: {
        name: 'Rat', symbol: 'r', color: '#8B7355', tier: 1,
        hp: 12, str: 4, def: 1, dex: 10, xp: 5, behavior: 'aggressive',
        speed: 1.2, description: 'A giant, diseased rat.',
    },
    slime: {
        name: 'Slime', symbol: 's', color: '#44cc44', tier: 1,
        hp: 20, str: 3, def: 3, dex: 3, xp: 8, behavior: 'patrol',
        speed: 0.5, description: 'A gelatinous blob that oozes forward.',
    },
    goblin: {
        name: 'Goblin', symbol: 'g', color: '#66aa44', tier: 1,
        hp: 18, str: 6, def: 3, dex: 9, xp: 10, behavior: 'aggressive',
        speed: 1.0, description: 'A sneaky, vicious goblin.',
    },
    bat: {
        name: 'Bat', symbol: 'b', color: '#886688', tier: 1,
        hp: 8, str: 3, def: 1, dex: 14, xp: 4, behavior: 'cowardly',
        speed: 1.5, description: 'A screeching cave bat.',
    },
    // Tier 2 (Floors 4-6)
    skeleton: {
        name: 'Skeleton', symbol: 'S', color: '#ddddcc', tier: 2,
        hp: 30, str: 10, def: 6, dex: 7, xp: 20, behavior: 'aggressive',
        speed: 0.8, description: 'An animated skeleton warrior.',
    },
    orc: {
        name: 'Orc', symbol: 'O', color: '#448844', tier: 2,
        hp: 45, str: 14, def: 8, dex: 6, xp: 30, behavior: 'aggressive',
        speed: 0.9, description: 'A hulking orc berserker.',
    },
    darkMage: {
        name: 'Dark Mage', symbol: 'M', color: '#9944cc', tier: 2,
        hp: 25, str: 5, def: 4, dex: 8, xp: 35, behavior: 'ranged',
        speed: 0.8, range: 5, description: 'A hooded figure crackling with dark energy.',
    },
    spider: {
        name: 'Giant Spider', symbol: 'x', color: '#444444', tier: 2,
        hp: 22, str: 8, def: 4, dex: 12, xp: 18, behavior: 'aggressive',
        speed: 1.3, statusOnHit: STATUS.POISON, description: 'A massive venomous spider.',
    },
    // Tier 3 (Floors 7-9)
    demon: {
        name: 'Demon', symbol: 'D', color: '#cc2222', tier: 3,
        hp: 65, str: 20, def: 12, dex: 10, xp: 60, behavior: 'aggressive',
        speed: 1.0, description: 'A fiend from the lower planes.',
    },
    lich: {
        name: 'Lich', symbol: 'L', color: '#aaccff', tier: 3,
        hp: 50, str: 8, def: 8, dex: 8, xp: 80, behavior: 'ranged',
        speed: 0.7, range: 6, description: 'An undead sorcerer of immense power.',
    },
    dragon: {
        name: 'Young Dragon', symbol: 'W', color: '#ff8844', tier: 3,
        hp: 80, str: 22, def: 15, dex: 9, xp: 100, behavior: 'aggressive',
        speed: 0.8, description: 'A dragon whelp, still deadly.',
    },
    golem: {
        name: 'Stone Golem', symbol: 'G', color: '#888888', tier: 3,
        hp: 100, str: 18, def: 20, dex: 3, xp: 70, behavior: 'patrol',
        speed: 0.4, description: 'An animated stone construct.',
    },
    wraith: {
        name: 'Wraith', symbol: 'W', color: '#aaaadd', tier: 3,
        hp: 40, str: 15, def: 5, dex: 14, xp: 55, behavior: 'aggressive',
        speed: 1.2, statusOnHit: STATUS.BLEEDING, description: 'A spectral terror that drains life.',
    },
    // Bosses
    goblinKing: {
        name: 'Goblin King', symbol: 'K', color: '#ccaa22', tier: 1, boss: true,
        hp: 80, str: 12, def: 8, dex: 10, xp: 100, behavior: 'aggressive',
        speed: 0.9, description: 'The cruel ruler of the goblin horde.',
    },
    necromancer: {
        name: 'Necromancer', symbol: 'N', color: '#8844aa', tier: 2, boss: true,
        hp: 120, str: 10, def: 10, dex: 9, xp: 250, behavior: 'ranged',
        speed: 0.8, range: 6, description: 'A master of death magic.',
    },
    demonLord: {
        name: 'Demon Lord', symbol: 'D', color: '#ff2222', tier: 3, boss: true,
        hp: 180, str: 22, def: 14, dex: 12, xp: 500, behavior: 'aggressive',
        speed: 1.0, description: 'A lord of the abyss, wreathed in hellfire.',
    },
    valrath: {
        name: 'Valrath the Undying', symbol: 'V', color: '#ff00ff', tier: 3, boss: true,
        hp: 280, str: 26, def: 16, dex: 14, xp: 1000, behavior: 'aggressive',
        speed: 1.1, description: 'The ancient evil that dwells in the deepest depths.',
    },
};

// Floors where bosses appear
const BOSS_FLOORS = {
    3: 'goblinKing',
    6: 'necromancer',
    9: 'demonLord',
    10: 'valrath',
};

// Enemies that can spawn on each tier
const TIER_ENEMIES = {
    1: ['rat', 'slime', 'goblin', 'bat'],
    2: ['skeleton', 'orc', 'darkMage', 'spider'],
    3: ['demon', 'lich', 'dragon', 'golem', 'wraith'],
};

// XP table for leveling
const XP_TABLE = [
    0, 30, 80, 150, 250, 400, 600, 850, 1200, 1600,
    2100, 2700, 3400, 4200, 5200, 6400, 7800, 9500, 11500, 14000,
];

// Hunger constants
const MAX_HUNGER = 100;
const HUNGER_PER_TURN = 0.15;
const HUNGER_DAMAGE_THRESHOLD = 10;
const HUNGER_WARNING_THRESHOLD = 25;

// BSP dungeon generation constants
const BSP_MIN_ROOM_SIZE = 5;
const BSP_MAX_ROOM_SIZE = 12;
const BSP_MIN_LEAF_SIZE = 8;
const BSP_CORRIDOR_WIDTH = 1;

// Combat constants
const BASE_CRIT_CHANCE = 0.05;
const CRIT_DEX_SCALE = 0.01;
const CRIT_MULTIPLIER = 2.0;
const BASE_DODGE_CHANCE = 0.02;
const DODGE_DEX_SCALE = 0.008;
const DAMAGE_VARIANCE = 0.2;

// Inventory
const MAX_INVENTORY_SIZE = 20;

// Colors
const COLORS = {
    background: '#0a0a12',
    hudBg: 'rgba(10, 10, 18, 0.9)',
    hudBorder: '#333348',
    hpBar: '#cc2222',
    hpBarBg: '#441111',
    mpBar: '#2244cc',
    mpBarBg: '#111144',
    xpBar: '#ccaa22',
    xpBarBg: '#443311',
    hungerBar: '#cc8822',
    hungerBarBg: '#442211',
    textPrimary: '#dddddd',
    textSecondary: '#888899',
    textDamage: '#ff4444',
    textHeal: '#44ff44',
    textMana: '#4488ff',
    textGold: '#ffcc00',
    textXp: '#ccaa22',
    textCrit: '#ff8800',
    tooltipBg: 'rgba(15, 15, 25, 0.95)',
    tooltipBorder: '#555568',
    minimapBg: 'rgba(0, 0, 0, 0.7)',
    minimapWall: '#555568',
    minimapFloor: '#333345',
    minimapPlayer: '#ffff00',
    minimapEnemy: '#ff4444',
    minimapItem: '#44cc44',
    minimapStairs: '#66ccff',
};

// Game states
const GAME_STATE = {
    MENU: 'menu',
    MP_MENU: 'mp_menu',
    LOBBY: 'lobby',
    PLAYING: 'playing',
    INVENTORY: 'inventory',
    CHARACTER: 'character',
    SHOP: 'shop',
    TARGETING: 'targeting',
    GAME_OVER: 'game_over',
    VICTORY: 'victory',
    LEVEL_UP: 'level_up',
    NPC_DIALOGUE: 'npc_dialogue',
};

// Multiplayer config
const WS_DEFAULT_PORT = 3000;
const MAX_PLAYERS = 4;
const ENEMY_REACTION_RANGE = 10;

// ============================================================
// BIOME SYSTEM
// ============================================================

const BIOME = {
    CRYPT: 'crypt',
    CAVERN: 'cavern',
    INFERNO: 'inferno',
    THRONE: 'throne',
};

const FLOOR_BIOME = {
    1: BIOME.CRYPT, 2: BIOME.CRYPT, 3: BIOME.CRYPT,
    4: BIOME.CAVERN, 5: BIOME.CAVERN, 6: BIOME.CAVERN,
    7: BIOME.INFERNO, 8: BIOME.INFERNO, 9: BIOME.INFERNO,
    10: BIOME.THRONE,
};

const BIOME_DATA = {
    [BIOME.CRYPT]: {
        name: 'The Crypt',
        palette: {
            floorBase: ['#2c2c38', '#2a2a35', '#282832'],
            wallTop: '#626278', wallBottom: '#484860',
            corridorBase: ['#232231', '#222230', '#21212f'],
            voidColor: '#0a0a0f',
        },
        lightColor: { r: 255, g: 200, b: 120 },
        ambientTint: null,
        dustColor: '#ccbb99',
        dustCount: 30,
        hazardBias: { water: 0.2, lava: 0.0, trap: 0.8 },
        decorDensity: 0.08,
    },
    [BIOME.CAVERN]: {
        name: 'Flooded Caverns',
        palette: {
            floorBase: ['#1e2e3e', '#1c2c38', '#1a2a34'],
            wallTop: '#3a5568', wallBottom: '#2a4558',
            corridorBase: ['#182830', '#172730', '#16262e'],
            voidColor: '#060e14',
        },
        lightColor: { r: 100, g: 220, b: 255 },
        ambientTint: { r: 20, g: 60, b: 80, a: 0.04 },
        dustColor: '#66aacc',
        dustCount: 20,
        hazardBias: { water: 0.7, lava: 0.0, trap: 0.3 },
        decorDensity: 0.10,
    },
    [BIOME.INFERNO]: {
        name: 'Inferno Forge',
        palette: {
            floorBase: ['#352018', '#301c14', '#2c1810'],
            wallTop: '#704030', wallBottom: '#583020',
            corridorBase: ['#2a1810', '#281610', '#26140e'],
            voidColor: '#0f0604',
        },
        lightColor: { r: 255, g: 120, b: 40 },
        ambientTint: { r: 80, g: 20, b: 0, a: 0.05 },
        dustColor: '#ff8844',
        dustCount: 40,
        hazardBias: { water: 0.0, lava: 0.6, trap: 0.4 },
        decorDensity: 0.12,
    },
    [BIOME.THRONE]: {
        name: 'Throne of Valrath',
        palette: {
            floorBase: ['#1a102e', '#18102a', '#160e28'],
            wallTop: '#4a3070', wallBottom: '#382060',
            corridorBase: ['#140c24', '#120c22', '#100a20'],
            voidColor: '#06020e',
        },
        lightColor: { r: 180, g: 100, b: 255 },
        ambientTint: { r: 60, g: 0, b: 80, a: 0.06 },
        dustColor: '#aa66ff',
        dustCount: 50,
        hazardBias: { water: 0.15, lava: 0.35, trap: 0.5 },
        decorDensity: 0.15,
    },
};

function getBiome(floor) {
    return BIOME_DATA[FLOOR_BIOME[floor]] || BIOME_DATA[BIOME.CRYPT];
}

// ============================================================
// ELITE ENEMY MODIFIERS
// ============================================================

const ELITE_MODIFIERS = {
    vampiric: {
        name: 'Vampiric', color: '#cc2244',
        glowColor: 'rgba(200, 30, 60, 0.3)', icon: 'V',
        statMults: { hp: 1.2, str: 1.0, def: 1.0 },
    },
    splitting: {
        name: 'Splitting', color: '#44cc88',
        glowColor: 'rgba(60, 200, 120, 0.3)', icon: 'S',
        statMults: { hp: 0.8, str: 0.9, def: 0.9 },
    },
    teleporting: {
        name: 'Teleporting', color: '#8844ff',
        glowColor: 'rgba(130, 60, 255, 0.3)', icon: 'T',
        statMults: { hp: 1.0, str: 1.1, def: 0.9 },
    },
    shielded: {
        name: 'Shielded', color: '#4488cc',
        glowColor: 'rgba(60, 130, 200, 0.3)', icon: 'D',
        statMults: { hp: 1.0, str: 0.9, def: 1.8 },
    },
    berserker: {
        name: 'Berserker', color: '#ff4444',
        glowColor: 'rgba(255, 60, 60, 0.3)', icon: 'B',
        statMults: { hp: 1.3, str: 1.1, def: 0.8 },
    },
    freezing: {
        name: 'Freezing', color: '#66ccff',
        glowColor: 'rgba(100, 200, 255, 0.3)', icon: 'F',
        statMults: { hp: 1.0, str: 1.0, def: 1.0 },
    },
    poisonous: {
        name: 'Poisonous', color: '#44cc44',
        glowColor: 'rgba(60, 200, 60, 0.3)', icon: 'P',
        statMults: { hp: 1.0, str: 0.9, def: 1.0 },
    },
    arcane: {
        name: 'Arcane', color: '#aa44ff',
        glowColor: 'rgba(170, 60, 255, 0.3)', icon: 'A',
        statMults: { hp: 1.1, str: 1.2, def: 0.9 },
    },
    regenerating: {
        name: 'Regenerating', color: '#44ff88',
        glowColor: 'rgba(60, 255, 130, 0.3)', icon: 'R',
        statMults: { hp: 1.0, str: 1.0, def: 1.0 },
    },
    explosive: {
        name: 'Explosive', color: '#ff8822',
        glowColor: 'rgba(255, 130, 30, 0.3)', icon: 'E',
        statMults: { hp: 0.9, str: 1.0, def: 0.9 },
    },
};

const ELITE_SPAWN_CHANCE = 0.15;
const ELITE_XP_MULTIPLIER = 2.5;
const ELITE_LOOT_RARITY_BOOST = 2;

// ============================================================
// COMBAT JUICE — Screen shake profiles & particle presets
// ============================================================

const SHAKE = {
    PLAYER_HIT: 5,
    PLAYER_CRIT_TAKEN: 10,
    ENEMY_HIT: 2,
    ENEMY_CRIT: 4,
    EXPLOSION: 12,
    BOSS_STOMP: 15,
    WHIRLWIND: 6,
    LEVEL_UP: 3,
};

const PARTICLE_PRESETS = {
    MELEE_HIT:  { count: 8,  speed: 80,  lifetime: 0.4, shape: 'spark',  gravity: 30 },
    CRIT_HIT:   { count: 15, speed: 120, lifetime: 0.6, shape: 'spark',  gravity: 20, size: 3 },
    BLOOD:      { count: 6,  speed: 50,  lifetime: 0.5, shape: 'circle', gravity: 80, size: 2 },
    FIRE:       { count: 12, speed: 40,  lifetime: 0.8, shape: 'circle', gravity: -20 },
    ICE:        { count: 10, speed: 30,  lifetime: 1.0, shape: 'square', gravity: 10 },
    LIGHTNING:  { count: 8,  speed: 100, lifetime: 0.3, shape: 'spark',  gravity: 0 },
    HEAL:       { count: 8,  speed: 30,  lifetime: 0.8, shape: 'circle', gravity: -40 },
    DEATH:      { count: 20, speed: 60,  lifetime: 1.0, shape: 'circle', gravity: 60 },
    GOLD:       { count: 6,  speed: 50,  lifetime: 0.5, shape: 'square', gravity: 50, size: 2 },
};

// ============================================================
// SKILL UPGRADE SYSTEM — Perks & ability upgrades
// ============================================================

const PERKS = {
    thorns: {
        name: 'Thorns', description: 'Reflect 20% of melee damage taken',
        icon: '!', iconColor: '#cc4444', maxStacks: 3,
        effect: { type: 'thorns', value: 0.20 },
    },
    scavenger: {
        name: 'Scavenger', description: '+25% gold found',
        icon: '$', iconColor: '#ffcc00', maxStacks: 2,
        effect: { type: 'gold_mult', value: 0.25 },
    },
    vampiric_strikes: {
        name: 'Vampiric Strikes', description: 'Heal 10% of melee damage dealt',
        icon: 'V', iconColor: '#cc2244', maxStacks: 2,
        effect: { type: 'lifesteal', value: 0.10 },
    },
    iron_skin: {
        name: 'Iron Skin', description: 'Reduce all damage taken by 2',
        icon: 'I', iconColor: '#4488cc', maxStacks: 3,
        effect: { type: 'flat_dr', value: 2 },
    },
    quick_feet: {
        name: 'Quick Feet', description: '+5% dodge chance',
        icon: 'Q', iconColor: '#44cc44', maxStacks: 3,
        effect: { type: 'dodge_bonus', value: 0.05 },
    },
    mana_flow: {
        name: 'Mana Flow', description: '+1 MP regeneration per turn',
        icon: 'M', iconColor: '#4488ff', maxStacks: 3,
        effect: { type: 'mp_regen', value: 1 },
    },
    critical_mastery: {
        name: 'Critical Mastery', description: '+5% critical hit chance',
        icon: 'C', iconColor: '#ff8800', maxStacks: 3,
        effect: { type: 'crit_bonus', value: 0.05 },
    },
    feast: {
        name: 'Feast', description: 'Killing an enemy restores 5% max HP',
        icon: 'F', iconColor: '#44ff88', maxStacks: 2,
        effect: { type: 'kill_heal', value: 0.05 },
    },
    arcane_hunger: {
        name: 'Arcane Hunger', description: 'Killing an enemy restores 3% max MP',
        icon: 'A', iconColor: '#aa44ff', maxStacks: 2,
        effect: { type: 'kill_mana', value: 0.03 },
    },
    thick_skull: {
        name: 'Thick Skull', description: '50% resistance to stun and freeze',
        icon: 'T', iconColor: '#ffff44', maxStacks: 1,
        effect: { type: 'cc_resist', value: 0.5 },
    },
};

const ABILITY_UPGRADES = {
    [CLASS.WARRIOR]: {
        'Cleave': [
            { name: 'Sweeping Cleave', description: 'Hits in a 2-tile radius', enhancedType: 'melee_aoe_2' },
            { name: 'Rending Cleave', description: 'Also applies Bleeding for 3 turns', enhancedType: 'melee_aoe_bleed' },
        ],
        'Shield Bash': [
            { name: 'Concussive Bash', description: 'Stun lasts 3 turns', enhancedType: 'stun_3' },
            { name: 'Shattering Bash', description: 'Also reduces DEF by 30%', enhancedType: 'stun_armor_break' },
        ],
        'Battle Cry': [
            { name: 'War Drums', description: 'Also grants +25% defense', enhancedType: 'buff_str_def' },
            { name: 'Bloodlust', description: 'Each kill extends duration by 2 turns', enhancedType: 'buff_str_extend' },
        ],
        'Whirlwind': [
            { name: 'Tornado', description: 'Radius 3, pushes enemies back', enhancedType: 'whirlwind_push' },
            { name: 'Cyclone', description: 'Hits twice at 70% damage each', enhancedType: 'whirlwind_double' },
        ],
    },
    [CLASS.ROGUE]: {
        'Backstab': [
            { name: 'Assassinate', description: '4x from stealth, execute below 15% HP', enhancedType: 'backstab_execute' },
            { name: 'Twisted Blade', description: 'Applies Bleeding and Poison', enhancedType: 'backstab_dot' },
        ],
        'Smoke Bomb': [
            { name: 'Choking Cloud', description: 'Also poisons adjacent enemies', enhancedType: 'stealth_poison' },
            { name: 'Shadow Cloak', description: 'Stealth lasts 5 turns', enhancedType: 'stealth_long' },
        ],
        'Poison Blade': [
            { name: 'Lethal Toxin', description: 'Double damage, lasts 7 turns', enhancedType: 'poison_strong' },
            { name: 'Paralyzing Venom', description: 'Also stuns for 1 turn', enhancedType: 'poison_stun' },
        ],
        'Shadow Step': [
            { name: 'Phantom Strike', description: 'Deals damage on arrival', enhancedType: 'teleport_damage' },
            { name: 'Blink', description: 'Teleport to any visible tile', enhancedType: 'teleport_free' },
        ],
    },
    [CLASS.MAGE]: {
        'Fireball': [
            { name: 'Meteor', description: 'Larger 5x5 radius', enhancedType: 'fireball_large' },
            { name: 'Chain Fireball', description: 'Bounces to second target at 50%', enhancedType: 'fireball_chain' },
        ],
        'Ice Lance': [
            { name: 'Blizzard', description: 'AOE freeze in 3x3 area', enhancedType: 'ice_aoe' },
            { name: 'Glacial Spike', description: 'Double damage, 3-turn freeze', enhancedType: 'ice_strong' },
        ],
        'Lightning': [
            { name: 'Thunderstorm', description: 'Hits 5 enemies, stuns each 1 turn', enhancedType: 'lightning_storm' },
            { name: 'Ball Lightning', description: 'Persistent orb for 3 turns', enhancedType: 'lightning_orb' },
        ],
        'Arcane Shield': [
            { name: 'Mana Barrier', description: 'Absorbs damage from MP, +200% def', enhancedType: 'shield_mana' },
            { name: 'Reflect Shield', description: 'Reflects 50% of blocked damage', enhancedType: 'shield_reflect' },
        ],
    },
    [CLASS.PALADIN]: {
        'Holy Smite': [
            { name: 'Judgment', description: 'Bonus 20% of enemy missing HP', enhancedType: 'smite_execute' },
            { name: 'Radiant Burst', description: 'AOE in 2-tile radius', enhancedType: 'smite_aoe' },
        ],
        'Heal': [
            { name: 'Greater Heal', description: 'Restore 50% max HP', enhancedType: 'heal_strong' },
            { name: 'Purify', description: 'Heal 30% and remove all debuffs', enhancedType: 'heal_cleanse' },
        ],
        'Divine Shield': [
            { name: 'Aegis of Light', description: 'Immunity lasts 3 turns', enhancedType: 'invuln_3' },
            { name: 'Martyr', description: '2 turn immunity + heal 50% on expiry', enhancedType: 'invuln_heal' },
        ],
        'Consecrate': [
            { name: 'Holy Ground', description: 'Also heals player each turn', enhancedType: 'consecrate_heal' },
            { name: 'Sanctify', description: 'Doubled radius and damage', enhancedType: 'consecrate_strong' },
        ],
    },
};

const STAT_UPGRADES = [
    { name: '+3 Strength',    stat: 'str',   value: 3,  color: '#cc4444' },
    { name: '+3 Defense',     stat: 'def',   value: 3,  color: '#4488cc' },
    { name: '+3 Dexterity',   stat: 'dex',   value: 3,  color: '#44cc44' },
    { name: '+3 Intelligence', stat: 'int',   value: 3,  color: '#aa66ff' },
    { name: '+15 Max HP',     stat: 'maxhp', value: 15, color: '#cc2222' },
    { name: '+10 Max MP',     stat: 'maxmp', value: 10, color: '#2244cc' },
];

// ============================================================
// NPC ENCOUNTERS
// ============================================================

const NPC_DATA = {
    wandering_merchant: {
        name: 'Wandering Merchant', symbol: 'M', color: '#44aa88',
        description: 'A hooded figure with a heavy pack.',
        dialogue: ['Ah, a customer! I have rare goods... for a price.', 'Not many venture this deep.'],
        type: 'trade', spawnFloors: [2, 3, 4, 5, 6, 7, 8, 9], spawnChance: 0.25,
    },
    hermit_sage: {
        name: 'Hermit Sage', symbol: 'S', color: '#8888ff',
        description: 'A wizened figure radiating faint magical energy.',
        dialogue: ['I sense great potential in you.', 'The path ahead is treacherous...'],
        type: 'buff', spawnFloors: [3, 5, 7, 9], spawnChance: 0.30,
        buffs: [
            { name: "Sage's Blessing", effect: STATUS.BUFF_STR, duration: 50, text: '+50% STR for 50 turns' },
            { name: 'Warding Rune', effect: STATUS.BUFF_DEF, duration: 50, text: '+100% DEF for 50 turns' },
            { name: 'Third Eye', text: 'Reveals all enemies', special: 'reveal_enemies' },
            { name: 'Restoration', text: 'Fully restores HP and MP', special: 'full_heal' },
        ],
    },
    lost_adventurer: {
        name: 'Lost Adventurer', symbol: 'A', color: '#cc8844',
        description: 'A wounded adventurer, desperate for help.',
        dialogue: ['Please... I was separated from my party.', 'Help me, and I\'ll share what I know.'],
        type: 'quest', spawnFloors: [2, 4, 6, 8], spawnChance: 0.20,
    },
    shrine_spirit: {
        name: 'Shrine Spirit', symbol: 'G', color: '#ffdd88',
        description: 'A spectral figure hovering above an ancient shrine.',
        dialogue: ['This shrine still holds power. Make an offering.', 'Gold for power... a fair trade.'],
        type: 'gamble', spawnFloors: [3, 4, 5, 6, 7, 8, 9], spawnChance: 0.20,
    },
    lore_keeper: {
        name: 'The Chronicler', symbol: 'C', color: '#aaccff',
        description: 'A ghostly figure endlessly writing in a spectral tome.',
        dialogue: ['I record all that transpires. Would you hear a tale?'],
        type: 'lore', spawnFloors: [1, 3, 5, 7, 9], spawnChance: 0.15,
        loreEntries: [
            'Valrath was once a mortal king, consumed by his quest for immortality.',
            'The Flooded Caverns were once grand halls, before the river broke through.',
            'The forges below once armed the greatest army this world has seen.',
            'The Throne of Valrath exists between worlds — neither fully here nor there.',
        ],
    },
};

// Direction vectors
const DIRS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
    UP_LEFT: { x: -1, y: -1 },
    UP_RIGHT: { x: 1, y: -1 },
    DOWN_LEFT: { x: -1, y: 1 },
    DOWN_RIGHT: { x: 1, y: 1 },
};

const ALL_DIRS = [DIRS.UP, DIRS.DOWN, DIRS.LEFT, DIRS.RIGHT, DIRS.UP_LEFT, DIRS.UP_RIGHT, DIRS.DOWN_LEFT, DIRS.DOWN_RIGHT];
const CARDINAL_DIRS = [DIRS.UP, DIRS.DOWN, DIRS.LEFT, DIRS.RIGHT];
