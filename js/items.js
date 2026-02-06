// ============================================================
// DEPTHS OF VALRATH — Item Generation & Inventory System
// ============================================================

let nextItemId = 1;

function generateItemId() {
    return nextItemId++;
}

// Generate a random item appropriate for the given floor
function generateItem(floor, forceRarity) {
    const rarity = forceRarity || rollRarity(floor);

    // Decide item type
    const typeRoll = rng.next();
    if (typeRoll < 0.30) return generateWeapon(floor, rarity);
    if (typeRoll < 0.50) return generateArmor(floor, rarity);
    if (typeRoll < 0.58) return generateShield(floor, rarity);
    if (typeRoll < 0.66) return generateRing(floor, rarity);
    if (typeRoll < 0.74) return generateAmulet(floor, rarity);
    if (typeRoll < 0.84) return generatePotion(floor);
    if (typeRoll < 0.90) return generateScroll(floor);
    if (typeRoll < 0.96) return generateFood();
    return generateGold(floor);
}

function rollRarity(floor) {
    const weights = Object.entries(RARITY_WEIGHTS).map(([rarity, weight]) => {
        // Higher floors have better loot
        let adjustedWeight = weight;
        if (rarity === RARITY.UNCOMMON) adjustedWeight += floor * 2;
        if (rarity === RARITY.RARE) adjustedWeight += floor * 1.5;
        if (rarity === RARITY.EPIC) adjustedWeight += floor * 0.8;
        if (rarity === RARITY.LEGENDARY) adjustedWeight += floor * 0.2;
        return { item: rarity, weight: adjustedWeight };
    });
    return rng.weightedPick(weights);
}

function generateWeapon(floor, rarity) {
    const base = rng.pick(WEAPONS);
    const rarityMult = getRarityMultiplier(rarity);
    const floorMult = 1 + floor * 0.15;

    const item = {
        id: generateItemId(),
        type: ITEM_TYPE.WEAPON,
        slot: SLOT.WEAPON,
        baseName: base.name,
        rarity,
        damage: Math.floor(base.baseDmg * rarityMult * floorMult),
        attackType: base.type,
        range: base.range || 1,
        strBonus: 0,
        dexBonus: 0,
        intBonus: 0,
        defBonus: 0,
        symbol: ')',
        statusEffect: null,
    };

    // Add bonuses based on rarity
    applyRarityBonuses(item, rarity, floor);

    // Add weapon-specific bonuses
    if (base.intBonus) item.intBonus += base.intBonus;

    // Status effects for rare+
    if (rarity === RARITY.RARE || rarity === RARITY.EPIC || rarity === RARITY.LEGENDARY) {
        const effects = [STATUS.BURNING, STATUS.FROZEN, STATUS.POISON, STATUS.BLEEDING];
        if (rng.chance(0.5)) item.statusEffect = rng.pick(effects);
    }

    item.name = generateItemName(item, rarity);
    item.description = `Damage: ${item.damage}` + (item.range > 1 ? ` (Range: ${item.range})` : '');
    return item;
}

function generateArmor(floor, rarity) {
    const base = rng.pick(ARMORS);
    const rarityMult = getRarityMultiplier(rarity);
    const floorMult = 1 + floor * 0.12;

    const item = {
        id: generateItemId(),
        type: ITEM_TYPE.ARMOR,
        slot: SLOT.ARMOR,
        baseName: base.name,
        rarity,
        defense: Math.floor(base.baseDef * rarityMult * floorMult),
        strBonus: 0,
        dexBonus: base.dexPenalty ? -base.dexPenalty : 0,
        intBonus: 0,
        defBonus: 0,
        hpBonus: 0,
        mpBonus: base.manaBonus || 0,
        symbol: '[',
    };

    applyRarityBonuses(item, rarity, floor);
    item.name = generateItemName(item, rarity);
    item.description = `Defense: ${item.defense}`;
    return item;
}

function generateShield(floor, rarity) {
    const base = rng.pick(SHIELDS);
    const rarityMult = getRarityMultiplier(rarity);
    const floorMult = 1 + floor * 0.12;

    const item = {
        id: generateItemId(),
        type: ITEM_TYPE.SHIELD,
        slot: SLOT.SHIELD,
        baseName: base.name,
        rarity,
        defense: Math.floor(base.baseDef * rarityMult * floorMult),
        blockChance: base.blockChance * rarityMult,
        dexBonus: base.dexPenalty ? -base.dexPenalty : 0,
        strBonus: 0,
        intBonus: 0,
        defBonus: 0,
        symbol: ']',
    };

    applyRarityBonuses(item, rarity, floor);
    item.name = generateItemName(item, rarity);
    item.description = `Defense: ${item.defense}, Block: ${Math.floor(item.blockChance * 100)}%`;
    return item;
}

