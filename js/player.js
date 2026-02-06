// ============================================================
// DEPTHS OF VALRATH — Player System
// ============================================================

class Player {
    constructor(classId) {
        const classData = CLASS_DATA[classId];
        this.classId = classId;
        this.className = classData.name;
        this.color = classData.color;
        this.symbol = classData.symbol;
        this.visionRadius = classData.visionRadius;

        // Position
        this.x = 0;
        this.y = 0;
        this.prevX = 0;
        this.prevY = 0;
        this.moveAnimT = 1;

        // Stats
        this.level = 1;
        this.xp = 0;
        this.xpToNext = XP_TABLE[1] || 30;

        this.maxHp = classData.baseStats.hp;
        this.hp = this.maxHp;
        this.maxMp = classData.baseStats.mp;
        this.mp = this.maxMp;

        this.baseStr = classData.baseStats.str;
        this.baseDef = classData.baseStats.def;
        this.baseDex = classData.baseStats.dex;
        this.baseInt = classData.baseStats.int;

        // Derived from base + equipment
        this.str = this.baseStr;
        this.def = this.baseDef;
        this.dex = this.baseDex;
        this.int = this.baseInt;

        // Hunger
        this.hunger = MAX_HUNGER;

        // Gold
        this.gold = 0;

        // Equipment
        this.equipment = {
            [SLOT.WEAPON]: null,
            [SLOT.ARMOR]: null,
            [SLOT.SHIELD]: null,
            [SLOT.RING]: null,
            [SLOT.AMULET]: null,
        };

        // Inventory
        this.inventory = [];

        // Abilities
        this.abilities = classData.abilities.map(a => ({
            ...a,
            currentCooldown: 0,
        }));

        // Status effects
        this.statusEffects = [];

        // Statistics tracking
        this.stats = {
            enemiesKilled: 0,
            damageDealt: 0,
            damageTaken: 0,
            itemsFound: 0,
            potionsDrunk: 0,
            floorsExplored: 1,
            turnsPlayed: 0,
            goldCollected: 0,
            bossesKilled: 0,
            criticalHits: 0,
        };

        // Stat points available for allocation (legacy, kept for compatibility)
        this.statPoints = 0;

        // Current floor
        this.floor = 1;

        // Stealth state
        this.stealthTurns = 0;

        // Invulnerability
        this.invulnTurns = 0;

        // Skill upgrade system — replaces simple stat allocation
        this.pendingStatPoints = 0; // Kept for backwards compatibility check
        this.pendingLevelUpChoices = 0;
        this.levelUpChoices = []; // Current 3 choices to pick from
        this.perks = {}; // perk_key -> stacks count
        this.abilityUpgrades = {}; // ability_name -> upgrade object
    }

    // Check if player has a perk
    hasPerk(perkKey) {
        return (this.perks[perkKey] || 0) > 0;
    }

    getPerkStacks(perkKey) {
        return this.perks[perkKey] || 0;
    }

    addPerk(perkKey) {
        const perk = PERKS[perkKey];
        if (!perk) return;
        const current = this.perks[perkKey] || 0;
        if (current < perk.maxStacks) {
            this.perks[perkKey] = current + 1;
        }
    }

    // Generate 3 level-up choices: mix of stat boosts, perks, and ability upgrades
    generateLevelUpChoices() {
        const choices = [];
        const pool = [];

        // Always include 2 random stat boosts
        const shuffledStats = [...STAT_UPGRADES].sort(() => Math.random() - 0.5);
        pool.push({ type: 'stat', data: shuffledStats[0] });
        pool.push({ type: 'stat', data: shuffledStats[1] });

        // Add available perks (not maxed)
        const perkKeys = Object.keys(PERKS);
        const availablePerks = perkKeys.filter(k => (this.perks[k] || 0) < PERKS[k].maxStacks);
        if (availablePerks.length > 0) {
            const shuffledPerks = availablePerks.sort(() => Math.random() - 0.5);
            pool.push({ type: 'perk', data: { key: shuffledPerks[0], ...PERKS[shuffledPerks[0]] } });
            if (shuffledPerks.length > 1) {
                pool.push({ type: 'perk', data: { key: shuffledPerks[1], ...PERKS[shuffledPerks[1]] } });
            }
        }

        // Add available ability upgrade (if any ability not yet upgraded)
        const classUpgrades = ABILITY_UPGRADES[this.classId];
        if (classUpgrades) {
            for (const ability of this.abilities) {
                if (!this.abilityUpgrades[ability.name] && classUpgrades[ability.name]) {
                    const options = classUpgrades[ability.name];
                    const pick = options[Math.floor(Math.random() * options.length)];
                    pool.push({
                        type: 'ability',
                        data: { abilityName: ability.name, ...pick },
                    });
                    break; // Only offer one ability upgrade per level
                }
            }
        }

        // Shuffle pool and pick 3
        pool.sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(3, pool.length); i++) {
            choices.push(pool[i]);
        }

