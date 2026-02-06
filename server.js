// ============================================================
// DEPTHS OF VALRATH — Multiplayer Server
// ============================================================

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Load all game logic files into a single function scope
const gameFiles = ['constants', 'utils', 'dungeon', 'fov', 'player', 'enemies', 'combat', 'items'];
const allCode = gameFiles.map(f =>
    fs.readFileSync(path.join(__dirname, 'js', `${f}.js`), 'utf8')
).join('\n');

const loadGame = new Function(`
    ${allCode}
    return {
        TILE, MAP_WIDTH, MAP_HEIGHT, MAX_FLOORS, BOSS_FLOORS,
        CLASS, CLASS_DATA, ENEMY_DATA, STATUS, STATUS_COLORS,
        SLOT, ITEM_TYPE, RARITY, FOG, GAME_STATE,
        ALL_DIRS, CARDINAL_DIRS,
        MAX_INVENTORY_SIZE, MAX_HUNGER, HUNGER_PER_TURN,
        HUNGER_DAMAGE_THRESHOLD, HUNGER_WARNING_THRESHOLD,
        ENEMY_REACTION_RANGE, MAX_PLAYERS, WS_DEFAULT_PORT,
        RARITY_COLORS, COLORS, XP_TABLE, TIER_ENEMIES,
        DAMAGE_VARIANCE, BASE_CRIT_CHANCE, CRIT_DEX_SCALE, CRIT_MULTIPLIER,
        BASE_DODGE_CHANCE, DODGE_DEX_SCALE,
        RNG, rng, Player, Enemy, Dungeon, FOVSystem, CombatSystem, BSPNode,
        MinHeap,
        spawnEnemies, spawnItems, generateItem, generateGold,
        astarFind, dist, chebyshevDist, bresenhamLine,
        getItemColor, getRarityMultiplier,
    };
`);

const G = loadGame();

// ============================================================
// Game Session
// ============================================================

class GameSession {
    constructor(id) {
        this.id = id;
        this.players = new Map(); // socketId -> { socket, player, name }
        this.dungeon = null;
        this.enemies = [];
        this.items = [];
        this.floor = 1;
        this.state = 'lobby';
        this.hostId = null;
        this.combat = new G.CombatSystem(null);
        this.stairsReady = new Set();
        this.nextPlayerId = 1;
    }

    addPlayer(socket, classId, name) {
        if (this.players.size >= G.MAX_PLAYERS) return null;
        if (this.state !== 'lobby') return null;

        const playerId = 'p' + this.nextPlayerId++;
        const isHost = this.players.size === 0;
        if (isHost) this.hostId = playerId;

        this.players.set(playerId, {
            socket,
            player: null,
            classId,
            name: name || `Player ${this.players.size + 1}`,
            isHost,
        });

        return playerId;
    }

    removePlayer(playerId) {
        const data = this.players.get(playerId);
        if (!data) return;

        this.players.delete(playerId);
        this.stairsReady.delete(playerId);

        if (this.players.size === 0) return 'empty';

        // Transfer host
        if (playerId === this.hostId) {
            const newHost = this.players.keys().next().value;
            this.hostId = newHost;
            const hostData = this.players.get(newHost);
            if (hostData) hostData.isHost = true;
        }

        this._broadcastAll({
            type: 'player_left',
            playerId,
            newHostId: this.hostId,
        });

        if (this.state === 'lobby') {
            this._broadcastLobby();
        }

        // Check if all remaining players are dead
        if (this.state === 'playing') {
            this._checkGameOver();
            this._checkStairsReady();
        }
    }

    startGame() {
        if (this.state !== 'lobby') return;
        this.state = 'playing';
        this.floor = 1;

        // Create player objects
        for (const [id, data] of this.players) {
            data.player = new G.Player(data.classId);
            data.player.floor = 1;
        }

        this._generateFloor(1);

        // Send game start with full state
        for (const [id, data] of this.players) {
            this._sendTo(id, {
                type: 'game_start',
                yourId: id,
                floor: this.floor,
                dungeon: this._serializeDungeon(),
                enemies: this._serializeAllEnemies(),
                items: this._serializeAllItems(),
                players: this._serializeAllPlayers(),
                yourState: this._serializeFullPlayer(data.player),
            });
        }
    }

