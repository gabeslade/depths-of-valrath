// ============================================================
// DEPTHS OF VALRATH — Enemy System
// ============================================================

class Enemy {
    constructor(type, x, y, floor, eliteModifier) {
        const data = ENEMY_DATA[type];
        this.type = type;
        this.name = data.name;
        this.symbol = data.symbol;
        this.color = data.color;
        this.boss = data.boss || false;
        this.behavior = data.behavior;
        this.range = data.range || 1;
        this.description = data.description;
        this.statusOnHit = data.statusOnHit || null;

        // Elite modifier system
        this.eliteModifier = eliteModifier || null;
        if (this.eliteModifier) {
            const mod = ELITE_MODIFIERS[this.eliteModifier];
            this.name = `${mod.name} ${this.name}`;
            this.eliteColor = mod.color;
            this.eliteGlow = mod.glowColor;
            this.eliteIcon = mod.icon;
        }

        // Position
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.moveAnimT = 1;

        // Scaling stats based on floor (bosses scale less aggressively)
        const scaleRate = this.boss ? 0.05 : 0.08;
        const scale = 1 + (floor - 1) * scaleRate;
        const eliteMults = this.eliteModifier ? ELITE_MODIFIERS[this.eliteModifier].statMults : { hp: 1, str: 1, def: 1 };
        this.maxHp = Math.floor(data.hp * scale * eliteMults.hp);
        this.hp = this.maxHp;
        this.str = Math.floor(data.str * scale * eliteMults.str);
        this.def = Math.floor(data.def * scale * eliteMults.def);
        this.dex = data.dex;
        this.xp = Math.floor(data.xp * scale * (this.eliteModifier ? ELITE_XP_MULTIPLIER : 1));
        this.speed = data.speed;

        // AI state
        this.alerted = false;
        this.alertTimer = 0;
        this.patrolTarget = null;
        this.lastKnownPlayerX = -1;
        this.lastKnownPlayerY = -1;
        this.actionDelay = 0; // For speed system
        this.arcaneBoltTimer = 0; // For arcane elite

        // Status effects
        this.statusEffects = [];

        // Visual
        this.flashTimer = 0;
        this.deathTimer = 0;
        this.isDead = false;
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.flashTimer = 0.3;
        if (this.hp <= 0) {
            this.hp = 0;
            this.isDead = true;
            this.deathTimer = 0.5;
        }
        return this.hp <= 0;
    }

    isStunned() {
        return this.statusEffects.some(e => e.type === STATUS.STUNNED || e.type === STATUS.FROZEN);
    }

