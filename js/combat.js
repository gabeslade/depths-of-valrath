// ============================================================
// DEPTHS OF VALRATH — Combat System
// ============================================================

class CombatSystem {
    constructor(game) {
        this.game = game;
    }

    // Player attacks enemy (melee)
    playerAttackEnemy(player, enemy) {
        const results = [];

        // Check dodge
        const dodgeChance = enemy.dex * 0.01;
        if (rng.chance(dodgeChance)) {
            results.push({
                type: 'dodge',
                text: `${enemy.name} dodges your attack!`,
                color: COLORS.textSecondary,
            });
            return results;
        }

        // Calculate damage
        let atk = player.getAttackPower();
        const variance = rng.float(1 - DAMAGE_VARIANCE, 1 + DAMAGE_VARIANCE);
        let damage = Math.max(1, Math.floor(atk * variance - enemy.def * 0.5));

        // Critical hit check
        let isCrit = false;
        if (rng.chance(player.getCritChance())) {
            damage = Math.floor(damage * CRIT_MULTIPLIER);
            isCrit = true;
            player.stats.criticalHits++;
        }

        // Backstab bonus for rogues in stealth
        if (player.classId === CLASS.ROGUE && player.stealthTurns > 0) {
            damage *= 3;
            player.stealthTurns = 0;
            results.push({
                type: 'backstab',
                text: 'Backstab!',
                color: '#ff8800',
            });
        }

        // Elite: Shielded — 50% damage reduction
        if (enemy.eliteModifier === 'shielded') {
            damage = Math.max(1, Math.floor(damage * 0.5));
        }

        // Apply damage
        const killed = enemy.takeDamage(damage);
        player.stats.damageDealt += damage;

        // Perk: Vampiric Strikes — lifesteal
        if (player.hasPerk('vampiric_strikes')) {
            const stacks = player.getPerkStacks('vampiric_strikes');
            const steal = Math.max(1, Math.floor(damage * 0.10 * stacks));
            player.hp = Math.min(player.hp + steal, player.maxHp);
        }

        results.push({
            type: isCrit ? 'critical' : 'hit',
            text: `You hit ${enemy.name} for ${damage} damage${isCrit ? ' (CRITICAL!)' : ''}!`,
            color: isCrit ? COLORS.textCrit : COLORS.textDamage,
            damage,
            targetX: enemy.x,
            targetY: enemy.y,
            isCrit,
        });

        // Weapon status effect
        const weapon = player.equipment[SLOT.WEAPON];
        if (weapon && weapon.statusEffect && rng.chance(0.3)) {
            enemy.addStatus(weapon.statusEffect, 3);
            results.push({
                type: 'status',
                text: `${enemy.name} is ${weapon.statusEffect}!`,
                color: STATUS_COLORS[weapon.statusEffect],
            });
        }

        if (killed) {
            results.push(...this._handleEnemyDeath(player, enemy));
        }

        return results;
    }