    handleAction(playerId, action) {
        if (this.state !== 'playing') return;
        const data = this.players.get(playerId);
        if (!data || !data.player || !data.player.isAlive()) return;

        let results = [];
        let acted = false;

        switch (action.type) {
            case 'move':
                ({ results, acted } = this._handleMove(playerId, action.dx, action.dy));
                break;
            case 'wait':
                results = [];
                acted = true;
                break;
            case 'ability':
                ({ results, acted } = this._handleAbility(playerId, action.index, action.targetX, action.targetY));
                break;
            case 'pickup':
                ({ results, acted } = this._handlePickup(playerId));
                break;
            case 'interact':
                ({ results, acted } = this._handleInteract(playerId));
                break;
            case 'equip':
                this._handleEquip(playerId, action.itemIndex);
                return;
            case 'use_item':
                ({ results, acted } = this._handleUseItem(playerId, action.itemIndex));
                break;
            case 'drop_item':
                this._handleDropItem(playerId, action.itemIndex);
                return;
            case 'allocate_stat':
                this._handleAllocateStat(playerId, action.stat);
                return;
            case 'buy_item':
                this._handleBuyItem(playerId, action.itemId);
                return;
            default:
                return;
        }

        if (!acted) {
            // Send results to just this player (failed action)
            this._sendTo(playerId, {
                type: 'action_result',
                actorId: playerId,
                results,
                players: this._serializeAllPlayers(),
                enemies: this._serializeAllEnemies(),
                items: this._serializeAllItems(),
                tileChanges: [],
            });
            this._sendPrivateState(playerId);
            return;
        }

        // Process the acting player's turn effects
        const player = data.player;
        player.processTurn();

        // Check acting player death
        if (!player.isAlive()) {
            results.push({ type: 'kill', text: `${data.name} has fallen!`, color: '#cc2222' });
        }

        // Hunger warnings
        if (player.isAlive()) {
            if (player.hunger <= G.HUNGER_DAMAGE_THRESHOLD && player.stats.turnsPlayed % 10 === 0) {
                results.push({ type: 'status', text: 'You are starving! Find food!', color: '#cc2222', privateFor: playerId });
            } else if (player.hunger <= G.HUNGER_WARNING_THRESHOLD && player.stats.turnsPlayed % 20 === 0) {
                results.push({ type: 'status', text: 'You are getting hungry...', color: '#cc8822', privateFor: playerId });
            }
        }

        // Process enemy turns near the acting player
        const enemyResults = this._processEnemyTurns(player);
        results.push(...enemyResults);

        // Drop loot for newly dead enemies
        const tileChanges = [];
        for (let i = 0; i < this.enemies.length; i++) {
            const enemy = this.enemies[i];
            if (enemy.isDead && !enemy._lootDropped) {
                enemy._lootDropped = true;
                this._dropEnemyLoot(enemy);
            }
        }

        // Check all players for death after enemy turns
        for (const [pid, pdata] of this.players) {
            if (pdata.player && !pdata.player.isAlive() && !pdata._deathAnnounced) {
                pdata._deathAnnounced = true;
                if (pid !== playerId) {
                    results.push({ type: 'kill', text: `${pdata.name} has fallen!`, color: '#cc2222' });
                }
            }
        }

        // Check victory / game over
        if (this.state === 'victory' || this.state === 'game_over') {
            // Already handled
        } else {
            this._checkGameOver();
        }

        // Broadcast to all
        this._broadcastAll({
            type: 'action_result',
            actorId: playerId,
            results,
            players: this._serializeAllPlayers(),
            enemies: this._serializeAllEnemies(),
            items: this._serializeAllItems(),
            tileChanges,
        });

        // Send private state to all players
        for (const [id] of this.players) {
            this._sendPrivateState(id);
        }
    }

    // === ACTION HANDLERS ===