function generateRing(floor, rarity) {
    const names = ['Ruby Ring', 'Sapphire Ring', 'Emerald Ring', 'Onyx Ring', 'Diamond Ring'];
    const item = {
        id: generateItemId(),
        type: ITEM_TYPE.RING,
        slot: SLOT.RING,
        baseName: rng.pick(names),
        rarity,
        strBonus: 0,
        dexBonus: 0,
        intBonus: 0,
        defBonus: 0,
        hpBonus: 0,
        mpBonus: 0,
        symbol: '=',
    };

    // Rings give varied stat bonuses
    const statBonus = Math.floor((1 + floor * 0.3) * getRarityMultiplier(rarity));
    const statType = rng.pick(['str', 'dex', 'int', 'def']);
    item[statType + 'Bonus'] = statBonus;

    if (rng.chance(0.5)) {
        item.hpBonus = Math.floor(rng.int(5, 15) * getRarityMultiplier(rarity));
    }

    item.name = generateItemName(item, rarity);
    item.description = getStatBonusDescription(item);
    return item;
}

function generateAmulet(floor, rarity) {
    const names = ['Gold Amulet', 'Silver Amulet', 'Crystal Amulet', 'Bone Amulet', 'Jade Amulet'];
    const item = {
        id: generateItemId(),
        type: ITEM_TYPE.AMULET,
        slot: SLOT.AMULET,
        baseName: rng.pick(names),
        rarity,
        strBonus: 0,
        dexBonus: 0,
        intBonus: 0,
        defBonus: 0,
        hpBonus: 0,
        mpBonus: 0,
        symbol: '"',
    };

    const rarityMult = getRarityMultiplier(rarity);
    // Amulets tend to give multiple smaller bonuses
    item.strBonus = rng.chance(0.3) ? Math.floor(rng.int(1, 3) * rarityMult) : 0;
    item.defBonus = rng.chance(0.3) ? Math.floor(rng.int(1, 3) * rarityMult) : 0;
    item.dexBonus = rng.chance(0.3) ? Math.floor(rng.int(1, 3) * rarityMult) : 0;
    item.intBonus = rng.chance(0.3) ? Math.floor(rng.int(1, 3) * rarityMult) : 0;
    item.mpBonus = rng.chance(0.4) ? Math.floor(rng.int(5, 15) * rarityMult) : 0;

    // Ensure amulets always have at least one bonus
    if (item.strBonus + item.defBonus + item.dexBonus + item.intBonus + item.mpBonus === 0) {
        const stat = rng.pick(['strBonus', 'defBonus', 'dexBonus', 'intBonus']);
        item[stat] = Math.floor(rng.int(1, 3) * rarityMult);
    }

    item.name = generateItemName(item, rarity);
    item.description = getStatBonusDescription(item);
    return item;
}

function generatePotion(floor) {
    const isHp = rng.chance(0.6);
    const power = isHp ? 20 + floor * 5 : 15 + floor * 3;

    return {
        id: generateItemId(),
        type: isHp ? ITEM_TYPE.POTION_HP : ITEM_TYPE.POTION_MP,
        name: isHp ? 'Health Potion' : 'Mana Potion',
        rarity: RARITY.COMMON,
        power,
        symbol: '!',
        description: isHp ? `Restores ${power} HP` : `Restores ${power} MP`,
        consumable: true,
    };
}

function generateScroll(floor) {
    const scrollTypes = [
        { name: 'Scroll of Teleport', effect: 'teleport', description: 'Teleports you to a random location' },
        { name: 'Scroll of Mapping', effect: 'map', description: 'Reveals the entire floor' },
        { name: 'Scroll of Fireball', effect: 'fireball', description: 'Unleashes a powerful fireball' },
    ];
    const scroll = rng.pick(scrollTypes);

    return {
        id: generateItemId(),
        type: ITEM_TYPE.SCROLL,
        name: scroll.name,
        rarity: RARITY.UNCOMMON,
        effect: scroll.effect,
        power: 15 + floor * 3,
        symbol: '?',
        description: scroll.description,
        consumable: true,
    };
}

function generateFood() {
    const foods = [
        { name: 'Bread', power: 25 },
        { name: 'Meat', power: 40 },
        { name: 'Cheese', power: 20 },
        { name: 'Rations', power: 35 },
        { name: 'Apple', power: 15 },
    ];
    const food = rng.pick(foods);

    return {
        id: generateItemId(),
        type: ITEM_TYPE.FOOD,
        name: food.name,
        rarity: RARITY.COMMON,
        power: food.power,
        symbol: '%',
        description: `Restores ${food.power} hunger`,
        consumable: true,
    };
}

function generateGold(floor) {
    const amount = rng.int(5, 15) + floor * rng.int(3, 8);
    return {
        id: generateItemId(),
        type: ITEM_TYPE.GOLD,
        name: `${amount} Gold`,
        rarity: RARITY.COMMON,
        value: amount,
        symbol: '$',
        description: `${amount} gold coins`,
    };
}

