// ============================================================
// DEPTHS OF VALRATH — Procedural Dungeon Generation (BSP)
// ============================================================

class Dungeon {
    constructor(width, height, floor) {
        this.width = width;
        this.height = height;
        this.floor = floor;
        this.tiles = [];
        this.rooms = [];
        this.corridors = [];
        this.stairsDown = null;
        this.stairsUp = null;
        this.spawnPoint = null;
        this.items = [];
        this.enemies = [];
        this.shopItems = [];
        this.specialRooms = { treasure: [], shop: null, boss: null };

        // Initialize all tiles as walls
        for (let y = 0; y < height; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < width; x++) {
                this.tiles[y][x] = TILE.WALL;
            }
        }
    }

    getTile(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return TILE.WALL;
        return this.tiles[y][x];
    }

    setTile(x, y, tile) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        this.tiles[y][x] = tile;
    }

    isWalkable(x, y) {
        const tile = this.getTile(x, y);
        return tile !== TILE.WALL && tile !== TILE.VOID &&
               tile !== TILE.BARREL && tile !== TILE.CRATE &&
               tile !== TILE.LOCKED_DOOR && tile !== TILE.CRACKED_WALL;
    }

    isTransparent(x, y) {
        const tile = this.getTile(x, y);
        return tile !== TILE.WALL && tile !== TILE.VOID && tile !== TILE.CRACKED_WALL;
    }

    generate() {
        // BSP tree split
        const root = new BSPNode(1, 1, this.width - 2, this.height - 2);
        this._splitNode(root, 0);

        // Create rooms from leaf nodes
        this._createRooms(root);

        // Connect rooms with corridors
        this._connectRooms(root);

        // Place stairs
        this._placeStairs();

        // Place special rooms
        this._placeSpecialRooms();

        // Place environmental hazards
        this._placeHazards();

        // Place doors at corridor/room transitions
        this._placeDoors();

        // Place interactive objects (barrels, crates, traps)
        this._placeInteractables();

        return this;
    }

    _splitNode(node, depth) {
        const maxDepth = 5 + Math.floor(this.floor / 3);

        if (depth >= maxDepth) return;
        if (node.w < BSP_MIN_LEAF_SIZE * 2 || node.h < BSP_MIN_LEAF_SIZE * 2) return;

        // Decide split direction
        let horizontal;
        if (node.w / node.h >= 1.25) horizontal = false;
        else if (node.h / node.w >= 1.25) horizontal = true;
        else horizontal = rng.chance(0.5);

        if (horizontal) {
            if (node.h < BSP_MIN_LEAF_SIZE * 2) return;
            const split = rng.int(BSP_MIN_LEAF_SIZE, node.h - BSP_MIN_LEAF_SIZE);
            node.left = new BSPNode(node.x, node.y, node.w, split);
            node.right = new BSPNode(node.x, node.y + split, node.w, node.h - split);
        } else {
            if (node.w < BSP_MIN_LEAF_SIZE * 2) return;
            const split = rng.int(BSP_MIN_LEAF_SIZE, node.w - BSP_MIN_LEAF_SIZE);
            node.left = new BSPNode(node.x, node.y, split, node.h);
            node.right = new BSPNode(node.x + split, node.y, node.w - split, node.h);
        }

        this._splitNode(node.left, depth + 1);
        this._splitNode(node.right, depth + 1);
    }

    _createRooms(node) {
        if (node.left || node.right) {
            if (node.left) this._createRooms(node.left);
            if (node.right) this._createRooms(node.right);
            return;
        }

        // Leaf node — create a room within it
        const padding = 1;
        const maxW = Math.min(node.w - padding * 2, BSP_MAX_ROOM_SIZE);
        const maxH = Math.min(node.h - padding * 2, BSP_MAX_ROOM_SIZE);
        const minW = Math.min(BSP_MIN_ROOM_SIZE, maxW);
        const minH = Math.min(BSP_MIN_ROOM_SIZE, maxH);

        if (maxW < minW || maxH < minH) return;

        const roomW = rng.int(minW, maxW);
        const roomH = rng.int(minH, maxH);
        const roomX = rng.int(node.x + padding, node.x + node.w - roomW - padding);
        const roomY = rng.int(node.y + padding, node.y + node.h - roomH - padding);

        const room = { x: roomX, y: roomY, w: roomW, h: roomH, cx: 0, cy: 0 };
        room.cx = Math.floor(roomX + roomW / 2);
        room.cy = Math.floor(roomY + roomH / 2);

        // Carve out the room
        for (let ry = roomY; ry < roomY + roomH; ry++) {
            for (let rx = roomX; rx < roomX + roomW; rx++) {
                this.setTile(rx, ry, TILE.FLOOR);
            }
        }

        this.rooms.push(room);
        node.room = room;
    }

    _connectRooms(node) {
        if (!node.left || !node.right) return;

        this._connectRooms(node.left);
        this._connectRooms(node.right);

        const roomA = this._getRoom(node.left);
        const roomB = this._getRoom(node.right);

        if (roomA && roomB) {
            this._carveCorridorBetween(roomA, roomB);
        }
    }

    _getRoom(node) {
        if (node.room) return node.room;
        if (node.left) {
            const r = this._getRoom(node.left);
            if (r) return r;
        }
        if (node.right) {
            const r = this._getRoom(node.right);
            if (r) return r;
        }
        return null;
    }

    _carveCorridorBetween(roomA, roomB) {
        let x = roomA.cx;
        let y = roomA.cy;
        const targetX = roomB.cx;
        const targetY = roomB.cy;

        // L-shaped corridor
        if (rng.chance(0.5)) {
            // Horizontal first, then vertical
            while (x !== targetX) {
                this._carveCorridor(x, y);
                x += x < targetX ? 1 : -1;
            }
            while (y !== targetY) {
                this._carveCorridor(x, y);
                y += y < targetY ? 1 : -1;
            }
        } else {
            // Vertical first, then horizontal
            while (y !== targetY) {
                this._carveCorridor(x, y);
                y += y < targetY ? 1 : -1;
            }
            while (x !== targetX) {
                this._carveCorridor(x, y);
                x += x < targetX ? 1 : -1;
            }
        }
        this._carveCorridor(x, y);
    }

    _carveCorridor(x, y) {
        if (this.getTile(x, y) === TILE.WALL) {
            this.setTile(x, y, TILE.CORRIDOR);
            this.corridors.push({ x, y });
        }
    }

    _placeStairs() {
        if (this.rooms.length < 2) return;

        // Stairs up in first room (spawn point)
        const firstRoom = this.rooms[0];
        this.stairsUp = { x: firstRoom.cx, y: firstRoom.cy };
        this.spawnPoint = { x: firstRoom.cx, y: firstRoom.cy };

        if (this.floor > 1) {
            this.setTile(firstRoom.cx, firstRoom.cy, TILE.STAIRS_UP);
        }

        // Stairs down in last room (furthest from start)
        if (this.floor < MAX_FLOORS) {
            let bestRoom = this.rooms[this.rooms.length - 1];
            let bestDist = 0;
            for (const room of this.rooms) {
                const d = dist(firstRoom.cx, firstRoom.cy, room.cx, room.cy);
                if (d > bestDist) {
                    bestDist = d;
                    bestRoom = room;
                }
            }
            this.stairsDown = { x: bestRoom.cx, y: bestRoom.cy };
            this.setTile(bestRoom.cx, bestRoom.cy, TILE.STAIRS_DOWN);
        }
    }

    _placeSpecialRooms() {
        if (this.rooms.length < 4) return;

        // Skip first and last rooms (stairs)
        const middleRooms = this.rooms.slice(1, -1);
        rng.shuffle(middleRooms);

        // Shop room on floors 2, 5, 8
        if (this.floor === 2 || this.floor === 5 || this.floor === 8) {
            if (middleRooms.length > 0) {
                const shopRoom = middleRooms.shift();
                this.specialRooms.shop = shopRoom;
                for (let ry = shopRoom.y; ry < shopRoom.y + shopRoom.h; ry++) {
                    for (let rx = shopRoom.x; rx < shopRoom.x + shopRoom.w; rx++) {
                        if (this.getTile(rx, ry) === TILE.FLOOR) {
                            this.setTile(rx, ry, TILE.SHOP_FLOOR);
                        }
                    }
                }
            }
        }

        // Treasure rooms
        const treasureCount = Math.min(rng.int(1, 2), middleRooms.length);
        for (let i = 0; i < treasureCount; i++) {
            if (middleRooms.length > 0) {
                this.specialRooms.treasure.push(middleRooms.shift());
            }
        }

        // Boss room
        if (BOSS_FLOORS[this.floor]) {
            if (this.stairsDown) {
                // Boss goes in the room with stairs down
                for (const room of this.rooms) {
                    if (room.cx === this.stairsDown.x && room.cy === this.stairsDown.y) {
                        this.specialRooms.boss = room;
                        break;
                    }
                }
            }
            // Fallback: use the furthest room from spawn (for floor 10 / final floor with no stairs down)
            if (!this.specialRooms.boss && this.rooms.length >= 2) {
                let bestRoom = this.rooms[this.rooms.length - 1];
                let bestDist = 0;
                const spawnRoom = this.rooms[0];
                for (const room of this.rooms.slice(1)) {
                    const d = dist(spawnRoom.cx, spawnRoom.cy, room.cx, room.cy);
                    if (d > bestDist) {
                        bestDist = d;
                        bestRoom = room;
                    }
                }
                this.specialRooms.boss = bestRoom;
            }
        }
    }

    _placeHazards() {
        if (this.floor < 3) return;

        const biome = getBiome(this.floor);
        const bias = biome.hazardBias;
        const hazardChance = 0.01 + this.floor * 0.005;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.getTile(x, y) !== TILE.FLOOR) continue;
                // Don't place hazards near stairs
                if (this.stairsUp && dist(x, y, this.stairsUp.x, this.stairsUp.y) < 3) continue;
                if (this.stairsDown && dist(x, y, this.stairsDown.x, this.stairsDown.y) < 3) continue;

                if (rng.chance(hazardChance)) {
                    const roll = rng.float(0, 1);
                    if (bias.lava > 0 && roll < bias.lava) {
                        this.setTile(x, y, TILE.LAVA);
                    } else if (bias.water > 0 && roll < bias.lava + bias.water) {
                        this.setTile(x, y, TILE.WATER);
                    } else {
                        this.setTile(x, y, TILE.TRAP);
                    }
                }
            }
        }
    }

    _placeInteractables() {
        // Barrels/crates in 40% of rooms
        for (let i = 1; i < this.rooms.length; i++) {
            if (!rng.chance(0.4)) continue;
            const room = this.rooms[i];
            // Skip special rooms
            if (this.specialRooms.boss === room || this.specialRooms.shop === room) continue;

            const count = rng.int(1, 3);
            for (let j = 0; j < count; j++) {
                const x = rng.int(room.x + 1, room.x + room.w - 2);
                const y = rng.int(room.y + 1, room.y + room.h - 2);
                if (this.getTile(x, y) !== TILE.FLOOR) continue;
                // Don't block stairs
                if (this.stairsUp && x === this.stairsUp.x && y === this.stairsUp.y) continue;
                if (this.stairsDown && x === this.stairsDown.x && y === this.stairsDown.y) continue;
                this.setTile(x, y, rng.chance(0.5) ? TILE.BARREL : TILE.CRATE);
            }
        }

        // Locked doors on treasure rooms (floors 3+)
        this.hasLockedDoors = false;
        if (this.floor >= 3) {
            for (const treasureRoom of this.specialRooms.treasure) {
                // Find door tiles adjacent to this room
                for (let y = treasureRoom.y - 1; y <= treasureRoom.y + treasureRoom.h; y++) {
                    for (let x = treasureRoom.x - 1; x <= treasureRoom.x + treasureRoom.w; x++) {
                        if (this.getTile(x, y) === TILE.DOOR) {
                            this.setTile(x, y, TILE.LOCKED_DOOR);
                            this.hasLockedDoors = true;
                        }
                    }
                }
            }
        }

        // Varied traps (spike/dart/alarm) — replace some generic traps
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.getTile(x, y) === TILE.TRAP) {
                    const roll = rng.float(0, 1);
                    if (roll < 0.4) {
                        this.setTile(x, y, TILE.SPIKE_TRAP);
                    } else if (roll < 0.65) {
                        this.setTile(x, y, TILE.DART_TRAP);
                    } else if (roll < 0.8) {
                        this.setTile(x, y, TILE.ALARM_TRAP);
                    }
                    // else keep as generic TRAP
                }
            }
        }

        // Cracked walls hiding secret rooms on 50% of floors 2+
        if (this.floor >= 2 && rng.chance(0.5)) {
            // Find a wall tile adjacent to a room that has void behind it
            for (let attempt = 0; attempt < 50; attempt++) {
                const room = rng.pick(this.rooms);
                // Try each wall direction
                const sides = rng.shuffle([
                    { dx: 0, dy: -1 }, // north wall
                    { dx: 0, dy: 1 },  // south wall
                    { dx: -1, dy: 0 }, // west wall
                    { dx: 1, dy: 0 },  // east wall
                ]);
                for (const side of sides) {
                    const wallX = side.dx === 0 ? rng.int(room.x + 1, room.x + room.w - 2) :
                        (side.dx < 0 ? room.x : room.x + room.w - 1);
                    const wallY = side.dy === 0 ? rng.int(room.y + 1, room.y + room.h - 2) :
                        (side.dy < 0 ? room.y : room.y + room.h - 1);

                    // Check there's void/wall behind this wall for the secret room
                    const secretX = wallX + side.dx * 2;
                    const secretY = wallY + side.dy * 2;
                    if (secretX < 2 || secretX >= this.width - 2 || secretY < 2 || secretY >= this.height - 2) continue;

                    // Verify the area behind is all void (space for a 3x3 room)
                    let canPlace = true;
                    for (let sy = -1; sy <= 1; sy++) {
                        for (let sx = -1; sx <= 1; sx++) {
                            const tile = this.getTile(secretX + sx, secretY + sy);
                            if (tile !== TILE.VOID && tile !== TILE.WALL) { canPlace = false; break; }
                        }
                        if (!canPlace) break;
                    }
                    if (!canPlace) continue;

                    // Place cracked wall
                    if (this.getTile(wallX, wallY) === TILE.WALL) {
                        this.setTile(wallX, wallY, TILE.CRACKED_WALL);
                        // Carve out 3x3 secret room behind
                        for (let sy = -1; sy <= 1; sy++) {
                            for (let sx = -1; sx <= 1; sx++) {
                                this.setTile(secretX + sx, secretY + sy, TILE.FLOOR);
                            }
                        }
                        // Place the connecting tile
                        this.setTile(wallX + side.dx, wallY + side.dy, TILE.FLOOR);
                        return; // Only one secret room per floor
                    }
                }
            }
        }
    }

    _placeDoors() {
        for (const { x, y } of this.corridors) {
            // Check if this corridor tile is at a room entrance
            const adj = CARDINAL_DIRS.map(d => ({
                tile: this.getTile(x + d.x, y + d.y),
                dx: d.x, dy: d.y
            }));

            const floorNeighbors = adj.filter(a => a.tile === TILE.FLOOR);
            const wallNeighbors = adj.filter(a => a.tile === TILE.WALL);

            // Door candidate: corridor tile adjacent to a room floor, with walls on sides
            if (floorNeighbors.length >= 1 && wallNeighbors.length >= 2) {
                // Check for horizontal or vertical doorway pattern
                const horizontalDoor = (
                    this.getTile(x, y - 1) === TILE.WALL &&
                    this.getTile(x, y + 1) === TILE.WALL
                );
                const verticalDoor = (
                    this.getTile(x - 1, y) === TILE.WALL &&
                    this.getTile(x + 1, y) === TILE.WALL
                );

                if ((horizontalDoor || verticalDoor) && rng.chance(0.4)) {
                    this.setTile(x, y, TILE.DOOR);
                }
            }
        }
    }

    // Get a random walkable position in a specific room
    getRandomPosInRoom(room) {
        for (let attempts = 0; attempts < 50; attempts++) {
            const x = rng.int(room.x + 1, room.x + room.w - 2);
            const y = rng.int(room.y + 1, room.y + room.h - 2);
            if (this.isWalkable(x, y)) {
                return { x, y };
            }
        }
        return { x: room.cx, y: room.cy };
    }

    // Get any random walkable position
    getRandomWalkablePos() {
        for (let attempts = 0; attempts < 200; attempts++) {
            const x = rng.int(1, this.width - 2);
            const y = rng.int(1, this.height - 2);
            if (this.isWalkable(x, y)) return { x, y };
        }
        return this.spawnPoint;
    }
}

class BSPNode {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.left = null;
        this.right = null;
        this.room = null;
    }
}