    _handleMove(playerId, dx, dy) {
        const data = this.players.get(playerId);
        const player = data.player;
        const newX = player.x + dx;
        const newY = player.y + dy;
        const results = [];

        // Check for enemy at target
        const enemy = this.enemies.find(e => !e.isDead && e.x === newX && e.y === newY);
        if (enemy) {
            const combatResults = this.combat.playerAttackEnemy(player, enemy);
            results.push(...combatResults);
            return { results, acted: true };
        }

        // Check walkability
        if (!this.dungeon.isWalkable(newX, newY)) {
            return { results: [], acted: false };
        }

        // Move player
        player.prevX = player.x;
        player.prevY = player.y;
        player.x = newX;
        player.y = newY;
        player.moveAnimT = 0;

        // Check tile effects
        const tileResults = this._checkTileEffects(playerId);
        results.push(...tileResults);

        return { results, acted: true };
    }

    _handleAbility(playerId, index, targetX, targetY) {
        const data = this.players.get(playerId);
        const player = data.player;
        const ability = player.abilities[index];
        if (!ability) return { results: [{ type: 'fail', text: 'No such ability.' }], acted: false };
        if (ability.currentCooldown > 0) return { results: [{ type: 'fail', text: `${ability.name} on cooldown.` }], acted: false };
        if (player.mp < ability.mpCost) return { results: [{ type: 'fail', text: 'Not enough MP.' }], acted: false };

        const results = this.combat.useAbility(player, index, targetX || 0, targetY || 0, this.dungeon, this.enemies);

        if (results.some(r => r.type === 'fail')) {
            return { results, acted: false };
        }

        return { results, acted: true };
    }

    _handlePickup(playerId) {
        const data = this.players.get(playerId);
        const player = data.player;
        const item = this.items.find(i => i.x === player.x && i.y === player.y && !i.isShopItem);

        if (!item) {
            return { results: [{ type: 'fail', text: 'Nothing to pick up.' }], acted: false };
        }

        if (item.type === G.ITEM_TYPE.GOLD) {
            player.addToInventory(item);
            const idx = this.items.indexOf(item);
            if (idx !== -1) this.items.splice(idx, 1);
            return { results: [{ type: 'status', text: `Picked up ${item.name}.`, color: '#ffcc00' }], acted: true };
        }

        if (!player.addToInventory(item)) {
            return { results: [{ type: 'fail', text: 'Inventory full!' }], acted: false };
        }

        const idx = this.items.indexOf(item);
        if (idx !== -1) this.items.splice(idx, 1);
        return { results: [{ type: 'status', text: `Picked up ${item.name}.`, color: G.RARITY_COLORS[item.rarity] || '#dddddd' }], acted: true };
    }

    _handleInteract(playerId) {
        const data = this.players.get(playerId);
        const player = data.player;
        const tile = this.dungeon.getTile(player.x, player.y);

        if (tile === G.TILE.STAIRS_DOWN) {
            if (this.floor >= G.MAX_FLOORS) {
                return { results: [{ type: 'fail', text: 'No stairs deeper...' }], acted: false };
            }

            this.stairsReady.add(playerId);
            const living = [...this.players.values()].filter(d => d.player && d.player.isAlive());
            const readyCount = this.stairsReady.size;
            const totalCount = living.length;

            if (readyCount >= totalCount) {
                // All ready — descend
                this._descend();
                return { results: [], acted: false };
            } else {
                this._broadcastAll({
                    type: 'waiting_at_stairs',
                    playerId,
                    playerName: data.name,
                    readyCount,
                    totalCount,
                });
                return { results: [{ type: 'status', text: `Waiting for other players... (${readyCount}/${totalCount})`, color: '#66ccff' }], acted: false };
            }
        }

        if (tile === G.TILE.STAIRS_UP) {
            return { results: [{ type: 'fail', text: 'You cannot go back!' }], acted: false };
        }

        return { results: [{ type: 'fail', text: 'Nothing to interact with.' }], acted: false };
    }

