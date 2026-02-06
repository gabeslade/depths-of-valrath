// ============================================================
// DEPTHS OF VALRATH — Rendering System
// ============================================================

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = 0;
        this.height = 0;

        // Camera
        this.camX = 0;
        this.camY = 0;
        this.targetCamX = 0;
        this.targetCamY = 0;

        // Screen shake
        this.shakeIntensity = 0;
        this.shakeDecay = 0.85;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;

        // Particles
        this.particles = [];

        // Floating texts (damage numbers, etc)
        this.floatingTexts = [];

        // Projectiles
        this.projectiles = [];

        // Explosions
        this.explosions = [];

        // Slash arcs
        this.slashArcs = [];

        // Screen flash
        this.screenFlash = null;

        // Time
        this.time = 0;

        // Torch flicker
        this.torchPhase = 0;

        // Biome lighting/dust config (defaults to crypt)
        this.biomeLight = { r: 255, g: 200, b: 120 };
        this.biomeDustColor = '#ccbb99';
        this.biomeAmbientTint = null;
        this.biomeDustCount = 30;

        // Atmospheric dust motes
        this.dustMotes = [];
        for (let i = 0; i < 30; i++) {
            this.dustMotes.push(this._spawnDustMote(true));
        }

        // Sprite cache
        this.sprites = new SpriteCache();
        this.sprites.init(TILE_SIZE);

        // Temp canvas for tinting sprites
        this._tintCanvas = document.createElement('canvas');
        this._tintCanvas.width = TILE_SIZE;
        this._tintCanvas.height = TILE_SIZE;
        this._tintCtx = this._tintCanvas.getContext('2d');

        this.resize();
    }

    _spawnDustMote(randomPhase) {
        return {
            offsetX: (Math.random() - 0.5) * 12 * TILE_SIZE,
            offsetY: (Math.random() - 0.5) * 10 * TILE_SIZE,
            driftX: (Math.random() - 0.5) * 8,
            driftY: -2 - Math.random() * 5,
            size: 0.8 + Math.random() * 1.2,
            alpha: 0.08 + Math.random() * 0.12,
            phase: randomPhase ? Math.random() * 6.28 : 0,
            life: randomPhase ? Math.random() * 6 : 4 + Math.random() * 4,
            maxLife: 4 + Math.random() * 4,
        };
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    // Update camera to follow target
    updateCamera(targetX, targetY, dt) {
        this.targetCamX = targetX * TILE_SIZE - this.width / 2 + TILE_SIZE / 2;
        this.targetCamY = targetY * TILE_SIZE - this.height / 2 + TILE_SIZE / 2;

        const camSpeed = 8;
        this.camX += (this.targetCamX - this.camX) * camSpeed * dt;
        this.camY += (this.targetCamY - this.camY) * camSpeed * dt;

        // Screen shake
        if (this.shakeIntensity > 0.1) {
            this.shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity *= this.shakeDecay;
        } else {
            this.shakeOffsetX = 0;
            this.shakeOffsetY = 0;
            this.shakeIntensity = 0;
        }
    }

    shake(intensity) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    }

    setBiome(biome) {
        this.biomeLight = biome.lightColor;
        this.biomeDustColor = biome.dustColor;
        this.biomeAmbientTint = biome.ambientTint;
        this.biomeDustCount = biome.dustCount;
        // Resize dust mote pool
        while (this.dustMotes.length < biome.dustCount) {
            this.dustMotes.push(this._spawnDustMote(true));
        }
        while (this.dustMotes.length > biome.dustCount) {
            this.dustMotes.pop();
        }
    }

    // Convert world position to screen position
    worldToScreen(wx, wy) {
        return {
            x: wx * TILE_SIZE - this.camX + this.shakeOffsetX,
            y: wy * TILE_SIZE - this.camY + this.shakeOffsetY,
        };
    }

    // Check if a tile is on screen
    isOnScreen(wx, wy) {
        const sx = wx * TILE_SIZE - this.camX;
        const sy = wy * TILE_SIZE - this.camY;
        return sx > -TILE_SIZE * 2 && sx < this.width + TILE_SIZE * 2 &&
               sy > -TILE_SIZE * 2 && sy < this.height + TILE_SIZE * 2;
    }

    // Main render call
    render(game, dt) {
        this.time += dt;
        this.torchPhase += dt * 3;
        const ctx = this.ctx;

        // Clear
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, this.width, this.height);

        if (!game.dungeon || !game.player) return;

        const dungeon = game.dungeon;
        const player = game.player;
        const fov = game.fov;

        // Update camera
        const playerScreenX = player.x;
        const playerScreenY = player.y;

        // Smooth player movement
        let drawPlayerX = player.x;
        let drawPlayerY = player.y;
        if (player.moveAnimT < 1) {
            drawPlayerX = lerp(player.prevX, player.x, easeOutQuad(player.moveAnimT));
            drawPlayerY = lerp(player.prevY, player.y, easeOutQuad(player.moveAnimT));
        }

        this.updateCamera(drawPlayerX, drawPlayerY, dt);

        // Determine visible tile range
        const startTileX = Math.floor(this.camX / TILE_SIZE) - 1;
        const startTileY = Math.floor(this.camY / TILE_SIZE) - 1;
        const endTileX = startTileX + Math.ceil(this.width / TILE_SIZE) + 3;
        const endTileY = startTileY + Math.ceil(this.height / TILE_SIZE) + 3;

        // Draw tiles
        for (let y = startTileY; y <= endTileY; y++) {
            for (let x = startTileX; x <= endTileX; x++) {
                const fog = fov.getFog(x, y);
                if (fog === FOG.UNEXPLORED) continue;

                const tile = dungeon.getTile(x, y);
                if (tile === TILE.VOID) continue;

                const screen = this.worldToScreen(x, y);
                const isVisible = fog === FOG.VISIBLE;

                // Alpha for torch light falloff and flicker
                let alpha = isVisible ? 1.0 : 0.5;

                if (isVisible && tile !== TILE.WALL) {
                    const distFromPlayer = dist(x, y, drawPlayerX, drawPlayerY);
                    const falloff = clamp(1 - (distFromPlayer / (player.visionRadius + 2)) * 0.4, 0.5, 1.0);
                    alpha *= falloff;

                    // Torch flicker
                    const flickerAmount = Math.sin(this.torchPhase + x * 0.7 + y * 0.5) * 0.08 +
                                          Math.sin(this.torchPhase * 1.3 + x * 0.3 + y * 0.9) * 0.05;
                    alpha = clamp(alpha + flickerAmount, 0.4, 1.0);
                }

                // Lava brightness pulsing
                if (tile === TILE.LAVA && isVisible) {
                    const glow = Math.sin(this.time * 2 + x + y) * 0.15 + 0.85;
                    alpha *= glow;
                }

                // Draw tile sprite
                ctx.globalAlpha = alpha;

                let tileSprite = null;

                // Wall auto-tiling: pick sprite based on cardinal neighbors
                if (tile === TILE.WALL) {
                    const tN = dungeon.getTile(x, y - 1);
                    const tE = dungeon.getTile(x + 1, y);
                    const tS = dungeon.getTile(x, y + 1);
                    const tW = dungeon.getTile(x - 1, y);
                    const nWall = tN === TILE.WALL || tN === TILE.VOID;
                    const eWall = tE === TILE.WALL || tE === TILE.VOID;
                    const sWall = tS === TILE.WALL || tS === TILE.VOID;
                    const wWall = tW === TILE.WALL || tW === TILE.VOID;
                    tileSprite = this.sprites.getWall(nWall, eWall, sWall, wWall);
                }
                // Animated tiles (water/lava) use frame-based sprites
                else if ((tile === TILE.WATER || tile === TILE.LAVA) && isVisible) {
                    const frame = Math.floor(this.time * 3) % 4;
                    tileSprite = this.sprites.getAnimatedTile(tile, frame);
                }

                if (!tileSprite) {
                    tileSprite = this.sprites.getTile(tile, x, y);
                }

                if (tileSprite) {
                    ctx.drawImage(tileSprite, screen.x, screen.y);
                    if (!isVisible) {
                        ctx.fillStyle = 'rgba(0, 0, 12, 0.45)';
                        ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE);
                    }
                } else {
                    ctx.fillStyle = TILE_COLORS[tile] || '#111111';
                    ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE);
                }

                // Wall-floor ambient occlusion shadows
                if (tile !== TILE.WALL && tile !== TILE.VOID && isVisible) {
                    const tN = dungeon.getTile(x, y - 1);
                    const tS = dungeon.getTile(x, y + 1);
                    const tW = dungeon.getTile(x - 1, y);
                    const tE = dungeon.getTile(x + 1, y);
                    if (tN === TILE.WALL) {
                        const shadow = this.sprites.getWallShadow('N');
                        if (shadow) ctx.drawImage(shadow, screen.x, screen.y);
                    }
                    if (tS === TILE.WALL) {
                        const shadow = this.sprites.getWallShadow('S');
                        if (shadow) ctx.drawImage(shadow, screen.x, screen.y);
                    }
                    if (tW === TILE.WALL) {
                        const shadow = this.sprites.getWallShadow('W');
                        if (shadow) ctx.drawImage(shadow, screen.x, screen.y);
                    }
                    if (tE === TILE.WALL) {
                        const shadow = this.sprites.getWallShadow('E');
                        if (shadow) ctx.drawImage(shadow, screen.x, screen.y);
                    }
                }

                // Floor decor overlay (bones, cracks, pebbles, etc.)
                if ((tile === TILE.FLOOR || tile === TILE.CORRIDOR) && isVisible) {
                    const decor = this.sprites.getDecor(x, y);
                    if (decor) {
                        ctx.drawImage(decor, screen.x, screen.y);
                    }
                }

                // Colored lighting tint from nearby light sources
                if (isVisible && tile !== TILE.WALL) {
                    let lightR = 0, lightG = 0, lightB = 0;

                    // Player torchlight (biome-colored)
                    const playerDist = dist(x, y, drawPlayerX, drawPlayerY);
                    if (playerDist < player.visionRadius) {
                        const intensity = clamp(1 - playerDist / player.visionRadius, 0, 1) * 0.12;
                        lightR += this.biomeLight.r * intensity;
                        lightG += this.biomeLight.g * intensity;
                        lightB += this.biomeLight.b * intensity;
                    }

                    // Nearby lava red glow and water blue glow
                    for (let dy = -2; dy <= 2; dy++) {
                        for (let dx = -2; dx <= 2; dx++) {
                            const nearby = dungeon.getTile(x + dx, y + dy);
                            const d = Math.sqrt(dx * dx + dy * dy);
                            if (nearby === TILE.LAVA && d < 3) {
                                const intensity = (1 - d / 3) * 0.15;
                                lightR += 255 * intensity;
                                lightG += 60 * intensity;
                            }
                            if (nearby === TILE.WATER && d < 2.5) {
                                const intensity = (1 - d / 2.5) * 0.08;
                                lightG += 80 * intensity;
                                lightB += 200 * intensity;
                            }
                        }
                    }

                    // Apply colored light as additive overlay
                    if (lightR > 1 || lightG > 1 || lightB > 1) {
                        ctx.globalCompositeOperation = 'lighter';
                        ctx.fillStyle = `rgba(${Math.min(255, Math.floor(lightR))}, ${Math.min(255, Math.floor(lightG))}, ${Math.min(255, Math.floor(lightB))}, 0.15)`;
                        ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE);
                        ctx.globalCompositeOperation = 'source-over';
                    }
                }

                // Stairs glow
                if ((tile === TILE.STAIRS_DOWN || tile === TILE.STAIRS_UP) && isVisible) {
                    const pulse = Math.sin(this.time * 2) * 0.15 + 0.25;
                    ctx.fillStyle = tile === TILE.STAIRS_DOWN ?
                        `rgba(68, 170, 255, ${pulse})` : `rgba(255, 170, 68, ${pulse})`;
                    ctx.beginPath();
                    ctx.arc(screen.x + TILE_SIZE / 2, screen.y + TILE_SIZE / 2, TILE_SIZE * 0.6, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.globalAlpha = 1.0;
            }
        }

        // Biome ambient tint overlay (subtle color wash across visible area)
        if (this.biomeAmbientTint) {
            const t = this.biomeAmbientTint;
            ctx.fillStyle = `rgba(${t.r}, ${t.g}, ${t.b}, ${t.a})`;
            ctx.fillRect(0, 0, this.width, this.height);
        }

        // Draw items on ground
        for (const item of game.items) {
            const fog = fov.getFog(item.x, item.y);
            if (fog !== FOG.VISIBLE) continue;

            const screen = this.worldToScreen(item.x, item.y);
            const color = getItemColor(item);

            // Glow effect for rare+ items
            if (item.rarity && item.rarity !== RARITY.COMMON) {
                const pulse = Math.sin(this.time * 3) * 0.3 + 0.7;
                ctx.fillStyle = hexToRgba(color, 0.15 * pulse);
                ctx.beginPath();
                ctx.arc(screen.x + TILE_SIZE / 2, screen.y + TILE_SIZE / 2, TILE_SIZE * 0.6, 0, Math.PI * 2);
                ctx.fill();
            }

            // Item drop shadow
            if (this.sprites.entityShadow) {
                ctx.globalAlpha = 0.5;
                ctx.drawImage(this.sprites.entityShadow, screen.x, screen.y);
                ctx.globalAlpha = 1.0;
            }

            // Draw item sprite with rarity tint
            const itemSprite = this.sprites.getItem(item.type);
            if (itemSprite) {
                // Tint the sprite with rarity color
                if (item.rarity && item.rarity !== RARITY.COMMON) {
                    this._tintCtx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
                    this._tintCtx.drawImage(itemSprite, 0, 0);
                    this._tintCtx.globalCompositeOperation = 'source-atop';
                    this._tintCtx.fillStyle = color;
                    this._tintCtx.globalAlpha = 0.35;
                    this._tintCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
                    this._tintCtx.globalAlpha = 1;
                    this._tintCtx.globalCompositeOperation = 'source-over';
                    ctx.drawImage(this._tintCanvas, screen.x, screen.y);
                } else {
                    ctx.drawImage(itemSprite, screen.x, screen.y);
                }
            } else {
                ctx.fillStyle = color;
                ctx.font = `bold ${TILE_SIZE - 2}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.symbol || '?', screen.x + TILE_SIZE / 2, screen.y + TILE_SIZE / 2 + 1);
            }
        }

        // Draw enemies
        for (const enemy of game.enemies) {
            if (enemy.isDead && enemy.deathTimer <= 0) continue;
            const fog = fov.getFog(enemy.x, enemy.y);
            if (fog !== FOG.VISIBLE) continue;

            let drawX = enemy.x;
            let drawY = enemy.y;
            if (enemy.moveAnimT < 1) {
                drawX = lerp(enemy.prevX, enemy.x, easeOutQuad(enemy.moveAnimT));
                drawY = lerp(enemy.prevY, enemy.y, easeOutQuad(enemy.moveAnimT));
            }

            const screen = this.worldToScreen(drawX, drawY);

            // Idle bob animation (subtle breathing)
            if (!enemy.isDead && enemy.moveAnimT >= 1) {
                const bobPhase = this.time * 2 + enemy.x * 1.7 + enemy.y * 2.3;
                screen.y += Math.sin(bobPhase) * 1.5;
            }

            // Death crumble animation (squish + fade + particles)
            let alpha = 1.0;
            let deathScaleX = 1, deathScaleY = 1;
            if (enemy.isDead) {
                alpha = enemy.deathTimer / 0.5;
                const deathProgress = 1 - alpha;
                deathScaleX = 1 + deathProgress * 0.3; // Widen
                deathScaleY = Math.max(0.1, 1 - deathProgress * 0.8); // Squish down
                // Spawn death burst particles on first frame
                if (!enemy._deathBurstDone) {
                    enemy._deathBurstDone = true;
                    this.spawnParticles(enemy.x, enemy.y,
                        enemy.boss ? 30 : 15,
                        enemy.eliteColor || enemy.color,
                        enemy.boss ? 80 : 50,
                        0.8, { shape: 'circle', gravity: 60 });
                }
            }

            // Flash on hit
            let color = enemy.color;
            if (enemy.flashTimer > 0) {
                color = '#ffffff';
            }

            // Status effect tint
            if (enemy.hasStatus(STATUS.FROZEN)) {
                color = '#88ccff';
            } else if (enemy.hasStatus(STATUS.BURNING)) {
                const burnFlash = Math.sin(this.time * 10) > 0;
                if (burnFlash) color = '#ff6622';
            } else if (enemy.hasStatus(STATUS.POISON)) {
                color = adjustColor(color, 30);
            }

            ctx.globalAlpha = alpha;

            // Drop shadow
            if (!enemy.isDead && this.sprites.entityShadow) {
                ctx.drawImage(this.sprites.entityShadow, screen.x, screen.y);
            }

            // Boss glow
            if (enemy.boss) {
                const bossGlow = Math.sin(this.time * 2) * 0.2 + 0.4;
                ctx.fillStyle = hexToRgba(enemy.color, bossGlow * 0.3);
                ctx.beginPath();
                ctx.arc(screen.x + TILE_SIZE / 2, screen.y + TILE_SIZE / 2, TILE_SIZE * 0.8, 0, Math.PI * 2);
                ctx.fill();
            }

            // Elite glow ring
            if (enemy.eliteModifier && !enemy.isDead) {
                const elitePulse = Math.sin(this.time * 3 + enemy.x * 2 + enemy.y * 3) * 0.15 + 0.35;
                ctx.fillStyle = enemy.eliteGlow.replace(/[\d.]+\)$/, elitePulse + ')');
                ctx.beginPath();
                ctx.arc(screen.x + TILE_SIZE / 2, screen.y + TILE_SIZE / 2, TILE_SIZE * 0.7, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw enemy sprite (with death squish transform)
            const enemySprite = this.sprites.getEnemy(enemy.type);
            const useSquish = enemy.isDead && (deathScaleX !== 1 || deathScaleY !== 1);
            if (useSquish) {
                ctx.save();
                ctx.translate(screen.x + TILE_SIZE / 2, screen.y + TILE_SIZE);
                ctx.scale(deathScaleX, deathScaleY);
                ctx.translate(-TILE_SIZE / 2, -TILE_SIZE);
            }

            if (enemySprite) {
                const needsTint = color !== enemy.color;
                if (needsTint) {
                    this._tintCtx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
                    this._tintCtx.drawImage(enemySprite, 0, 0);
                    this._tintCtx.globalCompositeOperation = 'source-atop';
                    this._tintCtx.fillStyle = color;
                    this._tintCtx.globalAlpha = 0.5;
                    this._tintCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
                    this._tintCtx.globalAlpha = 1;
                    this._tintCtx.globalCompositeOperation = 'source-over';
                    ctx.drawImage(this._tintCanvas, useSquish ? 0 : screen.x, useSquish ? 0 : screen.y);
                } else {
                    ctx.drawImage(enemySprite, useSquish ? 0 : screen.x, useSquish ? 0 : screen.y);
                }
            } else {
                ctx.fillStyle = color;
                ctx.font = `bold ${TILE_SIZE}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const textX = useSquish ? TILE_SIZE / 2 : screen.x + TILE_SIZE / 2;
                const textY = useSquish ? TILE_SIZE / 2 + 1 : screen.y + TILE_SIZE / 2 + 1;
                ctx.fillText(enemy.symbol, textX, textY);
            }

            if (useSquish) ctx.restore();

            // Health bar (only if damaged and alive)
            if (!enemy.isDead && enemy.hp < enemy.maxHp) {
                const barWidth = TILE_SIZE;
                const barHeight = 3;
                const barX = screen.x;
                const barY = screen.y - 4;
                const hpPct = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;

                ctx.fillStyle = '#441111';
                ctx.fillRect(barX, barY, barWidth, barHeight);
                ctx.fillStyle = hpPct > 0.5 ? '#44cc44' : hpPct > 0.25 ? '#ccaa22' : '#cc2222';
                ctx.fillRect(barX, barY, barWidth * hpPct, barHeight);
            }

            // Alerted indicator
            if (enemy.alerted && !enemy.isDead) {
                ctx.fillStyle = '#ff4444';
                ctx.font = '10px monospace';
                ctx.fillText('!', screen.x + TILE_SIZE / 2, screen.y - 8);
            }

            // Elite modifier badge
            if (enemy.eliteModifier && !enemy.isDead) {
                const badgeX = screen.x + TILE_SIZE - 6;
                const badgeY = screen.y + 2;
                ctx.fillStyle = enemy.eliteColor;
                ctx.beginPath();
                ctx.arc(badgeX, badgeY, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 7px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(enemy.eliteIcon, badgeX, badgeY);
            }

            ctx.globalAlpha = 1.0;
        }

        // Draw NPCs
        if (game.npcs) {
            for (const npc of game.npcs) {
                if (npc.interacted) continue;
                const fog = fov.getFog(npc.x, npc.y);
                if (fog !== FOG.VISIBLE) continue;

                const screen = this.worldToScreen(npc.x, npc.y);

                // Ambient glow
                const npcPulse = Math.sin(this.time * 2 + npc.x * 3) * 0.1 + 0.3;
                ctx.fillStyle = hexToRgba(npc.color, npcPulse);
                ctx.beginPath();
                ctx.arc(screen.x + TILE_SIZE / 2, screen.y + TILE_SIZE / 2, TILE_SIZE * 0.7, 0, Math.PI * 2);
                ctx.fill();

                // Drop shadow
                if (this.sprites.entityShadow) {
                    ctx.globalAlpha = 0.6;
                    ctx.drawImage(this.sprites.entityShadow, screen.x, screen.y);
                    ctx.globalAlpha = 1.0;
                }

                // NPC symbol
                ctx.fillStyle = npc.color;
                ctx.font = `bold ${TILE_SIZE - 4}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(npc.symbol, screen.x + TILE_SIZE / 2, screen.y + TILE_SIZE / 2 + 1);

                // "[E] Talk" prompt when adjacent to player
                const d = chebyshevDist(npc.x, npc.y, player.x, player.y);
                if (d <= 1) {
                    ctx.fillStyle = 'rgba(0,0,0,0.7)';
                    const promptW = 55;
                    ctx.fillRect(screen.x + TILE_SIZE / 2 - promptW / 2, screen.y - 16, promptW, 14);
                    ctx.fillStyle = '#ffcc00';
                    ctx.font = 'bold 10px monospace';
                    ctx.fillText('[E] Talk', screen.x + TILE_SIZE / 2, screen.y - 9);
                }
            }
        }

        // Draw player
        {
            const screen = this.worldToScreen(drawPlayerX, drawPlayerY);

            // Idle bob animation (only when not moving)
            if (player.moveAnimT >= 1) {
                const bobPhase = this.time * 2.2;
                screen.y += Math.sin(bobPhase) * 1.5;
            }

            // Drop shadow
            if (this.sprites.entityShadow) {
                ctx.drawImage(this.sprites.entityShadow, screen.x, screen.y);
            }

            // Stealth effect
            if (player.stealthTurns > 0) {
                ctx.globalAlpha = 0.5;
            }

            // Invulnerability glow
            if (player.invulnTurns > 0) {
                const glow = Math.sin(this.time * 6) * 0.3 + 0.5;
                ctx.fillStyle = `rgba(255, 255, 255, ${glow * 0.4})`;
                ctx.beginPath();
                ctx.arc(screen.x + TILE_SIZE / 2, screen.y + TILE_SIZE / 2, TILE_SIZE * 0.7, 0, Math.PI * 2);
                ctx.fill();
            }

            // Player ambient glow
            const playerGlow = Math.sin(this.time * 1.5) * 0.05 + 0.15;
            ctx.fillStyle = hexToRgba(player.color, playerGlow);
            ctx.beginPath();
            ctx.arc(screen.x + TILE_SIZE / 2, screen.y + TILE_SIZE / 2, TILE_SIZE * 0.8, 0, Math.PI * 2);
            ctx.fill();

            // Player sprite
            const playerSprite = this.sprites.getPlayer(player.classId);
            if (playerSprite) {
                ctx.drawImage(playerSprite, screen.x, screen.y);
            } else {
                ctx.fillStyle = player.color;
                ctx.font = `bold ${TILE_SIZE}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(player.symbol, screen.x + TILE_SIZE / 2, screen.y + TILE_SIZE / 2 + 1);
            }

            ctx.globalAlpha = 1.0;
        }

        // Draw other players (multiplayer)
        if (game.otherPlayers) {
            for (const op of Object.values(game.otherPlayers)) {
                if (!op.isAlive) continue;
                const fog = fov.getFog(op.x, op.y);
                if (fog !== FOG.VISIBLE) continue;

                let opDrawX = op.x;
                let opDrawY = op.y;
                if (op.moveAnimT < 1) {
                    opDrawX = lerp(op.prevX != null ? op.prevX : op.x, op.x, easeOutQuad(op.moveAnimT));
                    opDrawY = lerp(op.prevY != null ? op.prevY : op.y, op.y, easeOutQuad(op.moveAnimT));
                }

                const opScreen = this.worldToScreen(opDrawX, opDrawY);

                // Idle bob
                if (op.moveAnimT >= 1) {
                    const bobPhase = this.time * 2.2 + (op.x * 1.3 + op.y * 2.1);
                    opScreen.y += Math.sin(bobPhase) * 1.5;
                }

                // Drop shadow
                if (this.sprites.entityShadow) {
                    ctx.drawImage(this.sprites.entityShadow, opScreen.x, opScreen.y);
                }

                // Ambient glow
                const opColor = op.color || '#66ccff';
                const opGlow = Math.sin(this.time * 1.5 + 1) * 0.05 + 0.15;
                ctx.fillStyle = hexToRgba(opColor, opGlow);
                ctx.beginPath();
                ctx.arc(opScreen.x + TILE_SIZE / 2, opScreen.y + TILE_SIZE / 2, TILE_SIZE * 0.8, 0, Math.PI * 2);
                ctx.fill();

                // Sprite
                const opSprite = this.sprites.getPlayer(op.classId);
                if (opSprite) {
                    ctx.drawImage(opSprite, opScreen.x, opScreen.y);
                } else {
                    ctx.fillStyle = opColor;
                    ctx.font = `bold ${TILE_SIZE}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('@', opScreen.x + TILE_SIZE / 2, opScreen.y + TILE_SIZE / 2 + 1);
                }

                // Name label above
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.strokeText(op.name || 'Player', opScreen.x + TILE_SIZE / 2, opScreen.y - 6);
                ctx.fillText(op.name || 'Player', opScreen.x + TILE_SIZE / 2, opScreen.y - 6);

                // HP bar below name
                if (op.hp !== undefined && op.maxHp) {
                    const barWidth = TILE_SIZE;
                    const barHeight = 3;
                    const barX = opScreen.x;
                    const barY = opScreen.y - 3;
                    const hpPct = op.maxHp > 0 ? op.hp / op.maxHp : 0;

                    ctx.fillStyle = '#441111';
                    ctx.fillRect(barX, barY, barWidth, barHeight);
                    ctx.fillStyle = hpPct > 0.5 ? '#44cc44' : hpPct > 0.25 ? '#ccaa22' : '#cc2222';
                    ctx.fillRect(barX, barY, barWidth * hpPct, barHeight);
                }
            }
        }

        // Atmospheric dust motes (rendered before vignette for natural dimming at edges)
        this._renderDustMotes(ctx, dt, drawPlayerX, drawPlayerY);

        // Vignette overlay
        this._renderVignette(ctx);

        // Draw slash arcs
        this._renderSlashArcs(ctx, dt);

        // Draw particles
        this._renderParticles(ctx, dt);

        // Draw projectiles
        this._renderProjectiles(ctx, dt);

        // Draw explosions
        this._renderExplosions(ctx, dt);

        // Draw floating texts
        this._renderFloatingTexts(ctx, dt);

        // Screen flash overlay
        this._renderScreenFlash(ctx, dt);
    }

    // Spawn particles — supports shape ('circle','spark','square'), gravity, preset
    spawnParticles(worldX, worldY, count, color, speed, lifetime, opts) {
        const shape = (opts && opts.shape) || 'circle';
        const gravity = (opts && opts.gravity !== undefined) ? opts.gravity : 50;
        const baseSize = (opts && opts.size) || 0;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = speed * (0.5 + Math.random() * 0.5);
            this.particles.push({
                x: worldX * TILE_SIZE + TILE_SIZE / 2,
                y: worldY * TILE_SIZE + TILE_SIZE / 2,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                life: lifetime,
                maxLife: lifetime,
                color,
                size: baseSize || (2 + Math.random() * 3),
                shape,
                gravity,
            });
        }
    }

    // Spawn particles from a preset
    spawnPresetParticles(worldX, worldY, presetName, color) {
        const preset = PARTICLE_PRESETS[presetName];
        if (!preset) return;
        this.spawnParticles(worldX, worldY, preset.count, color,
            preset.speed, preset.lifetime, {
                shape: preset.shape,
                gravity: preset.gravity,
                size: preset.size || 0,
            });
    }

    // Spawn slash arc animation
    spawnSlashArc(fromX, fromY, toX, toY, color, isCrit) {
        this.slashArcs.push({
            fromX: fromX * TILE_SIZE + TILE_SIZE / 2,
            fromY: fromY * TILE_SIZE + TILE_SIZE / 2,
            toX: toX * TILE_SIZE + TILE_SIZE / 2,
            toY: toY * TILE_SIZE + TILE_SIZE / 2,
            color: color || '#ffffff',
            t: 0,
            duration: isCrit ? 0.3 : 0.25,
            width: isCrit ? 6 : 3,
            isCrit,
        });
    }

    // Flash the screen
    flashScreen(color, duration) {
        this.screenFlash = { color, life: duration || 0.15, maxLife: duration || 0.15 };
    }

    // Spawn floating damage/heal text
    spawnFloatingText(worldX, worldY, text, color, large) {
        this.floatingTexts.push({
            x: worldX * TILE_SIZE + TILE_SIZE / 2,
            y: worldY * TILE_SIZE,
            text,
            color,
            life: 1.2,
            maxLife: 1.2,
            large: large || false,
            vy: -40,
        });
    }

    // Spawn projectile
    spawnProjectile(fromX, fromY, toX, toY, color) {
        this.projectiles.push({
            x: fromX * TILE_SIZE + TILE_SIZE / 2,
            y: fromY * TILE_SIZE + TILE_SIZE / 2,
            targetX: toX * TILE_SIZE + TILE_SIZE / 2,
            targetY: toY * TILE_SIZE + TILE_SIZE / 2,
            color,
            t: 0,
            speed: 5,
            trail: [],
        });
    }

    // Spawn explosion
    spawnExplosion(worldX, worldY, radius, color) {
        this.explosions.push({
            x: worldX * TILE_SIZE + TILE_SIZE / 2,
            y: worldY * TILE_SIZE + TILE_SIZE / 2,
            radius: radius * TILE_SIZE,
            maxRadius: (radius + 1) * TILE_SIZE,
            color,
            life: 0.4,
            maxLife: 0.4,
        });

        // Also spawn particles
        this.spawnParticles(worldX, worldY, 20, color, 100, 0.6);
    }

    _renderDustMotes(ctx, dt, playerX, playerY) {
        const centerX = playerX * TILE_SIZE + TILE_SIZE / 2;
        const centerY = playerY * TILE_SIZE + TILE_SIZE / 2;

        for (let i = 0; i < this.dustMotes.length; i++) {
            const m = this.dustMotes[i];
            m.offsetX += m.driftX * dt;
            m.offsetY += m.driftY * dt;
            m.phase += dt * 1.5;
            m.life -= dt;

            // Gentle sine sway
            const swayX = Math.sin(m.phase) * 6;
            const swayY = Math.cos(m.phase * 0.7) * 3;

            const worldX = centerX + m.offsetX + swayX;
            const worldY = centerY + m.offsetY + swayY;
            const screenX = worldX - this.camX + this.shakeOffsetX;
            const screenY = worldY - this.camY + this.shakeOffsetY;

            // Fade in and out
            let alpha = m.alpha;
            const lifeRatio = m.life / m.maxLife;
            if (lifeRatio > 0.8) alpha *= (1 - lifeRatio) / 0.2;
            else if (lifeRatio < 0.2) alpha *= lifeRatio / 0.2;

            if (m.life <= 0) {
                this.dustMotes[i] = this._spawnDustMote(false);
                continue;
            }

            // Only draw if on screen
            if (screenX > -10 && screenX < this.width + 10 &&
                screenY > -10 && screenY < this.height + 10) {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = this.biomeDustColor;
                ctx.beginPath();
                ctx.arc(screenX, screenY, m.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1.0;
    }

    _renderSlashArcs(ctx, dt) {
        const dead = [];
        for (let i = 0; i < this.slashArcs.length; i++) {
            const arc = this.slashArcs[i];
            arc.t += dt;
            if (arc.t >= arc.duration) {
                dead.push(i);
                continue;
            }

            const progress = arc.t / arc.duration;
            const alpha = 1 - progress;

            const sx = arc.fromX - this.camX + this.shakeOffsetX;
            const sy = arc.fromY - this.camY + this.shakeOffsetY;
            const ex = arc.toX - this.camX + this.shakeOffsetX;
            const ey = arc.toY - this.camY + this.shakeOffsetY;

            // Calculate arc control point (perpendicular offset)
            const mx = (sx + ex) / 2;
            const my = (sy + ey) / 2;
            const dx = ex - sx;
            const dy = ey - sy;
            const len = Math.sqrt(dx * dx + dy * dy);
            const perpX = -dy / len * TILE_SIZE * 0.5;
            const perpY = dx / len * TILE_SIZE * 0.5;

            ctx.globalAlpha = alpha * 0.8;
            ctx.strokeStyle = arc.color;
            ctx.lineWidth = arc.width * alpha;
            ctx.lineCap = 'round';

            // Draw arc sweep
            const sweepEnd = Math.min(1, progress * 3); // Fast sweep
            ctx.beginPath();
            const startPt = progress * 0.3;
            for (let t = startPt; t <= sweepEnd; t += 0.05) {
                const px = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * (mx + perpX) + t * t * ex;
                const py = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * (my + perpY) + t * t * ey;
                if (t === startPt) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();

            // Bright leading edge
            if (sweepEnd < 1) {
                const t = sweepEnd;
                const px = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * (mx + perpX) + t * t * ex;
                const py = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * (my + perpY) + t * t * ey;
                ctx.globalAlpha = alpha;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(px, py, arc.width * 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
        for (let i = dead.length - 1; i >= 0; i--) {
            this.slashArcs.splice(dead[i], 1);
        }
    }

    _renderScreenFlash(ctx, dt) {
        if (!this.screenFlash) return;
        this.screenFlash.life -= dt;
        if (this.screenFlash.life <= 0) {
            this.screenFlash = null;
            return;
        }
        const alpha = (this.screenFlash.life / this.screenFlash.maxLife) * 0.3;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.screenFlash.color;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.globalAlpha = 1;
    }

    _renderVignette(ctx) {
        const cx = this.width / 2;
        const cy = this.height / 2;
        const radius = Math.max(this.width, this.height) * 0.7;
        const gradient = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.15)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);
    }

    _renderParticles(ctx, dt) {
        const dead = [];
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += (p.gravity !== undefined ? p.gravity : 50) * dt;
            p.life -= dt;

            if (p.life <= 0) {
                dead.push(i);
                continue;
            }

            const screenX = p.x - this.camX + this.shakeOffsetX;
            const screenY = p.y - this.camY + this.shakeOffsetY;

            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;

            const shape = p.shape || 'circle';
            const sz = p.size * alpha;

            if (shape === 'spark') {
                // Velocity-aligned line
                const len = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                if (len > 0) {
                    const nx = p.vx / len;
                    const ny = p.vy / len;
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = Math.max(1, sz * 0.5);
                    ctx.beginPath();
                    ctx.moveTo(screenX - nx * sz * 2, screenY - ny * sz * 2);
                    ctx.lineTo(screenX + nx * sz, screenY + ny * sz);
                    ctx.stroke();
                }
            } else if (shape === 'square') {
                ctx.fillRect(screenX - sz / 2, screenY - sz / 2, sz, sz);
            } else {
                // circle (default)
                ctx.beginPath();
                ctx.arc(screenX, screenY, Math.max(0.5, sz / 2), 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1.0;

        // Remove dead particles
        for (let i = dead.length - 1; i >= 0; i--) {
            this.particles.splice(dead[i], 1);
        }
    }

    _renderProjectiles(ctx, dt) {
        const done = [];
        for (let i = 0; i < this.projectiles.length; i++) {
            const p = this.projectiles[i];
            p.t += dt * p.speed;

            if (p.t >= 1) {
                done.push(i);
                continue;
            }

            const cx = lerp(p.x, p.targetX, easeOutQuad(p.t));
            const cy = lerp(p.y, p.targetY, easeOutQuad(p.t));

            // Trail
            p.trail.push({ x: cx, y: cy, alpha: 1 });
            if (p.trail.length > 8) p.trail.shift();

            // Draw trail
            for (let j = 0; j < p.trail.length; j++) {
                const t = p.trail[j];
                const screenX = t.x - this.camX + this.shakeOffsetX;
                const screenY = t.y - this.camY + this.shakeOffsetY;
                const alpha = (j / p.trail.length) * 0.6;
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw head
            const screenX = cx - this.camX + this.shakeOffsetX;
            const screenY = cy - this.camY + this.shakeOffsetY;
            ctx.globalAlpha = 1;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
            ctx.fill();

            // Glow
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(screenX, screenY, 10, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        for (let i = done.length - 1; i >= 0; i--) {
            this.projectiles.splice(done[i], 1);
        }
    }

    _renderExplosions(ctx, dt) {
        const done = [];
        for (let i = 0; i < this.explosions.length; i++) {
            const e = this.explosions[i];
            e.life -= dt;

            if (e.life <= 0) {
                done.push(i);
                continue;
            }

            const progress = 1 - (e.life / e.maxLife);
            const radius = lerp(e.radius * 0.3, e.maxRadius, easeOutQuad(progress));
            const alpha = e.life / e.maxLife * 0.6;

            const screenX = e.x - this.camX + this.shakeOffsetX;
            const screenY = e.y - this.camY + this.shakeOffsetY;

            ctx.globalAlpha = alpha;
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
            ctx.fill();

            // Inner bright core
            ctx.globalAlpha = alpha * 1.5;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        for (let i = done.length - 1; i >= 0; i--) {
            this.explosions.splice(done[i], 1);
        }
    }

    _renderFloatingTexts(ctx, dt) {
        const done = [];
        for (let i = 0; i < this.floatingTexts.length; i++) {
            const ft = this.floatingTexts[i];
            ft.y += ft.vy * dt;
            ft.vy *= 0.95;
            ft.life -= dt;

            if (ft.life <= 0) {
                done.push(i);
                continue;
            }

            const screenX = ft.x - this.camX + this.shakeOffsetX;
            const screenY = ft.y - this.camY + this.shakeOffsetY;
            const alpha = Math.min(1, ft.life / (ft.maxLife * 0.3));
            const scale = ft.large ? 1.5 : 1;

            // Outline
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${Math.floor(14 * scale)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(ft.text, screenX, screenY);
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, screenX, screenY);
        }
        ctx.globalAlpha = 1;

        for (let i = done.length - 1; i >= 0; i--) {
            this.floatingTexts.splice(done[i], 1);
        }
    }

    // Draw minimap
    renderMinimap(game, x, y, size) {
        if (!game.dungeon || !game.fov) return;
        const ctx = this.ctx;
        const dungeon = game.dungeon;
        const fov = game.fov;
        const player = game.player;

        const scale = size / Math.max(dungeon.width, dungeon.height);

        ctx.fillStyle = COLORS.minimapBg;
        ctx.fillRect(x - 2, y - 2, size + 4, size + 4);
        ctx.strokeStyle = COLORS.hudBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 2, y - 2, size + 4, size + 4);

        for (let ty = 0; ty < dungeon.height; ty++) {
            for (let tx = 0; tx < dungeon.width; tx++) {
                const fog = fov.getFog(tx, ty);
                if (fog === FOG.UNEXPLORED) continue;

                const tile = dungeon.getTile(tx, ty);
                const px = x + tx * scale;
                const py = y + ty * scale;
                const ps = Math.max(1, scale);

                if (tile === TILE.WALL) {
                    if (fog === FOG.VISIBLE) {
                        ctx.fillStyle = COLORS.minimapWall;
                    } else {
                        ctx.fillStyle = '#2a2a35';
                    }
                } else if (tile === TILE.STAIRS_DOWN || tile === TILE.STAIRS_UP) {
                    ctx.fillStyle = COLORS.minimapStairs;
                } else {
                    ctx.fillStyle = fog === FOG.VISIBLE ? COLORS.minimapFloor : '#1a1a25';
                }

                ctx.fillRect(px, py, ps, ps);
            }
        }

        // Draw items on minimap
        for (const item of game.items) {
            if (fov.getFog(item.x, item.y) === FOG.VISIBLE) {
                ctx.fillStyle = COLORS.minimapItem;
                ctx.fillRect(x + item.x * scale, y + item.y * scale, Math.max(2, scale), Math.max(2, scale));
            }
        }

        // Draw enemies on minimap
        for (const enemy of game.enemies) {
            if (!enemy.isDead && fov.getFog(enemy.x, enemy.y) === FOG.VISIBLE) {
                ctx.fillStyle = enemy.boss ? '#ff8800' : COLORS.minimapEnemy;
                const s = enemy.boss ? Math.max(3, scale * 1.5) : Math.max(2, scale);
                ctx.fillRect(x + enemy.x * scale, y + enemy.y * scale, s, s);
            }
        }

        // Draw other players on minimap (multiplayer)
        if (game.otherPlayers) {
            for (const op of Object.values(game.otherPlayers)) {
                if (!op.isAlive) continue;
                ctx.fillStyle = op.color || '#66ccff';
                ctx.fillRect(x + op.x * scale - 1, y + op.y * scale - 1, Math.max(3, scale * 2), Math.max(3, scale * 2));
            }
        }

        // Draw player on minimap
        ctx.fillStyle = COLORS.minimapPlayer;
        ctx.fillRect(x + player.x * scale - 1, y + player.y * scale - 1, Math.max(3, scale * 2), Math.max(3, scale * 2));
    }
}