    // Enemy attacks player
    enemyAttackPlayer(enemy, player) {
        const results = [];

        // Player dodge check
        if (rng.chance(player.getDodgeChance())) {
            results.push({
                type: 'dodge',
                text: `You dodge ${enemy.name}'s attack!`,
                color: COLORS.textSecondary,
            });
            return results;
        }

        // Player block check
        if (rng.chance(player.getBlockChance())) {
            results.push({
                type: 'block',
                text: `You block ${enemy.name}'s attack!`,
                color: '#8888ff',
            });
            return results;
        }

        // Player invulnerability
        if (player.invulnTurns > 0) {
            results.push({
                type: 'immune',
                text: `Divine shield absorbs ${enemy.name}'s attack!`,
                color: '#ffffff',
            });
            return results;
        }

        // Calculate damage
        const variance = rng.float(1 - DAMAGE_VARIANCE, 1 + DAMAGE_VARIANCE);
        let damage = Math.max(1, Math.floor(enemy.str * variance - player.getDefensePower() * 0.4));

        // Boss bonus damage
        if (enemy.boss) {
            damage = Math.floor(damage * 1.3);
        }

        // Elite: Berserker — +50% damage below 50% HP
        if (enemy.eliteModifier === 'berserker' && enemy.hp < enemy.maxHp * 0.5) {
            damage = Math.floor(damage * 1.5);
        }

        // Perk: Iron Skin — flat damage reduction
        if (player.hasPerk('iron_skin')) {
            damage = Math.max(1, damage - player.getPerkStacks('iron_skin') * 2);
        }

        // Perk: Thick Skull — CC resist (handled separately on status application)

        player.hp -= damage;

        // Perk: Thorns — reflect melee damage
        if (player.hasPerk('thorns')) {
            const stacks = player.getPerkStacks('thorns');
            const reflected = Math.max(1, Math.floor(damage * 0.20 * stacks));
            enemy.takeDamage(reflected);
            if (!enemy.isDead) {
                results.push({ type: 'hit', text: `Thorns reflects ${reflected} damage!`, color: '#cc4444',
                    damage: reflected, targetX: enemy.x, targetY: enemy.y });
            }
        }
        player.stats.damageTaken += damage;

        results.push({
            type: 'hit',
            text: `${enemy.name} hits you for ${damage} damage!`,
            color: COLORS.textDamage,
            damage,
            targetX: player.x,
            targetY: player.y,
        });

        // Elite: Vampiric — heals 30% of damage dealt
        if (enemy.eliteModifier === 'vampiric') {
            const healAmt = Math.max(1, Math.floor(damage * 0.3));
            enemy.hp = Math.min(enemy.maxHp, enemy.hp + healAmt);
            results.push({ type: 'heal_enemy', text: `${enemy.name} drains ${healAmt} HP!`, color: '#cc2244' });
        }

        // Elite: Freezing — 30% chance to freeze on hit
        if (enemy.eliteModifier === 'freezing' && rng.chance(0.3)) {
            player.addStatus(STATUS.FROZEN, 2);
            results.push({ type: 'status', text: 'You are frozen!', color: '#66ccff' });
        }

        // Elite: Poisonous — always applies poison on hit
        if (enemy.eliteModifier === 'poisonous') {
            player.addStatus(STATUS.POISON, 4);
            results.push({ type: 'status', text: 'You are poisoned!', color: '#44cc44' });
        }

        // Enemy status on hit
        if (enemy.statusOnHit && rng.chance(0.3)) {
            player.addStatus(enemy.statusOnHit, 4);
            results.push({
                type: 'status',
                text: `You are ${enemy.statusOnHit}!`,
                color: STATUS_COLORS[enemy.statusOnHit],
            });
        }

        // Screen shake for player damage
        results.push({ type: 'screenshake', intensity: damage > 10 ? 8 : 4 });

        return results;
    }

    // Enemy ranged attack
    enemyRangedAttack(enemy, player) {
        const results = [];

        if (player.invulnTurns > 0) {
            results.push({
                type: 'immune',
                text: `Divine shield absorbs ${enemy.name}'s spell!`,
                color: '#ffffff',
            });
            return results;
        }

        if (rng.chance(player.getDodgeChance())) {
            results.push({
                type: 'dodge',
                text: `You dodge ${enemy.name}'s ranged attack!`,
                color: COLORS.textSecondary,
            });
            return results;
        }

        const variance = rng.float(1 - DAMAGE_VARIANCE, 1 + DAMAGE_VARIANCE);
        let damage = Math.max(1, Math.floor(enemy.str * 1.2 * variance - player.getDefensePower() * 0.3));

        player.hp -= damage;
        player.stats.damageTaken += damage;

        results.push({
            type: 'hit',
            text: `${enemy.name} blasts you for ${damage} damage!`,
            color: '#aa44ff',
            damage,
            targetX: player.x,
            targetY: player.y,
        });

        results.push({ type: 'screenshake', intensity: 5 });

        return results;
    }