    processTurn() {
        // Elite: Regenerating heals 5% HP per turn
        if (this.eliteModifier === 'regenerating' && !this.isDead && this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + Math.max(1, Math.floor(this.maxHp * 0.05)));
        }
        // Elite: Arcane bolt timer
        if (this.eliteModifier === 'arcane') {
            this.arcaneBoltTimer++;
        }

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
                case STATUS.CONSECRATE:
                    this.hp -= 4;
                    break;
            }

            if (this.hp <= 0) {
                this.hp = 0;
                this.isDead = true;
                this.deathTimer = 0.5;
            }

            if (effect.duration <= 0) {
                expiredEffects.push(effect);
            }
        }

        for (const effect of expiredEffects) {
            const idx = this.statusEffects.indexOf(effect);
            if (idx !== -1) this.statusEffects.splice(idx, 1);
        }
    }

    addStatus(type, duration) {
        const existing = this.statusEffects.find(e => e.type === type);
        if (existing) {
            existing.duration = Math.max(existing.duration, duration);
        } else {
            this.statusEffects.push({ type, duration });
        }
    }

    hasStatus(statusType) {
        return this.statusEffects.some(e => e.type === statusType);
    }

    // Decide and execute AI action
    doTurn(dungeon, player, enemies) {
        if (this.isDead || this.isStunned()) return null;

        // Speed system: accumulate action points
        this.actionDelay += this.speed;
        if (this.actionDelay < 1.0) return null;
        this.actionDelay -= 1.0;

        const distToPlayer = chebyshevDist(this.x, this.y, player.x, player.y);

        // Elite: Teleporting — 20% chance to blink adjacent to player
        if (this.eliteModifier === 'teleporting' && this.alerted && distToPlayer > 2 && rng.chance(0.2)) {
            for (const dir of rng.shuffle([...ALL_DIRS])) {
                const nx = player.x + dir.x;
                const ny = player.y + dir.y;
                if (dungeon.isWalkable(nx, ny) && !enemies.some(e => !e.isDead && e !== this && e.x === nx && e.y === ny)) {
                    this.prevX = this.x;
                    this.prevY = this.y;
                    this.x = nx;
                    this.y = ny;
                    this.moveAnimT = 0;
                    return { type: 'teleport', text: `${this.name} blinks beside you!`, color: '#8844ff' };
                }
            }
        }

        // Elite: Arcane — fires ranged bolt every 3 turns when alerted
        if (this.eliteModifier === 'arcane' && this.alerted && this.arcaneBoltTimer >= 3 && distToPlayer <= 6) {
            if (this._hasLOS(player.x, player.y, dungeon)) {
                this.arcaneBoltTimer = 0;
                return { type: 'arcane_bolt', target: player };
            }
        }

        // Check if player is in vision (simple distance check)
        const visionRange = 8;
        if (distToPlayer <= visionRange && !player.stealthTurns) {
            this.alerted = true;
            this.alertTimer = 15;
            this.lastKnownPlayerX = player.x;
            this.lastKnownPlayerY = player.y;
        } else if (this.alerted) {
            this.alertTimer--;
            if (this.alertTimer <= 0) {
                this.alerted = false;
            }
        }

        switch (this.behavior) {
            case 'aggressive':
                return this._aggressiveBehavior(dungeon, player, enemies, distToPlayer);
            case 'ranged':
                return this._rangedBehavior(dungeon, player, enemies, distToPlayer);
            case 'cowardly':
                return this._cowardlyBehavior(dungeon, player, enemies, distToPlayer);
            case 'patrol':
                return this._patrolBehavior(dungeon, player, enemies, distToPlayer);
            default:
                return this._aggressiveBehavior(dungeon, player, enemies, distToPlayer);
        }
    }

    _aggressiveBehavior(dungeon, player, enemies, distToPlayer) {
        if (!this.alerted) {
            return this._wander(dungeon, enemies);
        }

        // Adjacent to player: attack
        if (distToPlayer <= 1) {
            return { type: 'attack', target: player };
        }

        // Move toward player
        return this._moveToward(this.lastKnownPlayerX, this.lastKnownPlayerY, dungeon, enemies);
    }

    _rangedBehavior(dungeon, player, enemies, distToPlayer) {
        if (!this.alerted) {
            return this._wander(dungeon, enemies);
        }

        // In range: ranged attack
        if (distToPlayer <= this.range && distToPlayer > 1) {
            // Check line of sight
            if (this._hasLOS(player.x, player.y, dungeon)) {
                return { type: 'ranged_attack', target: player };
            }
        }

        // Too close: try to move away
        if (distToPlayer <= 2) {
            return this._moveAway(player.x, player.y, dungeon, enemies);
        }

        // Too far: move toward
        if (distToPlayer > this.range) {
            return this._moveToward(this.lastKnownPlayerX, this.lastKnownPlayerY, dungeon, enemies);
        }

        return null; // Stay put
    }

    _cowardlyBehavior(dungeon, player, enemies, distToPlayer) {
        if (!this.alerted) {
            return this._wander(dungeon, enemies);
        }

        // Low HP: flee
        if (this.hp < this.maxHp * 0.5 || distToPlayer <= 3) {
            return this._moveAway(player.x, player.y, dungeon, enemies);
        }

        // Adjacent: attack
        if (distToPlayer <= 1) {
            return { type: 'attack', target: player };
        }

        return this._wander(dungeon, enemies);
    }

    _patrolBehavior(dungeon, player, enemies, distToPlayer) {
        if (this.alerted) {
            if (distToPlayer <= 1) {
                return { type: 'attack', target: player };
            }
            return this._moveToward(this.lastKnownPlayerX, this.lastKnownPlayerY, dungeon, enemies);
        }

        // Patrol: pick random nearby target
        if (!this.patrolTarget || (this.x === this.patrolTarget.x && this.y === this.patrolTarget.y)) {
            this.patrolTarget = {
                x: this.x + rng.int(-5, 5),
                y: this.y + rng.int(-5, 5),
            };
        }

        return this._moveToward(this.patrolTarget.x, this.patrolTarget.y, dungeon, enemies);
    }

    _moveToward(targetX, targetY, dungeon, enemies) {
        const path = astarFind(
            this.x, this.y, targetX, targetY,
            (x, y) => {
                if (!dungeon.isWalkable(x, y)) return false;
                // Don't walk through other enemies
                if (enemies.some(e => !e.isDead && e !== this && e.x === x && e.y === y)) return false;
                return true;
            },
            30
        );

        if (path && path.length > 0) {
            return { type: 'move', x: path[0].x, y: path[0].y };
        }

        return this._wander(dungeon, enemies);
    }

    _moveAway(fromX, fromY, dungeon, enemies) {
        let bestDx = 0, bestDy = 0, bestDist = -1;

        for (const dir of ALL_DIRS) {
            const nx = this.x + dir.x;
            const ny = this.y + dir.y;
            if (!dungeon.isWalkable(nx, ny)) continue;
            if (enemies.some(e => !e.isDead && e !== this && e.x === nx && e.y === ny)) continue;

            const d = dist(nx, ny, fromX, fromY);
            if (d > bestDist) {
                bestDist = d;
                bestDx = dir.x;
                bestDy = dir.y;
            }
        }

        if (bestDist > 0) {
            return { type: 'move', x: this.x + bestDx, y: this.y + bestDy };
        }

        return null;
    }

    _wander(dungeon, enemies) {
        if (!rng.chance(0.3)) return null; // Don't move every turn

        const dirs = rng.shuffle([...ALL_DIRS]);
        for (const dir of dirs) {
            const nx = this.x + dir.x;
            const ny = this.y + dir.y;
            if (!dungeon.isWalkable(nx, ny)) continue;
            if (enemies.some(e => !e.isDead && e !== this && e.x === nx && e.y === ny)) continue;
            return { type: 'move', x: nx, y: ny };
        }
        return null;
    }

    _hasLOS(targetX, targetY, dungeon) {
        const line = bresenhamLine(this.x, this.y, targetX, targetY);
        for (let i = 1; i < line.length - 1; i++) {
            if (!dungeon.isTransparent(line[i].x, line[i].y)) return false;
        }
        return true;
    }
}

