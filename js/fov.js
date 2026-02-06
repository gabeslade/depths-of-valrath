// ============================================================
// DEPTHS OF VALRATH — Field of View (Shadowcasting)
// ============================================================

// Recursive shadowcasting algorithm for fast, accurate FOV
class FOVSystem {
    constructor() {
        this.fogMap = null;
        this.width = 0;
        this.height = 0;
    }

    init(width, height) {
        this.width = width;
        this.height = height;
        this.fogMap = [];
        for (let y = 0; y < height; y++) {
            this.fogMap[y] = [];
            for (let x = 0; x < width; x++) {
                this.fogMap[y][x] = FOG.UNEXPLORED;
            }
        }
    }

    // Reset all VISIBLE tiles to EXPLORED before recomputing
    resetVisibility() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.fogMap[y][x] === FOG.VISIBLE) {
                    this.fogMap[y][x] = FOG.EXPLORED;
                }
            }
        }
    }

    getFog(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return FOG.UNEXPLORED;
        return this.fogMap[y][x];
    }

    setVisible(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        this.fogMap[y][x] = FOG.VISIBLE;
    }

    // Compute FOV using recursive shadowcasting
    compute(cx, cy, radius, dungeon) {
        this.resetVisibility();
        this.setVisible(cx, cy); // Origin always visible

        // 8 octants
        for (let octant = 0; octant < 8; octant++) {
            this._castLight(cx, cy, radius, 1, 1.0, 0.0, octant, dungeon);
        }
    }

    _castLight(cx, cy, radius, row, startSlope, endSlope, octant, dungeon) {
        if (startSlope < endSlope) return;

        const radiusSq = radius * radius;
        let nextStartSlope = startSlope;

        for (let j = row; j <= radius; j++) {
            let blocked = false;

            for (let dx = -j; dx <= 0; dx++) {
                const dy = -j;

                // Map to actual coordinates based on octant
                const { mx, my } = this._transformOctant(dx, dy, octant);
                const ax = cx + mx;
                const ay = cy + my;

                const leftSlope = (dx - 0.5) / (dy + 0.5);
                const rightSlope = (dx + 0.5) / (dy - 0.5);

                if (startSlope < rightSlope) continue;
                if (endSlope > leftSlope) break;

                // Check if in radius
                if (dx * dx + dy * dy <= radiusSq) {
                    this.setVisible(ax, ay);
                }

                if (blocked) {
                    if (!dungeon.isTransparent(ax, ay)) {
                        nextStartSlope = rightSlope;
                    } else {
                        blocked = false;
                        startSlope = nextStartSlope;
                    }
                } else if (!dungeon.isTransparent(ax, ay) && j < radius) {
                    blocked = true;
                    this._castLight(cx, cy, radius, j + 1, startSlope, leftSlope, octant, dungeon);
                    nextStartSlope = rightSlope;
                }
            }

            if (blocked) break;
        }
    }

    _transformOctant(col, row, octant) {
        switch (octant) {
            case 0: return { mx: col, my: row };
            case 1: return { mx: row, my: col };
            case 2: return { mx: row, my: -col };
            case 3: return { mx: col, my: -row };
            case 4: return { mx: -col, my: -row };
            case 5: return { mx: -row, my: -col };
            case 6: return { mx: -row, my: col };
            case 7: return { mx: -col, my: row };
        }
        return { mx: 0, my: 0 };
    }
}