    // Player uses ability
    useAbility(player, abilityIndex, targetX, targetY, dungeon, enemies) {
        const ability = player.abilities[abilityIndex];
        if (!ability) return [{ type: 'fail', text: 'No such ability.' }];
        if (ability.currentCooldown > 0) return [{ type: 'fail', text: `${ability.name} is on cooldown (${ability.currentCooldown} turns).` }];
        if (player.mp < ability.mpCost) return [{ type: 'fail', text: `Not enough MP for ${ability.name}.` }];

        player.mp -= ability.mpCost;
        ability.currentCooldown = ability.cooldown;

        const results = [];

        switch (ability.type) {
            case 'melee_aoe': // Cleave
                results.push(...this._abilityCleave(player, enemies));
                break;
            case 'stun': // Shield Bash
                results.push(...this._abilityStun(player, enemies));
                break;
            case 'buff_str': // Battle Cry
                player.addStatus(STATUS.BUFF_STR, 5);
                results.push({ type: 'buff', text: 'Battle Cry! +50% damage for 5 turns!', color: '#ff4444' });
                break;
            case 'whirlwind': // Whirlwind
                results.push(...this._abilityWhirlwind(player, enemies));
                break;
            case 'backstab': // Backstab (already handled in attack)
                results.push(...this._abilityBackstab(player, enemies));
                break;
            case 'stealth': // Smoke Bomb
                player.stealthTurns = 3;
                results.push({ type: 'buff', text: 'You vanish in a cloud of smoke!', color: '#888888' });
                break;
            case 'poison': // Poison Blade
                results.push(...this._abilityPoison(player, enemies));
                break;
            case 'teleport_to_enemy': // Shadow Step
                results.push(...this._abilityShadowStep(player, enemies, dungeon));
                break;
            case 'fireball': // Fireball
                results.push(...this._abilityFireball(player, targetX, targetY, dungeon, enemies));
                break;
            case 'ice_lance': // Ice Lance
                results.push(...this._abilityIceLance(player, targetX, targetY, enemies, dungeon));
                break;
            case 'chain_lightning': // Chain Lightning
                results.push(...this._abilityChainLightning(player, enemies));
                break;
            case 'buff_def': // Arcane Shield
                player.addStatus(STATUS.BUFF_DEF, 4);
                results.push({ type: 'buff', text: 'Arcane Shield! +100% defense for 4 turns!', color: '#4444ff' });
                break;
            case 'holy_smite': // Holy Smite
                results.push(...this._abilityHolySmite(player, enemies));
                break;
            case 'heal': // Heal
                const healAmt = Math.floor(player.maxHp * 0.3);
                player.hp = Math.min(player.hp + healAmt, player.maxHp);
                results.push({ type: 'heal', text: `Holy light restores ${healAmt} HP!`, color: COLORS.textHeal, targetX: player.x, targetY: player.y, heal: healAmt });
                break;
            case 'invulnerable': // Divine Shield
                player.invulnTurns = 2;
                results.push({ type: 'buff', text: 'Divine Shield! Immune to damage for 2 turns!', color: '#ffffff' });
                break;
            case 'consecrate': // Consecrate
                results.push(...this._abilityConsecrate(player, enemies));
                break;
        }

        return results;
    }