function getRarityMultiplier(rarity) {
    switch (rarity) {
        case RARITY.COMMON: return 1.0;
        case RARITY.UNCOMMON: return 1.3;
        case RARITY.RARE: return 1.7;
        case RARITY.EPIC: return 2.2;
        case RARITY.LEGENDARY: return 3.0;
        default: return 1.0;
    }
}

function applyRarityBonuses(item, rarity, floor) {
    const mult = getRarityMultiplier(rarity);
    if (rarity === RARITY.COMMON) return;

    const bonusCount = rarity === RARITY.UNCOMMON ? 1 :
                       rarity === RARITY.RARE ? 2 :
                       rarity === RARITY.EPIC ? 3 : 4;

    const stats = ['strBonus', 'defBonus', 'dexBonus', 'intBonus'];
    for (let i = 0; i < bonusCount; i++) {
        const stat = rng.pick(stats);
        item[stat] = (item[stat] || 0) + Math.floor(rng.int(1, 3) * mult);
    }

    if (rng.chance(0.3) && rarity !== RARITY.UNCOMMON) {
        item.hpBonus = (item.hpBonus || 0) + Math.floor(rng.int(5, 20) * mult);
    }
}

function generateItemName(item, rarity) {
    const prefixes = ITEM_PREFIXES[rarity];
    const suffixes = ITEM_SUFFIXES[rarity];
    let name = item.baseName;

    if (prefixes.length > 0 && rng.chance(0.7)) {
        name = rng.pick(prefixes) + ' ' + name;
    }
    if (suffixes.length > 0 && rng.chance(0.6)) {
        name = name + ' ' + rng.pick(suffixes);
    }

    return name;
}

function getStatBonusDescription(item) {
    const parts = [];
    if (item.damage) parts.push(`DMG: ${item.damage}`);
    if (item.defense) parts.push(`DEF: ${item.defense}`);
    if (item.strBonus > 0) parts.push(`+${item.strBonus} STR`);
    if (item.defBonus > 0) parts.push(`+${item.defBonus} DEF`);
    if (item.dexBonus > 0) parts.push(`+${item.dexBonus} DEX`);
    if (item.dexBonus < 0) parts.push(`${item.dexBonus} DEX`);
    if (item.intBonus > 0) parts.push(`+${item.intBonus} INT`);
    if (item.hpBonus > 0) parts.push(`+${item.hpBonus} HP`);
    if (item.mpBonus > 0) parts.push(`+${item.mpBonus} MP`);
    if (item.blockChance) parts.push(`Block: ${Math.floor(item.blockChance * 100)}%`);
    if (item.statusEffect) parts.push(`Proc: ${item.statusEffect}`);
    return parts.join(', ');
}

function getItemColor(item) {
    return RARITY_COLORS[item.rarity] || COLORS.textPrimary;
}

// Spawn items on a dungeon floor
function spawnItems(dungeon) {
    const floor = dungeon.floor;
    const items = [];

    // Regular loot in rooms
    for (let i = 1; i < dungeon.rooms.length; i++) {
        const room = dungeon.rooms[i];
        const itemCount = rng.int(0, 2);
        for (let j = 0; j < itemCount; j++) {
            const pos = dungeon.getRandomPosInRoom(room);
            const item = generateItem(floor);
            item.x = pos.x;
            item.y = pos.y;
            items.push(item);
        }
    }

    // Treasure rooms get extra loot
    for (const room of dungeon.specialRooms.treasure) {
        const itemCount = rng.int(2, 4);
        for (let j = 0; j < itemCount; j++) {
            const pos = dungeon.getRandomPosInRoom(room);
            const item = generateItem(floor, rng.chance(0.3) ? RARITY.RARE : undefined);
            item.x = pos.x;
            item.y = pos.y;
            items.push(item);
        }
    }

    // Shop items
    if (dungeon.specialRooms.shop) {
        const shopRoom = dungeon.specialRooms.shop;
        const shopCount = rng.int(3, 5);
        for (let j = 0; j < shopCount; j++) {
            const pos = dungeon.getRandomPosInRoom(shopRoom);
            const item = generateItem(floor, rng.chance(0.4) ? RARITY.UNCOMMON : undefined);
            item.x = pos.x;
            item.y = pos.y;
            item.shopPrice = Math.floor(
                (10 + floor * 5) * getRarityMultiplier(item.rarity) * rng.float(0.8, 1.2)
            );
            item.isShopItem = true;
            items.push(item);
        }
    }

    return items;
}

// Generate item sell price
function getSellPrice(item) {
    return Math.max(1, Math.floor(
        (5 + getRarityMultiplier(item.rarity) * 5) * (item.damage || item.defense || 3) * 0.3
    ));
}
