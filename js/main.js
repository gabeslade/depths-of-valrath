// ============================================================
// DEPTHS OF VALRATH — Main Game Loop & State Management
// ============================================================

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.renderer = new Renderer(this.canvas);
        this.ui = new UISystem(this.renderer);
        this.audio = new AudioSystem();
        this.combat = new CombatSystem(this);
        this.fov = new FOVSystem();

        // Game state
        this.state = GAME_STATE.MENU;
        this.menuSelection = 0;
        this.showMinimap = true;

        // Game objects
        this.player = null;
        this.dungeon = null;
        this.enemies = [];
        this.items = [];
        this.npcs = [];
        this.activeNPC = null; // Currently talking NPC
        this.npcDialogueSelection = 0;

        // Turn system
        this.playerActed = false;
        this.animating = false;
        this.turnQueue = [];

        // Auto-explore
        this.autoExploring = false;
        this.autoExplorePath = null;

        // Targeting mode
        this.targetingAbility = -1;
        this.targetX = 0;
        this.targetY = 0;

        // Input state
        this.keysDown = {};

        // Animation timing
        this.lastTime = 0;
        this.animTimer = 0;

        // === MULTIPLAYER STATE ===
        this.isMultiplayer = false;
        this.network = new NetworkClient();
        this.otherPlayers = {}; // id -> {x, y, prevX, prevY, moveAnimT, classId, className, color, name, hp, maxHp, isAlive, ...}
        this.myPlayerId = null;
        this.lobbyPlayers = [];
        this.serverAddress = window.location.host || ('localhost:' + WS_DEFAULT_PORT);
        this.mpMenuField = 'address'; // 'address' or 'class'
        this.mpClassSelection = 0;
        this.mpPlayerName = '';
        this.mpConnecting = false;
        this.mpError = null;

        // Bind events
        this._bindEvents();

        // Start game loop
        requestAnimationFrame((t) => this._gameLoop(t));
    }

    _bindEvents() {
        window.addEventListener('keydown', (e) => this._onKeyDown(e));
        window.addEventListener('keyup', (e) => this._onKeyUp(e));
        window.addEventListener('resize', () => this.renderer.resize());
        window.addEventListener('mousemove', (e) => {
            this.ui.mouseX = e.clientX;
            this.ui.mouseY = e.clientY;
            // Convert to tile coordinates
            this.ui.mouseTileX = Math.floor((e.clientX + this.renderer.camX - this.renderer.shakeOffsetX) / TILE_SIZE);
            this.ui.mouseTileY = Math.floor((e.clientY + this.renderer.camY - this.renderer.shakeOffsetY) / TILE_SIZE);
        });
        this.canvas.addEventListener('click', (e) => this._onClick(e));

        // Init audio on first interaction
        const initAudio = () => {
            this.audio.init();
            this.audio.resume();
            window.removeEventListener('click', initAudio);
            window.removeEventListener('keydown', initAudio);
        };
        window.addEventListener('click', initAudio);
        window.addEventListener('keydown', initAudio);
    }

    _gameLoop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
        this.lastTime = timestamp;

        this._update(dt);
        this._render(dt);

        requestAnimationFrame((t) => this._gameLoop(t));
    }

    _update(dt) {
        // Update animations
        if (this.player) {
            if (this.player.moveAnimT < 1) {
                this.player.moveAnimT += dt * 10;
                if (this.player.moveAnimT > 1) this.player.moveAnimT = 1;
            }
        }

        for (const enemy of this.enemies) {
            if (enemy.moveAnimT < 1) {
                enemy.moveAnimT += dt * 10;
                if (enemy.moveAnimT > 1) enemy.moveAnimT = 1;
            }
            if (enemy.flashTimer > 0) {
                enemy.flashTimer -= dt;
            }
            if (enemy.isDead && enemy.deathTimer > 0) {
                enemy.deathTimer -= dt;
            }
        }

        // Update other players' animations (multiplayer)
        for (const op of Object.values(this.otherPlayers)) {
            if (op.moveAnimT < 1) {
                op.moveAnimT += dt * 10;
                if (op.moveAnimT > 1) op.moveAnimT = 1;
            }
        }

        // Update tooltips
        if (this.state === GAME_STATE.PLAYING) {
            this.ui.updateTooltip(this);
        } else {
            this.ui.tooltip = null;
        }
    }

    _render(dt) {
        switch (this.state) {
            case GAME_STATE.MENU:
                this.ui.renderMenu(this);
                break;

            case GAME_STATE.MP_MENU:
                this.ui.renderMpMenu(this);
                break;

            case GAME_STATE.LOBBY:
                this.ui.renderLobby(this);
                break;

            case GAME_STATE.PLAYING:
            case GAME_STATE.TARGETING:
                this.renderer.render(this, dt);
                this.ui.renderHUD(this);
                if (this.state === GAME_STATE.TARGETING) {
                    this._renderTargetingOverlay();
                }
                break;

            case GAME_STATE.INVENTORY:
                this.renderer.render(this, dt);
                this.ui.renderInventory(this);
                break;

            case GAME_STATE.CHARACTER:
                this.renderer.render(this, dt);
                this.ui.renderCharacterSheet(this);
                break;

            case GAME_STATE.LEVEL_UP:
                this.renderer.render(this, dt);
                this.ui.renderLevelUp(this);
                break;

            case GAME_STATE.SHOP:
                this.renderer.render(this, dt);
                this.ui.renderShop(this);
                break;

            case GAME_STATE.NPC_DIALOGUE:
                this.renderer.render(this, dt);
                this.ui.renderNPCDialogue(this);
                break;

            case GAME_STATE.GAME_OVER:
                this.ui.renderGameOver(this);
                break;

            case GAME_STATE.VICTORY:
                this.ui.renderVictory(this);
                break;
        }
    }

    _renderTargetingOverlay() {
        const ctx = this.renderer.ctx;
        const screen = this.renderer.worldToScreen(this.targetX, this.targetY);

        // Target reticle
        const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
        ctx.strokeStyle = `rgba(255, 255, 0, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(screen.x - 2, screen.y - 2, TILE_SIZE + 4, TILE_SIZE + 4);

        // Line from player to target
        const playerScreen = this.renderer.worldToScreen(this.player.x, this.player.y);
        ctx.strokeStyle = `rgba(255, 255, 0, 0.3)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(playerScreen.x + TILE_SIZE / 2, playerScreen.y + TILE_SIZE / 2);
        ctx.lineTo(screen.x + TILE_SIZE / 2, screen.y + TILE_SIZE / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Hint
        ctx.fillStyle = '#ffcc00';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Select target [Arrows/WASD] [Enter] to confirm [Esc] to cancel',
            this.renderer.width / 2, this.renderer.height - 20);
    }

    // === INPUT HANDLING ===

    _onKeyDown(e) {
        this.keysDown[e.key] = true;

        switch (this.state) {
            case GAME_STATE.MENU:
                this._handleMenuInput(e);
                break;
            case GAME_STATE.MP_MENU:
                this._handleMpMenuInput(e);
                break;
            case GAME_STATE.LOBBY:
                this._handleLobbyInput(e);
                break;
            case GAME_STATE.PLAYING:
                this._handlePlayingInput(e);
                break;
            case GAME_STATE.INVENTORY:
                this._handleInventoryInput(e);
                break;
            case GAME_STATE.CHARACTER:
                this._handleCharacterInput(e);
                break;
            case GAME_STATE.LEVEL_UP:
                this._handleLevelUpInput(e);
                break;
            case GAME_STATE.SHOP:
                this._handleShopInput(e);
                break;
            case GAME_STATE.NPC_DIALOGUE:
                this._handleNPCDialogueInput(e);
                break;
            case GAME_STATE.TARGETING:
                this._handleTargetingInput(e);
                break;
            case GAME_STATE.GAME_OVER:
            case GAME_STATE.VICTORY:
                if (e.key === 'Enter') {
                    if (this.isMultiplayer) {
                        this.network.disconnect();
                        this.isMultiplayer = false;
                        this.otherPlayers = {};
                    }
                    this.state = GAME_STATE.MENU;
                    this.menuSelection = 0;
                }
                break;
        }
    }

    _onKeyUp(e) {
        this.keysDown[e.key] = false;
    }

    _onClick(e) {
        // Initialize audio context on click
        this.audio.resume();

        if (this.state === GAME_STATE.TARGETING) {
            this._confirmTargeting();
        }
    }

    _handleMenuInput(e) {
        switch (e.key) {
            case 'ArrowLeft':
            case 'a':
                this.menuSelection = Math.max(0, this.menuSelection - 1);
                break;
            case 'ArrowRight':
            case 'd':
                this.menuSelection = Math.min(Object.keys(CLASS).length - 1, this.menuSelection + 1);
                break;
            case 'Enter':
                this._startGame(Object.values(CLASS)[this.menuSelection]);
                break;
            case 'm': case 'M':
                this.state = GAME_STATE.MP_MENU;
                this.mpClassSelection = 0;
                this.mpError = null;
                this.mpConnecting = false;
                break;
        }
    }

    // === MULTIPLAYER MENU ===

    _handleMpMenuInput(e) {
        switch (e.key) {
            case 'Escape':
                this.state = GAME_STATE.MENU;
                break;
            case 'ArrowLeft':
                this.mpClassSelection = Math.max(0, this.mpClassSelection - 1);
                break;
            case 'ArrowRight':
                this.mpClassSelection = Math.min(Object.keys(CLASS).length - 1, this.mpClassSelection + 1);
                break;
            case 'Backspace':
                this.serverAddress = this.serverAddress.slice(0, -1);
                break;
            case 'Enter':
                if (!this.mpConnecting) {
                    this._connectToServer();
                }
                break;
            default:
                // Type server address
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                    this.serverAddress += e.key;
                }
                break;
        }
    }

    _handleLobbyInput(e) {
        switch (e.key) {
            case 'Escape':
                this.network.disconnect();
                this.isMultiplayer = false;
                this.state = GAME_STATE.MENU;
                break;
            case 'ArrowLeft':
                this.mpClassSelection = Math.max(0, this.mpClassSelection - 1);
                this.network.send({ type: 'change_class', classId: Object.values(CLASS)[this.mpClassSelection] });
                break;
            case 'ArrowRight':
                this.mpClassSelection = Math.min(Object.keys(CLASS).length - 1, this.mpClassSelection + 1);
                this.network.send({ type: 'change_class', classId: Object.values(CLASS)[this.mpClassSelection] });
                break;
            case 'Enter':
                if (this.network.isHost) {
                    this.network.send({ type: 'start_game' });
                }
                break;
        }
    }

    async _connectToServer() {
        this.mpConnecting = true;
        this.mpError = null;

        try {
            const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
            const url = `${wsProtocol}://${this.serverAddress}`;
            await this.network.connect(url);

            this.network.onMessage((msg) => this._handleServerMessage(msg));

            const classId = Object.values(CLASS)[this.mpClassSelection];
            this.network.send({ type: 'join', classId, name: this.mpPlayerName || 'Player' });
        } catch (e) {
            this.mpError = 'Connection failed. Is the server running?';
            this.mpConnecting = false;
        }
    }

    // === SERVER MESSAGE HANDLING ===

    _handleServerMessage(msg) {
        switch (msg.type) {
            case 'welcome':
                this.myPlayerId = msg.playerId;
                this.network.isHost = msg.isHost;
                this.state = GAME_STATE.LOBBY;
                this.isMultiplayer = true;
                this.mpConnecting = false;
                break;

            case 'lobby_update':
                this.lobbyPlayers = msg.players;
                break;

            case 'game_start':
                this._startMultiplayerGame(msg);
                break;

            case 'action_result':
                this._applyActionResult(msg);
                break;

            case 'your_state':
                this._applyPrivateState(msg.state);
                break;

            case 'floor_change':
                this._applyFloorChange(msg);
                break;

            case 'waiting_at_stairs':
                this.ui.addMessage(`${msg.playerName} is at the stairs (${msg.readyCount}/${msg.totalCount})`, '#66ccff');
                break;

            case 'player_joined':
                this.ui.addMessage(`A player joined the game.`, '#44cc44');
                break;

            case 'player_left':
                this.ui.addMessage(`A player left the game.`, '#cc4444');
                // Remove from otherPlayers
                delete this.otherPlayers[msg.playerId];
                break;

            case 'victory':
                this.state = GAME_STATE.VICTORY;
                this.audio.playVictory();
                this.audio.stopAmbient();
                break;

            case 'game_over':
                this.state = GAME_STATE.GAME_OVER;
                this.audio.playDeath();
                this.audio.stopAmbient();
                break;

            case 'disconnected':
                if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.LOBBY) {
                    this.ui.addMessage('Disconnected from server.', '#cc4444');
                    this.isMultiplayer = false;
                    this.state = GAME_STATE.MENU;
                }
                break;

            case 'error':
                this.mpError = msg.text;
                break;
        }
    }

    _startMultiplayerGame(msg) {
        this.myPlayerId = msg.yourId;

        // Rebuild dungeon from server data
        this._rebuildDungeonFromData(msg.dungeon);
        this.fov.init(this.dungeon.width, this.dungeon.height);

        // Create items from server data
        this.items = msg.items;

        // Create enemies from server data
        this._rebuildEnemies(msg.enemies);

        // Find our player in the players list and create local player
        const myData = msg.players[this.myPlayerId];
        if (myData) {
            this.player = new Player(myData.classId);
            this.player.x = myData.x;
            this.player.y = myData.y;
            this.player.prevX = myData.prevX;
            this.player.prevY = myData.prevY;
            this.player.moveAnimT = 1;
            this.player.floor = msg.floor;
        }

        // Apply full private state
        if (msg.yourState) {
            this._applyPrivateState(msg.yourState);
        }

        // Store other players
        this.otherPlayers = {};
        for (const [id, pdata] of Object.entries(msg.players)) {
            if (id !== this.myPlayerId) {
                this.otherPlayers[id] = { ...pdata, moveAnimT: 1 };
            }
        }

        // FOV and camera
        this.fov.compute(this.player.x, this.player.y, this.player.visionRadius, this.dungeon);
        this.renderer.camX = this.player.x * TILE_SIZE - this.renderer.width / 2;
        this.renderer.camY = this.player.y * TILE_SIZE - this.renderer.height / 2;

        this.state = GAME_STATE.PLAYING;
        this.ui.addMessage('The dungeon awaits... cooperate to survive!', '#66ccff');
        this.ui.addMessage('Controls: WASD/Arrows=Move, G=Pickup, I=Inventory, 1-4=Abilities, E=Interact', COLORS.textSecondary);

        this.audio.init();
        this.audio.startAmbient();

        if (BOSS_FLOORS[msg.floor]) {
            const bossName = ENEMY_DATA[BOSS_FLOORS[msg.floor]].name;
            this.ui.addMessage(`You sense a powerful presence... ${bossName} lurks on this floor!`, '#ff4444');
            this.audio.playBossAlert();
        }
    }

    _applyActionResult(msg) {
        // Update enemy states
        if (msg.enemies) {
            this._updateEnemyStates(msg.enemies);
        }

        // Update item states
        if (msg.items) {
            this.items = msg.items;
        }

        // Update player positions (ours and others)
        if (msg.players) {
            for (const [id, pdata] of Object.entries(msg.players)) {
                if (id === this.myPlayerId && this.player) {
                    // Update our position if server moved us
                    const oldX = this.player.x;
                    const oldY = this.player.y;
                    if (pdata.x !== oldX || pdata.y !== oldY) {
                        this.player.prevX = oldX;
                        this.player.prevY = oldY;
                        this.player.x = pdata.x;
                        this.player.y = pdata.y;
                        this.player.moveAnimT = 0;
                        this.audio.playFootstep();
                    }
                    // Update vital stats from server
                    this.player.hp = pdata.hp;
                    this.player.maxHp = pdata.maxHp;
                    this.player.mp = pdata.mp;
                    this.player.maxMp = pdata.maxMp;
                    this.player.gold = pdata.gold;
                    this.player.level = pdata.level;
                    this.player.str = pdata.str;
                    this.player.def = pdata.def;
                    this.player.dex = pdata.dex;
                    this.player.int = pdata.int;
                    this.player.stealthTurns = pdata.stealthTurns;
                    this.player.invulnTurns = pdata.invulnTurns;
                    this.player.statusEffects = pdata.statusEffects || [];
                } else if (id !== this.myPlayerId) {
                    // Update other player
                    const existing = this.otherPlayers[id];
                    if (existing) {
                        if (pdata.x !== existing.x || pdata.y !== existing.y) {
                            existing.prevX = existing.x;
                            existing.prevY = existing.y;
                            existing.moveAnimT = 0;
                        }
                        Object.assign(existing, pdata);
                    } else {
                        this.otherPlayers[id] = { ...pdata, moveAnimT: 1 };
                    }
                }
            }
        }

        // Process results (combat effects, messages, animations)
        if (msg.results && msg.results.length > 0) {
            this._processResults(msg.results);
        }

        // Update FOV after position change
        if (this.player && this.dungeon) {
            this.fov.compute(this.player.x, this.player.y, this.player.visionRadius, this.dungeon);
        }

        // Handle tile changes
        if (msg.tileChanges) {
            for (const tc of msg.tileChanges) {
                this.dungeon.setTile(tc.x, tc.y, tc.newTile);
            }
        }

        // Check our death
        if (this.player && !this.player.isAlive()) {
            // Don't switch to game over - in MP, we spectate
            this.ui.addMessage('You have fallen! Spectating...', '#cc2222');
            this.audio.playDeath();
        }

        // Check for pending level ups
        if (this.player && this.player.pendingLevelUpChoices > 0 && this.state === GAME_STATE.PLAYING) {
            this.player.generateLevelUpChoices();
            this.state = GAME_STATE.LEVEL_UP;
            this.ui.levelUpSelection = 0;
        }
    }

    _applyPrivateState(state) {
        if (!this.player || !state) return;

        this.player.hp = state.hp;
        this.player.maxHp = state.maxHp;
        this.player.mp = state.mp;
        this.player.maxMp = state.maxMp;
        this.player.str = state.str;
        this.player.def = state.def;
        this.player.dex = state.dex;
        this.player.int = state.int;
        this.player.baseStr = state.baseStr;
        this.player.baseDef = state.baseDef;
        this.player.baseDex = state.baseDex;
        this.player.baseInt = state.baseInt;
        this.player.level = state.level;
        this.player.xp = state.xp;
        this.player.xpToNext = state.xpToNext;
        this.player.gold = state.gold;
        this.player.hunger = state.hunger;
        this.player.floor = state.floor;
        this.player.stealthTurns = state.stealthTurns;
        this.player.invulnTurns = state.invulnTurns;
        this.player.pendingStatPoints = state.pendingStatPoints;
        this.player.statusEffects = state.statusEffects || [];
        this.player.visionRadius = state.visionRadius;
        if (state.stats) this.player.stats = state.stats;

        // Update abilities
        if (state.abilities) {
            for (let i = 0; i < state.abilities.length && i < this.player.abilities.length; i++) {
                this.player.abilities[i].currentCooldown = state.abilities[i].currentCooldown;
            }
        }

        // Update inventory from server
        if (state.inventory) {
            this.player.inventory = state.inventory;
        }
        if (state.equipment) {
            this.player.equipment = {};
            for (const [slot, item] of Object.entries(state.equipment)) {
                this.player.equipment[slot] = item;
            }
        }
    }

    _applyFloorChange(msg) {
        this._rebuildDungeonFromData(msg.dungeon);
        this.fov.init(this.dungeon.width, this.dungeon.height);
        this._rebuildEnemies(msg.enemies);
        this.items = Array.isArray(msg.items) ? msg.items : [];

        // Update players
        if (msg.players) {
            const myData = msg.players[this.myPlayerId];
            if (myData && this.player) {
                this.player.x = myData.x;
                this.player.y = myData.y;
                this.player.prevX = myData.x;
                this.player.prevY = myData.y;
                this.player.moveAnimT = 1;
                this.player.floor = msg.floor;
            }
            this.otherPlayers = {};
            for (const [id, pdata] of Object.entries(msg.players)) {
                if (id !== this.myPlayerId) {
                    this.otherPlayers[id] = { ...pdata, moveAnimT: 1 };
                }
            }
        }

        if (msg.yourState) {
            this._applyPrivateState(msg.yourState);
        }

        this.fov.compute(this.player.x, this.player.y, this.player.visionRadius, this.dungeon);
        this.renderer.camX = this.player.x * TILE_SIZE - this.renderer.width / 2;
        this.renderer.camY = this.player.y * TILE_SIZE - this.renderer.height / 2;

        this.ui.addMessage(`Descended to floor ${msg.floor}...`, '#66ccff');
        this.audio.playStairs();

        if (BOSS_FLOORS[msg.floor]) {
            const bossName = ENEMY_DATA[BOSS_FLOORS[msg.floor]].name;
            this.ui.addMessage(`You sense a powerful presence... ${bossName} lurks on this floor!`, '#ff4444');
            this.audio.playBossAlert();
        }
    }

    _rebuildDungeonFromData(data) {
        this.dungeon = new Dungeon(data.width, data.height, data.floor);
        this.dungeon.tiles = data.tiles;
        this.dungeon.rooms = data.rooms;
        this.dungeon.stairsUp = data.stairsUp;
        this.dungeon.stairsDown = data.stairsDown;
        this.dungeon.spawnPoint = data.spawnPoint;
        this.dungeon.specialRooms = data.specialRooms;
    }

    _rebuildEnemies(enemyData) {
        if (!Array.isArray(enemyData)) { this.enemies = []; return; }
        this.enemies = enemyData.map((e, i) => {
            // Create a lightweight enemy-like object for rendering
            return {
                idx: e.idx != null ? e.idx : i,
                type: e.type,
                name: e.name,
                color: e.color,
                boss: e.boss,
                behavior: e.behavior,
                x: e.x, y: e.y,
                prevX: e.prevX, prevY: e.prevY,
                moveAnimT: e.moveAnimT !== undefined ? e.moveAnimT : 1,
                hp: e.hp, maxHp: e.maxHp,
                str: e.str, def: e.def,
                isDead: e.isDead,
                deathTimer: e.deathTimer,
                flashTimer: e.flashTimer,
                alerted: e.alerted,
                statusEffects: e.statusEffects || [],
                description: e.description,
                symbol: ENEMY_DATA[e.type] ? ENEMY_DATA[e.type].symbol : '?',
                hasStatus: function(s) { return this.statusEffects.some(eff => eff.type === s); },
            };
        });
    }

    _updateEnemyStates(serverEnemies) {
        if (!Array.isArray(serverEnemies)) return;

        for (const se of serverEnemies) {
            // Match by idx (server-assigned index)
            const le = (se.idx != null && se.idx < this.enemies.length) ? this.enemies[se.idx] : null;
            if (!le) continue;

            // Check if enemy moved
            if (se.x !== le.x || se.y !== le.y) {
                le.prevX = le.x;
                le.prevY = le.y;
                le.moveAnimT = 0;
            }

            le.x = se.x;
            le.y = se.y;
            le.hp = se.hp;
            le.maxHp = se.maxHp;
            le.isDead = se.isDead;
            le.deathTimer = se.deathTimer;
            le.flashTimer = se.flashTimer;
            le.alerted = se.alerted;
            le.statusEffects = se.statusEffects || [];
        }
    }

    // === PLAYING INPUT (with multiplayer routing) ===

    _handlePlayingInput(e) {
        if (this.animating) return;

        // Prevent arrow keys, space, and tab from scrolling/switching
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(e.key)) {
            e.preventDefault();
        }

        // Cancel auto-explore on any input
        this.autoExploring = false;
        this.autoExplorePath = null;

        let dx = 0, dy = 0;

        switch (e.key) {
            // Movement
            case 'ArrowUp': case 'w': dy = -1; break;
            case 'ArrowDown': case 's': dy = 1; break;
            case 'ArrowLeft': case 'a': dx = -1; break;
            case 'ArrowRight': case 'd': dx = 1; break;

            // Wait
            case ' ':
                if (this.isMultiplayer) {
                    this.network.send({ type: 'wait' });
                } else {
                    this._processTurn();
                    this.ui.addMessage('You wait...', COLORS.textSecondary);
                }
                return;

            // Abilities
            case '1': case '2': case '3': case '4':
                this._handleAbility(parseInt(e.key) - 1);
                return;

            // Inventory
            case 'i': case 'I':
                this.state = GAME_STATE.INVENTORY;
                this.ui.selectedInventoryIndex = 0;
                this.ui.inventoryTab = 'items';
                return;

            // Character sheet
            case 'c': case 'C':
                this.state = GAME_STATE.CHARACTER;
                return;

            // Pickup
            case 'g': case 'G':
                if (this.isMultiplayer) {
                    this.network.send({ type: 'pickup' });
                } else {
                    this._pickupItem();
                }
                return;

            // Use stairs / interact
            case 'e': case 'E':
                if (this.isMultiplayer) {
                    this.network.send({ type: 'interact' });
                } else {
                    this._interact();
                }
                return;

            // Auto-explore (singleplayer only)
            case 'Tab':
                if (!this.isMultiplayer) {
                    this._startAutoExplore();
                }
                return;

            // Toggle minimap
            case 'm': case 'M':
                this.showMinimap = !this.showMinimap;
                return;

            // Help
            case '?': case '/':
                this.ui.addMessage('Controls: WASD/Arrows=Move | Space=Wait | 1-4=Abilities | I=Inventory | C=Stats | G=Pickup | E=Interact | Tab=Explore', COLORS.textSecondary);
                return;

            // Volume
            case '-':
                this.audio.setVolume(this.audio.volume - 0.1);
                this.ui.addMessage(`Volume: ${Math.round(this.audio.volume * 100)}%`);
                return;
            case '=':
                this.audio.setVolume(this.audio.volume + 0.1);
                this.ui.addMessage(`Volume: ${Math.round(this.audio.volume * 100)}%`);
                return;

            default:
                return;
        }

        if (dx !== 0 || dy !== 0) {
            if (this.isMultiplayer) {
                this.network.send({ type: 'move', dx, dy });
            } else {
                this._handleMovement(dx, dy);
            }
        }
    }

    _handleInventoryInput(e) {
        const player = this.player;
        switch (e.key) {
            case 'i': case 'I': case 'Escape':
                this.state = GAME_STATE.PLAYING;
                break;
            case 'Tab':
                e.preventDefault();
                this.ui.inventoryTab = this.ui.inventoryTab === 'items' ? 'equip' : 'items';
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (this.ui.inventoryTab === 'items' && player.inventory.length > 0) {
                    this.ui.selectedInventoryIndex = Math.max(0, this.ui.selectedInventoryIndex - 1);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (this.ui.inventoryTab === 'items' && player.inventory.length > 0) {
                    this.ui.selectedInventoryIndex = Math.min(player.inventory.length - 1, this.ui.selectedInventoryIndex + 1);
                }
                break;
            case 'e': case 'E': { // Equip
                const item = player.inventory[this.ui.selectedInventoryIndex];
                if (item && item.slot) {
                    if (this.isMultiplayer) {
                        this.network.send({ type: 'equip', itemIndex: this.ui.selectedInventoryIndex });
                    } else {
                        player.equip(item);
                    }
                    this.ui.addMessage(`Equipped ${item.name}.`, getItemColor(item));
                    this.audio.playPickup();
                    if (this.ui.selectedInventoryIndex >= player.inventory.length) {
                        this.ui.selectedInventoryIndex = Math.max(0, player.inventory.length - 1);
                    }
                } else if (item) {
                    this.ui.addMessage('Cannot equip that item.', COLORS.textSecondary);
                }
                break;
            }
            case 'u': case 'U': { // Use
                const item = player.inventory[this.ui.selectedInventoryIndex];
                if (item && item.consumable) {
                    if (this.isMultiplayer) {
                        this.network.send({ type: 'use_item', itemIndex: this.ui.selectedInventoryIndex });
                    } else {
                        if (item.type === ITEM_TYPE.SCROLL) {
                            this._useScroll(item);
                        } else {
                            player.useItem(item);
                            this.ui.addMessage(`Used ${item.name}.`, getItemColor(item));
                            if (item.type === ITEM_TYPE.POTION_HP || item.type === ITEM_TYPE.POTION_MP) {
                                this.audio.playPotion();
                            }
                        }
                    }
                    if (this.ui.selectedInventoryIndex >= player.inventory.length) {
                        this.ui.selectedInventoryIndex = Math.max(0, player.inventory.length - 1);
                    }
                }
                break;
            }
            case 'd': case 'D': { // Drop
                const item = player.inventory[this.ui.selectedInventoryIndex];
                if (item) {
                    if (this.isMultiplayer) {
                        this.network.send({ type: 'drop_item', itemIndex: this.ui.selectedInventoryIndex });
                    } else {
                        player.dropItem(item);
                        item.x = player.x;
                        item.y = player.y;
                        this.items.push(item);
                    }
                    this.ui.addMessage(`Dropped ${item.name}.`, COLORS.textSecondary);
                    if (this.ui.selectedInventoryIndex >= player.inventory.length) {
                        this.ui.selectedInventoryIndex = Math.max(0, player.inventory.length - 1);
                    }
                }
                break;
            }
        }
    }

    _handleCharacterInput(e) {
        if (e.key === 'c' || e.key === 'C' || e.key === 'Escape') {
            this.state = GAME_STATE.PLAYING;
        }
    }

    _handleLevelUpInput(e) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();

        // Generate choices if not yet generated
        if (this.player.levelUpChoices.length === 0 && this.player.pendingLevelUpChoices > 0) {
            this.player.generateLevelUpChoices();
        }

        const maxIdx = Math.max(0, this.player.levelUpChoices.length - 1);

        switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                this.ui.levelUpSelection = Math.max(0, this.ui.levelUpSelection - 1);
                break;
            case 'ArrowRight':
            case 'ArrowDown':
                this.ui.levelUpSelection = Math.min(maxIdx, this.ui.levelUpSelection + 1);
                break;
            case 'Enter': {
                const choice = this.player.levelUpChoices[this.ui.levelUpSelection];
                if (!choice) break;

                if (this.player.applyLevelUpChoice(this.ui.levelUpSelection)) {
                    // Announce the choice
                    let msg = '';
                    switch (choice.type) {
                        case 'stat': msg = `${choice.data.name}!`; break;
                        case 'perk': msg = `Perk: ${choice.data.name}!`; break;
                        case 'ability': msg = `${choice.data.abilityName} upgraded to ${choice.data.name}!`; break;
                    }
                    this.ui.addMessage(msg, '#ffcc00');
                    this.ui.levelUpSelection = 0;
                    this.player.pendingStatPoints--;

                    if (this.player.pendingLevelUpChoices > 0) {
                        // More levels to allocate
                        this.player.generateLevelUpChoices();
                    } else {
                        this.state = GAME_STATE.PLAYING;
                    }
                }
                break;
            }
        }
    }

    _handleShopInput(e) {
        const shopItems = this.items.filter(item =>
            item.isShopItem && chebyshevDist(this.player.x, this.player.y, item.x, item.y) <= 3
        );

        // Close shop if no items remain
        if (shopItems.length === 0 && e.key !== 'Escape') {
            this.state = GAME_STATE.PLAYING;
            return;
        }

        switch (e.key) {
            case 'Escape':
                this.state = GAME_STATE.PLAYING;
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (shopItems.length > 0) {
                    this.ui.shopSelection = Math.max(0, this.ui.shopSelection - 1);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (shopItems.length > 0) {
                    this.ui.shopSelection = Math.min(shopItems.length - 1, this.ui.shopSelection + 1);
                }
                break;
            case 'Enter': {
                const item = shopItems[this.ui.shopSelection];
                if (item) {
                    if (this.isMultiplayer) {
                        this.network.send({ type: 'buy_item', itemId: item.id });
                    } else {
                        if (this.player.gold >= item.shopPrice) {
                            if (this.player.inventory.length >= MAX_INVENTORY_SIZE) {
                                this.ui.addMessage('Inventory is full!', COLORS.textDamage);
                            } else {
                                this.player.gold -= item.shopPrice;
                                item.isShopItem = false;
                                const idx = this.items.indexOf(item);
                                if (idx !== -1) this.items.splice(idx, 1);
                                this.player.addToInventory(item);
                                this.ui.addMessage(`Bought ${item.name} for ${item.shopPrice}g.`, COLORS.textGold);
                                this.audio.playShopBuy();
                                if (this.ui.shopSelection >= shopItems.length - 1) {
                                    this.ui.shopSelection = Math.max(0, this.ui.shopSelection - 1);
                                }
                            }
                        } else {
                            this.ui.addMessage('Not enough gold!', COLORS.textDamage);
                        }
                    }
                }
                break;
            }
        }
    }

    _handleNPCDialogueInput(e) {
        if (!this.activeNPC) {
            this.state = GAME_STATE.PLAYING;
            return;
        }

        const options = this.ui._getNPCOptions(this, this.activeNPC);

        switch (e.key) {
            case 'Escape':
                this.activeNPC = null;
                this.state = GAME_STATE.PLAYING;
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.npcDialogueSelection = Math.max(0, this.npcDialogueSelection - 1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.npcDialogueSelection = Math.min(options.length - 1, this.npcDialogueSelection + 1);
                break;
            case 'Enter': {
                const selected = options[this.npcDialogueSelection];
                if (!selected) break;
                if (selected.action === 'leave') {
                    this.activeNPC = null;
                    this.state = GAME_STATE.PLAYING;
                } else {
                    this._handleNPCAction(this.activeNPC, selected);
                }
                break;
            }
        }
    }

    _handleNPCAction(npc, option) {
        const npcData = NPC_DATA[npc.npcType];

        switch (option.action) {
            case 'trade': {
                // Generate merchant items and open shop
                const merchantItems = [];
                const numItems = rng.int(3, 5);
                for (let i = 0; i < numItems; i++) {
                    const rarity = rng.chance(0.3) ? RARITY.RARE : RARITY.UNCOMMON;
                    const item = generateItem(this.player.floor, rarity);
                    item.isShopItem = true;
                    item.shopPrice = Math.floor((10 + this.player.floor * 5) * getRarityMultiplier(item.rarity) * 1.5);
                    item.x = npc.x;
                    item.y = npc.y;
                    merchantItems.push(item);
                }
                this.items.push(...merchantItems);
                npc.interacted = true;
                this.activeNPC = null;
                this.state = GAME_STATE.SHOP;
                this.ui.shopSelection = 0;
                this.ui.addMessage('The merchant displays rare wares...', npc.color);
                break;
            }

            case 'buff': {
                const buff = option.data;
                if (buff.special === 'reveal_enemies') {
                    // Reveal all enemies on FOV
                    for (const enemy of this.enemies) {
                        if (!enemy.isDead) {
                            this.fov.fogMap[enemy.y][enemy.x] = FOG.VISIBLE;
                        }
                    }
                    this.ui.addMessage('The sage reveals the positions of your foes!', '#8888ff');
                } else if (buff.special === 'full_heal') {
                    this.player.hp = this.player.maxHp;
                    this.player.mp = this.player.maxMp;
                    this.ui.addMessage('Warmth floods through you. Fully restored!', COLORS.textHeal);
                    this.renderer.spawnPresetParticles(this.player.x, this.player.y, 'HEAL', COLORS.textHeal);
                } else {
                    this.player.addStatus(buff.effect, buff.duration);
                    this.ui.addMessage(`The sage grants you ${buff.name}! ${buff.text}`, '#8888ff');
                }
                npc.interacted = true;
                this.activeNPC = null;
                this.state = GAME_STATE.PLAYING;
                this.renderer.spawnParticles(npc.x, npc.y, 10, npc.color, 50, 0.6, { shape: 'circle', gravity: -30 });
                break;
            }

            case 'quest_food': {
                if (this.player.hunger < 30) {
                    this.ui.addMessage('You don\'t have enough energy to spare.', COLORS.textDamage);
                    return;
                }
                this.player.hunger -= 30;
                npc.interacted = true;
                // Give a rare item reward
                const reward = generateItem(this.player.floor + 2, RARITY.RARE);
                if (this.player.addToInventory(reward)) {
                    this.ui.addMessage(`The adventurer thanks you and gives you ${reward.name}!`, '#cc8844');
                } else {
                    reward.x = npc.x;
                    reward.y = npc.y;
                    this.items.push(reward);
                    this.ui.addMessage(`The adventurer drops ${reward.name} at your feet.`, '#cc8844');
                }
                // Reveal map partially
                for (let y = 0; y < this.dungeon.height; y++) {
                    for (let x = 0; x < this.dungeon.width; x++) {
                        if (this.dungeon.isWalkable(x, y) && this.fov.getFog(x, y) === FOG.UNEXPLORED) {
                            if (rng.chance(0.4)) {
                                this.fov.fogMap[y][x] = FOG.EXPLORED;
                            }
                        }
                    }
                }
                this.ui.addMessage('The adventurer shares knowledge of the dungeon layout.', COLORS.textSecondary);
                this.activeNPC = null;
                this.state = GAME_STATE.PLAYING;
                break;
            }

            case 'gamble': {
                const cost = option.data;
                if (this.player.gold < cost) {
                    this.ui.addMessage('You don\'t have enough gold!', COLORS.textDamage);
                    return;
                }
                this.player.gold -= cost;
                npc.interacted = true;

                // Random outcome: 30% curse, 40% buff, 30% epic item
                const roll = rng.float();
                if (roll < 0.3) {
                    // Curse — lose some HP
                    const hpLoss = Math.floor(this.player.maxHp * 0.15);
                    this.player.hp = Math.max(1, this.player.hp - hpLoss);
                    this.ui.addMessage(`The shrine drains your vitality! -${hpLoss} HP!`, '#cc2222');
                    this.renderer.shake(SHAKE.PLAYER_HIT);
                    this.renderer.spawnPresetParticles(this.player.x, this.player.y, 'BLOOD', '#cc2222');
                } else if (roll < 0.7) {
                    // Powerful buff
                    this.player.addStatus(STATUS.BUFF_STR, 100);
                    this.player.addStatus(STATUS.BUFF_DEF, 100);
                    this.ui.addMessage('The shrine blesses you with great power!', '#ffdd88');
                    this.renderer.spawnParticles(npc.x, npc.y, 15, '#ffdd88', 60, 0.8, { shape: 'circle', gravity: -40 });
                } else {
                    // Epic item
                    const epicItem = generateItem(this.player.floor + 3, RARITY.EPIC);
                    if (this.player.addToInventory(epicItem)) {
                        this.ui.addMessage(`The shrine conjures ${epicItem.name}!`, RARITY_COLORS[RARITY.EPIC]);
                    } else {
                        epicItem.x = npc.x;
                        epicItem.y = npc.y;
                        this.items.push(epicItem);
                        this.ui.addMessage(`${epicItem.name} materializes at the shrine!`, RARITY_COLORS[RARITY.EPIC]);
                    }
                    this.renderer.spawnParticles(npc.x, npc.y, 20, '#aa44dd', 80, 1.0, { shape: 'spark', gravity: -20 });
                }
                this.activeNPC = null;
                this.state = GAME_STATE.PLAYING;
                break;
            }

            case 'lore': {
                // Give lore text + permanent +1 random stat
                const entries = npcData.loreEntries || [];
                const lore = entries.length > 0 ? rng.pick(entries) : 'The chronicler murmurs unintelligibly.';
                this.ui.addMessage(`"${lore}"`, '#aaccff');

                // Permanent +1 to random stat
                const statKeys = ['str', 'def', 'dex', 'int'];
                const stat = rng.pick(statKeys);
                this.player[stat]++;
                this.player['base' + stat.charAt(0).toUpperCase() + stat.slice(1)]++;
                this.ui.addMessage(`The knowledge empowers you. +1 ${stat.toUpperCase()}!`, '#aaccff');
                this.renderer.spawnParticles(this.player.x, this.player.y, 8, '#aaccff', 40, 0.6, { shape: 'circle', gravity: -30 });

                npc.interacted = true;
                this.activeNPC = null;
                this.state = GAME_STATE.PLAYING;
                break;
            }

            default:
                this.activeNPC = null;
                this.state = GAME_STATE.PLAYING;
                break;
        }
    }

    _handleTargetingInput(e) {
        // Prevent arrow keys from scrolling
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }

        switch (e.key) {
            case 'ArrowUp': case 'w': this.targetY--; break;
            case 'ArrowDown': case 's': this.targetY++; break;
            case 'ArrowLeft': case 'a': this.targetX--; break;
            case 'ArrowRight': case 'd': this.targetX++; break;
            case 'Enter':
                this._confirmTargeting();
                break;
            case 'Escape':
                this.state = GAME_STATE.PLAYING;
                this.targetingAbility = -1;
                break;
        }
    }

    // === GAME LOGIC (singleplayer) ===

    _startGame(classId) {
        this.isMultiplayer = false;
        this.player = new Player(classId);
        this.player.floor = 1;

        // Generate first dungeon floor
        this._generateFloor(1);

        this.state = GAME_STATE.PLAYING;
        this.ui.addMessage(`You enter the Depths of Valrath as a ${CLASS_DATA[classId].name}.`, CLASS_DATA[classId].color);
        this.ui.addMessage('Find the stairs down to descend deeper. Defeat Valrath on floor 10 to win!', COLORS.textSecondary);
        this.ui.addMessage('Controls: WASD/Arrows=Move, G=Pickup, I=Inventory, 1-4=Abilities, E=Interact', COLORS.textSecondary);

        this.audio.init();
        this.audio.startAmbient();
    }

    _generateFloor(floorNum) {
        this.dungeon = new Dungeon(MAP_WIDTH, MAP_HEIGHT, floorNum);
        this.dungeon.generate();

        // Initialize biome visuals for this floor
        const biome = getBiome(floorNum);
        this.renderer.sprites.initBiome(biome);
        this.renderer.setBiome(biome);

        this.fov.init(MAP_WIDTH, MAP_HEIGHT);

        // Spawn enemies and items
        this.enemies = spawnEnemies(this.dungeon);
        this.items = spawnItems(this.dungeon);

        // Spawn NPCs
        this.npcs = [];
        for (const [npcKey, npcData] of Object.entries(NPC_DATA)) {
            if (npcData.spawnFloors.includes(floorNum) && rng.chance(npcData.spawnChance)) {
                // Find a room for this NPC (not spawn room, boss room, or shop)
                const validRooms = this.dungeon.rooms.filter((r, i) => i > 0 &&
                    r !== this.dungeon.specialRooms.boss &&
                    r !== this.dungeon.specialRooms.shop);
                if (validRooms.length > 0) {
                    const room = rng.pick(validRooms);
                    const pos = this.dungeon.getRandomPosInRoom(room);
                    // Don't stack on enemies
                    if (!this.enemies.some(e => e.x === pos.x && e.y === pos.y)) {
                        this.npcs.push(new NPC(npcKey, pos.x, pos.y));
                    }
                }
            }
        }

        // Place player at spawn
        this.player.x = this.dungeon.spawnPoint.x;
        this.player.y = this.dungeon.spawnPoint.y;
        this.player.prevX = this.player.x;
        this.player.prevY = this.player.y;
        this.player.moveAnimT = 1;
        this.player.floor = floorNum;

        // Update FOV
        this.fov.compute(this.player.x, this.player.y, this.player.visionRadius, this.dungeon);

        // Center camera immediately
        this.renderer.camX = this.player.x * TILE_SIZE - this.renderer.width / 2;
        this.renderer.camY = this.player.y * TILE_SIZE - this.renderer.height / 2;

        // Biome transition messages
        const prevBiome = floorNum > 1 ? getBiome(floorNum - 1) : null;
        if (prevBiome && prevBiome !== biome) {
            this.ui.addMessage(`You descend into ${biome.name}...`, biome.dustColor);
        }

        // Boss floor alert
        if (BOSS_FLOORS[floorNum]) {
            const bossName = ENEMY_DATA[BOSS_FLOORS[floorNum]].name;
            this.ui.addMessage(`You sense a powerful presence... ${bossName} lurks on this floor!`, '#ff4444');
            this.audio.playBossAlert();
        }
    }

    _handleMovement(dx, dy) {
        const newX = this.player.x + dx;
        const newY = this.player.y + dy;

        // Check if there's an enemy at the target position
        const enemy = this.enemies.find(e => !e.isDead && e.x === newX && e.y === newY);
        if (enemy) {
            // Attack!
            this._playerAttack(enemy);
            return;
        }

        // Check for interactive objects that block movement
        const tile = this.dungeon.getTile(newX, newY);
        if (tile === TILE.BARREL || tile === TILE.CRATE) {
            this._attackObject(newX, newY, tile);
            this._processTurn();
            return;
        }
        if (tile === TILE.LOCKED_DOOR) {
            this._tryUnlockDoor(newX, newY);
            return;
        }
        if (tile === TILE.CRACKED_WALL) {
            this._attackCrackedWall(newX, newY);
            this._processTurn();
            return;
        }

        // Check walkability
        if (!this.dungeon.isWalkable(newX, newY)) {
            return;
        }

        // Move player
        this.player.prevX = this.player.x;
        this.player.prevY = this.player.y;
        this.player.x = newX;
        this.player.y = newY;
        this.player.moveAnimT = 0;

        this.audio.playFootstep();

        // Check tile effects
        this._checkTileEffects();

        // Process turn
        this._processTurn();
    }

    _playerAttack(enemy) {
        const results = this.combat.playerAttackEnemy(this.player, enemy);
        this._processResults(results);

        if (results.some(r => r.isCrit)) {
            this.audio.playCriticalHit();
        } else if (results.some(r => r.type === 'hit')) {
            this.audio.playHit();
        }

        this._processTurn();
    }

    _handleAbility(index) {
        const ability = this.player.abilities[index];
        if (!ability) return;

        if (ability.currentCooldown > 0) {
            this.ui.addMessage(`${ability.name} is on cooldown (${ability.currentCooldown} turns).`, COLORS.textSecondary);
            return;
        }
        if (this.player.mp < ability.mpCost) {
            this.ui.addMessage(`Not enough MP for ${ability.name}. Need ${ability.mpCost} MP.`, COLORS.textSecondary);
            return;
        }

        // Abilities that need targeting
        const targetingAbilities = ['fireball', 'ice_lance'];
        if (targetingAbilities.includes(ability.type)) {
            this.state = GAME_STATE.TARGETING;
            this.targetingAbility = index;
            this.targetX = this.player.x;
            this.targetY = this.player.y;
            this.ui.addMessage(`Targeting ${ability.name}... Use arrows and Enter to confirm.`, '#ffcc00');
            return;
        }

        // Non-targeting abilities
        if (this.isMultiplayer) {
            this.network.send({ type: 'ability', index });
        } else {
            // Immediate abilities
            const results = this.combat.useAbility(this.player, index, 0, 0, this.dungeon, this.enemies);
            if (results.some(r => r.type === 'fail')) {
                for (const r of results) {
                    this.ui.addMessage(r.text, r.color || COLORS.textSecondary);
                }
                return;
            }

            this.audio.playSpellCast();
            this._processResults(results);
            this._processTurn();
        }
    }

    _confirmTargeting() {
        if (this.targetingAbility < 0) return;

        if (this.isMultiplayer) {
            this.network.send({
                type: 'ability',
                index: this.targetingAbility,
                targetX: this.targetX,
                targetY: this.targetY,
            });
            this.state = GAME_STATE.PLAYING;
            this.targetingAbility = -1;
        } else {
            const results = this.combat.useAbility(
                this.player, this.targetingAbility,
                this.targetX, this.targetY,
                this.dungeon, this.enemies
            );

            this.audio.playSpellCast();
            const ability = this.player.abilities[this.targetingAbility];
            if (ability && ability.type === 'fireball') this.audio.playFireball();
            if (ability && ability.type === 'ice_lance') this.audio.playIce();

            this._processResults(results);
            this.state = GAME_STATE.PLAYING;
            this.targetingAbility = -1;
            this._processTurn();
        }
    }

    _processResults(results) {
        for (const result of results) {
            switch (result.type) {
                case 'hit':
                case 'critical':
                    this.ui.addMessage(result.text, result.color);
                    if (result.targetX !== undefined) {
                        this.renderer.spawnFloatingText(result.targetX, result.targetY,
                            `-${result.damage}`, result.color, result.isCrit);
                        // Enhanced particles based on hit type
                        if (result.isCrit) {
                            this.renderer.spawnPresetParticles(result.targetX, result.targetY,
                                'CRIT_HIT', '#ffaa44');
                            this.renderer.flashScreen('#ffffff', 0.12);
                            this.renderer.shake(SHAKE.ENEMY_CRIT);
                        } else {
                            this.renderer.spawnPresetParticles(result.targetX, result.targetY,
                                'MELEE_HIT', result.color || '#cc2222');
                        }
                        // Slash arc from player to target on melee
                        if (result.targetX !== this.player.x || result.targetY !== this.player.y) {
                            this.renderer.spawnSlashArc(
                                this.player.x, this.player.y,
                                result.targetX, result.targetY,
                                result.isCrit ? '#ffcc44' : '#ffffff',
                                result.isCrit
                            );
                        }
                    }
                    break;

                case 'dodge':
                case 'block':
                case 'miss':
                case 'immune':
                    this.ui.addMessage(result.text, result.color);
                    this.audio.playMiss();
                    break;

                case 'kill':
                    this.ui.addMessage(result.text, result.color);
                    this.audio.playEnemyDeath();
                    if (result.targetX !== undefined) {
                        this.renderer.spawnPresetParticles(result.targetX, result.targetY,
                            'DEATH', result.enemyColor || '#cc4444');
                    }
                    break;

                case 'xp':
                    this.ui.addMessage(result.text, result.color);
                    if (result.targetX !== undefined) {
                        this.renderer.spawnFloatingText(result.targetX, result.targetY,
                            result.text, result.color);
                    }
                    break;

                case 'levelup':
                    this.ui.addMessage(result.text, result.color);
                    this.audio.playLevelUp();
                    this.renderer.spawnPresetParticles(this.player.x, this.player.y,
                        'GOLD', '#ffcc00');
                    this.renderer.spawnParticles(this.player.x, this.player.y,
                        20, '#ffcc00', 60, 1.0, { shape: 'circle', gravity: -30 });
                    this.renderer.shake(SHAKE.LEVEL_UP);
                    this.renderer.flashScreen('#ffff00', 0.2);
                    // Trigger level up choice screen
                    if (this.player.pendingLevelUpChoices > 0) {
                        this.player.generateLevelUpChoices();
                        this.state = GAME_STATE.LEVEL_UP;
                        this.ui.levelUpSelection = 0;
                    }
                    break;

                case 'heal':
                    this.ui.addMessage(result.text, result.color);
                    if (result.targetX !== undefined) {
                        this.renderer.spawnFloatingText(result.targetX, result.targetY,
                            `+${result.heal}`, COLORS.textHeal);
                        this.renderer.spawnPresetParticles(result.targetX, result.targetY,
                            'HEAL', COLORS.textHeal);
                    }
                    this.audio.playHeal();
                    break;

                case 'buff':
                case 'status':
                    this.ui.addMessage(result.text, result.color);
                    break;

                case 'backstab':
                    this.ui.addMessage(result.text, result.color);
                    break;

                case 'teleport':
                    this.ui.addMessage(result.text, result.color);
                    break;

                case 'screenshake':
                    this.renderer.shake(result.intensity);
                    break;

                case 'projectile':
                    this.renderer.spawnProjectile(result.fromX, result.fromY, result.toX, result.toY, result.color);
                    break;

                case 'explosion':
                    this.renderer.spawnExplosion(
                        result.x || result.targetX, result.y || result.targetY,
                        result.radius, result.color
                    );
                    this.ui.addMessage(result.text, result.color);
                    break;

                case 'split': {
                    this.ui.addMessage(result.text, result.color);
                    // Spawn a weaker copy near death position
                    for (const dir of ALL_DIRS) {
                        const nx = result.sourceX + dir.x;
                        const ny = result.sourceY + dir.y;
                        if (this.dungeon.isWalkable(nx, ny) &&
                            !this.enemies.some(e => !e.isDead && e.x === nx && e.y === ny)) {
                            const copy = new Enemy(result.sourceType, nx, ny, result.sourceFloor);
                            copy.maxHp = Math.floor(copy.maxHp * 0.5);
                            copy.hp = copy.maxHp;
                            copy.str = Math.floor(copy.str * 0.7);
                            copy.xp = Math.floor(copy.xp * 0.5);
                            copy.alerted = true;
                            copy.alertTimer = 10;
                            copy.lastKnownPlayerX = this.player.x;
                            copy.lastKnownPlayerY = this.player.y;
                            this.enemies.push(copy);
                            this.renderer.spawnParticles(nx, ny, 8, '#44cc88', 50, 0.5);
                            break;
                        }
                    }
                    break;
                }

                case 'heal_enemy':
                    this.ui.addMessage(result.text, result.color);
                    break;

                case 'consecrate_effect':
                    this.renderer.spawnParticles(result.x, result.y, 20, '#ffdd44', 50, 0.8);
                    break;

                case 'fail':
                    this.ui.addMessage(result.text, COLORS.textSecondary);
                    break;
            }
        }

        // Check player hit (for sounds)
        if (this.player && results.some(r => r.type === 'hit' && r.targetX === this.player.x && r.targetY === this.player.y)) {
            this.audio.playPlayerHit();
        }
    }

    _processTurn() {
        // Player turn effects
        this.player.processTurn();

        // Check player death
        if (!this.player.isAlive()) {
            this.state = GAME_STATE.GAME_OVER;
            this.audio.playDeath();
            this.audio.stopAmbient();
            return;
        }

        // Hunger warnings
        if (this.player.hunger <= HUNGER_DAMAGE_THRESHOLD && this.player.stats.turnsPlayed % 10 === 0) {
            this.ui.addMessage('You are starving! Find food!', '#cc2222');
        } else if (this.player.hunger <= HUNGER_WARNING_THRESHOLD && this.player.stats.turnsPlayed % 20 === 0) {
            this.ui.addMessage('You are getting hungry...', COLORS.hungerBar);
        }

        // Enemy turns
        for (const enemy of this.enemies) {
            if (enemy.isDead) continue;

            enemy.processTurn();
            if (enemy.isDead) {
                // Died from status effects
                this.ui.addMessage(`${enemy.name} dies from ${enemy.statusEffects.length > 0 ? 'afflictions' : 'damage'}!`, '#ff8844');
                this.audio.playEnemyDeath();
                const levels = this.player.gainXp(enemy.xp);
                this.ui.addMessage(`+${enemy.xp} XP`, COLORS.textXp);
                this.player.stats.enemiesKilled++;
                if (enemy.boss) this.player.stats.bossesKilled++;
                for (const lvl of levels) {
                    this.ui.addMessage(`Level up! You are now level ${lvl}!`, '#ffff00');
                    this.audio.playLevelUp();
                }
                // Drop loot for status-effect kills too
                if (!enemy._lootDropped) {
                    enemy._lootDropped = true;
                    this._dropEnemyLoot(enemy);
                }
                continue;
            }

            const action = enemy.doTurn(this.dungeon, this.player, this.enemies);
            if (action) {
                switch (action.type) {
                    case 'move':
                        enemy.prevX = enemy.x;
                        enemy.prevY = enemy.y;
                        enemy.x = action.x;
                        enemy.y = action.y;
                        enemy.moveAnimT = 0;
                        break;

                    case 'attack': {
                        const results = this.combat.enemyAttackPlayer(enemy, this.player);
                        this._processResults(results);
                        break;
                    }

                    case 'ranged_attack': {
                        const results = this.combat.enemyRangedAttack(enemy, this.player);
                        this._processResults(results);
                        break;
                    }

                    case 'teleport':
                        this.ui.addMessage(action.text, action.color);
                        this.renderer.spawnParticles(enemy.x, enemy.y, 10, '#8844ff', 60, 0.5);
                        break;

                    case 'arcane_bolt': {
                        const results = this.combat.enemyRangedAttack(enemy, this.player);
                        this._processResults(results);
                        this.renderer.spawnProjectile(enemy.x, enemy.y, this.player.x, this.player.y, '#aa44ff');
                        break;
                    }
                }
            }
        }

        // Clean up dead enemies (drop loot)
        const newlyDead = this.enemies.filter(e => e.isDead && e.deathTimer > 0 && !e._lootDropped);
        for (const enemy of newlyDead) {
            enemy._lootDropped = true;
            this._dropEnemyLoot(enemy);
        }

        // Check player death after enemy turns
        if (!this.player.isAlive()) {
            this.state = GAME_STATE.GAME_OVER;
            this.audio.playDeath();
            this.audio.stopAmbient();
            return;
        }

        // Check for pending level ups
        if (this.player.pendingLevelUpChoices > 0 && this.state === GAME_STATE.PLAYING) {
            this.player.generateLevelUpChoices();
            this.state = GAME_STATE.LEVEL_UP;
            this.ui.levelUpSelection = 0;
        }

        // Update FOV
        this.fov.compute(this.player.x, this.player.y, this.player.visionRadius, this.dungeon);
    }

    _checkTileEffects() {
        const tile = this.dungeon.getTile(this.player.x, this.player.y);

        switch (tile) {
            case TILE.TRAP:
                if (rng.chance(0.5)) {
                    const damage = rng.int(3, 8 + this.player.floor * 2);
                    this.player.hp -= damage;
                    this.ui.addMessage(`You trigger a trap! ${damage} damage!`, COLORS.textDamage);
                    this.renderer.shake(6);
                    this.renderer.spawnParticles(this.player.x, this.player.y, 8, '#cc4444', 50, 0.4);
                    this.dungeon.setTile(this.player.x, this.player.y, TILE.FLOOR);
                }
                break;

            case TILE.SPIKE_TRAP:
                if (rng.chance(0.6)) {
                    const spikeDmg = rng.int(4, 10 + this.player.floor * 2);
                    this.player.hp -= spikeDmg;
                    this.player.addStatus(STATUS.BLEEDING, 3);
                    this.ui.addMessage(`Spikes impale you for ${spikeDmg} damage! You are bleeding!`, '#cc4444');
                    this.renderer.shake(SHAKE.PLAYER_HIT);
                    this.renderer.spawnPresetParticles(this.player.x, this.player.y, 'BLOOD', '#cc2222');
                    this.dungeon.setTile(this.player.x, this.player.y, TILE.FLOOR);
                }
                break;

            case TILE.DART_TRAP: {
                const dartDmg = rng.int(5, 12 + this.player.floor);
                this.player.hp -= dartDmg;
                this.ui.addMessage(`A dart shoots from the wall! ${dartDmg} damage!`, '#cc4444');
                this.renderer.shake(SHAKE.PLAYER_HIT);
                // Projectile visual from nearest wall
                const wallDir = CARDINAL_DIRS.find(d =>
                    this.dungeon.getTile(this.player.x + d.x, this.player.y + d.y) === TILE.WALL);
                if (wallDir) {
                    this.renderer.spawnProjectile(
                        this.player.x + wallDir.x, this.player.y + wallDir.y,
                        this.player.x, this.player.y, '#aaaaaa');
                }
                this.dungeon.setTile(this.player.x, this.player.y, TILE.FLOOR);
                break;
            }

            case TILE.ALARM_TRAP: {
                this.ui.addMessage('You trigger an alarm! Enemies are alerted!', '#cccc44');
                this.renderer.shake(SHAKE.ENEMY_HIT);
                this.renderer.spawnParticles(this.player.x, this.player.y, 10, '#cccc44', 60, 0.6,
                    { shape: 'circle', gravity: -20 });
                // Alert all enemies within 10 tiles
                for (const enemy of this.enemies) {
                    if (enemy.isDead) continue;
                    if (chebyshevDist(this.player.x, this.player.y, enemy.x, enemy.y) <= 10) {
                        enemy.alerted = true;
                        enemy.alertTimer = 20;
                        enemy.lastKnownPlayerX = this.player.x;
                        enemy.lastKnownPlayerY = this.player.y;
                    }
                }
                this.dungeon.setTile(this.player.x, this.player.y, TILE.FLOOR);
                break;
            }

            case TILE.LAVA:
                const lavaDmg = 5 + this.player.floor;
                this.player.hp -= lavaDmg;
                this.ui.addMessage(`The lava burns you for ${lavaDmg} damage!`, '#ff4422');
                this.renderer.spawnParticles(this.player.x, this.player.y, 6, '#ff4422', 40, 0.3);
                break;

            case TILE.WATER:
                // No damage, just flavor text occasionally
                if (rng.chance(0.1)) {
                    this.ui.addMessage('You wade through water...', '#4488cc');
                }
                break;

            case TILE.SHOP_FLOOR:
                // Auto-open shop if there are shop items nearby
                const nearbyShopItems = this.items.filter(item =>
                    item.isShopItem && chebyshevDist(this.player.x, this.player.y, item.x, item.y) <= 3
                );
                if (nearbyShopItems.length > 0) {
                    this.state = GAME_STATE.SHOP;
                    this.ui.shopSelection = 0;
                }
                break;
        }
    }

    _attackObject(x, y, tile) {
        const name = tile === TILE.BARREL ? 'barrel' : 'crate';
        this.dungeon.setTile(x, y, TILE.FLOOR);
        this.ui.addMessage(`You smash the ${name}!`, '#8a6020');
        this.renderer.spawnParticles(x, y, 8, '#8a6020', 50, 0.5, { shape: 'square', gravity: 60 });
        this.renderer.shake(SHAKE.ENEMY_HIT);

        // 35% chance to contain items
        if (rng.chance(0.35)) {
            const item = generateItem(this.player.floor);
            item.x = x;
            item.y = y;
            this.items.push(item);
            this.ui.addMessage(`Something falls out!`, '#ffcc00');
        }
    }

    _tryUnlockDoor(x, y) {
        // Check if player has a key
        const keyIdx = this.player.inventory.findIndex(i => i.type === ITEM_TYPE.KEY);
        if (keyIdx !== -1) {
            this.player.inventory.splice(keyIdx, 1);
            this.dungeon.setTile(x, y, TILE.DOOR);
            this.ui.addMessage('You use a key to unlock the door!', '#ccaa44');
            this.renderer.spawnParticles(x, y, 6, '#ccaa44', 40, 0.5, { shape: 'square', gravity: 20 });
        } else {
            this.ui.addMessage('The door is locked. You need a key.', COLORS.textSecondary);
        }
    }

    _attackCrackedWall(x, y) {
        // Track hits on cracked walls
        if (!this._crackedWallHits) this._crackedWallHits = {};
        const key = `${x},${y}`;
        this._crackedWallHits[key] = (this._crackedWallHits[key] || 0) + 1;
        const hitsNeeded = 3;

        if (this._crackedWallHits[key] >= hitsNeeded) {
            this.dungeon.setTile(x, y, TILE.FLOOR);
            delete this._crackedWallHits[key];
            this.ui.addMessage('The wall crumbles, revealing a hidden passage!', '#ffcc00');
            this.renderer.spawnParticles(x, y, 15, '#888899', 60, 0.6, { shape: 'square', gravity: 80 });
            this.renderer.shake(SHAKE.EXPLOSION);
            // Update FOV to reveal new area
            this.fov.compute(this.player.x, this.player.y, this.player.visionRadius, this.dungeon);
        } else {
            this.ui.addMessage(`You strike the cracked wall! (${this._crackedWallHits[key]}/${hitsNeeded})`, '#888899');
            this.renderer.shake(SHAKE.ENEMY_HIT);
            this.renderer.spawnParticles(x, y, 4, '#888899', 30, 0.3, { shape: 'square', gravity: 60 });
        }
    }

    _pickupItem() {
        const item = this.items.find(i => i.x === this.player.x && i.y === this.player.y && !i.isShopItem);
        if (!item) {
            this.ui.addMessage('Nothing to pick up here.', COLORS.textSecondary);
            return;
        }

        if (item.type === ITEM_TYPE.GOLD) {
            this.player.addToInventory(item);
            this.ui.addMessage(`Picked up ${item.name}.`, COLORS.textGold);
            this.audio.playGoldPickup();
        } else {
            if (!this.player.addToInventory(item)) {
                this.ui.addMessage('Inventory is full!', COLORS.textDamage);
                return;
            }
            this.ui.addMessage(`Picked up ${item.name}.`, getItemColor(item));
            this.audio.playPickup();
        }

        // Remove from floor
        const idx = this.items.indexOf(item);
        if (idx !== -1) this.items.splice(idx, 1);

        // All pickups cost a turn
        this._processTurn();
    }

    _interact() {
        const tile = this.dungeon.getTile(this.player.x, this.player.y);

        if (tile === TILE.STAIRS_DOWN) {
            if (this.player.floor >= MAX_FLOORS) {
                this.ui.addMessage('There are no stairs deeper...', COLORS.textSecondary);
                return;
            }
            this.player.floor++;
            this.player.stats.floorsExplored++;
            this.ui.addMessage(`You descend to floor ${this.player.floor}...`, '#66ccff');
            this.audio.playStairs();
            this._generateFloor(this.player.floor);
            return;
        }

        if (tile === TILE.STAIRS_UP) {
            if (this.player.floor <= 1) {
                this.ui.addMessage('You cannot leave the dungeon!', COLORS.textSecondary);
            } else {
                this.ui.addMessage('You hear the call of the depths... There is no going back.', '#cc8844');
            }
            return;
        }

        // Check for adjacent NPC
        const adjacentNPC = this.npcs.find(n => !n.interacted &&
            chebyshevDist(this.player.x, this.player.y, n.x, n.y) <= 1);
        if (adjacentNPC) {
            this.activeNPC = adjacentNPC;
            this.npcDialogueSelection = 0;
            this.state = GAME_STATE.NPC_DIALOGUE;
            this.ui.addMessage(`You speak with ${adjacentNPC.name}.`, adjacentNPC.color);
            return;
        }

        // Check for shop
        const nearbyShopItems = this.items.filter(item =>
            item.isShopItem && chebyshevDist(this.player.x, this.player.y, item.x, item.y) <= 3
        );
        if (nearbyShopItems.length > 0) {
            this.state = GAME_STATE.SHOP;
            this.ui.shopSelection = 0;
            return;
        }

        this.ui.addMessage('Nothing to interact with here.', COLORS.textSecondary);
    }

    _useScroll(scroll) {
        switch (scroll.effect) {
            case 'teleport': {
                const pos = this.dungeon.getRandomWalkablePos();
                this.player.x = pos.x;
                this.player.y = pos.y;
                this.player.prevX = pos.x;
                this.player.prevY = pos.y;
                this.fov.compute(this.player.x, this.player.y, this.player.visionRadius, this.dungeon);
                this.ui.addMessage('You are teleported to a new location!', '#aa44ff');
                this.renderer.spawnParticles(pos.x, pos.y, 15, '#aa44ff', 60, 0.5);
                break;
            }
            case 'map':
                // Reveal entire floor
                for (let y = 0; y < this.dungeon.height; y++) {
                    for (let x = 0; x < this.dungeon.width; x++) {
                        if (this.dungeon.isWalkable(x, y) || this.dungeon.getTile(x, y) === TILE.WALL) {
                            if (this.fov.getFog(x, y) === FOG.UNEXPLORED) {
                                this.fov.fogMap[y][x] = FOG.EXPLORED;
                            }
                        }
                    }
                }
                this.ui.addMessage('The scroll reveals the entire floor!', '#ffcc00');
                break;
            case 'fireball': {
                // Fireball nearest enemy
                const nearest = this.enemies
                    .filter(e => !e.isDead)
                    .sort((a, b) => dist(this.player.x, this.player.y, a.x, a.y) - dist(this.player.x, this.player.y, b.x, b.y))[0];
                if (nearest) {
                    const damage = scroll.power;
                    nearest.takeDamage(damage);
                    nearest.addStatus(STATUS.BURNING, 3);
                    this.renderer.spawnExplosion(nearest.x, nearest.y, 1, '#ff4422');
                    this.ui.addMessage(`Fireball hits ${nearest.name} for ${damage} damage!`, '#ff4422');
                    this.audio.playFireball();
                    if (nearest.isDead) {
                        this.player.stats.enemiesKilled++;
                        const levels = this.player.gainXp(nearest.xp);
                        this.ui.addMessage(`+${nearest.xp} XP`, COLORS.textXp);
                    }
                } else {
                    this.ui.addMessage('No enemies to target!', COLORS.textSecondary);
                }
                break;
            }
        }

        // Remove scroll from inventory
        const idx = this.player.inventory.indexOf(scroll);
        if (idx !== -1) this.player.inventory.splice(idx, 1);
    }

    _dropEnemyLoot(enemy) {
        // Chance to drop items — elites have 80% drop rate with boosted rarity
        const isElite = !!enemy.eliteModifier;
        const dropChance = enemy.boss ? 1.0 : (isElite ? 0.8 : 0.35);
        if (rng.chance(dropChance)) {
            let rarity;
            if (enemy.boss) {
                rarity = rng.chance(0.3) ? RARITY.EPIC : RARITY.RARE;
            } else if (isElite) {
                const effectiveFloor = Math.min(10, this.player.floor + ELITE_LOOT_RARITY_BOOST);
                rarity = effectiveFloor >= 7 ? RARITY.RARE : RARITY.UNCOMMON;
            }
            const item = generateItem(this.player.floor, rarity);
            item.x = enemy.x;
            item.y = enemy.y;
            this.items.push(item);
        }

        // Key drops when floor has locked doors (15% chance)
        if (this.dungeon.hasLockedDoors && !enemy.boss && rng.chance(0.15)) {
            const key = { type: ITEM_TYPE.KEY, name: 'Rusty Key', symbol: 'k', x: enemy.x, y: enemy.y };
            this.items.push(key);
        }

        // Always drop some gold
        const gold = generateGold(this.player.floor);
        gold.x = enemy.x;
        gold.y = enemy.y;
        this.items.push(gold);

        // Check for victory (killed final boss)
        if (enemy.type === 'valrath') {
            this.state = GAME_STATE.VICTORY;
            this.audio.playVictory();
            this.audio.stopAmbient();
        }
    }

    _startAutoExplore() {
        // Find nearest unexplored walkable tile
        let bestTarget = null;
        let bestDist = Infinity;

        for (let y = 0; y < this.dungeon.height; y++) {
            for (let x = 0; x < this.dungeon.width; x++) {
                if (this.fov.getFog(x, y) !== FOG.UNEXPLORED) continue;
                // Check if adjacent to explored tile
                let adjacentExplored = false;
                for (const dir of CARDINAL_DIRS) {
                    const nx = x + dir.x;
                    const ny = y + dir.y;
                    if (this.dungeon.isWalkable(nx, ny) && this.fov.getFog(nx, ny) !== FOG.UNEXPLORED) {
                        adjacentExplored = true;
                        break;
                    }
                }
                if (!adjacentExplored) continue;

                const d = dist(this.player.x, this.player.y, x, y);
                if (d < bestDist) {
                    bestDist = d;
                    bestTarget = { x, y };
                }
            }
        }

        if (bestTarget) {
            this.autoExploring = true;
            this._autoExploreStep(bestTarget);
        } else {
            this.ui.addMessage('Nothing left to explore on this floor.', COLORS.textSecondary);
        }
    }

    _autoExploreStep(target) {
        if (!this.autoExploring || !this.player.isAlive() || this.state !== GAME_STATE.PLAYING) {
            this.autoExploring = false;
            return;
        }

        // Check if enemy visible
        const visibleEnemy = this.enemies.find(e =>
            !e.isDead && this.fov.getFog(e.x, e.y) === FOG.VISIBLE
        );
        if (visibleEnemy) {
            this.autoExploring = false;
            this.ui.addMessage(`You spot a ${visibleEnemy.name}!`, visibleEnemy.color);
            return;
        }

        // Check for nearby items
        const nearbyItem = this.items.find(i =>
            !i.isShopItem && this.fov.getFog(i.x, i.y) === FOG.VISIBLE &&
            chebyshevDist(this.player.x, this.player.y, i.x, i.y) <= 1
        );
        if (nearbyItem) {
            this.autoExploring = false;
            this.ui.addMessage(`You notice a ${nearbyItem.name} nearby.`, getItemColor(nearbyItem));
            return;
        }

        // Low HP safety stop
        if (this.player.hp < this.player.maxHp * 0.3) {
            this.autoExploring = false;
            this.ui.addMessage('Auto-explore stopped: low HP!', COLORS.textDamage);
            return;
        }

        // Pathfind toward target
        const path = astarFind(
            this.player.x, this.player.y, target.x, target.y,
            (x, y) => this.dungeon.isWalkable(x, y) && !this.enemies.some(e => !e.isDead && e.x === x && e.y === y),
            500
        );

        if (path && path.length > 0) {
            const dx = path[0].x - this.player.x;
            const dy = path[0].y - this.player.y;
            this._handleMovement(dx, dy);

            // Continue auto-exploring after a short delay (only if still valid)
            if (this.autoExploring && this.player.isAlive() && this.state === GAME_STATE.PLAYING) {
                setTimeout(() => this._autoExploreStep(target), 120);
            }
        } else {
            this.autoExploring = false;
            this.ui.addMessage('Cannot find path. Auto-explore stopped.', COLORS.textSecondary);
        }
    }
}

// Start the game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