// Simple NPC class for non-combat encounters
class NPC {
    constructor(npcType, x, y) {
        const data = NPC_DATA[npcType];
        this.npcType = npcType;
        this.name = data.name;
        this.symbol = data.symbol;
        this.color = data.color;
        this.description = data.description;
        this.dialogue = data.dialogue;
        this.interactionType = data.type;
        this.x = x;
        this.y = y;
        this.interacted = false;
    }
}

// Enemy spawning logic
function spawnEnemies(dungeon) {
    const floor = dungeon.floor;
    const enemies = [];

    // Determine which tier of enemies to spawn
    let tier = 1;
    if (floor >= 7) tier = 3;
    else if (floor >= 4) tier = 2;

    // Mix in some enemies from adjacent tiers
    const possibleTypes = [...TIER_ENEMIES[tier]];
    if (tier > 1) possibleTypes.push(...TIER_ENEMIES[tier - 1]);

    // Number of enemies scales with floor
    const baseCount = 6 + floor * 2;
    const enemyCount = rng.int(baseCount - 2, baseCount + 2);

    // Spawn enemies in rooms (not the first room / spawn room)
    for (let i = 0; i < enemyCount; i++) {
        const roomIdx = rng.int(1, dungeon.rooms.length - 1);
        const room = dungeon.rooms[roomIdx];
        const pos = dungeon.getRandomPosInRoom(room);

        // Don't spawn on stairs
        if (dungeon.stairsDown && pos.x === dungeon.stairsDown.x && pos.y === dungeon.stairsDown.y) continue;
        if (dungeon.stairsUp && pos.x === dungeon.stairsUp.x && pos.y === dungeon.stairsUp.y) continue;
        // Don't stack enemies
        if (enemies.some(e => e.x === pos.x && e.y === pos.y)) continue;

        const type = rng.pick(possibleTypes);
        // Elite chance on floors 3+
        let eliteMod = null;
        if (floor >= 3 && rng.chance(ELITE_SPAWN_CHANCE)) {
            const modKeys = Object.keys(ELITE_MODIFIERS);
            eliteMod = rng.pick(modKeys);
        }
        enemies.push(new Enemy(type, pos.x, pos.y, floor, eliteMod));
    }

    // Boss spawn
    const bossType = BOSS_FLOORS[floor];
    if (bossType && dungeon.specialRooms.boss) {
        const bossRoom = dungeon.specialRooms.boss;
        const boss = new Enemy(bossType, bossRoom.cx, bossRoom.cy, floor);
        boss.alerted = false; // Boss starts dormant until player enters room
        enemies.push(boss);
    }

    return enemies;
}