        // Ensure at least 3 choices by padding with stats
        while (choices.length < 3) {
            const extra = STAT_UPGRADES[Math.floor(Math.random() * STAT_UPGRADES.length)];
            if (!choices.some(c => c.type === 'stat' && c.data.stat === extra.stat)) {
                choices.push({ type: 'stat', data: extra });
            } else {
                choices.push({ type: 'stat', data: STAT_UPGRADES[Math.floor(Math.random() * STAT_UPGRADES.length)] });
            }
        }

        this.levelUpChoices = choices.slice(0, 3);
    }

    // Apply a level-up choice (index 0-2)
    applyLevelUpChoice(index) {
        const choice = this.levelUpChoices[index];
        if (!choice) return false;

        switch (choice.type) {
            case 'stat': {
                const s = choice.data;
                switch (s.stat) {
                    case 'str': this.baseStr += s.value; break;
                    case 'def': this.baseDef += s.value; break;
                    case 'dex': this.baseDex += s.value; break;
                    case 'int': this.baseInt += s.value; break;
                    case 'maxhp': this.maxHp += s.value; this.hp += s.value; break;
                    case 'maxmp': this.maxMp += s.value; this.mp += s.value; break;
                }
                break;
            }
            case 'perk':
                this.addPerk(choice.data.key);
                break;
            case 'ability': {
                this.abilityUpgrades[choice.data.abilityName] = choice.data;
                // Update the ability's enhanced type
                const ability = this.abilities.find(a => a.name === choice.data.abilityName);
                if (ability) {
                    ability.enhancedType = choice.data.enhancedType;
                    ability.upgradeName = choice.data.name;
                }
                break;
            }
        }

        this.pendingLevelUpChoices--;
        this.levelUpChoices = [];
        this.recalcStats();
        return true;
    }

    // Recalculate derived stats from base + equipment
    recalcStats() {
        this.str = this.baseStr;
        this.def = this.baseDef;
        this.dex = this.baseDex;
        this.int = this.baseInt;

        let totalHpBonus = 0;
        let totalMpBonus = 0;

        for (const slot of Object.values(SLOT)) {
            const item = this.equipment[slot];
            if (!item) continue;
            if (item.strBonus) this.str += item.strBonus;
            if (item.defBonus) this.def += item.defBonus;
            if (item.dexBonus) this.dex += item.dexBonus;
            if (item.intBonus) this.int += item.intBonus;
            if (item.hpBonus) totalHpBonus += item.hpBonus;
            if (item.mpBonus) totalMpBonus += item.mpBonus;
        }

        this.maxHp = CLASS_DATA[this.classId].baseStats.hp + (this.level - 1) * 8 + totalHpBonus;
        this.maxMp = CLASS_DATA[this.classId].baseStats.mp + (this.level - 1) * 3 + totalMpBonus;
        this.hp = Math.min(this.hp, this.maxHp);
        this.mp = Math.min(this.mp, this.maxMp);

        // Status effect buffs
        for (const effect of this.statusEffects) {
            if (effect.type === STATUS.BUFF_STR) this.str = Math.floor(this.str * 1.5);
            if (effect.type === STATUS.BUFF_DEF) this.def = Math.floor(this.def * 2);
        }
    }

    getAttackPower() {
        let atk = this.str;
        const weapon = this.equipment[SLOT.WEAPON];
        if (weapon) {
            atk += weapon.damage || 0;
            if (weapon.intBonus && this.classId === CLASS.MAGE) {
                atk += Math.floor(this.int * 0.5);
            }
        }
        return atk;
    }

    getDefensePower() {
        let defense = this.def;
        const armor = this.equipment[SLOT.ARMOR];
        if (armor) defense += armor.defense || 0;
        const shield = this.equipment[SLOT.SHIELD];
        if (shield) defense += shield.defense || 0;
        return defense;
    }

    getCritChance() {
        const perkBonus = this.getPerkStacks('critical_mastery') * 0.05;
        return BASE_CRIT_CHANCE + this.dex * CRIT_DEX_SCALE + perkBonus;
    }

    getDodgeChance() {
        const perkBonus = this.getPerkStacks('quick_feet') * 0.05;
        return BASE_DODGE_CHANCE + this.dex * DODGE_DEX_SCALE + perkBonus;
    }

    getBlockChance() {
        const shield = this.equipment[SLOT.SHIELD];
        return shield ? (shield.blockChance || 0) : 0;
    }

    // Process gaining XP
    gainXp(amount) {
        this.xp += amount;
        const levelsGained = [];
        while (this.xp >= this.xpToNext && this.level < XP_TABLE.length) {
            this.xp -= this.xpToNext;
            this.level++;
            this.xpToNext = XP_TABLE[this.level] || this.xpToNext * 1.5;

            // Level up bonuses (base HP/MP still grow)
            this.maxHp += 5;
            this.hp = Math.min(this.hp + Math.floor(this.maxHp * 0.3), this.maxHp);
            this.maxMp += 2;
            this.mp = Math.min(this.mp + Math.floor(this.maxMp * 0.3), this.maxMp);

            // Trigger choice-based upgrade
            this.pendingLevelUpChoices++;
            this.pendingStatPoints++; // Keep in sync for state check

            levelsGained.push(this.level);
        }
        return levelsGained;
    }

    // Allocate a stat point
    allocateStat(stat) {
        if (this.pendingStatPoints <= 0) return false;
        switch (stat) {
            case 'str': this.baseStr++; break;
            case 'def': this.baseDef++; break;
            case 'dex': this.baseDex++; break;
            case 'int': this.baseInt++; break;
            default: return false;
        }
        this.pendingStatPoints--;
        this.recalcStats();
        return true;
    }

    // Equip an item
    equip(item) {
        const slot = item.slot;
        if (!slot) return false;

        // Unequip current item in that slot
        if (this.equipment[slot]) {
            this.unequip(slot);
        }

        // Remove from inventory
        const idx = this.inventory.indexOf(item);
        if (idx !== -1) this.inventory.splice(idx, 1);

        this.equipment[slot] = item;
        this.recalcStats();
        return true;
    }

    // Unequip an item to inventory
    unequip(slot) {
        const item = this.equipment[slot];
        if (!item) return false;
        if (this.inventory.length >= MAX_INVENTORY_SIZE) return false;

        this.inventory.push(item);
        this.equipment[slot] = null;
        this.recalcStats();
        return true;
    }

    // Add item to inventory
    addToInventory(item) {
        if (item.type === ITEM_TYPE.GOLD) {
            this.gold += item.value;
            this.stats.goldCollected += item.value;
            return true;
        }
        if (this.inventory.length >= MAX_INVENTORY_SIZE) return false;
        this.inventory.push(item);
        this.stats.itemsFound++;
        return true;
    }

    // Use a consumable
    useItem(item) {
        switch (item.type) {
            case ITEM_TYPE.POTION_HP: {
                const heal = item.power || 30;
                this.hp = Math.min(this.hp + heal, this.maxHp);
                this.stats.potionsDrunk++;
                break;
            }
            case ITEM_TYPE.POTION_MP: {
                const restore = item.power || 20;
                this.mp = Math.min(this.mp + restore, this.maxMp);
                this.stats.potionsDrunk++;
                break;
            }
            case ITEM_TYPE.FOOD: {
                this.hunger = Math.min(this.hunger + (item.power || 30), MAX_HUNGER);
                break;
            }
            default: return false;
        }

        // Remove from inventory
        const idx = this.inventory.indexOf(item);
        if (idx !== -1) this.inventory.splice(idx, 1);
        return true;
    }

    // Remove item from inventory
    dropItem(item) {
        const idx = this.inventory.indexOf(item);
        if (idx !== -1) {
            this.inventory.splice(idx, 1);
            return true;
        }
        return false;
    }

    // Update per-turn effects
    processTurn() {
        this.stats.turnsPlayed++;

        // Hunger
        this.hunger -= HUNGER_PER_TURN;
        if (this.hunger <= 0) {
            this.hunger = 0;
            this.hp -= 1; // Starving damage
        }

        // Cooldowns
        for (const ability of this.abilities) {
            if (ability.currentCooldown > 0) ability.currentCooldown--;
        }

        // Stealth
        if (this.stealthTurns > 0) {
            this.stealthTurns--;
        }

        // Invulnerability
        if (this.invulnTurns > 0) {
            this.invulnTurns--;
        }

        // Status effects
        const expiredEffects = [];
        for (const effect of this.statusEffects) {
            effect.duration--;

            switch (effect.type) {
                case STATUS.POISON:
                    this.hp -= 2;
                    break;
                case STATUS.BURNING:
                    this.hp -= 3;
                    break;
                case STATUS.BLEEDING:
                    this.hp -= 1;
                    break;
            }

            if (effect.duration <= 0) {
                expiredEffects.push(effect);
            }
        }

        for (const effect of expiredEffects) {
            const idx = this.statusEffects.indexOf(effect);
            if (idx !== -1) this.statusEffects.splice(idx, 1);
        }

        // Recalc in case buffs expired
        if (expiredEffects.length > 0) this.recalcStats();

        // MP regen (base + mana flow perk)
        const manaFlowBonus = this.getPerkStacks('mana_flow');
        this.mp = Math.min(this.mp + 1 + manaFlowBonus, this.maxMp);
    }

    hasStatus(statusType) {
        return this.statusEffects.some(e => e.type === statusType);
    }

    addStatus(type, duration) {
        // Refresh if already has it
        const existing = this.statusEffects.find(e => e.type === type);
        if (existing) {
            existing.duration = Math.max(existing.duration, duration);
        } else {
            this.statusEffects.push({ type, duration });
        }
        this.recalcStats();
    }

    removeStatus(type) {
        this.statusEffects = this.statusEffects.filter(e => e.type !== type);
        this.recalcStats();
    }

    isAlive() {
        return this.hp > 0;
    }
}