    _handleEquip(playerId, itemIndex) {
        const data = this.players.get(playerId);
        const player = data.player;
        const item = player.inventory[itemIndex];
        if (!item || !item.slot) return;

        player.equip(item);
        this._sendPrivateState(playerId);
        this._broadcastAll({
            type: 'action_result',
            actorId: playerId,
            results: [],
            players: this._serializeAllPlayers(),
            enemies: this._serializeAllEnemies(),
            items: this._serializeAllItems(),
            tileChanges: [],
        });
    }

    _handleUseItem(playerId, itemIndex) {
        const data = this.players.get(playerId);
        const player = data.player;
        const item = player.inventory[itemIndex];
        if (!item) return { results: [{ type: 'fail', text: 'No item.' }], acted: false };

        if (item.type === G.ITEM_TYPE.SCROLL) {
            const results = this._useScroll(playerId, item);
            const idx = player.inventory.indexOf(item);
            if (idx !== -1) player.inventory.splice(idx, 1);
            this._sendPrivateState(playerId);
            return { results, acted: true };
        }

        if (item.consumable) {
            player.useItem(item);
            this._sendPrivateState(playerId);
            return { results: [{ type: 'status', text: `Used ${item.name}.`, color: '#44ff44' }], acted: false };
        }

        return { results: [{ type: 'fail', text: 'Cannot use that.' }], acted: false };
    }

    _handleDropItem(playerId, itemIndex) {
        const data = this.players.get(playerId);
        const player = data.player;
        const item = player.inventory[itemIndex];
        if (!item) return;

        player.dropItem(item);
        item.x = player.x;
        item.y = player.y;
        this.items.push(item);
        this._sendPrivateState(playerId);
        this._broadcastAll({
            type: 'action_result',
            actorId: playerId,
            results: [],
            players: this._serializeAllPlayers(),
            enemies: this._serializeAllEnemies(),
            items: this._serializeAllItems(),
            tileChanges: [],
        });
    }

    _handleAllocateStat(playerId, stat) {
        const data = this.players.get(playerId);
        if (!data || !data.player) return;
        data.player.allocateStat(stat);
        this._sendPrivateState(playerId);
        this._broadcastAll({
            type: 'action_result',
            actorId: playerId,
            results: [],
            players: this._serializeAllPlayers(),
            enemies: this._serializeAllEnemies(),
            items: this._serializeAllItems(),
            tileChanges: [],
        });
    }

    _handleBuyItem(playerId, itemId) {
        const data = this.players.get(playerId);
        const player = data.player;
        const item = this.items.find(i => i.id === itemId && i.isShopItem);
        if (!item) return;

        if (player.gold < item.shopPrice) {
            this._sendTo(playerId, { type: 'action_result', actorId: playerId, results: [{ type: 'fail', text: 'Not enough gold!' }], players: this._serializeAllPlayers(), enemies: this._serializeAllEnemies(), items: this._serializeAllItems(), tileChanges: [] });
            return;
        }
        if (player.inventory.length >= G.MAX_INVENTORY_SIZE) {
            this._sendTo(playerId, { type: 'action_result', actorId: playerId, results: [{ type: 'fail', text: 'Inventory full!' }], players: this._serializeAllPlayers(), enemies: this._serializeAllEnemies(), items: this._serializeAllItems(), tileChanges: [] });
            return;
        }

        player.gold -= item.shopPrice;
        item.isShopItem = false;
        const idx = this.items.indexOf(item);
        if (idx !== -1) this.items.splice(idx, 1);
        player.addToInventory(item);

        this._sendPrivateState(playerId);
        this._broadcastAll({
            type: 'action_result',
            actorId: playerId,
            results: [{ type: 'status', text: `${data.name} bought ${item.name}.`, color: '#ffcc00' }],
            players: this._serializeAllPlayers(),
            enemies: this._serializeAllEnemies(),
            items: this._serializeAllItems(),
            tileChanges: [],
        });
    }

    // === GAME LOGIC ===

