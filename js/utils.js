// ============================================================
// DEPTHS OF VALRATH — Utility Functions
// ============================================================

// Seeded random number generator (Mulberry32)
class RNG {
    constructor(seed) {
        this.seed = seed || Date.now();
        this.state = this.seed;
    }

    next() {
        this.state |= 0;
        this.state = (this.state + 0x6D2B79F5) | 0;
        let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // Random int in [min, max] inclusive
    int(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    // Random float in [min, max)
    float(min, max) {
        return this.next() * (max - min) + min;
    }

    // Pick random element from array
    pick(arr) {
        return arr[Math.floor(this.next() * arr.length)];
    }

    // Shuffle array in place
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // Weighted random pick: items is [{item, weight}]
    weightedPick(items) {
        const total = items.reduce((sum, i) => sum + i.weight, 0);
        let roll = this.next() * total;
        for (const entry of items) {
            roll -= entry.weight;
            if (roll <= 0) return entry.item;
        }
        return items[items.length - 1].item;
    }

    // Chance check (0-1)
    chance(probability) {
        return this.next() < probability;
    }
}

// Global RNG instance
const rng = new RNG();

// A* Pathfinding
function astarFind(startX, startY, goalX, goalY, isWalkable, maxSteps = 500) {
    const key = (x, y) => `${x},${y}`;
    const openSet = new MinHeap();
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();

    const startKey = key(startX, startY);
    gScore.set(startKey, 0);
    openSet.push({ x: startX, y: startY, f: heuristic(startX, startY, goalX, goalY) });

    let steps = 0;
    while (openSet.size() > 0 && steps < maxSteps) {
        steps++;
        const current = openSet.pop();
        const currentKey = key(current.x, current.y);

        if (current.x === goalX && current.y === goalY) {
            return reconstructPath(cameFrom, currentKey, key);
        }

        if (closedSet.has(currentKey)) continue;
        closedSet.add(currentKey);

        for (const dir of ALL_DIRS) {
            const nx = current.x + dir.x;
            const ny = current.y + dir.y;
            const neighborKey = key(nx, ny);

            if (closedSet.has(neighborKey)) continue;
            if (!isWalkable(nx, ny)) continue;

            // Prevent diagonal movement through walls
            if (dir.x !== 0 && dir.y !== 0) {
                if (!isWalkable(current.x + dir.x, current.y) || !isWalkable(current.x, current.y + dir.y)) {
                    continue;
                }
            }

            const moveCost = (dir.x !== 0 && dir.y !== 0) ? 1.414 : 1;
            const currentG = gScore.has(currentKey) ? gScore.get(currentKey) : Infinity;
            const tentativeG = currentG + moveCost;

            const neighborG = gScore.has(neighborKey) ? gScore.get(neighborKey) : Infinity;
            if (tentativeG < neighborG) {
                cameFrom.set(neighborKey, currentKey);
                gScore.set(neighborKey, tentativeG);
                const f = tentativeG + heuristic(nx, ny, goalX, goalY);
                openSet.push({ x: nx, y: ny, f });
            }
        }
    }

    return null; // No path found
}

function heuristic(x1, y1, x2, y2) {
    // Chebyshev distance for 8-directional movement
    return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
}

function reconstructPath(cameFrom, currentKey, keyFn) {
    const path = [];
    let current = currentKey;
    while (cameFrom.has(current)) {
        const [x, y] = current.split(',').map(Number);
        path.unshift({ x, y });
        current = cameFrom.get(current);
    }
    return path;
}

// Min-heap for A*
class MinHeap {
    constructor() {
        this.data = [];
    }

    size() {
        return this.data.length;
    }

    push(node) {
        this.data.push(node);
        this._bubbleUp(this.data.length - 1);
    }

    pop() {
        const top = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) {
            this.data[0] = last;
            this._sinkDown(0);
        }
        return top;
    }

    _bubbleUp(i) {
        while (i > 0) {
            const parent = Math.floor((i - 1) / 2);
            if (this.data[i].f < this.data[parent].f) {
                [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
                i = parent;
            } else break;
        }
    }

    _sinkDown(i) {
        const len = this.data.length;
        while (true) {
            let smallest = i;
            const left = 2 * i + 1;
            const right = 2 * i + 2;
            if (left < len && this.data[left].f < this.data[smallest].f) smallest = left;
            if (right < len && this.data[right].f < this.data[smallest].f) smallest = right;
            if (smallest !== i) {
                [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
                i = smallest;
            } else break;
        }
    }
}

// Bresenham line for LOS
function bresenhamLine(x0, y0, x1, y1) {
    const points = [];
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
        points.push({ x: x0, y: y0 });
        if (x0 === x1 && y0 === y1) break;
        let e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
    }
    return points;
}

// Distance between two points
function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function manhattanDist(x1, y1, x2, y2) {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

function chebyshevDist(x1, y1, x2, y2) {
    return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
}

// Clamp value between min and max
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

// Linear interpolation
function lerp(a, b, t) {
    return a + (b - a) * t;
}

// Ease out quad
function easeOutQuad(t) {
    return t * (2 - t);
}

// Ease in out quad
function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Convert hex color to rgba
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Lighten/darken a hex color
function adjustColor(hex, amount) {
    const r = clamp(parseInt(hex.slice(1, 3), 16) + amount, 0, 255);
    const g = clamp(parseInt(hex.slice(3, 5), 16) + amount, 0, 255);
    const b = clamp(parseInt(hex.slice(5, 7), 16) + amount, 0, 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Format number with commas
function formatNumber(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
