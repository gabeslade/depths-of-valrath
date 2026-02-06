// ============================================================
// DEPTHS OF VALRATH — Procedural Sprite Cache
// ============================================================

class SpriteCache {
    constructor() {
        this.tileSize = 0;
        this.tiles = {};      // tile type -> [variant canvases]
        this.animated = {};   // tile type -> [frame canvases]
        this.wallTiles = {};  // bitmask -> canvas (auto-tiled walls)
        this.decor = [];      // floor decoration overlays
        this.wallShadows = {};// direction -> shadow gradient canvas
        this.entityShadow = null; // drop shadow for entities
        this.enemies = {};    // enemy id -> canvas
        this.players = {};    // class id -> canvas
        this.items = {};      // item type -> canvas (or sub-map)
    }

    init(tileSize) {
        this.tileSize = tileSize;
        this._designSize = 24; // All sprite coordinates designed for 24px
        this._scale = tileSize / 24;
        this.currentPalette = BIOME_DATA[BIOME.CRYPT].palette;
        this._generateTiles();
        this._generateWallAutoTiles();
        this._generateDecor();
        this._generateWallShadows();
        this._generateEntityShadow();
        this._generateEnemies();
        this._generatePlayers();
        this._generateItems();
    }

    // Switch biome palette and regenerate tiles/walls/decor
    initBiome(biome) {
        this.currentPalette = biome.palette;
        this._generateTiles();
        this._generateWallAutoTiles();
        this._generateDecor();
        this._generateBiomeDecor(biome);
    }