    _generateFloor(floorNum) {
        this.dungeon = new G.Dungeon(G.MAP_WIDTH, G.MAP_HEIGHT, floorNum);
        this.dungeon.generate();
        this.enemies = G.spawnEnemies(this.dungeon);
        this.items = G.spawnItems(this.dungeon);
        this.floor = floorNum;
        this.stairsReady.clear();

        // Place all players at spawn
        for (const [id, data] of this.players) {
            if (!data.player) continue;
            data.player.x = this.dungeon.spawnPoint.x;
            data.player.y = this.dungeon.spawnPoint.y;
            data.player.prevX = data.player.x;
            data.player.prevY = data.player.y;
            data.player.moveAnimT = 1;
            data.player.floor = floorNum;
        }
    }

    _descend() {
        this.floor++;
        this._generateFloor(this.floor);

        for (const [id, data] of this.players) {
            if (data.player) {
                data.player.stats.floorsExplored++;
            }
        }

        // Send floor change
        for (const [id, data] of this.players) {
            this._sendTo(id, {
                type: 'floor_change',
                floor: this.floor,
                dungeon: this._serializeDungeon(),
                enemies: this._serializeAllEnemies(),
                items: this._serializeAllItems(),
                players: this._serializeAllPlayers(),
                yourState: data.player ? this._serializeFullPlayer(data.player) : null,
            });
        }
    }

    _checkTileEffects(playerId) {
        const data = this.players.get(playerId);
        const player = data.player;
        const tile = this.dungeon.getTile(player.x, player.y);
        const results = [];

        switch (tile) {
            case G.TILE.TRAP:
                if (G.rng.chance(0.5)) {
                    const damage = G.rng.int(3, 8 + player.floor * 2);
                    player.hp -= damage;
                    results.push({ type: 'hit', text: `${data.name} triggers a trap! ${damage} damage!`, color: '#cc4444', damage, targetX: player.x, targetY: player.y });
                    results.push({ type: 'screenshake', intensity: 6 });
                    this.dungeon.setTile(player.x, player.y, G.TILE.FLOOR);
                }
                break;
            case G.TILE.LAVA: {
                const lavaDmg = 5 + player.floor;
                player.hp -= lavaDmg;
                results.push({ type: 'hit', text: `Lava burns ${data.name} for ${lavaDmg}!`, color: '#ff4422', damage: lavaDmg, targetX: player.x, targetY: player.y });
                break;
            }
        }

        return results;
    }

    _processEnemyTurns(actingPlayer) {
        const results = [];
        const allPlayers = [...this.players.values()]
            .filter(d => d.player && d.player.isAlive())
            .map(d => d.player);

        for (const enemy of this.enemies) {
            if (enemy.isDead) continue;

            // Only process enemies near the acting player
            const distToActor = G.chebyshevDist(enemy.x, enemy.y, actingPlayer.x, actingPlayer.y);
            if (distToActor > G.ENEMY_REACTION_RANGE) continue;

            // Process status effects
            enemy.processTurn();
            if (enemy.isDead) {
                // Died from status effects
                const killer = this._findNearestPlayer(enemy, allPlayers);
                if (killer) {
                    const levels = killer.gainXp(enemy.xp);
                    results.push({ type: 'kill', text: `${enemy.name} dies from afflictions!`, color: '#ff8844' });
                    results.push({ type: 'xp', text: `+${enemy.xp} XP`, color: '#ccaa22', targetX: enemy.x, targetY: enemy.y });
                    for (const lvl of levels) {
                        results.push({ type: 'levelup', text: `Level up! Level ${lvl}!`, color: '#ffff00' });
                    }
                    if (enemy.boss) killer.stats.bossesKilled++;
                    killer.stats.enemiesKilled++;
                }
                continue;
            }

            // Find nearest player for AI targeting
            const nearestPlayer = this._findNearestPlayer(enemy, allPlayers);
            if (!nearestPlayer) continue;

            const action = enemy.doTurn(this.dungeon, nearestPlayer, this.enemies);
            if (!action) continue;

            switch (action.type) {
                case 'move':
                    // Don't move onto other players
                    const blocked = allPlayers.some(p => p.x === action.x && p.y === action.y);
                    if (!blocked) {
                        enemy.prevX = enemy.x;
                        enemy.prevY = enemy.y;
                        enemy.x = action.x;
                        enemy.y = action.y;
                        enemy.moveAnimT = 0;
                    }
                    break;
                case 'attack': {
                    // Attack the nearest adjacent player
                    const target = this._findNearestPlayer(enemy, allPlayers.filter(p =>
                        G.chebyshevDist(enemy.x, enemy.y, p.x, p.y) <= 1
                    ));
                    if (target) {
                        const combatResults = this.combat.enemyAttackPlayer(enemy, target);
                        results.push(...combatResults);
                    }
                    break;
                }
                case 'ranged_attack': {
                    const target = this._findNearestPlayer(enemy, allPlayers);
                    if (target) {
                        const combatResults = this.combat.enemyRangedAttack(enemy, target);
                        results.push(...combatResults);
                    }
                    break;
                }
            }
        }

        return results;
    }