    _abilityCleave(player, enemies) {
        const results = [];
        let hitCount = 0;
        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            if (chebyshevDist(player.x, player.y, enemy.x, enemy.y) <= 1) {
                const damage = Math.max(1, Math.floor(player.getAttackPower() * 0.8 - enemy.def * 0.3));
                const killed = enemy.takeDamage(damage);
                player.stats.damageDealt += damage;
                hitCount++;
                results.push({
                    type: 'hit', text: `Cleave hits ${enemy.name} for ${damage}!`,
                    color: COLORS.textDamage, damage, targetX: enemy.x, targetY: enemy.y,
                });
                if (killed) results.push(...this._handleEnemyDeath(player, enemy));
            }
        }
        if (hitCount === 0) results.push({ type: 'miss', text: 'Cleave hits nothing!', color: COLORS.textSecondary });
        return results;
    }

    _abilityStun(player, enemies) {
        const results = [];
        let closest = null, closestDist = Infinity;
        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            const d = chebyshevDist(player.x, player.y, enemy.x, enemy.y);
            if (d <= 1 && d < closestDist) {
                closestDist = d;
                closest = enemy;
            }
        }
        if (closest) {
            closest.addStatus(STATUS.STUNNED, 2);
            const damage = Math.max(1, Math.floor(player.getAttackPower() * 0.5));
            closest.takeDamage(damage);
            player.stats.damageDealt += damage;
            results.push({
                type: 'hit', text: `Shield Bash stuns ${closest.name} for 2 turns! (${damage} damage)`,
                color: '#ffff44', damage, targetX: closest.x, targetY: closest.y,
            });
            if (closest.isDead) results.push(...this._handleEnemyDeath(player, closest));
        } else {
            results.push({ type: 'miss', text: 'No adjacent enemy to bash!', color: COLORS.textSecondary });
        }
        return results;
    }

    _abilityWhirlwind(player, enemies) {
        const results = [];
        let hitCount = 0;
        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            if (chebyshevDist(player.x, player.y, enemy.x, enemy.y) <= 2) {
                const damage = Math.max(1, Math.floor(player.getAttackPower() * 1.2 - enemy.def * 0.2));
                const killed = enemy.takeDamage(damage);
                player.stats.damageDealt += damage;
                hitCount++;
                results.push({
                    type: 'hit', text: `Whirlwind hits ${enemy.name} for ${damage}!`,
                    color: COLORS.textDamage, damage, targetX: enemy.x, targetY: enemy.y,
                });
                if (killed) results.push(...this._handleEnemyDeath(player, enemy));
            }
        }
        if (hitCount === 0) results.push({ type: 'miss', text: 'Whirlwind hits nothing!', color: COLORS.textSecondary });
        results.push({ type: 'screenshake', intensity: 6 });
        return results;
    }

    _abilityBackstab(player, enemies) {
        const results = [];
        let closest = null, closestDist = Infinity;
        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            const d = chebyshevDist(player.x, player.y, enemy.x, enemy.y);
            if (d <= 1 && d < closestDist) {
                closestDist = d;
                closest = enemy;
            }
        }
        if (closest) {
            const multiplier = player.stealthTurns > 0 ? 3 : 1.5;
            const damage = Math.max(1, Math.floor(player.getAttackPower() * multiplier - closest.def * 0.2));
            const killed = closest.takeDamage(damage);
            player.stats.damageDealt += damage;
            if (player.stealthTurns > 0) player.stealthTurns = 0;
            results.push({
                type: 'hit', text: `Backstab hits ${closest.name} for ${damage}!`,
                color: '#ff8800', damage, targetX: closest.x, targetY: closest.y,
            });
            if (killed) results.push(...this._handleEnemyDeath(player, closest));
        } else {
            results.push({ type: 'miss', text: 'No adjacent enemy!', color: COLORS.textSecondary });
        }
        return results;
    }

    _abilityPoison(player, enemies) {
        const results = [];
        let closest = null, closestDist = Infinity;
        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            const d = chebyshevDist(player.x, player.y, enemy.x, enemy.y);
            if (d <= 1 && d < closestDist) {
                closestDist = d;
                closest = enemy;
            }
        }
        if (closest) {
            closest.addStatus(STATUS.POISON, 5);
            const damage = Math.max(1, Math.floor(player.getAttackPower() * 0.7));
            closest.takeDamage(damage);
            player.stats.damageDealt += damage;
            results.push({
                type: 'hit', text: `Poison Blade hits ${closest.name} for ${damage}! Poisoned for 5 turns!`,
                color: '#44cc44', damage, targetX: closest.x, targetY: closest.y,
            });
            if (closest.isDead) results.push(...this._handleEnemyDeath(player, closest));
        } else {
            results.push({ type: 'miss', text: 'No adjacent enemy!', color: COLORS.textSecondary });
        }
        return results;
    }

    _abilityShadowStep(player, enemies, dungeon) {
        const results = [];
        let closest = null, closestDist = Infinity;
        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            const d = chebyshevDist(player.x, player.y, enemy.x, enemy.y);
            if (d <= 8 && d < closestDist) {
                closestDist = d;
                closest = enemy;
            }
        }
        if (closest) {
            // Find a free tile adjacent to enemy
            for (const dir of ALL_DIRS) {
                const nx = closest.x + dir.x;
                const ny = closest.y + dir.y;
                if (dungeon.isWalkable(nx, ny) && !enemies.some(e => !e.isDead && e.x === nx && e.y === ny)) {
                    player.x = nx;
                    player.y = ny;
                    player.stealthTurns = 1; // Brief stealth for backstab
                    results.push({ type: 'teleport', text: `You shadow step behind ${closest.name}!`, color: '#888888' });
                    return results;
                }
            }
            results.push({ type: 'fail', text: 'No space to shadow step!', color: COLORS.textSecondary });
        } else {
            results.push({ type: 'fail', text: 'No enemy in range!', color: COLORS.textSecondary });
        }
        return results;
    }

    _abilityFireball(player, targetX, targetY, dungeon, enemies) {
        const results = [];
        const intDmg = Math.floor(player.int * 2);
        const radius = 1;

        results.push({ type: 'projectile', fromX: player.x, fromY: player.y, toX: targetX, toY: targetY, color: '#ff4422' });

        // Area damage
        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            if (chebyshevDist(targetX, targetY, enemy.x, enemy.y) <= radius) {
                const damage = Math.max(1, intDmg + rng.int(-3, 3) - Math.floor(enemy.def * 0.2));
                const killed = enemy.takeDamage(damage);
                enemy.addStatus(STATUS.BURNING, 3);
                player.stats.damageDealt += damage;
                results.push({
                    type: 'hit', text: `Fireball burns ${enemy.name} for ${damage}!`,
                    color: '#ff4422', damage, targetX: enemy.x, targetY: enemy.y,
                });
                if (killed) results.push(...this._handleEnemyDeath(player, enemy));
            }
        }

        results.push({ type: 'explosion', x: targetX, y: targetY, radius, color: '#ff4422' });
        results.push({ type: 'screenshake', intensity: 8 });
        return results;
    }

    _abilityIceLance(player, targetX, targetY, enemies, dungeon) {
        const results = [];
        // Find enemy nearest to target
        let target = null, bestDist = Infinity;
        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            const d = dist(targetX, targetY, enemy.x, enemy.y);
            if (d < bestDist && d <= 2) {
                bestDist = d;
                target = enemy;
            }
        }

        if (target) {
            const damage = Math.max(1, Math.floor(player.int * 1.8) - Math.floor(target.def * 0.2));
            const killed = target.takeDamage(damage);
            target.addStatus(STATUS.FROZEN, 2);
            player.stats.damageDealt += damage;
            results.push({
                type: 'hit', text: `Ice Lance pierces ${target.name} for ${damage}! Frozen for 2 turns!`,
                color: '#66ccff', damage, targetX: target.x, targetY: target.y,
            });
            results.push({ type: 'projectile', fromX: player.x, fromY: player.y, toX: target.x, toY: target.y, color: '#66ccff' });
            if (killed) results.push(...this._handleEnemyDeath(player, target));
        } else {
            results.push({ type: 'miss', text: 'Ice Lance finds no target!', color: COLORS.textSecondary });
        }
        return results;
    }

    _abilityChainLightning(player, enemies) {
        const results = [];
        // Find 3 nearest enemies
        const targets = enemies
            .filter(e => !e.isDead && chebyshevDist(player.x, player.y, e.x, e.y) <= 8)
            .sort((a, b) => dist(player.x, player.y, a.x, a.y) - dist(player.x, player.y, b.x, b.y))
            .slice(0, 3);

        if (targets.length === 0) {
            results.push({ type: 'miss', text: 'No enemies in range for Chain Lightning!', color: COLORS.textSecondary });
            return results;
        }

        let prevX = player.x, prevY = player.y;
        for (let i = 0; i < targets.length; i++) {
            const enemy = targets[i];
            const multiplier = 1 - i * 0.2;
            const damage = Math.max(1, Math.floor(player.int * 1.5 * multiplier) - Math.floor(enemy.def * 0.2));
            const killed = enemy.takeDamage(damage);
            player.stats.damageDealt += damage;
            results.push({
                type: 'hit', text: `Lightning zaps ${enemy.name} for ${damage}!`,
                color: '#ffff44', damage, targetX: enemy.x, targetY: enemy.y,
            });
            results.push({ type: 'projectile', fromX: prevX, fromY: prevY, toX: enemy.x, toY: enemy.y, color: '#ffff44' });
            if (killed) results.push(...this._handleEnemyDeath(player, enemy));
            prevX = enemy.x;
            prevY = enemy.y;
        }

        results.push({ type: 'screenshake', intensity: 5 });
        return results;
    }

    _abilityHolySmite(player, enemies) {
        const results = [];
        let closest = null, closestDist = Infinity;
        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            const d = chebyshevDist(player.x, player.y, enemy.x, enemy.y);
            if (d <= 3 && d < closestDist) {
                closestDist = d;
                closest = enemy;
            }
        }
        if (closest) {
            const damage = Math.max(1, Math.floor((player.str + player.int) * 1.2) - Math.floor(closest.def * 0.2));
            const killed = closest.takeDamage(damage);
            player.stats.damageDealt += damage;
            results.push({
                type: 'hit', text: `Holy Smite strikes ${closest.name} for ${damage}!`,
                color: '#ffdd44', damage, targetX: closest.x, targetY: closest.y,
            });
            results.push({ type: 'projectile', fromX: player.x, fromY: player.y, toX: closest.x, toY: closest.y, color: '#ffdd44' });
            if (killed) results.push(...this._handleEnemyDeath(player, closest));
        } else {
            results.push({ type: 'miss', text: 'No enemy in range for Holy Smite!', color: COLORS.textSecondary });
        }
        return results;
    }

    _abilityConsecrate(player, enemies) {
        const results = [];
        let hitCount = 0;
        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            if (chebyshevDist(player.x, player.y, enemy.x, enemy.y) <= 2) {
                enemy.addStatus(STATUS.CONSECRATE, 4);
                hitCount++;
                results.push({
                    type: 'status', text: `${enemy.name} is seared by holy ground!`,
                    color: '#ffdd44',
                });
            }
        }
        if (hitCount === 0) results.push({ type: 'miss', text: 'No enemies nearby to consecrate!', color: COLORS.textSecondary });
        else results.push({ type: 'consecrate_effect', x: player.x, y: player.y, radius: 2 });
        return results;
    }

    _handleEnemyDeath(player, enemy) {
        const results = [];
        player.stats.enemiesKilled++;
        if (enemy.boss) player.stats.bossesKilled++;

        results.push({
            type: 'kill',
            text: `${enemy.name} is slain!`,
            color: '#ff8844',
            xp: enemy.xp,
            targetX: enemy.x,
            targetY: enemy.y,
            enemyColor: enemy.eliteColor || enemy.color,
        });

        // Elite: Explosive — AOE damage on death
        if (enemy.eliteModifier === 'explosive') {
            const aoeDmg = Math.floor(enemy.str * 0.8);
            const px = player.x, py = player.y;
            if (chebyshevDist(enemy.x, enemy.y, px, py) <= 2) {
                player.hp -= aoeDmg;
                player.stats.damageTaken += aoeDmg;
                results.push({
                    type: 'explosion',
                    text: `${enemy.name} explodes for ${aoeDmg} damage!`,
                    color: '#ff8822',
                    targetX: enemy.x, targetY: enemy.y,
                    radius: 2,
                });
                results.push({ type: 'screenshake', intensity: SHAKE.EXPLOSION });
            } else {
                results.push({
                    type: 'explosion',
                    text: `${enemy.name} explodes!`,
                    color: '#ff8822',
                    targetX: enemy.x, targetY: enemy.y,
                    radius: 2,
                });
            }
        }

        // Elite: Splitting — spawns weaker copy on death
        if (enemy.eliteModifier === 'splitting') {
            results.push({
                type: 'split',
                text: `${enemy.name} splits into two!`,
                color: '#44cc88',
                sourceType: enemy.type,
                sourceX: enemy.x,
                sourceY: enemy.y,
                sourceFloor: player.floor,
            });
        }

        // Perk: Feast — kill heals 5% max HP per stack
        if (player.hasPerk('feast')) {
            const stacks = player.getPerkStacks('feast');
            const heal = Math.max(1, Math.floor(player.maxHp * 0.05 * stacks));
            player.hp = Math.min(player.hp + heal, player.maxHp);
        }

        // Perk: Arcane Hunger — kill restores 3% max MP per stack
        if (player.hasPerk('arcane_hunger')) {
            const stacks = player.getPerkStacks('arcane_hunger');
            const mana = Math.max(1, Math.floor(player.maxMp * 0.03 * stacks));
            player.mp = Math.min(player.mp + mana, player.maxMp);
        }

        // Perk: Scavenger — bonus gold (handled in loot drop)

        // XP
        const levels = player.gainXp(enemy.xp);
        results.push({
            type: 'xp',
            text: `+${enemy.xp} XP`,
            color: COLORS.textXp,
            targetX: enemy.x,
            targetY: enemy.y,
        });

        for (const lvl of levels) {
            results.push({
                type: 'levelup',
                text: `Level up! You are now level ${lvl}!`,
                color: '#ffff00',
            });
        }

        return results;
    }
}