    _createCanvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w || this.tileSize;
        c.height = h || this.tileSize;
        const ctx = c.getContext('2d');
        // Scale drawing context so 24px design coordinates fill the actual tile size
        if (this._scale !== 1) {
            ctx.scale(this._scale, this._scale);
        }
        return { canvas: c, ctx };
    }

    // ── Getters ──────────────────────────────────────────────

    getTile(tileType, x, y) {
        const variants = this.tiles[tileType];
        if (!variants || variants.length === 0) return null;
        const idx = Math.abs((x * 7 + y * 13)) % variants.length;
        return variants[idx];
    }

    getAnimatedTile(tileType, frame) {
        const frames = this.animated[tileType];
        if (!frames || frames.length === 0) return null;
        return frames[frame % frames.length];
    }

    getEnemy(enemyId) {
        return this.enemies[enemyId] || null;
    }

    getPlayer(classId) {
        return this.players[classId] || null;
    }

    getItem(itemType, subType) {
        if (subType && this.items[itemType + '_' + subType]) {
            return this.items[itemType + '_' + subType];
        }
        return this.items[itemType] || null;
    }

    // Wall auto-tile: bitmask of cardinal neighbors that are walls
    // N=1, E=2, S=4, W=8
    getWall(n, e, s, w) {
        const mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
        return this.wallTiles[mask] || this.tiles[TILE.WALL][0];
    }

    // Floor decor overlay (deterministic by position)
    getDecor(x, y) {
        const hash = Math.abs((x * 73 + y * 137 + x * y * 31)) % 100;
        if (hash < 8) { // 8% chance of decor
            const idx = hash % this.decor.length;
            return this.decor[idx];
        }
        return null;
    }

    // Wall-floor shadow for a given edge direction
    getWallShadow(dir) {
        return this.wallShadows[dir] || null;
    }

    // ── Tile Generation ──────────────────────────────────────

    _generateTiles() {
        const s = this._designSize;

        // FLOOR — 4 variants of stone slab with cracks and gradient
        const pal = this.currentPalette;
        this.tiles[TILE.FLOOR] = [];
        for (let v = 0; v < 4; v++) {
            const { canvas, ctx } = this._createCanvas();
            // Base stone with subtle gradient
            const baseGrad = ctx.createLinearGradient(0, 0, s, s);
            baseGrad.addColorStop(0, pal.floorBase[0]);
            baseGrad.addColorStop(0.5, pal.floorBase[1]);
            baseGrad.addColorStop(1, pal.floorBase[2]);
            ctx.fillStyle = baseGrad;
            ctx.fillRect(0, 0, s, s);

            // Stone texture — many tiny noise dots for granular look
            const seed = v * 17;
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            for (let i = 0; i < 16; i++) {
                const px = ((seed + i * 7) * 13) % s;
                const py = ((seed + i * 11) * 7) % s;
                ctx.fillRect(px, py, 1, 1);
            }
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            for (let i = 0; i < 12; i++) {
                const px = ((seed + i * 9) * 11) % s;
                const py = ((seed + i * 13) * 9) % s;
                ctx.fillRect(px, py, 1, 1);
            }
            // Larger faint blotches for natural variation
            ctx.fillStyle = 'rgba(0,0,0,0.03)';
            for (let i = 0; i < 3; i++) {
                const px = ((seed + i * 17) * 7) % (s - 4) + 2;
                const py = ((seed + i * 23) * 11) % (s - 4) + 2;
                ctx.beginPath();
                ctx.arc(px, py, 2 + (i % 2), 0, Math.PI * 2);
                ctx.fill();
            }

            // Inner stone grid lines (subtle flagstone look)
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 0.5;
            if (v < 2) {
                // Horizontal split
                ctx.beginPath();
                ctx.moveTo(2, s * 0.5);
                ctx.lineTo(s - 2, s * 0.5);
                ctx.stroke();
            }
            if (v === 0 || v === 2) {
                // Vertical split (offset)
                ctx.beginPath();
                ctx.moveTo(s * 0.5 + (v === 2 ? 3 : 0), 2);
                ctx.lineTo(s * 0.5 + (v === 2 ? 3 : 0), s - 2);
                ctx.stroke();
            }

            // Crack lines (different per variant)
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 0.5;
            if (v === 0) {
                ctx.beginPath();
                ctx.moveTo(s * 0.2, s * 0.6);
                ctx.lineTo(s * 0.45, s * 0.55);
                ctx.lineTo(s * 0.6, s * 0.7);
                ctx.stroke();
            } else if (v === 1) {
                ctx.beginPath();
                ctx.moveTo(s * 0.7, s * 0.2);
                ctx.lineTo(s * 0.65, s * 0.5);
                ctx.stroke();
            } else if (v === 2) {
                ctx.beginPath();
                ctx.moveTo(s * 0.1, s * 0.3);
                ctx.lineTo(s * 0.35, s * 0.35);
                ctx.lineTo(s * 0.4, s * 0.55);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(s * 0.7, s * 0.8);
                ctx.lineTo(s * 0.9, s * 0.75);
                ctx.stroke();
            }
            // v === 3: plain, no cracks

            // Subtle edge line (tile border, slightly brighter inside)
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(0.5, 0.5, s - 1, s - 1);
            // Inner edge highlight (very faint top-left)
            ctx.strokeStyle = 'rgba(255,255,255,0.02)';
            ctx.beginPath();
            ctx.moveTo(1, s - 1);
            ctx.lineTo(1, 1);
            ctx.lineTo(s - 1, 1);
            ctx.stroke();

            this.tiles[TILE.FLOOR].push(canvas);
        }

        // WALL — 3 variants of stone brick
        this.tiles[TILE.WALL] = [];
        for (let v = 0; v < 3; v++) {
            const { canvas, ctx } = this._createCanvas();

            // Gradient: lighter top, darker bottom
            const grad = ctx.createLinearGradient(0, 0, 0, s);
            grad.addColorStop(0, pal.wallTop);
            grad.addColorStop(1, pal.wallBottom);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, s, s);

            // Brick mortar lines
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 1;

            // Horizontal mortar
            ctx.beginPath();
            ctx.moveTo(0, Math.floor(s * 0.33));
            ctx.lineTo(s, Math.floor(s * 0.33));
            ctx.moveTo(0, Math.floor(s * 0.66));
            ctx.lineTo(s, Math.floor(s * 0.66));
            ctx.stroke();

            // Vertical mortar (offset per row for brick pattern)
            const offsets = [
                [s * 0.5],
                [s * 0.25, s * 0.75],
                [s * 0.4, s * 0.8],
            ];
            const vOff = offsets[v];
            ctx.beginPath();
            for (const xOff of vOff) {
                // Top row
                ctx.moveTo(xOff, 0);
                ctx.lineTo(xOff, Math.floor(s * 0.33));
                // Middle row (offset)
                ctx.moveTo(xOff + s * 0.25, Math.floor(s * 0.33));
                ctx.lineTo(xOff + s * 0.25, Math.floor(s * 0.66));
                // Bottom row
                ctx.moveTo(xOff, Math.floor(s * 0.66));
                ctx.lineTo(xOff, s);
            }
            ctx.stroke();

            // Surface texture
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            const seed = v * 31;
            for (let i = 0; i < 10; i++) {
                const px = ((seed + i * 7) * 13) % s;
                const py = ((seed + i * 11) * 7) % s;
                ctx.fillRect(px, py, 2, 1);
            }

            this.tiles[TILE.WALL].push(canvas);
        }

        // CORRIDOR — 3 variants, worn stone path
        this.tiles[TILE.CORRIDOR] = [];
        for (let v = 0; v < 3; v++) {
            const { canvas, ctx } = this._createCanvas();
            // Slightly varied base per variant
            const baseGrad = ctx.createLinearGradient(0, 0, s, 0);
            baseGrad.addColorStop(0, pal.corridorBase[0]);
            baseGrad.addColorStop(0.5, pal.corridorBase[1]);
            baseGrad.addColorStop(1, pal.corridorBase[2]);
            ctx.fillStyle = baseGrad;
            ctx.fillRect(0, 0, s, s);

            // Worn center path (lighter strip down the middle)
            ctx.fillStyle = 'rgba(255,255,255,0.015)';
            ctx.fillRect(s * 0.2, 0, s * 0.6, s);

            // Worn path marks
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            const seed = v * 23;
            for (let i = 0; i < 10; i++) {
                const px = ((seed + i * 7) * 11) % (s - 4) + 2;
                const py = ((seed + i * 13) * 7) % (s - 4) + 2;
                ctx.fillRect(px, py, 2, 1);
            }
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            for (let i = 0; i < 8; i++) {
                const px = ((seed + i * 11) * 13) % s;
                const py = ((seed + i * 7) * 11) % s;
                ctx.fillRect(px, py, 1, 1);
            }

            // Subtle edge
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(0.5, 0.5, s - 1, s - 1);

            this.tiles[TILE.CORRIDOR].push(canvas);
        }

        // DOOR — wooden planks with metal bands
        this.tiles[TILE.DOOR] = [];
        {
            const { canvas, ctx } = this._createCanvas();
            // Door frame (dark stone surround)
            ctx.fillStyle = '#3a2a0a';
            ctx.fillRect(0, 0, s, s);

            // Wood planks with gradient (lighter center for 3D)
            const woodGrad = ctx.createLinearGradient(2, 0, s - 2, 0);
            woodGrad.addColorStop(0, '#7a5a10');
            woodGrad.addColorStop(0.3, '#9B7924');
            woodGrad.addColorStop(0.7, '#9B7924');
            woodGrad.addColorStop(1, '#7a5a10');
            ctx.fillStyle = woodGrad;
            ctx.fillRect(2, 2, s - 4, s - 4);

            // Wood grain lines (varied opacity)
            ctx.strokeStyle = 'rgba(60,40,0,0.2)';
            ctx.lineWidth = 0.5;
            for (let i = 1; i < 4; i++) {
                const x = Math.floor(s * i / 4);
                ctx.beginPath();
                ctx.moveTo(x, 2);
                ctx.lineTo(x, s - 2);
                ctx.stroke();
            }
            // Finer grain detail
            ctx.strokeStyle = 'rgba(60,40,0,0.08)';
            for (let i = 0; i < 6; i++) {
                const x = 3 + ((i * 7 + 3) % (s - 6));
                ctx.beginPath();
                ctx.moveTo(x, 3);
                ctx.lineTo(x + 1, s - 3);
                ctx.stroke();
            }

            // Horizontal metal bands with metallic gradient
            const bandY1 = Math.floor(s * 0.25) - 1;
            const bandY2 = Math.floor(s * 0.75) - 1;
            for (const by of [bandY1, bandY2]) {
                const metalGrad = ctx.createLinearGradient(0, by, 0, by + 3);
                metalGrad.addColorStop(0, '#8888aa');
                metalGrad.addColorStop(0.5, '#666677');
                metalGrad.addColorStop(1, '#555566');
                ctx.fillStyle = metalGrad;
                ctx.fillRect(2, by, s - 4, 3);
            }

            // Rivets with highlight
            ctx.fillStyle = '#999aaa';
            for (const ry of [bandY1 + 1, bandY2 + 1]) {
                for (const rx of [5, s - 5]) {
                    ctx.beginPath();
                    ctx.arc(rx, ry, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                    // Rivet highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.25)';
                    ctx.beginPath();
                    ctx.arc(rx - 0.5, ry - 0.5, 0.7, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#999aaa';
                }
            }

            // Door handle with ring
            ctx.strokeStyle = '#888899';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(s - 6, s / 2, 2.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#aaaacc';
            ctx.beginPath();
            ctx.arc(s - 6, s / 2 - 2.5, 1, 0, Math.PI * 2);
            ctx.fill();

            // Frame shadow (inner)
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(2, 2, s - 4, 1);
            ctx.fillRect(2, 2, 1, s - 4);

            this.tiles[TILE.DOOR].push(canvas);
        }

        // STAIRS_DOWN — descending steps with 3D depth
        this.tiles[TILE.STAIRS_DOWN] = [];
        {
            const { canvas, ctx } = this._createCanvas();
            ctx.fillStyle = '#0e1a30';
            ctx.fillRect(0, 0, s, s);

            // Steps (getting darker and narrower as they descend)
            const steps = 5;
            for (let i = 0; i < steps; i++) {
                const y = Math.floor(s * i / steps);
                const h = Math.floor(s / steps);
                const inset = i * 1.5;
                const brightness = 80 - i * 12;

                // Step face
                const stepGrad = ctx.createLinearGradient(0, y, 0, y + h);
                stepGrad.addColorStop(0, `rgb(${brightness * 0.5}, ${brightness * 0.7}, ${brightness})`);
                stepGrad.addColorStop(1, `rgb(${brightness * 0.35}, ${brightness * 0.5}, ${brightness * 0.7})`);
                ctx.fillStyle = stepGrad;
                ctx.fillRect(2 + inset, y, s - 4 - inset * 2, h);

                // Step edge highlight
                ctx.fillStyle = `rgba(100, 180, 255, ${0.35 - i * 0.06})`;
                ctx.fillRect(2 + inset, y, s - 4 - inset * 2, 1);

                // Step side shadow
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                ctx.fillRect(2 + inset, y + h - 1, s - 4 - inset * 2, 1);
            }

            // Down arrow hint
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(s / 2, s * 0.25);
            ctx.lineTo(s / 2, s * 0.65);
            ctx.lineTo(s * 0.35, s * 0.5);
            ctx.moveTo(s / 2, s * 0.65);
            ctx.lineTo(s * 0.65, s * 0.5);
            ctx.stroke();

            this.tiles[TILE.STAIRS_DOWN].push(canvas);
        }

        // STAIRS_UP — ascending steps with 3D depth
        this.tiles[TILE.STAIRS_UP] = [];
        {
            const { canvas, ctx } = this._createCanvas();
            ctx.fillStyle = '#2a1a0a';
            ctx.fillRect(0, 0, s, s);

            // Steps (getting lighter and narrower as they ascend)
            const steps = 5;
            for (let i = 0; i < steps; i++) {
                const y = Math.floor(s * (steps - 1 - i) / steps);
                const h = Math.floor(s / steps);
                const inset = i * 1.5;
                const brightness = 55 + i * 13;

                // Step face with gradient
                const stepGrad = ctx.createLinearGradient(0, y, 0, y + h);
                stepGrad.addColorStop(0, `rgb(${brightness}, ${brightness * 0.75}, ${brightness * 0.4})`);
                stepGrad.addColorStop(1, `rgb(${brightness * 0.8}, ${brightness * 0.6}, ${brightness * 0.3})`);
                ctx.fillStyle = stepGrad;
                ctx.fillRect(2 + inset, y, s - 4 - inset * 2, h);

                // Step edge highlight
                ctx.fillStyle = `rgba(255, 200, 100, ${0.15 + i * 0.05})`;
                ctx.fillRect(2 + inset, y, s - 4 - inset * 2, 1);

                // Step bottom shadow
                ctx.fillStyle = 'rgba(0,0,0,0.12)';
                ctx.fillRect(2 + inset, y + h - 1, s - 4 - inset * 2, 1);
            }

            // Up arrow hint
            ctx.strokeStyle = 'rgba(255, 200, 100, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(s / 2, s * 0.75);
            ctx.lineTo(s / 2, s * 0.35);
            ctx.lineTo(s * 0.35, s * 0.5);
            ctx.moveTo(s / 2, s * 0.35);
            ctx.lineTo(s * 0.65, s * 0.5);
            ctx.stroke();

            this.tiles[TILE.STAIRS_UP].push(canvas);
        }

        // BARREL — wooden barrel
        this.tiles[TILE.BARREL] = [];
        {
            const { canvas, ctx } = this._createCanvas();
            // Floor underneath
            ctx.fillStyle = pal.floorBase[0];
            ctx.fillRect(0, 0, s, s);
            // Barrel body
            const barrelGrad = ctx.createLinearGradient(s * 0.25, 0, s * 0.75, 0);
            barrelGrad.addColorStop(0, '#5a3a10');
            barrelGrad.addColorStop(0.3, '#8a6020');
            barrelGrad.addColorStop(0.7, '#8a6020');
            barrelGrad.addColorStop(1, '#5a3a10');
            ctx.fillStyle = barrelGrad;
            ctx.beginPath();
            ctx.ellipse(s / 2, s / 2, s * 0.35, s * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            // Metal bands
            ctx.strokeStyle = '#888899';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(s / 2, s * 0.35, s * 0.33, s * 0.08, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(s / 2, s * 0.65, s * 0.33, s * 0.08, 0, 0, Math.PI * 2);
            ctx.stroke();
            this.tiles[TILE.BARREL].push(canvas);
        }

        // CRATE — wooden crate
        this.tiles[TILE.CRATE] = [];
        {
            const { canvas, ctx } = this._createCanvas();
            ctx.fillStyle = pal.floorBase[0];
            ctx.fillRect(0, 0, s, s);
            // Crate body
            ctx.fillStyle = '#6a4a18';
            ctx.fillRect(s * 0.15, s * 0.15, s * 0.7, s * 0.7);
            // Planks
            ctx.strokeStyle = 'rgba(40,25,5,0.3)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(s * 0.15, s * 0.5);
            ctx.lineTo(s * 0.85, s * 0.5);
            ctx.stroke();
            // Cross bracing
            ctx.strokeStyle = '#886830';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(s * 0.15, s * 0.15);
            ctx.lineTo(s * 0.85, s * 0.85);
            ctx.moveTo(s * 0.85, s * 0.15);
            ctx.lineTo(s * 0.15, s * 0.85);
            ctx.stroke();
            // Border
            ctx.strokeStyle = '#4a3210';
            ctx.lineWidth = 1;
            ctx.strokeRect(s * 0.15, s * 0.15, s * 0.7, s * 0.7);
            this.tiles[TILE.CRATE].push(canvas);
        }

        // LOCKED_DOOR — door with lock
        this.tiles[TILE.LOCKED_DOOR] = [];
        {
            const { canvas, ctx } = this._createCanvas();
            ctx.fillStyle = '#3a2a0a';
            ctx.fillRect(0, 0, s, s);
            ctx.fillStyle = '#6a4a12';
            ctx.fillRect(2, 2, s - 4, s - 4);
            // Lock
            ctx.fillStyle = '#ccaa44';
            ctx.beginPath();
            ctx.arc(s / 2, s / 2, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#aa8833';
            ctx.fillRect(s / 2 - 1, s / 2, 2, 4);
            // Metal bands
            ctx.fillStyle = '#666677';
            ctx.fillRect(2, s * 0.25, s - 4, 2);
            ctx.fillRect(2, s * 0.75, s - 4, 2);
            this.tiles[TILE.LOCKED_DOOR].push(canvas);
        }

        // CRACKED_WALL — wall with cracks
        this.tiles[TILE.CRACKED_WALL] = [];
        {
            const { canvas, ctx } = this._createCanvas();
            const grad = ctx.createLinearGradient(0, 0, 0, s);
            grad.addColorStop(0, pal.wallTop);
            grad.addColorStop(1, pal.wallBottom);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, s, s);
            // Heavy cracks
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(s * 0.2, s * 0.1);
            ctx.lineTo(s * 0.5, s * 0.4);
            ctx.lineTo(s * 0.3, s * 0.7);
            ctx.lineTo(s * 0.5, s * 0.9);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(s * 0.5, s * 0.4);
            ctx.lineTo(s * 0.8, s * 0.3);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(s * 0.5, s * 0.4);
            ctx.lineTo(s * 0.7, s * 0.6);
            ctx.stroke();
            // Light through cracks
            ctx.strokeStyle = 'rgba(200,180,120,0.1)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(s * 0.22, s * 0.12);
            ctx.lineTo(s * 0.5, s * 0.4);
            ctx.stroke();
            this.tiles[TILE.CRACKED_WALL].push(canvas);
        }

        // SPIKE_TRAP — floor with spike holes
        this.tiles[TILE.SPIKE_TRAP] = [];
        {
            const { canvas, ctx } = this._createCanvas();
            ctx.fillStyle = pal.floorBase[0];
            ctx.fillRect(0, 0, s, s);
            // Spike holes
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            for (let i = 0; i < 4; i++) {
                const sx = s * 0.25 + (i % 2) * s * 0.5;
                const sy = s * 0.25 + Math.floor(i / 2) * s * 0.5;
                ctx.beginPath();
                ctx.arc(sx, sy, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            // Spike tips
            ctx.fillStyle = 'rgba(150,150,160,0.3)';
            for (let i = 0; i < 4; i++) {
                const sx = s * 0.25 + (i % 2) * s * 0.5;
                const sy = s * 0.25 + Math.floor(i / 2) * s * 0.5;
                ctx.beginPath();
                ctx.moveTo(sx, sy - 2);
                ctx.lineTo(sx - 1, sy + 1);
                ctx.lineTo(sx + 1, sy + 1);
                ctx.closePath();
                ctx.fill();
            }
            this.tiles[TILE.SPIKE_TRAP].push(canvas);
        }

        // DART_TRAP — floor with dart slot
        this.tiles[TILE.DART_TRAP] = [];
        {
            const { canvas, ctx } = this._createCanvas();
            ctx.fillStyle = pal.floorBase[0];
            ctx.fillRect(0, 0, s, s);
            // Dart hole in wall-side
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(s * 0.45, s * 0.4, s * 0.1, s * 0.2);
            // Pressure plate
            ctx.strokeStyle = 'rgba(100,100,110,0.2)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(s * 0.3, s * 0.3, s * 0.4, s * 0.4);
            this.tiles[TILE.DART_TRAP].push(canvas);
        }

        // ALARM_TRAP — floor with magical glyph
        this.tiles[TILE.ALARM_TRAP] = [];
        {
            const { canvas, ctx } = this._createCanvas();
            ctx.fillStyle = pal.floorBase[0];
            ctx.fillRect(0, 0, s, s);
            // Glyph circle
            ctx.strokeStyle = 'rgba(200,200,60,0.15)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(s / 2, s / 2, s * 0.3, 0, Math.PI * 2);
            ctx.stroke();
            // Inner rune
            ctx.strokeStyle = 'rgba(200,200,60,0.1)';
            ctx.beginPath();
            ctx.moveTo(s / 2, s * 0.25);
            ctx.lineTo(s * 0.35, s * 0.65);
            ctx.lineTo(s * 0.65, s * 0.65);
            ctx.closePath();
            ctx.stroke();
            this.tiles[TILE.ALARM_TRAP].push(canvas);
        }

        // WATER — 4 animation frames with depth gradient
        this.animated[TILE.WATER] = [];
        for (let f = 0; f < 4; f++) {
            const { canvas, ctx } = this._createCanvas();
            // Depth gradient base
            const waterGrad = ctx.createLinearGradient(0, 0, 0, s);
            waterGrad.addColorStop(0, '#1e4070');
            waterGrad.addColorStop(0.5, '#1a3a6a');
            waterGrad.addColorStop(1, '#153060');
            ctx.fillStyle = waterGrad;
            ctx.fillRect(0, 0, s, s);

            // Subtle caustic patterns (light refracting through water)
            ctx.fillStyle = 'rgba(80, 160, 230, 0.06)';
            const phase = f * Math.PI * 0.5;
            for (let i = 0; i < 4; i++) {
                const cx = ((i * 7 + f * 3) * 5) % s;
                const cy = ((i * 11 + f * 5) * 3) % s;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + 3 + Math.sin(phase + i) * 2, cy + 2);
                ctx.lineTo(cx + 1, cy + 4);
                ctx.closePath();
                ctx.fill();
            }

            // Ripple highlights (layered)
            for (let layer = 0; layer < 2; layer++) {
                ctx.strokeStyle = layer === 0 ? 'rgba(100, 180, 255, 0.2)' : 'rgba(140, 210, 255, 0.12)';
                ctx.lineWidth = layer === 0 ? 1 : 0.5;
                for (let r = 0; r < 3; r++) {
                    const yBase = s * (0.15 + r * 0.3) + layer * 4;
                    const rPhase = phase + r * 1.2 + layer * 0.7;
                    ctx.beginPath();
                    for (let x = 0; x < s; x++) {
                        const y = yBase + Math.sin(x * 0.4 + rPhase) * (2 - layer * 0.5);
                        if (x === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }
            }

            // Specular highlights (brighter, multiple)
            ctx.fillStyle = 'rgba(180, 230, 255, 0.15)';
            const hx = (8 + f * 5) % s;
            const hy = (6 + f * 3) % s;
            ctx.beginPath();
            ctx.ellipse(hx, hy, 3, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(200, 240, 255, 0.1)';
            ctx.beginPath();
            ctx.ellipse((hx + 10) % s, (hy + 8) % s, 2, 1, 0.5, 0, Math.PI * 2);
            ctx.fill();

            this.animated[TILE.WATER].push(canvas);
        }
        // Static fallback
        this.tiles[TILE.WATER] = [this.animated[TILE.WATER][0]];

        // LAVA — 4 animation frames with magma layers
        this.animated[TILE.LAVA] = [];
        for (let f = 0; f < 4; f++) {
            const { canvas, ctx } = this._createCanvas();
            // Dark magma base with gradient
            const lavaGrad = ctx.createRadialGradient(s * 0.5, s * 0.5, 1, s * 0.5, s * 0.5, s * 0.7);
            lavaGrad.addColorStop(0, '#6a2000');
            lavaGrad.addColorStop(1, '#4a1000');
            ctx.fillStyle = lavaGrad;
            ctx.fillRect(0, 0, s, s);

            // Cooled crust patches (dark spots)
            ctx.fillStyle = 'rgba(30, 5, 0, 0.3)';
            const phase = f * Math.PI * 0.5;
            for (let i = 0; i < 3; i++) {
                const cx = ((i * 11 + f * 3) * 7) % s;
                const cy = ((i * 7 + f * 5) * 11) % s;
                ctx.beginPath();
                ctx.ellipse(cx, cy, 3, 2, phase + i, 0, Math.PI * 2);
                ctx.fill();
            }

            // Magma flow veins (multiple layers)
            for (let layer = 0; layer < 2; layer++) {
                ctx.strokeStyle = layer === 0 ? 'rgba(220, 90, 0, 0.45)' : 'rgba(255, 140, 20, 0.25)';
                ctx.lineWidth = layer === 0 ? 2.5 : 1.5;
                ctx.beginPath();
                const yOff = layer * 6;
                const pOff = layer * 1.5;
                for (let x = 0; x < s; x++) {
                    const y = s * 0.4 + yOff + Math.sin(x * 0.3 + phase + pOff) * 4;
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            // Hot spots with radial glow
            const spots = [
                { x: (5 + f * 6) % s, y: (7 + f * 4) % s, r: 3.5 },
                { x: (16 + f * 3) % s, y: (14 + f * 5) % s, r: 3 },
                { x: (10 + f * 8) % s, y: (20 + f * 2) % s, r: 2.5 },
            ];
            for (const spot of spots) {
                const glow = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, spot.r * 2);
                glow.addColorStop(0, 'rgba(255, 200, 50, 0.5)');
                glow.addColorStop(0.5, 'rgba(255, 120, 0, 0.25)');
                glow.addColorStop(1, 'rgba(255, 60, 0, 0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(spot.x, spot.y, spot.r * 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Bright core specks (white-hot)
            ctx.fillStyle = 'rgba(255, 240, 150, 0.4)';
            ctx.beginPath();
            ctx.arc(spots[0].x, spots[0].y, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 220, 100, 0.3)';
            ctx.beginPath();
            ctx.arc(spots[1].x, spots[1].y, 1, 0, Math.PI * 2);
            ctx.fill();

            this.animated[TILE.LAVA].push(canvas);
        }
        this.tiles[TILE.LAVA] = [this.animated[TILE.LAVA][0]];

        // TRAP — pressure plate with subtle danger hints
        this.tiles[TILE.TRAP] = [];
        {
            const { canvas, ctx } = this._createCanvas();
            // Same as floor base
            ctx.fillStyle = '#2a2a35';
            ctx.fillRect(0, 0, s, s);

            // Floor texture (match floor tile look)
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            for (let i = 0; i < 8; i++) {
                ctx.fillRect(((i * 7 + 5) * 13) % s, ((i * 11 + 3) * 7) % s, 1, 1);
            }

            // Pressure plate — recessed rectangle
            ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
            ctx.fillRect(4, 4, s - 8, s - 8);
            // Plate edge highlight (raised look)
            ctx.strokeStyle = 'rgba(200, 50, 50, 0.12)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(4, 4, s - 8, s - 8);
            // Inner shadow (recessed)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.strokeRect(5, 5, s - 10, s - 10);

            // Tiny spike hints in cross pattern
            ctx.fillStyle = 'rgba(200, 50, 50, 0.2)';
            const cx = s / 2, cy = s / 2;
            for (let a = 0; a < 8; a++) {
                const angle = (a * Math.PI) / 4;
                const r = (a % 2 === 0) ? 5 : 3;
                const px = cx + Math.cos(angle) * r;
                const py = cy + Math.sin(angle) * r;
                ctx.beginPath();
                ctx.moveTo(px, py - 1.5);
                ctx.lineTo(px + 1, py + 0.5);
                ctx.lineTo(px - 1, py + 0.5);
                ctx.closePath();
                ctx.fill();
            }

            // Faint danger circle
            ctx.strokeStyle = 'rgba(200, 50, 50, 0.08)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(cx, cy, s * 0.3, 0, Math.PI * 2);
            ctx.stroke();

            this.tiles[TILE.TRAP].push(canvas);
        }

        // SHOP_FLOOR — checkered market floor
        this.tiles[TILE.SHOP_FLOOR] = [];
        for (let v = 0; v < 2; v++) {
            const { canvas, ctx } = this._createCanvas();
            const half = Math.floor(s / 2);

            // Checkered pattern
            for (let cy = 0; cy < 2; cy++) {
                for (let cx = 0; cx < 2; cx++) {
                    const isLight = (cx + cy + v) % 2 === 0;
                    ctx.fillStyle = isLight ? '#2e3e2e' : '#243424';
                    ctx.fillRect(cx * half, cy * half, half, half);
                }
            }

            // Subtle border
            ctx.strokeStyle = 'rgba(68, 170, 68, 0.1)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(0.5, 0.5, s - 1, s - 1);

            this.tiles[TILE.SHOP_FLOOR].push(canvas);
        }

        // VOID — just black (single)
        this.tiles[TILE.VOID] = [];
        {
            const { canvas, ctx } = this._createCanvas();
            ctx.fillStyle = '#0a0a0f';
            ctx.fillRect(0, 0, s, s);
            this.tiles[TILE.VOID].push(canvas);
        }
    }

    // ── Wall Auto-Tiling ─────────────────────────────────────

    _generateWallAutoTiles() {
        const s = this._designSize;
        const pal = this.currentPalette;

        // Generate 16 wall variants based on NSEW neighbor bitmask
        // N=1, E=2, S=4, W=8
        for (let mask = 0; mask < 16; mask++) {
            const { canvas, ctx } = this._createCanvas();
            const hasN = !!(mask & 1);
            const hasE = !!(mask & 2);
            const hasS = !!(mask & 4);
            const hasW = !!(mask & 8);

            // Base wall fill with gradient
            const grad = ctx.createLinearGradient(0, 0, 0, s);
            grad.addColorStop(0, pal.wallTop);
            grad.addColorStop(1, pal.wallBottom);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, s, s);

            // Mortar lines for interior connections
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;

            // Horizontal mortar
            ctx.beginPath();
            ctx.moveTo(0, Math.floor(s * 0.33));
            ctx.lineTo(s, Math.floor(s * 0.33));
            ctx.moveTo(0, Math.floor(s * 0.66));
            ctx.lineTo(s, Math.floor(s * 0.66));
            ctx.stroke();

            // Vertical mortar (brick pattern)
            ctx.beginPath();
            ctx.moveTo(s * 0.5, 0);
            ctx.lineTo(s * 0.5, Math.floor(s * 0.33));
            ctx.moveTo(s * 0.25, Math.floor(s * 0.33));
            ctx.lineTo(s * 0.25, Math.floor(s * 0.66));
            ctx.moveTo(s * 0.75, Math.floor(s * 0.33));
            ctx.lineTo(s * 0.75, Math.floor(s * 0.66));
            ctx.moveTo(s * 0.5, Math.floor(s * 0.66));
            ctx.lineTo(s * 0.5, s);
            ctx.stroke();

            // Exposed face edges — lighter stone face where wall meets open space
            const faceColor = 'rgba(120, 120, 150, 0.4)';
            const edgeHighlight = 'rgba(160, 160, 190, 0.3)';
            const edgeWidth = 3;

            // North face (no wall above = exposed top)
            if (!hasN) {
                ctx.fillStyle = edgeHighlight;
                ctx.fillRect(0, 0, s, edgeWidth);
                ctx.fillStyle = 'rgba(80, 80, 110, 0.2)';
                ctx.fillRect(0, edgeWidth, s, 1);
            }
            // South face (no wall below = exposed bottom)
            if (!hasS) {
                ctx.fillStyle = faceColor;
                ctx.fillRect(0, s - edgeWidth, s, edgeWidth);
                ctx.fillStyle = 'rgba(40, 40, 60, 0.3)';
                ctx.fillRect(0, s - edgeWidth, s, 1);
            }
            // West face (no wall left = exposed left)
            if (!hasW) {
                ctx.fillStyle = edgeHighlight;
                ctx.fillRect(0, 0, edgeWidth, s);
            }
            // East face (no wall right = exposed right)
            if (!hasE) {
                ctx.fillStyle = faceColor;
                ctx.fillRect(s - edgeWidth, 0, edgeWidth, s);
            }

            // Corner highlights for L-bends
            if (!hasN && !hasW) {
                ctx.fillStyle = 'rgba(180, 180, 210, 0.2)';
                ctx.fillRect(0, 0, edgeWidth, edgeWidth);
            }
            if (!hasN && !hasE) {
                ctx.fillStyle = 'rgba(150, 150, 180, 0.15)';
                ctx.fillRect(s - edgeWidth, 0, edgeWidth, edgeWidth);
            }
            if (!hasS && !hasW) {
                ctx.fillStyle = 'rgba(100, 100, 130, 0.15)';
                ctx.fillRect(0, s - edgeWidth, edgeWidth, edgeWidth);
            }
            if (!hasS && !hasE) {
                ctx.fillStyle = 'rgba(60, 60, 80, 0.2)';
                ctx.fillRect(s - edgeWidth, s - edgeWidth, edgeWidth, edgeWidth);
            }

            // Surface texture — dense noise for stone grain
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            for (let i = 0; i < 14; i++) {
                const px = ((mask * 17 + i * 13) * 7) % s;
                const py = ((mask * 11 + i * 7) * 13) % s;
                ctx.fillRect(px, py, 2, 1);
            }
            ctx.fillStyle = 'rgba(0,0,0,0.05)';
            for (let i = 0; i < 10; i++) {
                const px = ((mask * 23 + i * 11) * 9) % s;
                const py = ((mask * 7 + i * 17) * 11) % s;
                ctx.fillRect(px, py, 1, 2);
            }

            // Inner brick face shading — subtle 3D per-brick gradient
            ctx.fillStyle = 'rgba(255,255,255,0.025)';
            // Top row highlight
            ctx.fillRect(1, 1, s - 2, Math.floor(s * 0.33) - 2);

            this.wallTiles[mask] = canvas;
        }
    }

    // ── Floor Decor ──────────────────────────────────────────

    _generateDecor() {
        const s = this._designSize;
        this.decor = []; // Reset for biome switching

        // Small bone
        {
            const { canvas, ctx } = this._createCanvas();
            ctx.strokeStyle = 'rgba(180, 170, 150, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(s * 0.3, s * 0.6);
            ctx.lineTo(s * 0.7, s * 0.4);
            ctx.stroke();
            // Bone ends
            ctx.fillStyle = 'rgba(180, 170, 150, 0.15)';
            ctx.beginPath();
            ctx.arc(s * 0.3, s * 0.6, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(s * 0.7, s * 0.4, 1.5, 0, Math.PI * 2);
            ctx.fill();
            this.decor.push(canvas);
        }

        // Crack pattern
        {
            const { canvas, ctx } = this._createCanvas();
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(s * 0.2, s * 0.3);
            ctx.lineTo(s * 0.4, s * 0.5);
            ctx.lineTo(s * 0.35, s * 0.7);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(s * 0.4, s * 0.5);
            ctx.lineTo(s * 0.6, s * 0.55);
            ctx.stroke();
            this.decor.push(canvas);
        }

        // Small pebbles
        {
            const { canvas, ctx } = this._createCanvas();
            ctx.fillStyle = 'rgba(100, 100, 110, 0.15)';
            ctx.beginPath();
            ctx.ellipse(s * 0.3, s * 0.7, 1.5, 1, 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(s * 0.6, s * 0.4, 1, 1, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(s * 0.7, s * 0.65, 1.2, 0.8, -0.3, 0, Math.PI * 2);
            ctx.fill();
            this.decor.push(canvas);
        }

        // Cobweb corner
        {
            const { canvas, ctx } = this._createCanvas();
            ctx.strokeStyle = 'rgba(200, 200, 210, 0.08)';
            ctx.lineWidth = 0.5;
            // Radial threads from corner
            for (let i = 0; i < 4; i++) {
                const angle = (i / 3) * Math.PI * 0.5;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * s * 0.5, Math.sin(angle) * s * 0.5);
                ctx.stroke();
            }
            // Cross threads
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.2, 0, Math.PI * 0.5);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.35, 0, Math.PI * 0.5);
            ctx.stroke();
            this.decor.push(canvas);
        }

        // Moss/stain
        {
            const { canvas, ctx } = this._createCanvas();
            ctx.fillStyle = 'rgba(60, 80, 50, 0.08)';
            ctx.beginPath();
            ctx.ellipse(s * 0.5, s * 0.5, 4, 3, 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(50, 70, 40, 0.06)';
            ctx.beginPath();
            ctx.ellipse(s * 0.4, s * 0.55, 3, 2, -0.2, 0, Math.PI * 2);
            ctx.fill();
            this.decor.push(canvas);
        }
    }

    // ── Biome-Specific Decor ─────────────────────────────────

    _generateBiomeDecor(biome) {
        const s = this._designSize;
        const biomeKey = Object.keys(BIOME_DATA).find(k => BIOME_DATA[k] === biome);

        if (biomeKey === BIOME.CAVERN) {
            // Stalactite drip
            {
                const { canvas, ctx } = this._createCanvas();
                ctx.fillStyle = 'rgba(80, 140, 160, 0.15)';
                ctx.beginPath();
                ctx.moveTo(s * 0.45, 0);
                ctx.lineTo(s * 0.5, s * 0.35);
                ctx.lineTo(s * 0.55, 0);
                ctx.closePath();
                ctx.fill();
                // Drip
                ctx.fillStyle = 'rgba(100, 180, 220, 0.2)';
                ctx.beginPath();
                ctx.arc(s * 0.5, s * 0.42, 1, 0, Math.PI * 2);
                ctx.fill();
                this.decor.push(canvas);
            }
            // Glowing mushroom
            {
                const { canvas, ctx } = this._createCanvas();
                ctx.fillStyle = 'rgba(60, 200, 180, 0.12)';
                ctx.beginPath();
                ctx.ellipse(s * 0.4, s * 0.7, 2.5, 1.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(40, 160, 140, 0.15)';
                ctx.fillRect(s * 0.38, s * 0.72, 1, 3);
                // Glow
                ctx.fillStyle = 'rgba(80, 255, 220, 0.06)';
                ctx.beginPath();
                ctx.arc(s * 0.4, s * 0.7, 5, 0, Math.PI * 2);
                ctx.fill();
                this.decor.push(canvas);
            }
            // Puddle
            {
                const { canvas, ctx } = this._createCanvas();
                ctx.fillStyle = 'rgba(40, 100, 140, 0.1)';
                ctx.beginPath();
                ctx.ellipse(s * 0.5, s * 0.55, 5, 2.5, 0.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(80, 160, 200, 0.08)';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.ellipse(s * 0.5, s * 0.55, 3, 1.5, 0.2, 0, Math.PI * 2);
                ctx.stroke();
                this.decor.push(canvas);
            }
        } else if (biomeKey === BIOME.INFERNO) {
            // Scorched mark
            {
                const { canvas, ctx } = this._createCanvas();
                ctx.fillStyle = 'rgba(20, 10, 5, 0.15)';
                ctx.beginPath();
                ctx.ellipse(s * 0.5, s * 0.5, 5, 4, 0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(80, 30, 10, 0.08)';
                ctx.beginPath();
                ctx.ellipse(s * 0.5, s * 0.5, 3, 2.5, 0.3, 0, Math.PI * 2);
                ctx.fill();
                this.decor.push(canvas);
            }
            // Ember crack
            {
                const { canvas, ctx } = this._createCanvas();
                ctx.strokeStyle = 'rgba(255, 100, 20, 0.15)';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(s * 0.2, s * 0.4);
                ctx.lineTo(s * 0.45, s * 0.5);
                ctx.lineTo(s * 0.7, s * 0.35);
                ctx.stroke();
                // Ember glow
                ctx.fillStyle = 'rgba(255, 80, 10, 0.08)';
                ctx.beginPath();
                ctx.arc(s * 0.45, s * 0.5, 3, 0, Math.PI * 2);
                ctx.fill();
                this.decor.push(canvas);
            }
            // Slag pile
            {
                const { canvas, ctx } = this._createCanvas();
                ctx.fillStyle = 'rgba(60, 30, 15, 0.18)';
                ctx.beginPath();
                ctx.ellipse(s * 0.55, s * 0.65, 3, 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(100, 40, 10, 0.1)';
                ctx.beginPath();
                ctx.ellipse(s * 0.5, s * 0.6, 2, 1.5, 0.5, 0, Math.PI * 2);
                ctx.fill();
                this.decor.push(canvas);
            }
        } else if (biomeKey === BIOME.THRONE) {
            // Void crack
            {
                const { canvas, ctx } = this._createCanvas();
                ctx.strokeStyle = 'rgba(120, 40, 200, 0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(s * 0.15, s * 0.5);
                ctx.lineTo(s * 0.4, s * 0.45);
                ctx.lineTo(s * 0.6, s * 0.55);
                ctx.lineTo(s * 0.85, s * 0.5);
                ctx.stroke();
                // Inner glow
                ctx.strokeStyle = 'rgba(180, 80, 255, 0.1)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(s * 0.25, s * 0.48);
                ctx.lineTo(s * 0.5, s * 0.5);
                ctx.lineTo(s * 0.75, s * 0.52);
                ctx.stroke();
                this.decor.push(canvas);
            }
            // Eldritch rune
            {
                const { canvas, ctx } = this._createCanvas();
                ctx.strokeStyle = 'rgba(160, 60, 255, 0.12)';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.arc(s * 0.5, s * 0.5, 4, 0, Math.PI * 2);
                ctx.stroke();
                // Inner symbol
                ctx.beginPath();
                ctx.moveTo(s * 0.5, s * 0.3);
                ctx.lineTo(s * 0.35, s * 0.65);
                ctx.lineTo(s * 0.65, s * 0.65);
                ctx.closePath();
                ctx.stroke();
                // Glow
                ctx.fillStyle = 'rgba(140, 40, 255, 0.04)';
                ctx.beginPath();
                ctx.arc(s * 0.5, s * 0.5, 7, 0, Math.PI * 2);
                ctx.fill();
                this.decor.push(canvas);
            }
            // Corrupted crystal
            {
                const { canvas, ctx } = this._createCanvas();
                ctx.fillStyle = 'rgba(100, 30, 180, 0.15)';
                ctx.beginPath();
                ctx.moveTo(s * 0.45, s * 0.75);
                ctx.lineTo(s * 0.4, s * 0.45);
                ctx.lineTo(s * 0.5, s * 0.3);
                ctx.lineTo(s * 0.6, s * 0.45);
                ctx.lineTo(s * 0.55, s * 0.75);
                ctx.closePath();
                ctx.fill();
                // Crystal highlight
                ctx.strokeStyle = 'rgba(200, 120, 255, 0.15)';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(s * 0.48, s * 0.4);
                ctx.lineTo(s * 0.5, s * 0.32);
                ctx.lineTo(s * 0.55, s * 0.42);
                ctx.stroke();
                this.decor.push(canvas);
            }
        }
        // Crypt uses the default decor (bones, cracks, pebbles, cobwebs, moss)
    }

    // ── Wall-Floor Shadows ───────────────────────────────────

    _generateWallShadows() {
        const s = this._designSize;
        const shadowDepth = 5;

        // Shadow on south edge (wall is to the north)
        {
            const { canvas, ctx } = this._createCanvas();
            const grad = ctx.createLinearGradient(0, 0, 0, shadowDepth);
            grad.addColorStop(0, 'rgba(0, 0, 10, 0.35)');
            grad.addColorStop(1, 'rgba(0, 0, 10, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, s, shadowDepth);
            this.wallShadows['N'] = canvas;
        }

        // Shadow on north edge (wall is to the south)
        {
            const { canvas, ctx } = this._createCanvas();
            const grad = ctx.createLinearGradient(0, s, 0, s - shadowDepth);
            grad.addColorStop(0, 'rgba(0, 0, 10, 0.25)');
            grad.addColorStop(1, 'rgba(0, 0, 10, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, s - shadowDepth, s, shadowDepth);
            this.wallShadows['S'] = canvas;
        }

        // Shadow on east edge (wall is to the west)
        {
            const { canvas, ctx } = this._createCanvas();
            const grad = ctx.createLinearGradient(0, 0, shadowDepth, 0);
            grad.addColorStop(0, 'rgba(0, 0, 10, 0.3)');
            grad.addColorStop(1, 'rgba(0, 0, 10, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, shadowDepth, s);
            this.wallShadows['W'] = canvas;
        }

        // Shadow on west edge (wall is to the east)
        {
            const { canvas, ctx } = this._createCanvas();
            const grad = ctx.createLinearGradient(s, 0, s - shadowDepth, 0);
            grad.addColorStop(0, 'rgba(0, 0, 10, 0.2)');
            grad.addColorStop(1, 'rgba(0, 0, 10, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(s - shadowDepth, 0, shadowDepth, s);
            this.wallShadows['E'] = canvas;
        }
    }

    // ── Entity Drop Shadow ────────────────────────────────────

    _generateEntityShadow() {
        const s = this._designSize;
        const { canvas, ctx } = this._createCanvas();
        const cx = s / 2, cy = s * 0.82;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.32);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.28)');
        grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.12)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, s * 0.32, s * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        this.entityShadow = canvas;
    }

    // ── Enemy Generation ─────────────────────────────────────

    _generateEnemies() {
        const s = this._designSize;

        // Helper to draw eyes
        const drawEyes = (ctx, lx, ly, rx, ry, r, color) => {
            ctx.fillStyle = color || '#ff3333';
            ctx.beginPath();
            ctx.arc(lx, ly, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(rx, ry, r, 0, Math.PI * 2);
            ctx.fill();
        };

        // Helper: add rim light to a sprite (top-left highlight)
        const addRimLight = (ctx, cx, cy, radius, color) => {
            const rimGrad = ctx.createRadialGradient(cx - radius * 0.4, cy - radius * 0.4, 0, cx, cy, radius);
            rimGrad.addColorStop(0, color || 'rgba(255,255,255,0.12)');
            rimGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = rimGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
        };

        // RAT
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#8B7355';
            const cx = s / 2, cy = s / 2;

            // Body
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.ellipse(cx + 1, cy + 2, 6, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.beginPath();
            ctx.ellipse(cx - 5, cy, 4, 3, -0.3, 0, Math.PI * 2);
            ctx.fill();

            // Snout
            ctx.beginPath();
            ctx.ellipse(cx - 9, cy + 1, 2, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Ears
            ctx.beginPath();
            ctx.arc(cx - 5, cy - 3, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx - 3, cy - 3, 2, 0, Math.PI * 2);
            ctx.fill();

            // Tail
            ctx.strokeStyle = c;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx + 7, cy + 2);
            ctx.quadraticCurveTo(cx + 11, cy - 2, cx + 10, cy - 5);
            ctx.stroke();

            // Eye
            ctx.fillStyle = '#ff2222';
            ctx.beginPath();
            ctx.arc(cx - 7, cy - 1, 1, 0, Math.PI * 2);
            ctx.fill();

            // Nose
            ctx.fillStyle = '#553333';
            ctx.beginPath();
            ctx.arc(cx - 11, cy + 1, 0.8, 0, Math.PI * 2);
            ctx.fill();

            this.enemies.rat = canvas;
        }

        // SLIME
        {
            const { canvas, ctx } = this._createCanvas();
            const cx = s / 2, cy = s / 2 + 2;

            // Body (blob shape)
            const grad = ctx.createRadialGradient(cx - 2, cy - 3, 1, cx, cy, 9);
            grad.addColorStop(0, '#88ff88');
            grad.addColorStop(0.5, '#44cc44');
            grad.addColorStop(1, '#228822');
            ctx.fillStyle = grad;

            ctx.beginPath();
            ctx.moveTo(cx - 8, cy + 4);
            ctx.quadraticCurveTo(cx - 9, cy - 4, cx - 3, cy - 7);
            ctx.quadraticCurveTo(cx + 2, cy - 9, cx + 5, cy - 6);
            ctx.quadraticCurveTo(cx + 10, cy - 2, cx + 8, cy + 4);
            ctx.quadraticCurveTo(cx, cy + 6, cx - 8, cy + 4);
            ctx.fill();

            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath();
            ctx.ellipse(cx - 2, cy - 4, 3, 2, -0.3, 0, Math.PI * 2);
            ctx.fill();

            // Eyes
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(cx - 3, cy - 2, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + 2, cy - 2, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#113311';
            ctx.beginPath();
            ctx.arc(cx - 3, cy - 1.5, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + 2, cy - 1.5, 1, 0, Math.PI * 2);
            ctx.fill();

            this.enemies.slime = canvas;
        }

        // GOBLIN
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#66aa44';
            const cx = s / 2, cy = s / 2;

            // Body (hunched)
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.ellipse(cx, cy + 3, 5, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.beginPath();
            ctx.ellipse(cx, cy - 4, 4, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Pointy ears
            ctx.beginPath();
            ctx.moveTo(cx - 4, cy - 5);
            ctx.lineTo(cx - 8, cy - 8);
            ctx.lineTo(cx - 3, cy - 3);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 4, cy - 5);
            ctx.lineTo(cx + 8, cy - 8);
            ctx.lineTo(cx + 3, cy - 3);
            ctx.closePath();
            ctx.fill();

            // Eyes (glowing yellow)
            drawEyes(ctx, cx - 2, cy - 5, cx + 2, cy - 5, 1.2, '#ffff44');

            // Mouth
            ctx.strokeStyle = '#335522';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(cx, cy - 2, 2, 0, Math.PI);
            ctx.stroke();

            this.enemies.goblin = canvas;
        }

        // BAT
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#886688';
            const cx = s / 2, cy = s / 2;

            // Wings
            ctx.fillStyle = c;
            // Left wing
            ctx.beginPath();
            ctx.moveTo(cx - 1, cy);
            ctx.quadraticCurveTo(cx - 6, cy - 6, cx - 10, cy - 2);
            ctx.quadraticCurveTo(cx - 8, cy + 1, cx - 5, cy + 3);
            ctx.quadraticCurveTo(cx - 3, cy + 1, cx - 1, cy);
            ctx.fill();
            // Right wing
            ctx.beginPath();
            ctx.moveTo(cx + 1, cy);
            ctx.quadraticCurveTo(cx + 6, cy - 6, cx + 10, cy - 2);
            ctx.quadraticCurveTo(cx + 8, cy + 1, cx + 5, cy + 3);
            ctx.quadraticCurveTo(cx + 3, cy + 1, cx + 1, cy);
            ctx.fill();

            // Body
            ctx.beginPath();
            ctx.ellipse(cx, cy, 3, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Ears
            ctx.beginPath();
            ctx.moveTo(cx - 2, cy - 3);
            ctx.lineTo(cx - 3, cy - 7);
            ctx.lineTo(cx, cy - 4);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 2, cy - 3);
            ctx.lineTo(cx + 3, cy - 7);
            ctx.lineTo(cx, cy - 4);
            ctx.fill();

            // Eyes
            drawEyes(ctx, cx - 1.5, cy - 1, cx + 1.5, cy - 1, 0.8, '#ff4466');

            this.enemies.bat = canvas;
        }

        // SKELETON
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#ddddcc';
            const cx = s / 2, cy = s / 2;

            // Skull
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(cx, cy - 4, 5, 0, Math.PI * 2);
            ctx.fill();

            // Eye sockets (dark)
            ctx.fillStyle = '#222222';
            ctx.beginPath();
            ctx.ellipse(cx - 2, cy - 5, 1.5, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx + 2, cy - 5, 1.5, 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Nose hole
            ctx.beginPath();
            ctx.moveTo(cx, cy - 3);
            ctx.lineTo(cx - 1, cy - 1.5);
            ctx.lineTo(cx + 1, cy - 1.5);
            ctx.closePath();
            ctx.fill();

            // Jaw line
            ctx.strokeStyle = c;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx - 3, cy - 1);
            ctx.lineTo(cx - 2, cy + 1);
            ctx.lineTo(cx + 2, cy + 1);
            ctx.lineTo(cx + 3, cy - 1);
            ctx.stroke();

            // Teeth
            ctx.fillStyle = c;
            for (let i = -2; i <= 2; i++) {
                ctx.fillRect(cx + i * 1.2 - 0.4, cy - 1, 0.8, 1.5);
            }

            // Ribcage
            ctx.strokeStyle = c;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(cx, cy + 2);
            ctx.lineTo(cx, cy + 8);
            ctx.stroke();
            for (let i = 0; i < 3; i++) {
                const ry = cy + 3 + i * 2;
                ctx.beginPath();
                ctx.moveTo(cx - 4, ry);
                ctx.quadraticCurveTo(cx, ry + 1, cx + 4, ry);
                ctx.stroke();
            }

            // Eye glow
            ctx.fillStyle = 'rgba(255, 50, 50, 0.5)';
            ctx.beginPath();
            ctx.arc(cx - 2, cy - 5, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + 2, cy - 5, 1, 0, Math.PI * 2);
            ctx.fill();

            addRimLight(ctx, cx, cy - 2, 8, 'rgba(220,220,200,0.08)');
            this.enemies.skeleton = canvas;
        }

        // ORC
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#448844';
            const cx = s / 2, cy = s / 2;

            // Body (broad)
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.ellipse(cx, cy + 3, 7, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.beginPath();
            ctx.ellipse(cx, cy - 4, 5, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Heavy brow
            ctx.fillStyle = '#336633';
            ctx.fillRect(cx - 5, cy - 7, 10, 2);

            // Eyes (under brow)
            drawEyes(ctx, cx - 2, cy - 4, cx + 2, cy - 4, 1.2, '#ff4444');

            // Tusks
            ctx.fillStyle = '#ccccaa';
            ctx.beginPath();
            ctx.moveTo(cx - 3, cy - 1);
            ctx.lineTo(cx - 4, cy - 4);
            ctx.lineTo(cx - 2, cy - 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 3, cy - 1);
            ctx.lineTo(cx + 4, cy - 4);
            ctx.lineTo(cx + 2, cy - 2);
            ctx.fill();

            // Arms
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.ellipse(cx - 8, cy + 2, 3, 5, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx + 8, cy + 2, 3, 5, 0.3, 0, Math.PI * 2);
            ctx.fill();

            addRimLight(ctx, cx, cy, 9, 'rgba(100,200,100,0.06)');
            this.enemies.orc = canvas;
        }

        // DARK MAGE
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#9944cc';
            const cx = s / 2, cy = s / 2;

            // Robe body
            ctx.fillStyle = '#3a1a4a';
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy - 2);
            ctx.lineTo(cx - 7, cy + 9);
            ctx.lineTo(cx + 7, cy + 9);
            ctx.lineTo(cx + 5, cy - 2);
            ctx.closePath();
            ctx.fill();

            // Hood
            ctx.fillStyle = '#2a1a35';
            ctx.beginPath();
            ctx.arc(cx, cy - 4, 5, Math.PI, 0);
            ctx.lineTo(cx + 5, cy);
            ctx.lineTo(cx - 5, cy);
            ctx.closePath();
            ctx.fill();

            // Glowing eyes under hood
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(cx - 2, cy - 3, 1.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + 2, cy - 3, 1.2, 0, Math.PI * 2);
            ctx.fill();

            // Eye glow
            ctx.fillStyle = 'rgba(153, 68, 204, 0.3)';
            ctx.beginPath();
            ctx.arc(cx - 2, cy - 3, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + 2, cy - 3, 3, 0, Math.PI * 2);
            ctx.fill();

            // Staff
            ctx.strokeStyle = '#664422';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx + 7, cy - 8);
            ctx.lineTo(cx + 7, cy + 9);
            ctx.stroke();

            // Staff orb
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(cx + 7, cy - 9, 2, 0, Math.PI * 2);
            ctx.fill();

            this.enemies.darkMage = canvas;
        }

        // SPIDER
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#444444';
            const cx = s / 2, cy = s / 2;

            // Legs (8 total)
            ctx.strokeStyle = c;
            ctx.lineWidth = 1;
            const legAngles = [-0.8, -0.4, 0.4, 0.8];
            for (const angle of legAngles) {
                // Left
                ctx.beginPath();
                ctx.moveTo(cx - 2, cy);
                const kx = cx - 7 + Math.abs(angle) * 2;
                const ky = cy + angle * 8;
                ctx.quadraticCurveTo(cx - 8, cy + angle * 4, kx, ky);
                ctx.stroke();
                // Right
                ctx.beginPath();
                ctx.moveTo(cx + 2, cy);
                ctx.quadraticCurveTo(cx + 8, cy + angle * 4, cx + 7 - Math.abs(angle) * 2, ky);
                ctx.stroke();
            }

            // Body (abdomen)
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.ellipse(cx, cy + 2, 4, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Cephalothorax
            ctx.beginPath();
            ctx.ellipse(cx, cy - 3, 3, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Eyes (multiple)
            ctx.fillStyle = '#ff2222';
            const eyePos = [
                [cx - 2, cy - 4], [cx + 2, cy - 4],
                [cx - 1, cy - 5], [cx + 1, cy - 5],
            ];
            for (const [ex, ey] of eyePos) {
                ctx.beginPath();
                ctx.arc(ex, ey, 0.7, 0, Math.PI * 2);
                ctx.fill();
            }

            // Abdomen marking
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx - 2, cy + 4);
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + 2, cy + 4);
            ctx.stroke();

            this.enemies.spider = canvas;
        }

        // DEMON
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#cc2222';
            const cx = s / 2, cy = s / 2;

            // Body
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.ellipse(cx, cy + 2, 6, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.beginPath();
            ctx.arc(cx, cy - 5, 4, 0, Math.PI * 2);
            ctx.fill();

            // Horns
            ctx.fillStyle = '#441111';
            ctx.beginPath();
            ctx.moveTo(cx - 3, cy - 7);
            ctx.lineTo(cx - 6, cy - 12);
            ctx.lineTo(cx - 1, cy - 7);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 3, cy - 7);
            ctx.lineTo(cx + 6, cy - 12);
            ctx.lineTo(cx + 1, cy - 7);
            ctx.fill();

            // Wings (small)
            ctx.fillStyle = 'rgba(140, 20, 20, 0.7)';
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy);
            ctx.quadraticCurveTo(cx - 12, cy - 4, cx - 9, cy + 4);
            ctx.lineTo(cx - 5, cy + 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 5, cy);
            ctx.quadraticCurveTo(cx + 12, cy - 4, cx + 9, cy + 4);
            ctx.lineTo(cx + 5, cy + 2);
            ctx.fill();

            // Eyes
            drawEyes(ctx, cx - 2, cy - 6, cx + 2, cy - 6, 1.2, '#ffff00');

            addRimLight(ctx, cx, cy - 2, 10, 'rgba(255,100,50,0.08)');
            this.enemies.demon = canvas;
        }

        // LICH
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#aaccff';
            const cx = s / 2, cy = s / 2;

            // Floating robe
            ctx.fillStyle = '#2a2a55';
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy - 1);
            ctx.lineTo(cx - 7, cy + 10);
            ctx.quadraticCurveTo(cx - 4, cy + 8, cx, cy + 10);
            ctx.quadraticCurveTo(cx + 4, cy + 8, cx + 7, cy + 10);
            ctx.lineTo(cx + 5, cy - 1);
            ctx.closePath();
            ctx.fill();

            // Skull face
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(cx, cy - 4, 4.5, 0, Math.PI * 2);
            ctx.fill();

            // Eye sockets
            ctx.fillStyle = '#000033';
            ctx.beginPath();
            ctx.ellipse(cx - 2, cy - 5, 1.5, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx + 2, cy - 5, 1.5, 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Soul fire eyes
            ctx.fillStyle = '#4488ff';
            ctx.beginPath();
            ctx.arc(cx - 2, cy - 5, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + 2, cy - 5, 1, 0, Math.PI * 2);
            ctx.fill();

            // Spectral crown
            ctx.strokeStyle = 'rgba(100, 150, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy - 7);
            ctx.lineTo(cx - 3, cy - 10);
            ctx.lineTo(cx - 1, cy - 8);
            ctx.lineTo(cx + 1, cy - 10);
            ctx.lineTo(cx + 3, cy - 8);
            ctx.lineTo(cx + 5, cy - 10);
            ctx.lineTo(cx + 5, cy - 7);
            ctx.stroke();

            this.enemies.lich = canvas;
        }

        // DRAGON
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#ff8844';
            const cx = s / 2, cy = s / 2;

            // Body
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.ellipse(cx + 1, cy + 2, 6, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.beginPath();
            ctx.ellipse(cx - 4, cy - 3, 5, 4, -0.2, 0, Math.PI * 2);
            ctx.fill();

            // Snout
            ctx.beginPath();
            ctx.ellipse(cx - 9, cy - 2, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Horns
            ctx.fillStyle = '#cc6622';
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy - 6);
            ctx.lineTo(cx - 8, cy - 11);
            ctx.lineTo(cx - 3, cy - 6);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx - 2, cy - 6);
            ctx.lineTo(cx + 1, cy - 11);
            ctx.lineTo(cx, cy - 6);
            ctx.fill();

            // Eye
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(cx - 6, cy - 4, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.ellipse(cx - 6, cy - 4, 0.5, 1.2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Scales hint
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(cx + 1 + i * 2, cy + 2, 2, 0, Math.PI);
                ctx.stroke();
            }

            // Wing
            ctx.fillStyle = 'rgba(200, 100, 40, 0.6)';
            ctx.beginPath();
            ctx.moveTo(cx + 3, cy - 1);
            ctx.quadraticCurveTo(cx + 10, cy - 10, cx + 11, cy - 2);
            ctx.lineTo(cx + 7, cy + 1);
            ctx.closePath();
            ctx.fill();

            addRimLight(ctx, cx, cy, 10, 'rgba(255,180,80,0.08)');
            this.enemies.dragon = canvas;
        }

        // GOLEM
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#888888';
            const cx = s / 2, cy = s / 2;

            // Blocky body
            ctx.fillStyle = c;
            ctx.fillRect(cx - 6, cy - 2, 12, 12);

            // Head
            ctx.fillRect(cx - 4, cy - 8, 8, 7);

            // Stone texture lines
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(cx - 6, cy + 4);
            ctx.lineTo(cx + 6, cy + 4);
            ctx.moveTo(cx, cy - 2);
            ctx.lineTo(cx, cy + 10);
            ctx.stroke();

            // Rune eye (glowing)
            ctx.fillStyle = '#44aaff';
            ctx.beginPath();
            ctx.arc(cx, cy - 5, 2, 0, Math.PI * 2);
            ctx.fill();

            // Eye glow
            ctx.fillStyle = 'rgba(68, 170, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(cx, cy - 5, 4, 0, Math.PI * 2);
            ctx.fill();

            // Arms
            ctx.fillStyle = '#777777';
            ctx.fillRect(cx - 10, cy - 1, 4, 8);
            ctx.fillRect(cx + 6, cy - 1, 4, 8);

            this.enemies.golem = canvas;
        }

        // WRAITH
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#aaaadd';
            const cx = s / 2, cy = s / 2;

            // Ghostly body (flowing shape)
            const grad = ctx.createLinearGradient(cx, cy - 8, cx, cy + 10);
            grad.addColorStop(0, 'rgba(170, 170, 221, 0.8)');
            grad.addColorStop(1, 'rgba(170, 170, 221, 0.1)');
            ctx.fillStyle = grad;

            ctx.beginPath();
            ctx.moveTo(cx - 5, cy - 6);
            ctx.quadraticCurveTo(cx, cy - 10, cx + 5, cy - 6);
            ctx.lineTo(cx + 7, cy + 6);
            ctx.quadraticCurveTo(cx + 5, cy + 4, cx + 3, cy + 7);
            ctx.quadraticCurveTo(cx + 1, cy + 4, cx - 1, cy + 8);
            ctx.quadraticCurveTo(cx - 3, cy + 4, cx - 5, cy + 7);
            ctx.quadraticCurveTo(cx - 6, cy + 5, cx - 7, cy + 6);
            ctx.closePath();
            ctx.fill();

            // Hollow eyes
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(cx - 2, cy - 4, 2, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx + 2, cy - 4, 2, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Dark inner eye
            ctx.fillStyle = '#222244';
            ctx.beginPath();
            ctx.ellipse(cx - 2, cy - 4, 1, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx + 2, cy - 4, 1, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();

            this.enemies.wraith = canvas;
        }

        // GOBLIN KING (boss)
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#ccaa22';
            const cx = s / 2, cy = s / 2;

            // Body (larger goblin)
            ctx.fillStyle = '#66aa44';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 3, 6, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.beginPath();
            ctx.ellipse(cx, cy - 4, 5, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Ears
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy - 5);
            ctx.lineTo(cx - 9, cy - 10);
            ctx.lineTo(cx - 3, cy - 3);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 5, cy - 5);
            ctx.lineTo(cx + 9, cy - 10);
            ctx.lineTo(cx + 3, cy - 3);
            ctx.fill();

            // Crown
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy - 6);
            ctx.lineTo(cx - 4, cy - 10);
            ctx.lineTo(cx - 2, cy - 7);
            ctx.lineTo(cx, cy - 11);
            ctx.lineTo(cx + 2, cy - 7);
            ctx.lineTo(cx + 4, cy - 10);
            ctx.lineTo(cx + 5, cy - 6);
            ctx.closePath();
            ctx.fill();

            // Crown gems
            ctx.fillStyle = '#ff2222';
            ctx.beginPath();
            ctx.arc(cx, cy - 9, 1, 0, Math.PI * 2);
            ctx.fill();

            // Eyes
            drawEyes(ctx, cx - 2, cy - 5, cx + 2, cy - 5, 1.3, '#ffff44');

            // Cape
            ctx.fillStyle = 'rgba(160, 30, 30, 0.5)';
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy - 1);
            ctx.lineTo(cx - 8, cy + 9);
            ctx.lineTo(cx + 8, cy + 9);
            ctx.lineTo(cx + 5, cy - 1);
            ctx.closePath();
            ctx.fill();

            addRimLight(ctx, cx, cy, 10, 'rgba(255,220,50,0.1)');
            this.enemies.goblinKing = canvas;
        }

        // NECROMANCER (boss)
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#8844aa';
            const cx = s / 2, cy = s / 2;

            // Tall robe
            ctx.fillStyle = '#1a0a2a';
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy - 3);
            ctx.lineTo(cx - 8, cy + 10);
            ctx.lineTo(cx + 8, cy + 10);
            ctx.lineTo(cx + 5, cy - 3);
            ctx.closePath();
            ctx.fill();

            // Hood (pointed)
            ctx.fillStyle = '#120820';
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy - 2);
            ctx.quadraticCurveTo(cx, cy - 12, cx + 5, cy - 2);
            ctx.closePath();
            ctx.fill();

            // Eyes
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(cx - 2, cy - 4, 1.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + 2, cy - 4, 1.3, 0, Math.PI * 2);
            ctx.fill();

            // Skull staff
            ctx.strokeStyle = '#555544';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx - 7, cy - 8);
            ctx.lineTo(cx - 7, cy + 9);
            ctx.stroke();

            // Skull on staff
            ctx.fillStyle = '#ccccbb';
            ctx.beginPath();
            ctx.arc(cx - 7, cy - 9, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#220022';
            ctx.beginPath();
            ctx.arc(cx - 8, cy - 9.5, 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx - 6, cy - 9.5, 0.7, 0, Math.PI * 2);
            ctx.fill();

            // Magic circles around
            ctx.strokeStyle = 'rgba(136, 68, 170, 0.3)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(cx, cy, 10, 0, Math.PI * 2);
            ctx.stroke();

            addRimLight(ctx, cx, cy, 11, 'rgba(160,80,220,0.1)');
            this.enemies.necromancer = canvas;
        }

        // DEMON LORD (boss)
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#ff2222';
            const cx = s / 2, cy = s / 2;

            // Massive body
            ctx.fillStyle = '#aa1111';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 2, 8, 7, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(cx, cy - 6, 5, 0, Math.PI * 2);
            ctx.fill();

            // Large horns (kept within tile bounds)
            ctx.fillStyle = '#331111';
            ctx.beginPath();
            ctx.moveTo(cx - 4, cy - 8);
            ctx.quadraticCurveTo(cx - 8, cy - 11, cx - 2, cy - 10);
            ctx.lineTo(cx - 2, cy - 8);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 4, cy - 8);
            ctx.quadraticCurveTo(cx + 8, cy - 11, cx + 2, cy - 10);
            ctx.lineTo(cx + 2, cy - 8);
            ctx.fill();

            // Wings
            ctx.fillStyle = 'rgba(130, 10, 10, 0.6)';
            ctx.beginPath();
            ctx.moveTo(cx - 6, cy - 2);
            ctx.quadraticCurveTo(cx - 14, cy - 10, cx - 11, cy + 3);
            ctx.lineTo(cx - 6, cy + 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 6, cy - 2);
            ctx.quadraticCurveTo(cx + 14, cy - 10, cx + 11, cy + 3);
            ctx.lineTo(cx + 6, cy + 2);
            ctx.fill();

            // Burning eyes
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(cx - 2, cy - 7, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + 2, cy - 7, 1.5, 0, Math.PI * 2);
            ctx.fill();

            // Flame aura
            ctx.fillStyle = 'rgba(255, 100, 0, 0.15)';
            ctx.beginPath();
            ctx.arc(cx, cy, 11, 0, Math.PI * 2);
            ctx.fill();

            addRimLight(ctx, cx, cy, 11, 'rgba(255,80,0,0.12)');
            this.enemies.demonLord = canvas;
        }

        // VALRATH (final boss)
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#ff00ff';
            const cx = s / 2, cy = s / 2;

            // Eldritch body (amorphous)
            const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 10);
            grad.addColorStop(0, '#ff44ff');
            grad.addColorStop(0.5, '#aa00aa');
            grad.addColorStop(1, '#440044');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(cx - 7, cy + 5);
            ctx.quadraticCurveTo(cx - 10, cy - 3, cx - 4, cy - 8);
            ctx.quadraticCurveTo(cx, cy - 11, cx + 4, cy - 8);
            ctx.quadraticCurveTo(cx + 10, cy - 3, cx + 7, cy + 5);
            ctx.quadraticCurveTo(cx + 3, cy + 8, cx, cy + 7);
            ctx.quadraticCurveTo(cx - 3, cy + 8, cx - 7, cy + 5);
            ctx.fill();

            // Multiple eyes
            ctx.fillStyle = '#ffff00';
            const eyes = [
                [cx - 3, cy - 5, 1.2],
                [cx + 3, cy - 5, 1.2],
                [cx, cy - 3, 1.5],
                [cx - 5, cy - 2, 0.8],
                [cx + 5, cy - 2, 0.8],
                [cx - 2, cy, 0.6],
                [cx + 2, cy, 0.6],
            ];
            for (const [ex, ey, er] of eyes) {
                ctx.beginPath();
                ctx.arc(ex, ey, er, 0, Math.PI * 2);
                ctx.fill();
            }
            // Black pupils
            ctx.fillStyle = '#220022';
            for (const [ex, ey, er] of eyes) {
                ctx.beginPath();
                ctx.arc(ex, ey, er * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Tentacle appendages
            ctx.strokeStyle = 'rgba(200, 0, 200, 0.6)';
            ctx.lineWidth = 1.5;
            const tentacles = [
                [cx - 7, cy + 4, cx - 11, cy + 8],
                [cx - 5, cy + 6, cx - 8, cy + 11],
                [cx + 7, cy + 4, cx + 11, cy + 8],
                [cx + 5, cy + 6, cx + 8, cy + 11],
                [cx - 3, cy + 7, cx - 2, cy + 11],
                [cx + 3, cy + 7, cx + 2, cy + 11],
            ];
            for (const [sx, sy, ex, ey] of tentacles) {
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.quadraticCurveTo(sx + (ex - sx) * 0.5 + 2, sy + (ey - sy) * 0.3, ex, ey);
                ctx.stroke();
            }

            // Crown of thorns (scaled to fit within tile)
            ctx.strokeStyle = '#660066';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < 7; i++) {
                const angle = Math.PI + (i / 6) * Math.PI;
                const r1 = 5;
                const r2 = 8;
                ctx.moveTo(cx + Math.cos(angle) * r1, cy - 3 + Math.sin(angle) * r1);
                ctx.lineTo(cx + Math.cos(angle) * r2, cy - 3 + Math.sin(angle) * r2);
            }
            ctx.stroke();

            addRimLight(ctx, cx, cy, 11, 'rgba(255,0,255,0.12)');
            this.enemies.valrath = canvas;
        }
    }

    // ── Player Generation ────────────────────────────────────

    _generatePlayers() {
        const s = this._designSize;

        // WARRIOR — helmet with T-visor, broad shoulders
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#cc4444';
            const cx = s / 2, cy = s / 2;

            // Body (broad shoulders)
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.ellipse(cx, cy + 3, 6, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Shoulder pauldrons
            ctx.fillStyle = '#993333';
            ctx.beginPath();
            ctx.ellipse(cx - 7, cy + 1, 3, 2.5, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx + 7, cy + 1, 3, 2.5, 0.3, 0, Math.PI * 2);
            ctx.fill();

            // Helmet
            ctx.fillStyle = '#888899';
            ctx.beginPath();
            ctx.arc(cx, cy - 5, 5, 0, Math.PI * 2);
            ctx.fill();

            // T-visor
            ctx.fillStyle = '#222233';
            ctx.fillRect(cx - 4, cy - 6, 8, 2);
            ctx.fillRect(cx - 1, cy - 6, 2, 5);

            // Visor glow
            ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
            ctx.fillRect(cx - 4, cy - 6, 8, 2);

            // Sword silhouette (right side)
            ctx.fillStyle = '#aaaacc';
            ctx.fillRect(cx + 8, cy - 8, 2, 14);
            // Crossguard
            ctx.fillRect(cx + 6, cy - 1, 6, 2);
            // Pommel
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(cx + 9, cy + 7, 1.5, 0, Math.PI * 2);
            ctx.fill();

            this.players[CLASS.WARRIOR] = canvas;
        }

        // ROGUE — hooded, slim
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#44cc44';
            const cx = s / 2, cy = s / 2;

            // Slim body
            ctx.fillStyle = '#2a3a2a';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 3, 4, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Hood
            ctx.fillStyle = '#1a2a1a';
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy - 1);
            ctx.quadraticCurveTo(cx - 6, cy - 8, cx, cy - 9);
            ctx.quadraticCurveTo(cx + 6, cy - 8, cx + 5, cy - 1);
            ctx.closePath();
            ctx.fill();

            // Face in shadow
            ctx.fillStyle = '#111a11';
            ctx.beginPath();
            ctx.ellipse(cx, cy - 3, 3.5, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Glowing eyes
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.ellipse(cx - 2, cy - 4, 1, 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx + 2, cy - 4, 1, 0.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Cape
            ctx.fillStyle = 'rgba(30, 50, 30, 0.5)';
            ctx.beginPath();
            ctx.moveTo(cx - 4, cy);
            ctx.lineTo(cx - 6, cy + 9);
            ctx.lineTo(cx + 6, cy + 9);
            ctx.lineTo(cx + 4, cy);
            ctx.closePath();
            ctx.fill();

            // Dagger (left hand)
            ctx.fillStyle = '#ccccdd';
            ctx.beginPath();
            ctx.moveTo(cx - 6, cy + 1);
            ctx.lineTo(cx - 8, cy - 5);
            ctx.lineTo(cx - 5, cy + 1);
            ctx.fill();

            // Dagger glint
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(cx - 7, cy - 3, 0.8, 0, Math.PI * 2);
            ctx.fill();

            this.players[CLASS.ROGUE] = canvas;
        }

        // MAGE — pointed hat, robe, glowing staff
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#6666ff';
            const cx = s / 2, cy = s / 2;

            // Robe body
            ctx.fillStyle = '#2a2a5a';
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy);
            ctx.lineTo(cx - 7, cy + 9);
            ctx.lineTo(cx + 7, cy + 9);
            ctx.lineTo(cx + 5, cy);
            ctx.closePath();
            ctx.fill();

            // Head
            ctx.fillStyle = '#ccbbaa';
            ctx.beginPath();
            ctx.arc(cx, cy - 3, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Pointed hat
            ctx.fillStyle = '#1a1a4a';
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy - 4);
            ctx.lineTo(cx + 1, cy - 11);
            ctx.lineTo(cx + 5, cy - 4);
            ctx.closePath();
            ctx.fill();

            // Hat brim
            ctx.fillStyle = '#2a2a5a';
            ctx.beginPath();
            ctx.ellipse(cx, cy - 4, 6, 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Hat star
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(cx + 0.5, cy - 8, 1.2, 0, Math.PI * 2);
            ctx.fill();

            // Eyes
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(cx - 1.5, cy - 3, 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + 1.5, cy - 3, 0.8, 0, Math.PI * 2);
            ctx.fill();

            // Staff
            ctx.strokeStyle = '#664422';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx + 7, cy - 8);
            ctx.lineTo(cx + 7, cy + 9);
            ctx.stroke();

            // Staff orb (glowing)
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(cx + 7, cy - 9, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Orb glow
            ctx.fillStyle = 'rgba(100, 100, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(cx + 7, cy - 9, 4, 0, Math.PI * 2);
            ctx.fill();

            this.players[CLASS.MAGE] = canvas;
        }

        // PALADIN — winged helmet, shield
        {
            const { canvas, ctx } = this._createCanvas();
            const c = '#dddd44';
            const cx = s / 2, cy = s / 2;

            // Body
            ctx.fillStyle = '#888855';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 3, 6, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Armor highlight
            ctx.fillStyle = 'rgba(221, 221, 68, 0.2)';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 2, 4, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Helmet
            ctx.fillStyle = '#aaaa66';
            ctx.beginPath();
            ctx.arc(cx, cy - 5, 4.5, 0, Math.PI * 2);
            ctx.fill();

            // Helmet visor
            ctx.fillStyle = '#444433';
            ctx.beginPath();
            ctx.ellipse(cx, cy - 4, 3, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Wing ornaments on helmet
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy - 6);
            ctx.lineTo(cx - 9, cy - 10);
            ctx.lineTo(cx - 7, cy - 7);
            ctx.lineTo(cx - 10, cy - 8);
            ctx.lineTo(cx - 5, cy - 5);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + 5, cy - 6);
            ctx.lineTo(cx + 9, cy - 10);
            ctx.lineTo(cx + 7, cy - 7);
            ctx.lineTo(cx + 10, cy - 8);
            ctx.lineTo(cx + 5, cy - 5);
            ctx.closePath();
            ctx.fill();

            // Holy cross on chest
            ctx.fillStyle = c;
            ctx.fillRect(cx - 0.5, cy + 1, 1, 4);
            ctx.fillRect(cx - 2, cy + 2.5, 4, 1);

            // Shield (left)
            ctx.fillStyle = '#999966';
            ctx.beginPath();
            ctx.moveTo(cx - 9, cy - 2);
            ctx.lineTo(cx - 11, cy + 2);
            ctx.lineTo(cx - 9, cy + 6);
            ctx.lineTo(cx - 7, cy + 2);
            ctx.lineTo(cx - 7, cy - 2);
            ctx.closePath();
            ctx.fill();

            // Shield emblem
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(cx - 9, cy + 1, 1.5, 0, Math.PI * 2);
            ctx.fill();

            // Golden glow
            ctx.fillStyle = 'rgba(221, 221, 68, 0.1)';
            ctx.beginPath();
            ctx.arc(cx, cy, 11, 0, Math.PI * 2);
            ctx.fill();

            this.players[CLASS.PALADIN] = canvas;
        }
    }

    // ── Item Generation ──────────────────────────────────────

    _generateItems() {
        const s = this._designSize;

        // WEAPON — sword silhouette
        {
            const { canvas, ctx } = this._createCanvas();
            const cx = s / 2, cy = s / 2;

            // Blade
            ctx.fillStyle = '#ccccdd';
            ctx.beginPath();
            ctx.moveTo(cx, cy - 9);
            ctx.lineTo(cx + 2, cy - 7);
            ctx.lineTo(cx + 2, cy + 1);
            ctx.lineTo(cx - 2, cy + 1);
            ctx.lineTo(cx - 2, cy - 7);
            ctx.closePath();
            ctx.fill();

            // Blade tip
            ctx.beginPath();
            ctx.moveTo(cx - 2, cy - 7);
            ctx.lineTo(cx, cy - 10);
            ctx.lineTo(cx + 2, cy - 7);
            ctx.fill();

            // Edge highlight
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(cx - 1, cy - 9, 1, 10);

            // Crossguard
            ctx.fillStyle = '#aa8833';
            ctx.fillRect(cx - 4, cy + 1, 8, 2);

            // Grip
            ctx.fillStyle = '#553311';
            ctx.fillRect(cx - 1, cy + 3, 2, 4);

            // Pommel
            ctx.fillStyle = '#aa8833';
            ctx.beginPath();
            ctx.arc(cx, cy + 8, 1.5, 0, Math.PI * 2);
            ctx.fill();

            this.items[ITEM_TYPE.WEAPON] = canvas;
        }

        // ARMOR — breastplate
        {
            const { canvas, ctx } = this._createCanvas();
            const cx = s / 2, cy = s / 2;

            // Main plate
            ctx.fillStyle = '#777788';
            ctx.beginPath();
            ctx.moveTo(cx - 6, cy - 5);
            ctx.quadraticCurveTo(cx - 7, cy, cx - 6, cy + 5);
            ctx.lineTo(cx - 3, cy + 7);
            ctx.lineTo(cx + 3, cy + 7);
            ctx.lineTo(cx + 6, cy + 5);
            ctx.quadraticCurveTo(cx + 7, cy, cx + 6, cy - 5);
            ctx.lineTo(cx + 3, cy - 7);
            ctx.lineTo(cx - 3, cy - 7);
            ctx.closePath();
            ctx.fill();

            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.ellipse(cx - 2, cy - 2, 3, 4, -0.2, 0, Math.PI * 2);
            ctx.fill();

            // Center line
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy - 7);
            ctx.lineTo(cx, cy + 7);
            ctx.stroke();

            // Neck opening
            ctx.fillStyle = '#333344';
            ctx.beginPath();
            ctx.ellipse(cx, cy - 6, 3, 1.5, 0, 0, Math.PI * 2);
            ctx.fill();

            this.items[ITEM_TYPE.ARMOR] = canvas;
        }

        // SHIELD
        {
            const { canvas, ctx } = this._createCanvas();
            const cx = s / 2, cy = s / 2;

            // Shield shape (pointed bottom)
            ctx.fillStyle = '#888899';
            ctx.beginPath();
            ctx.moveTo(cx - 6, cy - 6);
            ctx.lineTo(cx + 6, cy - 6);
            ctx.lineTo(cx + 7, cy + 1);
            ctx.lineTo(cx, cy + 8);
            ctx.lineTo(cx - 7, cy + 1);
            ctx.closePath();
            ctx.fill();

            // Shield border
            ctx.strokeStyle = '#666677';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Emblem (cross)
            ctx.fillStyle = '#555566';
            ctx.fillRect(cx - 0.5, cy - 4, 1, 8);
            ctx.fillRect(cx - 3, cy - 1, 6, 1);

            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            ctx.ellipse(cx - 2, cy - 2, 2, 3, -0.3, 0, Math.PI * 2);
            ctx.fill();

            this.items[ITEM_TYPE.SHIELD] = canvas;
        }

        // RING
        {
            const { canvas, ctx } = this._createCanvas();
            const cx = s / 2, cy = s / 2;

            // Ring band
            ctx.strokeStyle = '#ccaa44';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy + 1, 5, 4, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Gem
            ctx.fillStyle = '#ff4466';
            ctx.beginPath();
            ctx.arc(cx, cy - 3, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Gem highlight
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.arc(cx - 1, cy - 4, 1, 0, Math.PI * 2);
            ctx.fill();

            this.items[ITEM_TYPE.RING] = canvas;
        }

        // AMULET
        {
            const { canvas, ctx } = this._createCanvas();
            const cx = s / 2, cy = s / 2;

            // Chain
            ctx.strokeStyle = '#aa8833';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy - 4, 5, Math.PI * 0.2, Math.PI * 0.8);
            ctx.stroke();

            // Pendant
            ctx.fillStyle = '#aa8833';
            ctx.beginPath();
            ctx.moveTo(cx, cy - 1);
            ctx.lineTo(cx - 3, cy + 3);
            ctx.lineTo(cx, cy + 6);
            ctx.lineTo(cx + 3, cy + 3);
            ctx.closePath();
            ctx.fill();

            // Gem in pendant
            ctx.fillStyle = '#44aaff';
            ctx.beginPath();
            ctx.arc(cx, cy + 2.5, 1.5, 0, Math.PI * 2);
            ctx.fill();

            // Gem highlight
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath();
            ctx.arc(cx - 0.5, cy + 2, 0.6, 0, Math.PI * 2);
            ctx.fill();

            this.items[ITEM_TYPE.AMULET] = canvas;
        }

        // POTION HP — red flask
        {
            const { canvas, ctx } = this._createCanvas();
            const cx = s / 2, cy = s / 2;

            // Flask body
            ctx.fillStyle = '#cc2244';
            ctx.beginPath();
            ctx.moveTo(cx - 4, cy - 2);
            ctx.quadraticCurveTo(cx - 5, cy + 3, cx - 4, cy + 6);
            ctx.lineTo(cx + 4, cy + 6);
            ctx.quadraticCurveTo(cx + 5, cy + 3, cx + 4, cy - 2);
            ctx.closePath();
            ctx.fill();

            // Flask neck
            ctx.fillStyle = '#aa1133';
            ctx.fillRect(cx - 2, cy - 5, 4, 4);

            // Cork
            ctx.fillStyle = '#886644';
            ctx.fillRect(cx - 2, cy - 7, 4, 3);

            // Liquid highlight
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.ellipse(cx - 1, cy + 1, 1.5, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Heart symbol
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+', cx, cy + 2);

            this.items[ITEM_TYPE.POTION_HP] = canvas;
        }

        // POTION MP — blue flask
        {
            const { canvas, ctx } = this._createCanvas();
            const cx = s / 2, cy = s / 2;

            // Flask body
            ctx.fillStyle = '#2244cc';
            ctx.beginPath();
            ctx.moveTo(cx - 4, cy - 2);
            ctx.quadraticCurveTo(cx - 5, cy + 3, cx - 4, cy + 6);
            ctx.lineTo(cx + 4, cy + 6);
            ctx.quadraticCurveTo(cx + 5, cy + 3, cx + 4, cy - 2);
            ctx.closePath();
            ctx.fill();

            // Flask neck
            ctx.fillStyle = '#1133aa';
            ctx.fillRect(cx - 2, cy - 5, 4, 4);

            // Cork
            ctx.fillStyle = '#886644';
            ctx.fillRect(cx - 2, cy - 7, 4, 3);

            // Liquid highlight
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.ellipse(cx - 1, cy + 1, 1.5, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Star symbol
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('*', cx, cy + 2);

            this.items[ITEM_TYPE.POTION_MP] = canvas;
        }

        // SCROLL
        {
            const { canvas, ctx } = this._createCanvas();
            const cx = s / 2, cy = s / 2;

            // Rolled parchment body
            ctx.fillStyle = '#ccbb88';
            ctx.fillRect(cx - 4, cy - 5, 8, 10);

            // Top roll
            ctx.fillStyle = '#ddcc99';
            ctx.beginPath();
            ctx.ellipse(cx, cy - 5, 5, 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Bottom roll
            ctx.beginPath();
            ctx.ellipse(cx, cy + 5, 5, 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Text lines
            ctx.strokeStyle = 'rgba(100, 80, 40, 0.3)';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < 3; i++) {
                const y = cy - 2 + i * 3;
                ctx.beginPath();
                ctx.moveTo(cx - 3, y);
                ctx.lineTo(cx + 3, y);
                ctx.stroke();
            }

            // Seal
            ctx.fillStyle = '#cc3333';
            ctx.beginPath();
            ctx.arc(cx, cy + 5, 1.5, 0, Math.PI * 2);
            ctx.fill();

            this.items[ITEM_TYPE.SCROLL] = canvas;
        }

        // FOOD — drumstick
        {
            const { canvas, ctx } = this._createCanvas();
            const cx = s / 2, cy = s / 2;

            // Meat part
            ctx.fillStyle = '#aa6633';
            ctx.beginPath();
            ctx.ellipse(cx - 1, cy - 1, 5, 4, -0.3, 0, Math.PI * 2);
            ctx.fill();

            // Meat highlight
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.ellipse(cx - 2, cy - 2, 2, 1.5, -0.3, 0, Math.PI * 2);
            ctx.fill();

            // Bone
            ctx.fillStyle = '#eeddcc';
            ctx.beginPath();
            ctx.moveTo(cx + 3, cy + 2);
            ctx.lineTo(cx + 8, cy + 7);
            ctx.lineTo(cx + 7, cy + 8);
            ctx.lineTo(cx + 2, cy + 3);
            ctx.closePath();
            ctx.fill();

            // Bone end knob
            ctx.beginPath();
            ctx.arc(cx + 8, cy + 8, 1.5, 0, Math.PI * 2);
            ctx.fill();

            this.items[ITEM_TYPE.FOOD] = canvas;
        }

        // GOLD — coin stack
        {
            const { canvas, ctx } = this._createCanvas();
            const cx = s / 2, cy = s / 2;

            // Bottom coins
            ctx.fillStyle = '#aa8800';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 3, 5, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#cc9900';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 1, 5, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Top coin
            ctx.fillStyle = '#ddaa00';
            ctx.beginPath();
            ctx.ellipse(cx, cy - 1, 5, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Coin shine
            ctx.fillStyle = 'rgba(255,255,200,0.3)';
            ctx.beginPath();
            ctx.ellipse(cx - 1, cy - 2, 2, 1, 0, 0, Math.PI * 2);
            ctx.fill();

            // $ symbol
            ctx.fillStyle = 'rgba(100,70,0,0.4)';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', cx, cy - 1);

            this.items[ITEM_TYPE.GOLD] = canvas;
        }
    }
}