    _findNearestPlayer(enemy, players) {
        let nearest = null;
        let bestDist = Infinity;
        for (const p of players) {
            const d = G.chebyshevDist(enemy.x, enemy.y, p.x, p.y);
            if (d < bestDist) {
                bestDist = d;
                nearest = p;
            }
        }
        return nearest;
    }

    _dropEnemyLoot(enemy) {
        const dropChance = enemy.boss ? 1.0 : 0.35;
        if (G.rng.chance(dropChance)) {
            const rarity = enemy.boss ? (G.rng.chance(0.3) ? G.RARITY.EPIC : G.RARITY.RARE) : undefined;
            const item = G.generateItem(this.floor, rarity);
            item.x = enemy.x;
            item.y = enemy.y;
            this.items.push(item);
        }

        const gold = G.generateGold(this.floor);
        gold.x = enemy.x;
        gold.y = enemy.y;
        this.items.push(gold);

        // Victory check
        if (enemy.type === 'valrath') {
            this.state = 'victory';
            this._broadcastAll({
                type: 'victory',
                players: this._serializeAllPlayers(),
            });
        }
    }

    _useScroll(playerId, scroll) {
        const data = this.players.get(playerId);
        const player = data.player;
        const results = [];

        switch (scroll.effect) {
            case 'teleport': {
                const pos = this.dungeon.getRandomWalkablePos();
                player.x = pos.x;
                player.y = pos.y;
                player.prevX = pos.x;
                player.prevY = pos.y;
                results.push({ type: 'teleport', text: 'Teleported to a new location!', color: '#aa44ff' });
                break;
            }
            case 'map':
                results.push({ type: 'status', text: 'The scroll reveals the floor!', color: '#ffcc00' });
                break;
            case 'fireball': {
                const nearest = this.enemies
                    .filter(e => !e.isDead)
                    .sort((a, b) => G.dist(player.x, player.y, a.x, a.y) - G.dist(player.x, player.y, b.x, b.y))[0];
                if (nearest) {
                    const damage = scroll.power;
                    nearest.takeDamage(damage);
                    nearest.addStatus(G.STATUS.BURNING, 3);
                    results.push({ type: 'hit', text: `Fireball hits ${nearest.name} for ${damage}!`, color: '#ff4422', damage, targetX: nearest.x, targetY: nearest.y });
                    results.push({ type: 'explosion', x: nearest.x, y: nearest.y, radius: 1, color: '#ff4422' });
                    if (nearest.isDead) {
                        player.stats.enemiesKilled++;
                        const levels = player.gainXp(nearest.xp);
                        results.push({ type: 'xp', text: `+${nearest.xp} XP`, color: '#ccaa22', targetX: nearest.x, targetY: nearest.y });
                    }
                }
                break;
            }
        }

        return results;
    }

    _checkGameOver() {
        const anyAlive = [...this.players.values()].some(d => d.player && d.player.isAlive());
        if (!anyAlive && this.state === 'playing') {
            this.state = 'game_over';
            this._broadcastAll({
                type: 'game_over',
                players: this._serializeAllPlayers(),
            });
        }
    }

    _checkStairsReady() {
        if (this.stairsReady.size === 0) return;
        const living = [...this.players.values()].filter(d => d.player && d.player.isAlive());
        if (this.stairsReady.size >= living.length) {
            this._descend();
        }
    }

    // === SERIALIZATION ===

    _serializeDungeon() {
        return {
            tiles: this.dungeon.tiles,
            width: this.dungeon.width,
            height: this.dungeon.height,
            floor: this.dungeon.floor,
            rooms: this.dungeon.rooms,
            stairsUp: this.dungeon.stairsUp,
            stairsDown: this.dungeon.stairsDown,
            spawnPoint: this.dungeon.spawnPoint,
            specialRooms: this.dungeon.specialRooms,
        };
    }

    _serializeAllPlayers() {
        const out = {};
        for (const [id, data] of this.players) {
            if (!data.player) continue;
            const p = data.player;
            out[id] = {
                id,
                name: data.name,
                classId: p.classId,
                className: p.className,
                color: p.color,
                x: p.x, y: p.y,
                prevX: p.prevX, prevY: p.prevY,
                moveAnimT: p.moveAnimT,
                hp: p.hp, maxHp: p.maxHp,
                mp: p.mp, maxMp: p.maxMp,
                level: p.level,
                str: p.str, def: p.def, dex: p.dex, int: p.int,
                gold: p.gold,
                isAlive: p.isAlive(),
                stealthTurns: p.stealthTurns,
                invulnTurns: p.invulnTurns,
                statusEffects: p.statusEffects,
                isHost: data.isHost,
            };
        }
        return out;
    }

    _serializeFullPlayer(player) {
        return {
            hp: player.hp, maxHp: player.maxHp,
            mp: player.mp, maxMp: player.maxMp,
            str: player.str, def: player.def,
            dex: player.dex, int: player.int,
            baseStr: player.baseStr, baseDef: player.baseDef,
            baseDex: player.baseDex, baseInt: player.baseInt,
            level: player.level, xp: player.xp, xpToNext: player.xpToNext,
            gold: player.gold, hunger: player.hunger,
            floor: player.floor,
            stealthTurns: player.stealthTurns,
            invulnTurns: player.invulnTurns,
            pendingStatPoints: player.pendingStatPoints,
            statusEffects: player.statusEffects,
            abilities: player.abilities.map(a => ({
                name: a.name, description: a.description,
                mpCost: a.mpCost, cooldown: a.cooldown,
                currentCooldown: a.currentCooldown,
                type: a.type,
            })),
            inventory: player.inventory.map(i => this._serializeItem(i)),
            equipment: Object.fromEntries(
                Object.entries(player.equipment).map(([slot, item]) => [slot, item ? this._serializeItem(item) : null])
            ),
            stats: { ...player.stats },
            visionRadius: player.visionRadius,
            classId: player.classId,
            className: player.className,
            color: player.color,
        };
    }

    _serializeAllEnemies() {
        return this.enemies.map((e, idx) => ({
            idx,
            type: e.type,
            name: e.name,
            color: e.color,
            boss: e.boss,
            behavior: e.behavior,
            x: e.x, y: e.y,
            prevX: e.prevX, prevY: e.prevY,
            moveAnimT: e.moveAnimT,
            hp: e.hp, maxHp: e.maxHp,
            str: e.str, def: e.def,
            isDead: e.isDead,
            deathTimer: e.deathTimer,
            flashTimer: e.flashTimer,
            alerted: e.alerted,
            statusEffects: e.statusEffects,
            description: e.description,
        }));
    }

    _serializeAllItems() {
        return this.items.map(i => this._serializeItem(i));
    }

    _serializeItem(item) {
        return {
            id: item.id,
            x: item.x, y: item.y,
            type: item.type,
            name: item.name,
            rarity: item.rarity,
            symbol: item.symbol,
            description: item.description,
            isShopItem: item.isShopItem || false,
            shopPrice: item.shopPrice || 0,
            consumable: item.consumable || false,
            slot: item.slot || null,
            damage: item.damage || 0,
            defense: item.defense || 0,
            blockChance: item.blockChance || 0,
            strBonus: item.strBonus || 0,
            defBonus: item.defBonus || 0,
            dexBonus: item.dexBonus || 0,
            intBonus: item.intBonus || 0,
            hpBonus: item.hpBonus || 0,
            mpBonus: item.mpBonus || 0,
            statusEffect: item.statusEffect || null,
            power: item.power || 0,
            effect: item.effect || null,
            value: item.value || 0,
            baseName: item.baseName || item.name,
            attackType: item.attackType || null,
            range: item.range || 1,
        };
    }

    // === COMMUNICATION ===

    _sendTo(playerId, msg) {
        const data = this.players.get(playerId);
        if (data && data.socket.readyState === WebSocket.OPEN) {
            data.socket.send(JSON.stringify(msg));
        }
    }

    _sendPrivateState(playerId) {
        const data = this.players.get(playerId);
        if (!data || !data.player) return;
        this._sendTo(playerId, {
            type: 'your_state',
            state: this._serializeFullPlayer(data.player),
        });
    }

    _broadcastAll(msg) {
        const json = JSON.stringify(msg);
        for (const [id, data] of this.players) {
            if (data.socket.readyState === WebSocket.OPEN) {
                data.socket.send(json);
            }
        }
    }

    _broadcastLobby() {
        const lobbyPlayers = [];
        for (const [id, data] of this.players) {
            lobbyPlayers.push({
                id,
                name: data.name,
                classId: data.classId,
                isHost: data.isHost,
            });
        }
        this._broadcastAll({
            type: 'lobby_update',
            players: lobbyPlayers,
            sessionId: this.id,
        });
    }
}

// ============================================================
// HTTP + WebSocket Server
// ============================================================

const http = require('http');
const PORT = parseInt(process.env.PORT) || G.WS_DEFAULT_PORT;

// MIME types for static file serving
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
};

// HTTP server serves the game files
const httpServer = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    // Prevent directory traversal
    filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(__dirname, filePath);

    // Only serve files within the project directory
    if (!fullPath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(fullPath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(fullPath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

const wss = new WebSocket.Server({ server: httpServer });

// Single session for now
let session = new GameSession('default');
const socketToPlayer = new Map(); // ws -> playerId

httpServer.listen(PORT, () => {
    console.log(`Depths of Valrath server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play`);
});

wss.on('connection', (ws) => {
    let playerId = null;

    ws.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch (e) {
            return;
        }

        switch (msg.type) {
            case 'join': {
                // Reset session if game is over
                if (session.state === 'victory' || session.state === 'game_over') {
                    session = new GameSession('default');
                }

                playerId = session.addPlayer(ws, msg.classId || G.CLASS.WARRIOR, msg.name || 'Anonymous');
                if (!playerId) {
                    ws.send(JSON.stringify({ type: 'error', text: 'Cannot join: game full or in progress.' }));
                    return;
                }

                socketToPlayer.set(ws, playerId);

                ws.send(JSON.stringify({
                    type: 'welcome',
                    playerId,
                    isHost: session.players.get(playerId).isHost,
                }));

                session._broadcastLobby();
                break;
            }

            case 'start_game': {
                if (!playerId || playerId !== session.hostId) return;
                if (session.state !== 'lobby') return;
                session.startGame();
                break;
            }

            case 'change_class': {
                if (!playerId || session.state !== 'lobby') return;
                const data = session.players.get(playerId);
                if (data) {
                    data.classId = msg.classId;
                    session._broadcastLobby();
                }
                break;
            }

            default: {
                if (!playerId) return;
                session.handleAction(playerId, msg);
                break;
            }
        }
    });

    ws.on('close', () => {
        if (playerId) {
            const result = session.removePlayer(playerId);
            socketToPlayer.delete(ws);
            if (result === 'empty') {
                session = new GameSession('default');
                console.log('All players left, resetting session.');
            }
        }
    });

    ws.on('error', () => {});
});
