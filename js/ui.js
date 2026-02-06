// ============================================================
// DEPTHS OF VALRATH — UI System
// ============================================================

class UISystem {
    constructor(renderer) {
        this.renderer = renderer;
        this.ctx = renderer.ctx;
        this.messages = [];
        this.maxMessages = 50;
        this.visibleMessages = 5;
        this.messageScroll = 0;

        // Tooltip
        this.tooltip = null;
        this.tooltipTimer = 0;

        // Mouse position
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseTileX = 0;
        this.mouseTileY = 0;

        // Inventory selection
        this.selectedInventoryIndex = 0;
        this.selectedEquipSlot = null;
        this.inventoryTab = 'items'; // 'items' or 'equip'

        // Level up selection
        this.levelUpSelection = 0;

        // Shop
        this.shopSelection = 0;
    }

    addMessage(text, color) {
        this.messages.push({ text, color: color || COLORS.textPrimary, time: Date.now() });
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }
        this.messageScroll = 0; // Auto-scroll to bottom
    }

    // Render full HUD
    renderHUD(game) {
        const ctx = this.ctx;
        const player = game.player;
        if (!player) return;

        const w = this.renderer.width;
        const h = this.renderer.height;

        // Top HUD bar
        this._renderTopBar(player, w);

        // Ability bar
        this._renderAbilityBar(player, w, h);

        // Message log
        this._renderMessageLog(w, h);

        // Minimap
        if (game.showMinimap) {
            const mmSize = 160;
            this.renderer.renderMinimap(game, w - mmSize - 10, 50, mmSize);
        }

        // Multiplayer player list
        if (game.isMultiplayer && game.otherPlayers) {
            this._renderPlayerList(game, w, h);
        }

        // Status effects
        this._renderStatusEffects(player, w);

        // Tooltip
        if (this.tooltip) {
            this._renderTooltip(this.tooltip);
        }
    }

    _renderTopBar(player, w) {
        const ctx = this.ctx;
        const barH = 40;

        // Background
        ctx.fillStyle = COLORS.hudBg;
        ctx.fillRect(0, 0, w, barH);
        ctx.strokeStyle = COLORS.hudBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, w, barH);

        let x = 10;

        // Class and level
        ctx.fillStyle = player.color;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${player.className} Lv.${player.level}`, x, barH / 2);
        x += 130;

        // HP bar
        this._drawBar(x, 8, 140, 10, player.hp, player.maxHp, COLORS.hpBar, COLORS.hpBarBg);
        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`HP ${player.hp}/${player.maxHp}`, x + 70, 14);
        x += 150;

        // MP bar
        this._drawBar(x, 8, 100, 10, player.mp, player.maxMp, COLORS.mpBar, COLORS.mpBarBg);
        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = '10px monospace';
        ctx.fillText(`MP ${player.mp}/${player.maxMp}`, x + 50, 14);
        x += 110;

        // XP bar
        this._drawBar(x, 8, 100, 10, player.xp, player.xpToNext, COLORS.xpBar, COLORS.xpBarBg);
        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = '10px monospace';
        ctx.fillText(`XP ${player.xp}/${player.xpToNext}`, x + 50, 14);
        x += 110;

        // Hunger bar
        const hungerColor = player.hunger > HUNGER_WARNING_THRESHOLD ? COLORS.hungerBar : '#cc2222';
        this._drawBar(x, 8, 80, 10, player.hunger, MAX_HUNGER, hungerColor, COLORS.hungerBarBg);
        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = '10px monospace';
        ctx.fillText(`Food`, x + 40, 14);
        x += 90;

        // Gold
        ctx.fillStyle = COLORS.textGold;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`$ ${formatNumber(player.gold)}`, x, barH / 2);
        x += 80;

        // Floor
        ctx.fillStyle = COLORS.textPrimary;
        ctx.fillText(`Floor ${player.floor}/${MAX_FLOORS}`, x, barH / 2);

        // Second row: STR/DEF/DEX/INT
        const y2 = 28;
        let sx = 10;
        ctx.font = '10px monospace';
        const statColors = { STR: '#cc4444', DEF: '#4488cc', DEX: '#44cc44', INT: '#aa66ff' };
        for (const [label, val] of [['STR', player.str], ['DEF', player.def], ['DEX', player.dex], ['INT', player.int]]) {
            ctx.fillStyle = statColors[label];
            ctx.fillText(`${label}:${val}`, sx, y2);
            sx += 55;
        }
    }

    _drawBar(x, y, w, h, current, max, fgColor, bgColor) {
        const ctx = this.ctx;
        const pct = max > 0 ? clamp(current / max, 0, 1) : 0;

        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = fgColor;
        ctx.fillRect(x, y, w * pct, h);
        ctx.strokeStyle = COLORS.hudBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
    }

    _renderAbilityBar(player, w, h) {
        const ctx = this.ctx;
        const barY = h - 80;
        const barH = 35;
        const abilityW = 160;
        const totalW = player.abilities.length * (abilityW + 5);
        const startX = (w - totalW) / 2;

        for (let i = 0; i < player.abilities.length; i++) {
            const ability = player.abilities[i];
            const x = startX + i * (abilityW + 5);

            const canUse = ability.currentCooldown === 0 && player.mp >= ability.mpCost;

            // Background
            ctx.fillStyle = canUse ? 'rgba(20, 20, 40, 0.85)' : 'rgba(30, 10, 10, 0.85)';
            ctx.fillRect(x, barY, abilityW, barH);
            ctx.strokeStyle = canUse ? '#555568' : '#442222';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, barY, abilityW, barH);

            // Key number
            ctx.fillStyle = canUse ? '#ffcc00' : '#664422';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`[${i + 1}]`, x + 4, barY + barH / 2);

            // Name
            ctx.fillStyle = canUse ? COLORS.textPrimary : '#666666';
            ctx.font = '11px monospace';
            ctx.fillText(ability.name, x + 30, barY + 12);

            // Cost / Cooldown
            if (ability.currentCooldown > 0) {
                ctx.fillStyle = '#cc4444';
                ctx.font = '10px monospace';
                ctx.fillText(`CD: ${ability.currentCooldown}`, x + 30, barY + 26);
            } else {
                ctx.fillStyle = COLORS.textMana;
                ctx.font = '10px monospace';
                ctx.fillText(`${ability.mpCost} MP`, x + 30, barY + 26);
            }
        }
    }

    _renderMessageLog(w, h) {
        const ctx = this.ctx;
        const logH = 90;
        const logY = h - logH - 45;
        const logW = w * 0.5;
        const logX = 10;

        ctx.fillStyle = 'rgba(10, 10, 18, 0.75)';
        ctx.fillRect(logX, logY, logW, logH);
        ctx.strokeStyle = COLORS.hudBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(logX, logY, logW, logH);

        const startIdx = Math.max(0, this.messages.length - this.visibleMessages - this.messageScroll);
        const endIdx = Math.min(this.messages.length, startIdx + this.visibleMessages);

        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        for (let i = startIdx; i < endIdx; i++) {
            const msg = this.messages[i];
            const lineY = logY + 5 + (i - startIdx) * 16;
            const age = (Date.now() - msg.time) / 1000;
            const alpha = age < 5 ? 1 : Math.max(0.4, 1 - (age - 5) * 0.1);

            ctx.globalAlpha = alpha;
            ctx.fillStyle = msg.color;
            // Truncate if too long
            const maxChars = Math.floor(logW / 7.5);
            const text = msg.text.length > maxChars ? msg.text.substring(0, maxChars - 3) + '...' : msg.text;
            ctx.fillText(text, logX + 5, lineY);
        }
        ctx.globalAlpha = 1;
    }

    _renderStatusEffects(player, w) {
        const ctx = this.ctx;
        let x = w - 170;
        const y = 5;

        for (const effect of player.statusEffects) {
            const color = STATUS_COLORS[effect.type] || '#ffffff';
            ctx.fillStyle = 'rgba(10, 10, 18, 0.8)';
            ctx.fillRect(x - 2, y - 2, 80, 18);
            ctx.fillStyle = color;
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`${effect.type} (${effect.duration})`, x, y);
            x -= 85;
        }

        if (player.stealthTurns > 0) {
            ctx.fillStyle = 'rgba(10, 10, 18, 0.8)';
            ctx.fillRect(x - 2, y - 2, 80, 18);
            ctx.fillStyle = '#8888aa';
            ctx.font = '10px monospace';
            ctx.fillText(`Stealth (${player.stealthTurns})`, x, y);
        }

        if (player.invulnTurns > 0) {
            ctx.fillStyle = 'rgba(10, 10, 18, 0.8)';
            ctx.fillRect(x - 2, y - 2, 80, 18);
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px monospace';
            ctx.fillText(`Immune (${player.invulnTurns})`, x, y);
        }
    }

    _renderPlayerList(game, w, h) {
        const ctx = this.ctx;
        const players = Object.values(game.otherPlayers);
        if (players.length === 0) return;

        const listX = w - 160;
        const listY = 220;
        const rowH = 24;
        const listW = 150;

        // Background
        ctx.fillStyle = 'rgba(10, 10, 18, 0.75)';
        ctx.fillRect(listX - 5, listY - 18, listW + 10, 20 + players.length * rowH);
        ctx.strokeStyle = COLORS.hudBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(listX - 5, listY - 18, listW + 10, 20 + players.length * rowH);

        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('PARTY', listX, listY - 14);

        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            const py = listY + 4 + i * rowH;

            // Name
            ctx.fillStyle = p.isAlive ? (p.color || '#66ccff') : '#555555';
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(p.name || 'Player', listX, py);

            // HP bar
            if (p.hp !== undefined && p.maxHp) {
                const barW = 60;
                const barH = 4;
                const barX = listX + listW - barW;
                const barY = py + 4;
                const hpPct = p.maxHp > 0 ? p.hp / p.maxHp : 0;

                ctx.fillStyle = '#441111';
                ctx.fillRect(barX, barY, barW, barH);
                ctx.fillStyle = p.isAlive ? (hpPct > 0.5 ? '#44cc44' : hpPct > 0.25 ? '#ccaa22' : '#cc2222') : '#333333';
                ctx.fillRect(barX, barY, barW * hpPct, barH);

                // HP text
                ctx.fillStyle = p.isAlive ? COLORS.textPrimary : '#555555';
                ctx.font = '8px monospace';
                ctx.textAlign = 'right';
                ctx.fillText(`${p.hp}/${p.maxHp}`, barX - 3, py + 2);
            }

            if (!p.isAlive) {
                ctx.fillStyle = '#cc4444';
                ctx.font = '8px monospace';
                ctx.textAlign = 'right';
                ctx.fillText('DEAD', listX + listW, py + 2);
            }
        }
    }

    // Render inventory screen
    renderInventory(game) {
        const ctx = this.ctx;
        const player = game.player;
        const w = this.renderer.width;
        const h = this.renderer.height;

        // Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, w, h);

        const panelW = 600;
        const panelH = 500;
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        // Panel background
        ctx.fillStyle = COLORS.tooltipBg;
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = COLORS.hudBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        // Title
        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('INVENTORY', panelX + panelW / 2, panelY + 25);

        // Tabs
        const tabs = ['items', 'equip'];
        for (let i = 0; i < tabs.length; i++) {
            const tabX = panelX + 10 + i * 100;
            const isActive = this.inventoryTab === tabs[i];
            ctx.fillStyle = isActive ? '#333348' : '#1a1a28';
            ctx.fillRect(tabX, panelY + 40, 90, 25);
            ctx.strokeStyle = COLORS.hudBorder;
            ctx.strokeRect(tabX, panelY + 40, 90, 25);
            ctx.fillStyle = isActive ? '#ffffff' : '#888899';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(tabs[i].toUpperCase(), tabX + 45, panelY + 55);
        }

        if (this.inventoryTab === 'items') {
            this._renderItemList(player, panelX, panelY + 75, panelW, panelH - 85);
        } else {
            this._renderEquipmentPanel(player, panelX, panelY + 75, panelW, panelH - 85);
        }

        // Controls hint
        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[I] Close  [Tab] Switch Tab  [Up/Down] Select  [E] Equip  [U] Use  [D] Drop', panelX + panelW / 2, panelY + panelH - 10);
    }

    _renderItemList(player, px, py, pw, ph) {
        const ctx = this.ctx;

        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Items: ${player.inventory.length}/${MAX_INVENTORY_SIZE}`, px + 10, py);

        for (let i = 0; i < player.inventory.length; i++) {
            const item = player.inventory[i];
            const y = py + 18 + i * 22;
            const isSelected = i === this.selectedInventoryIndex;

            if (isSelected) {
                ctx.fillStyle = 'rgba(68, 68, 136, 0.3)';
                ctx.fillRect(px + 5, y - 4, pw - 10, 20);
            }

            // Item symbol
            ctx.fillStyle = getItemColor(item);
            ctx.font = '14px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(item.symbol || '?', px + 12, y + 6);

            // Item name
            ctx.fillStyle = getItemColor(item);
            ctx.font = '12px monospace';
            ctx.fillText(item.name, px + 30, y + 6);

            // Description
            if (item.description && isSelected) {
                ctx.fillStyle = COLORS.textSecondary;
                ctx.font = '10px monospace';
                ctx.fillText(item.description, px + 30, y + 18);
            }
        }

        if (player.inventory.length === 0) {
            ctx.fillStyle = COLORS.textSecondary;
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Inventory is empty', px + pw / 2, py + 80);
        }

        // Selected item details
        if (player.inventory[this.selectedInventoryIndex]) {
            const item = player.inventory[this.selectedInventoryIndex];
            const detailX = px + pw - 200;
            const detailY = py + 20;

            ctx.fillStyle = 'rgba(20, 20, 35, 0.9)';
            ctx.fillRect(detailX - 5, detailY - 5, 195, 120);
            ctx.strokeStyle = getItemColor(item);
            ctx.lineWidth = 1;
            ctx.strokeRect(detailX - 5, detailY - 5, 195, 120);

            ctx.fillStyle = getItemColor(item);
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(item.name, detailX, detailY + 10);

            ctx.fillStyle = COLORS.textSecondary;
            ctx.font = '10px monospace';
            ctx.fillText(`Rarity: ${item.rarity || 'common'}`, detailX, detailY + 28);

            if (item.description) {
                ctx.fillText(item.description, detailX, detailY + 44);
            }

            // Show comparison with equipped item
            if (item.slot) {
                const equipped = player.equipment[item.slot];
                if (equipped) {
                    ctx.fillStyle = COLORS.textSecondary;
                    ctx.fillText(`Equipped: ${equipped.name}`, detailX, detailY + 64);

                    if (item.damage && equipped.damage) {
                        const diff = item.damage - equipped.damage;
                        ctx.fillStyle = diff > 0 ? COLORS.textHeal : diff < 0 ? COLORS.textDamage : COLORS.textSecondary;
                        ctx.fillText(`DMG: ${diff > 0 ? '+' : ''}${diff}`, detailX, detailY + 80);
                    }
                    if (item.defense && equipped.defense) {
                        const diff = item.defense - equipped.defense;
                        ctx.fillStyle = diff > 0 ? COLORS.textHeal : diff < 0 ? COLORS.textDamage : COLORS.textSecondary;
                        ctx.fillText(`DEF: ${diff > 0 ? '+' : ''}${diff}`, detailX + 80, detailY + 80);
                    }
                }
            }
        }
    }

    _renderEquipmentPanel(player, px, py, pw, ph) {
        const ctx = this.ctx;
        const slots = Object.values(SLOT);

        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Equipment', px + 10, py + 5);

        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            const item = player.equipment[slot];
            const y = py + 30 + i * 40;
            const isSelected = this.selectedEquipSlot === slot || (!this.selectedEquipSlot && i === 0);

            if (isSelected) {
                ctx.fillStyle = 'rgba(68, 68, 136, 0.3)';
                ctx.fillRect(px + 5, y - 5, pw - 10, 35);
            }

            // Slot name
            ctx.fillStyle = COLORS.textSecondary;
            ctx.font = '11px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(slot.toUpperCase() + ':', px + 12, y + 5);

            if (item) {
                ctx.fillStyle = getItemColor(item);
                ctx.font = '12px monospace';
                ctx.fillText(item.name, px + 80, y + 5);

                ctx.fillStyle = COLORS.textSecondary;
                ctx.font = '10px monospace';
                ctx.fillText(item.description || '', px + 80, y + 20);
            } else {
                ctx.fillStyle = '#444455';
                ctx.font = '12px monospace';
                ctx.fillText('-- empty --', px + 80, y + 5);
            }
        }

        // Stats summary
        const statsX = px + 10;
        const statsY = py + 260;
        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = 'bold 12px monospace';
        ctx.fillText('Stats', statsX, statsY);

        const stats = [
            ['Attack Power', player.getAttackPower()],
            ['Defense Power', player.getDefensePower()],
            ['Crit Chance', Math.floor(player.getCritChance() * 100) + '%'],
            ['Dodge Chance', Math.floor(player.getDodgeChance() * 100) + '%'],
            ['Block Chance', Math.floor(player.getBlockChance() * 100) + '%'],
        ];

        ctx.font = '11px monospace';
        for (let i = 0; i < stats.length; i++) {
            ctx.fillStyle = COLORS.textSecondary;
            ctx.fillText(stats[i][0] + ':', statsX, statsY + 18 + i * 16);
            ctx.fillStyle = COLORS.textPrimary;
            ctx.fillText(String(stats[i][1]), statsX + 130, statsY + 18 + i * 16);
        }
    }

    // Character sheet
    renderCharacterSheet(game) {
        const ctx = this.ctx;
        const player = game.player;
        const w = this.renderer.width;
        const h = this.renderer.height;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, w, h);

        const panelW = 400;
        const panelH = 450;
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        ctx.fillStyle = COLORS.tooltipBg;
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = COLORS.hudBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        // Title
        ctx.fillStyle = player.color;
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${player.className} - Level ${player.level}`, panelX + panelW / 2, panelY + 30);

        // Stats
        const stats = [
            ['HP', `${player.hp} / ${player.maxHp}`, COLORS.hpBar],
            ['MP', `${player.mp} / ${player.maxMp}`, COLORS.mpBar],
            ['Strength', player.str, '#cc4444'],
            ['Defense', player.def, '#4488cc'],
            ['Dexterity', player.dex, '#44cc44'],
            ['Intelligence', player.int, '#aa66ff'],
            ['Attack Power', player.getAttackPower(), COLORS.textDamage],
            ['Defense Power', player.getDefensePower(), '#4488cc'],
            ['Crit Chance', Math.floor(player.getCritChance() * 100) + '%', COLORS.textCrit],
            ['Dodge Chance', Math.floor(player.getDodgeChance() * 100) + '%', '#44cc44'],
            ['Block Chance', Math.floor(player.getBlockChance() * 100) + '%', '#8888ff'],
            ['Hunger', Math.floor(player.hunger), COLORS.hungerBar],
        ];

        let sy = panelY + 60;
        ctx.font = '12px monospace';
        for (const [label, value, color] of stats) {
            ctx.fillStyle = COLORS.textSecondary;
            ctx.textAlign = 'left';
            ctx.fillText(label + ':', panelX + 20, sy);
            ctx.fillStyle = color;
            ctx.textAlign = 'right';
            ctx.fillText(String(value), panelX + panelW - 20, sy);
            sy += 20;
        }

        // Run statistics
        sy += 15;
        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Run Statistics', panelX + 20, sy);
        sy += 20;

        const runStats = [
            ['Enemies Killed', player.stats.enemiesKilled],
            ['Bosses Killed', player.stats.bossesKilled],
            ['Damage Dealt', formatNumber(player.stats.damageDealt)],
            ['Damage Taken', formatNumber(player.stats.damageTaken)],
            ['Gold Collected', formatNumber(player.stats.goldCollected)],
            ['Items Found', player.stats.itemsFound],
            ['Turns Played', formatNumber(player.stats.turnsPlayed)],
        ];

        ctx.font = '11px monospace';
        for (const [label, value] of runStats) {
            ctx.fillStyle = COLORS.textSecondary;
            ctx.textAlign = 'left';
            ctx.fillText(label + ':', panelX + 20, sy);
            ctx.fillStyle = COLORS.textPrimary;
            ctx.textAlign = 'right';
            ctx.fillText(String(value), panelX + panelW - 20, sy);
            sy += 16;
        }

        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[C] Close', panelX + panelW / 2, panelY + panelH - 10);
    }

    // Level up screen — 3-card choice system
    renderLevelUp(game) {
        const ctx = this.ctx;
        const player = game.player;
        const w = this.renderer.width;
        const h = this.renderer.height;
        const choices = player.levelUpChoices;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, w, h);

        // Title
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('LEVEL UP!', w / 2, h / 2 - 140);

        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = '13px monospace';
        ctx.fillText(`Level ${player.level} — Choose an upgrade:`, w / 2, h / 2 - 115);

        if (choices.length === 0) {
            ctx.fillStyle = COLORS.textSecondary;
            ctx.font = '12px monospace';
            ctx.fillText('Generating choices...', w / 2, h / 2);
            return;
        }

        // Draw 3 cards
        const cardW = 160;
        const cardH = 180;
        const cardGap = 20;
        const totalW = choices.length * cardW + (choices.length - 1) * cardGap;
        const startX = (w - totalW) / 2;
        const cardY = h / 2 - 80;

        for (let i = 0; i < choices.length; i++) {
            const choice = choices[i];
            const cx = startX + i * (cardW + cardGap);
            const isSelected = i === this.levelUpSelection;

            // Card background
            const borderColor = isSelected ? '#ffcc00' : '#444466';
            ctx.fillStyle = isSelected ? 'rgba(40, 40, 70, 0.95)' : 'rgba(20, 20, 40, 0.9)';
            ctx.fillRect(cx, cardY, cardW, cardH);
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeRect(cx, cardY, cardW, cardH);

            // Selection glow
            if (isSelected) {
                ctx.shadowColor = '#ffcc00';
                ctx.shadowBlur = 10;
                ctx.strokeRect(cx, cardY, cardW, cardH);
                ctx.shadowBlur = 0;
            }

            // Type badge
            let badgeColor, badgeText;
            switch (choice.type) {
                case 'stat': badgeColor = choice.data.color || '#888888'; badgeText = 'STAT'; break;
                case 'perk': badgeColor = choice.data.iconColor || '#44cc88'; badgeText = 'PERK'; break;
                case 'ability': badgeColor = '#ff8844'; badgeText = 'ABILITY'; break;
            }
            ctx.fillStyle = badgeColor;
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(badgeText, cx + cardW / 2, cardY + 18);

            // Name
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px monospace';
            let name = '';
            switch (choice.type) {
                case 'stat': name = choice.data.name; break;
                case 'perk': name = choice.data.name; break;
                case 'ability': name = choice.data.name; break;
            }
            // Word wrap name if too long
            if (name.length > 16) {
                const mid = name.lastIndexOf(' ', 16);
                if (mid > 0) {
                    ctx.fillText(name.substring(0, mid), cx + cardW / 2, cardY + 45);
                    ctx.fillText(name.substring(mid + 1), cx + cardW / 2, cardY + 60);
                } else {
                    ctx.fillText(name, cx + cardW / 2, cardY + 50);
                }
            } else {
                ctx.fillText(name, cx + cardW / 2, cardY + 50);
            }

            // Icon (large centered)
            ctx.font = 'bold 28px monospace';
            let icon = '?', iconColor = '#ffffff';
            switch (choice.type) {
                case 'stat': icon = choice.data.stat === 'maxhp' ? '+' : choice.data.stat === 'maxmp' ? '+' : choice.data.stat[0].toUpperCase(); iconColor = choice.data.color; break;
                case 'perk': icon = choice.data.icon; iconColor = choice.data.iconColor; break;
                case 'ability': icon = '*'; iconColor = '#ff8844'; break;
            }
            ctx.fillStyle = iconColor;
            ctx.fillText(icon, cx + cardW / 2, cardY + 95);

            // Description
            ctx.fillStyle = '#aaaacc';
            ctx.font = '10px monospace';
            let desc = '';
            switch (choice.type) {
                case 'stat': desc = choice.data.name; break;
                case 'perk': {
                    desc = choice.data.description;
                    const stacks = player.getPerkStacks(choice.data.key);
                    if (stacks > 0) desc += ` (${stacks}/${choice.data.maxStacks})`;
                    break;
                }
                case 'ability': desc = choice.data.description; break;
            }
            // Word wrap description
            const words = desc.split(' ');
            let line = '';
            let lineY = cardY + 125;
            for (const word of words) {
                const test = line + (line ? ' ' : '') + word;
                if (ctx.measureText(test).width > cardW - 16) {
                    ctx.fillText(line, cx + cardW / 2, lineY);
                    line = word;
                    lineY += 14;
                } else {
                    line = test;
                }
            }
            if (line) ctx.fillText(line, cx + cardW / 2, lineY);

            // Selection indicator
            if (isSelected) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = 'bold 14px monospace';
                ctx.fillText('[ SELECT ]', cx + cardW / 2, cardY + cardH - 10);
            }
        }

        // Controls
        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[Left/Right] Choose   [Enter] Confirm', w / 2, cardY + cardH + 30);
    }

    // Multiplayer menu screen
    renderMpMenu(game) {
        const ctx = this.ctx;
        const w = this.renderer.width;
        const h = this.renderer.height;

        // Background
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, w, h);

        // Animated background
        const time = Date.now() / 1000;
        for (let i = 0; i < 50; i++) {
            const x = (Math.sin(time * 0.3 + i * 1.7) * 0.5 + 0.5) * w;
            const y = (Math.cos(time * 0.2 + i * 2.3) * 0.5 + 0.5) * h;
            const alpha = Math.sin(time + i) * 0.15 + 0.15;
            ctx.fillStyle = `rgba(100, 200, 100, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Title
        ctx.fillStyle = '#44cc88';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('MULTIPLAYER', w / 2, h * 0.15);

        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '14px monospace';
        ctx.fillText('Co-op Dungeon Crawling', w / 2, h * 0.15 + 35);

        // Server address field
        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = 'bold 14px monospace';
        ctx.fillText('Server Address:', w / 2, h * 0.3);

        const addrBoxW = 300;
        const addrBoxH = 30;
        const addrBoxX = (w - addrBoxW) / 2;
        const addrBoxY = h * 0.3 + 10;

        ctx.fillStyle = 'rgba(20, 20, 35, 0.9)';
        ctx.fillRect(addrBoxX, addrBoxY, addrBoxW, addrBoxH);
        ctx.strokeStyle = '#44cc88';
        ctx.lineWidth = 1;
        ctx.strokeRect(addrBoxX, addrBoxY, addrBoxW, addrBoxH);

        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        const cursor = Math.sin(time * 4) > 0 ? '|' : '';
        ctx.fillText(game.serverAddress + cursor, w / 2, addrBoxY + 20);

        // Class selection
        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = 'bold 16px monospace';
        ctx.fillText('Choose Your Class', w / 2, h * 0.48);

        const classes = Object.values(CLASS);
        const classWidth = 140;
        const totalWidth = classes.length * classWidth + (classes.length - 1) * 10;
        const startX = (w - totalWidth) / 2;

        for (let i = 0; i < classes.length; i++) {
            const cls = CLASS_DATA[classes[i]];
            const x = startX + i * (classWidth + 10);
            const y = h * 0.52;
            const isSelected = game.mpClassSelection === i;

            ctx.fillStyle = isSelected ? 'rgba(40, 40, 70, 0.9)' : 'rgba(20, 20, 35, 0.8)';
            ctx.fillRect(x, y, classWidth, 100);
            ctx.strokeStyle = isSelected ? cls.color : COLORS.hudBorder;
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeRect(x, y, classWidth, 100);

            if (isSelected) {
                ctx.fillStyle = cls.color;
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('> SELECTED <', x + classWidth / 2, y - 6);
            }

            ctx.fillStyle = cls.color;
            ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(cls.symbol, x + classWidth / 2, y + 35);

            ctx.font = 'bold 12px monospace';
            ctx.fillText(cls.name, x + classWidth / 2, y + 55);

            ctx.fillStyle = COLORS.textSecondary;
            ctx.font = '9px monospace';
            ctx.fillText(`HP:${cls.baseStats.hp} STR:${cls.baseStats.str}`, x + classWidth / 2, y + 75);
            ctx.fillText(`DEF:${cls.baseStats.def} DEX:${cls.baseStats.dex}`, x + classWidth / 2, y + 87);
        }

        // Error message
        if (game.mpError) {
            ctx.fillStyle = '#cc4444';
            ctx.font = '14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(game.mpError, w / 2, h * 0.82);
        }

        // Connecting message
        if (game.mpConnecting) {
            ctx.fillStyle = '#44cc88';
            ctx.font = '14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Connecting...', w / 2, h * 0.82);
        }

        // Controls
        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[Left/Right] Select Class  [Enter] Connect  [Esc] Back', w / 2, h * 0.92);
    }

    // Lobby screen (waiting for players / host to start)
    renderLobby(game) {
        const ctx = this.ctx;
        const w = this.renderer.width;
        const h = this.renderer.height;

        // Background
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, w, h);

        const time = Date.now() / 1000;
        for (let i = 0; i < 40; i++) {
            const x = (Math.sin(time * 0.4 + i * 1.9) * 0.5 + 0.5) * w;
            const y = (Math.cos(time * 0.3 + i * 2.1) * 0.5 + 0.5) * h;
            const alpha = Math.sin(time * 1.5 + i) * 0.1 + 0.1;
            ctx.fillStyle = `rgba(100, 150, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Title
        ctx.fillStyle = '#66aaff';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('LOBBY', w / 2, h * 0.12);

        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '12px monospace';
        ctx.fillText(`Server: ${game.serverAddress}`, w / 2, h * 0.12 + 30);

        // Player list panel
        const panelW = 450;
        const panelH = 280;
        const panelX = (w - panelW) / 2;
        const panelY = h * 0.22;

        ctx.fillStyle = 'rgba(15, 15, 28, 0.9)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = '#66aaff';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`Players (${game.lobbyPlayers.length}/${MAX_PLAYERS})`, w / 2, panelY + 22);

        // Players
        for (let i = 0; i < game.lobbyPlayers.length; i++) {
            const p = game.lobbyPlayers[i];
            const py = panelY + 45 + i * 50;
            const isMe = p.id === game.myPlayerId;

            // Row background
            ctx.fillStyle = isMe ? 'rgba(40, 50, 80, 0.5)' : 'rgba(25, 25, 40, 0.5)';
            ctx.fillRect(panelX + 10, py, panelW - 20, 42);
            if (isMe) {
                ctx.strokeStyle = '#66aaff';
                ctx.lineWidth = 1;
                ctx.strokeRect(panelX + 10, py, panelW - 20, 42);
            }

            // Class symbol and color
            const classData = CLASS_DATA[p.classId];
            const classColor = classData ? classData.color : '#888888';
            const classSymbol = classData ? classData.symbol : '?';
            const className = classData ? classData.name : 'Unknown';

            ctx.fillStyle = classColor;
            ctx.font = 'bold 20px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(classSymbol, panelX + 22, py + 26);

            // Name
            ctx.fillStyle = isMe ? '#ffffff' : COLORS.textPrimary;
            ctx.font = 'bold 13px monospace';
            ctx.fillText(p.name || 'Player', panelX + 50, py + 18);

            // Class name
            ctx.fillStyle = classColor;
            ctx.font = '11px monospace';
            ctx.fillText(className, panelX + 50, py + 34);

            // Host badge
            if (p.isHost) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'right';
                ctx.fillText('HOST', panelX + panelW - 20, py + 18);
            }

            // "You" indicator
            if (isMe) {
                ctx.fillStyle = '#66aaff';
                ctx.font = '10px monospace';
                ctx.textAlign = 'right';
                ctx.fillText('(YOU)', panelX + panelW - 20, py + 34);
            }
        }

        // Class switch hint
        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';

        const currentClass = CLASS_DATA[Object.values(CLASS)[game.mpClassSelection]];
        if (currentClass) {
            ctx.fillStyle = currentClass.color;
            ctx.fillText(`Your class: ${currentClass.name}  [Left/Right to change]`, w / 2, panelY + panelH + 25);
        }

        // Start / waiting
        if (game.network && game.network.isHost) {
            const canStart = game.lobbyPlayers.length >= 1;
            ctx.fillStyle = canStart ? '#44cc44' : '#666666';
            ctx.font = 'bold 18px monospace';
            ctx.fillText(canStart ? 'Press [Enter] to Start' : 'Need at least 1 player', w / 2, h * 0.82);
        } else {
            const dots = '.'.repeat(Math.floor(time * 2) % 4);
            ctx.fillStyle = '#88aacc';
            ctx.font = '16px monospace';
            ctx.fillText(`Waiting for host to start${dots}`, w / 2, h * 0.82);
        }

        // Error
        if (game.mpError) {
            ctx.fillStyle = '#cc4444';
            ctx.font = '12px monospace';
            ctx.fillText(game.mpError, w / 2, h * 0.87);
        }

        // Controls
        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '12px monospace';
        ctx.fillText('[Esc] Disconnect', w / 2, h * 0.93);
    }

    // Menu screen
    renderMenu(game) {
        const ctx = this.ctx;
        const w = this.renderer.width;
        const h = this.renderer.height;

        // Background
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, w, h);

        // Animated background particles
        const time = Date.now() / 1000;
        for (let i = 0; i < 50; i++) {
            const x = (Math.sin(time * 0.3 + i * 1.7) * 0.5 + 0.5) * w;
            const y = (Math.cos(time * 0.2 + i * 2.3) * 0.5 + 0.5) * h;
            const alpha = Math.sin(time + i) * 0.15 + 0.15;
            ctx.fillStyle = `rgba(100, 100, 200, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Title
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('DEPTHS OF VALRATH', w / 2, h * 0.2);

        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '14px monospace';
        ctx.fillText('A Roguelike Adventure', w / 2, h * 0.2 + 40);

        // Class selection
        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = 'bold 18px monospace';
        ctx.fillText('Choose Your Class', w / 2, h * 0.35);

        const classes = Object.values(CLASS);
        const classWidth = 180;
        const totalWidth = classes.length * classWidth + (classes.length - 1) * 15;
        const startX = (w - totalWidth) / 2;

        for (let i = 0; i < classes.length; i++) {
            const cls = CLASS_DATA[classes[i]];
            const x = startX + i * (classWidth + 15);
            const y = h * 0.4;
            const isSelected = game.menuSelection === i;

            // Card
            ctx.fillStyle = isSelected ? 'rgba(40, 40, 70, 0.9)' : 'rgba(20, 20, 35, 0.8)';
            ctx.fillRect(x, y, classWidth, 220);
            ctx.strokeStyle = isSelected ? cls.color : COLORS.hudBorder;
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeRect(x, y, classWidth, 220);

            // Selection indicator
            if (isSelected) {
                ctx.fillStyle = cls.color;
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('> SELECTED <', x + classWidth / 2, y - 8);
            }

            // Class symbol
            ctx.fillStyle = cls.color;
            ctx.font = 'bold 36px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(cls.symbol, x + classWidth / 2, y + 40);

            // Name
            ctx.fillStyle = cls.color;
            ctx.font = 'bold 14px monospace';
            ctx.fillText(cls.name, x + classWidth / 2, y + 65);

            // Description (word wrap)
            ctx.fillStyle = COLORS.textSecondary;
            ctx.font = '10px monospace';
            const words = cls.description.split(' ');
            let line = '';
            let lineY = y + 85;
            for (const word of words) {
                const test = line + word + ' ';
                if (ctx.measureText(test).width > classWidth - 20) {
                    ctx.fillText(line, x + classWidth / 2, lineY);
                    line = word + ' ';
                    lineY += 14;
                } else {
                    line = test;
                }
            }
            ctx.fillText(line, x + classWidth / 2, lineY);

            // Stats preview
            lineY += 20;
            ctx.font = '9px monospace';
            const stats = cls.baseStats;
            const statLabels = ['HP', 'MP', 'STR', 'DEF', 'DEX', 'INT'];
            const statValues = [stats.hp, stats.mp, stats.str, stats.def, stats.dex, stats.int];
            const statColors = ['#cc4444', '#4488cc', '#cc4444', '#4488cc', '#44cc44', '#aa66ff'];
            for (let j = 0; j < statLabels.length; j++) {
                ctx.fillStyle = statColors[j];
                ctx.fillText(`${statLabels[j]}:${statValues[j]}`, x + classWidth / 2, lineY + j * 12);
            }
        }

        // Controls
        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[Left/Right] Select Class  [Enter] Start Game  [M] Multiplayer', w / 2, h * 0.92);
        ctx.fillText('WASD/Arrows: Move | Space: Wait | 1-4: Abilities | I: Inventory | G: Pickup', w / 2, h * 0.95);
    }

    // Game over screen
    renderGameOver(game) {
        const ctx = this.ctx;
        const player = game.player;
        const w = this.renderer.width;
        const h = this.renderer.height;

        ctx.fillStyle = 'rgba(20, 0, 0, 0.9)';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#cc2222';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('YOU HAVE FALLEN', w / 2, h * 0.2);

        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '16px monospace';
        ctx.fillText(`${player.className} - Level ${player.level}`, w / 2, h * 0.28);
        ctx.fillText(`Reached Floor ${player.floor}`, w / 2, h * 0.32);

        // Stats
        const stats = [
            ['Enemies Slain', player.stats.enemiesKilled],
            ['Bosses Defeated', player.stats.bossesKilled],
            ['Damage Dealt', formatNumber(player.stats.damageDealt)],
            ['Damage Taken', formatNumber(player.stats.damageTaken)],
            ['Gold Collected', formatNumber(player.stats.goldCollected)],
            ['Items Found', player.stats.itemsFound],
            ['Critical Hits', player.stats.criticalHits],
            ['Potions Used', player.stats.potionsDrunk],
            ['Turns Survived', formatNumber(player.stats.turnsPlayed)],
        ];

        let sy = h * 0.4;
        ctx.font = '13px monospace';
        for (const [label, value] of stats) {
            ctx.fillStyle = COLORS.textSecondary;
            ctx.textAlign = 'right';
            ctx.fillText(label + ':', w / 2 - 10, sy);
            ctx.fillStyle = COLORS.textPrimary;
            ctx.textAlign = 'left';
            ctx.fillText(String(value), w / 2 + 10, sy);
            sy += 22;
        }

        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Press [Enter] to Try Again', w / 2, h * 0.88);
    }

    // Victory screen
    renderVictory(game) {
        const ctx = this.ctx;
        const player = game.player;
        const w = this.renderer.width;
        const h = this.renderer.height;

        ctx.fillStyle = 'rgba(0, 10, 20, 0.9)';
        ctx.fillRect(0, 0, w, h);

        // Animated gold particles
        const time = Date.now() / 1000;
        for (let i = 0; i < 100; i++) {
            const x = (Math.sin(time * 0.5 + i * 1.3) * 0.4 + 0.5) * w;
            const y = ((time * 20 + i * 37) % h);
            const alpha = Math.sin(time * 2 + i) * 0.3 + 0.4;
            ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
            ctx.fillRect(x, y, 3, 3);
        }

        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('VICTORY!', w / 2, h * 0.15);

        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = '16px monospace';
        ctx.fillText('You have defeated Valrath the Undying!', w / 2, h * 0.23);
        ctx.fillText('The depths are freed from darkness.', w / 2, h * 0.27);

        ctx.fillStyle = '#ffcc00';
        ctx.font = '14px monospace';
        ctx.fillText(`${player.className} - Level ${player.level}`, w / 2, h * 0.33);

        // Stats
        const stats = [
            ['Enemies Slain', player.stats.enemiesKilled],
            ['Bosses Defeated', player.stats.bossesKilled],
            ['Damage Dealt', formatNumber(player.stats.damageDealt)],
            ['Gold Collected', formatNumber(player.stats.goldCollected)],
            ['Turns Taken', formatNumber(player.stats.turnsPlayed)],
        ];

        let sy = h * 0.4;
        ctx.font = '13px monospace';
        for (const [label, value] of stats) {
            ctx.fillStyle = COLORS.textSecondary;
            ctx.textAlign = 'right';
            ctx.fillText(label + ':', w / 2 - 10, sy);
            ctx.fillStyle = '#ffcc00';
            ctx.textAlign = 'left';
            ctx.fillText(String(value), w / 2 + 10, sy);
            sy += 22;
        }

        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Press [Enter] to Play Again', w / 2, h * 0.88);
    }

    // Shop screen
    renderShop(game) {
        const ctx = this.ctx;
        const player = game.player;
        const w = this.renderer.width;
        const h = this.renderer.height;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, w, h);

        const panelW = 500;
        const panelH = 400;
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        ctx.fillStyle = COLORS.tooltipBg;
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = '#44aa44';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        ctx.fillStyle = '#44aa44';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SHOP', panelX + panelW / 2, panelY + 25);

        ctx.fillStyle = COLORS.textGold;
        ctx.font = '14px monospace';
        ctx.fillText(`Gold: ${formatNumber(player.gold)}`, panelX + panelW / 2, panelY + 48);

        // Filter shop items for current position
        const shopItems = game.items.filter(item =>
            item.isShopItem && chebyshevDist(player.x, player.y, item.x, item.y) <= 3
        );

        for (let i = 0; i < shopItems.length; i++) {
            const item = shopItems[i];
            const y = panelY + 68 + i * 30;
            const isSelected = i === this.shopSelection;

            if (isSelected) {
                ctx.fillStyle = 'rgba(68, 68, 136, 0.3)';
                ctx.fillRect(panelX + 5, y - 5, panelW - 10, 28);
            }

            ctx.fillStyle = getItemColor(item);
            ctx.font = '12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`${item.symbol} ${item.name}`, panelX + 15, y + 8);

            ctx.fillStyle = COLORS.textGold;
            ctx.textAlign = 'right';
            ctx.fillText(`${item.shopPrice}g`, panelX + panelW - 15, y + 8);

            if (isSelected && item.description) {
                ctx.fillStyle = COLORS.textSecondary;
                ctx.font = '10px monospace';
                ctx.textAlign = 'left';
                ctx.fillText(item.description, panelX + 30, y + 20);
            }
        }

        if (shopItems.length === 0) {
            ctx.fillStyle = COLORS.textSecondary;
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('No items for sale here', panelX + panelW / 2, panelY + 120);
        }

        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[Up/Down] Select  [Enter] Buy  [Esc] Close', panelX + panelW / 2, panelY + panelH - 12);
    }

    // NPC Dialogue screen
    renderNPCDialogue(game) {
        const ctx = this.ctx;
        const w = this.renderer.width;
        const h = this.renderer.height;
        const npc = game.activeNPC;
        if (!npc) return;

        const npcData = NPC_DATA[npc.npcType];

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, w, h);

        // Dialogue panel
        const panelW = 500;
        const panelH = 340;
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        ctx.fillStyle = COLORS.tooltipBg;
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = npc.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        // NPC symbol and name header
        ctx.fillStyle = npc.color;
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(npc.symbol, panelX + panelW / 2, panelY + 30);

        ctx.font = 'bold 16px monospace';
        ctx.fillText(npc.name, panelX + panelW / 2, panelY + 52);

        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '11px monospace';
        ctx.fillText(npc.description, panelX + panelW / 2, panelY + 70);

        // Dialogue text
        const dialogue = npcData.dialogue[0];
        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = '12px monospace';
        // Word wrap dialogue
        const words = dialogue.split(' ');
        let line = '';
        let lineY = panelY + 100;
        for (const word of words) {
            const test = line + (line ? ' ' : '') + word;
            if (ctx.measureText(test).width > panelW - 40) {
                ctx.fillText(line, panelX + panelW / 2, lineY);
                line = word;
                lineY += 16;
            } else {
                line = test;
            }
        }
        if (line) ctx.fillText(line, panelX + panelW / 2, lineY);

        // Interaction options based on NPC type
        const options = this._getNPCOptions(game, npc);
        const optStartY = panelY + 160;

        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const oy = optStartY + i * 32;
            const isSelected = i === game.npcDialogueSelection;

            if (isSelected) {
                ctx.fillStyle = 'rgba(68, 68, 136, 0.3)';
                ctx.fillRect(panelX + 20, oy - 6, panelW - 40, 28);
                ctx.strokeStyle = npc.color;
                ctx.lineWidth = 1;
                ctx.strokeRect(panelX + 20, oy - 6, panelW - 40, 28);
            }

            ctx.fillStyle = isSelected ? '#ffffff' : COLORS.textSecondary;
            ctx.font = isSelected ? 'bold 12px monospace' : '12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(opt.label, panelX + 35, oy + 8);

            if (opt.detail) {
                ctx.fillStyle = isSelected ? '#aaaacc' : '#666677';
                ctx.font = '10px monospace';
                ctx.textAlign = 'right';
                ctx.fillText(opt.detail, panelX + panelW - 35, oy + 8);
            }
        }

        // Controls hint
        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[Up/Down] Select  [Enter] Choose  [Esc] Leave', panelX + panelW / 2, panelY + panelH - 12);
    }

    _getNPCOptions(game, npc) {
        const npcData = NPC_DATA[npc.npcType];
        switch (npcData.type) {
            case 'trade':
                return [
                    { label: 'Browse wares', action: 'trade', detail: '' },
                    { label: 'Leave', action: 'leave' },
                ];
            case 'buff':
                return (npcData.buffs || []).map(b => ({
                    label: b.name, action: 'buff', detail: b.text, data: b,
                })).concat([{ label: 'Leave', action: 'leave' }]);
            case 'quest':
                if (npc.interacted) {
                    return [{ label: 'Already helped', action: 'leave', detail: '' }];
                }
                return [
                    { label: 'Give food', action: 'quest_food', detail: 'Costs 30 hunger' },
                    { label: 'Leave', action: 'leave' },
                ];
            case 'gamble':
                return [
                    { label: 'Offer 50 gold', action: 'gamble', detail: '50g', data: 50 },
                    { label: 'Offer 150 gold', action: 'gamble', detail: '150g', data: 150 },
                    { label: 'Leave', action: 'leave' },
                ];
            case 'lore':
                return [
                    { label: 'Hear a tale', action: 'lore', detail: '+1 random stat' },
                    { label: 'Leave', action: 'leave' },
                ];
            default:
                return [{ label: 'Leave', action: 'leave' }];
        }
    }

    // Tooltip rendering
    _renderTooltip(tooltip) {
        const ctx = this.ctx;
        const { x, y, lines } = tooltip;

        const lineHeight = 16;
        const padding = 8;
        let maxWidth = 0;
        ctx.font = '12px monospace';
        for (const line of lines) {
            const w = ctx.measureText(line.text).width;
            if (w > maxWidth) maxWidth = w;
        }

        const tooltipW = maxWidth + padding * 2;
        const tooltipH = lines.length * lineHeight + padding * 2;
        const tx = Math.min(x + 15, this.renderer.width - tooltipW - 5);
        const ty = Math.min(y, this.renderer.height - tooltipH - 5);

        ctx.fillStyle = COLORS.tooltipBg;
        ctx.fillRect(tx, ty, tooltipW, tooltipH);
        ctx.strokeStyle = COLORS.tooltipBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty, tooltipW, tooltipH);

        for (let i = 0; i < lines.length; i++) {
            ctx.fillStyle = lines[i].color || COLORS.textPrimary;
            ctx.font = lines[i].bold ? 'bold 12px monospace' : '12px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(lines[i].text, tx + padding, ty + padding + i * lineHeight);
        }
    }

    // Set tooltip for tile at mouse position
    updateTooltip(game) {
        this.tooltip = null;
        if (!game.dungeon || !game.fov) return;

        const fog = game.fov.getFog(this.mouseTileX, this.mouseTileY);
        if (fog !== FOG.VISIBLE) return;

        const lines = [];

        // Check for other players at position (multiplayer)
        if (game.otherPlayers) {
            const otherPlayer = Object.values(game.otherPlayers).find(p => p.x === this.mouseTileX && p.y === this.mouseTileY && p.isAlive);
            if (otherPlayer) {
                const classData = otherPlayer.classId ? CLASS_DATA[otherPlayer.classId] : null;
                lines.push({ text: otherPlayer.name || 'Player', color: otherPlayer.color || '#66ccff', bold: true });
                lines.push({ text: classData ? classData.name : 'Unknown', color: COLORS.textSecondary });
                if (otherPlayer.hp != null && otherPlayer.maxHp) {
                    lines.push({ text: `HP: ${otherPlayer.hp}/${otherPlayer.maxHp}`, color: COLORS.hpBar });
                }
            }
        }

        // Check for NPC at position
        if (game.npcs) {
            const npc = game.npcs.find(n => n.x === this.mouseTileX && n.y === this.mouseTileY);
            if (npc) {
                lines.push({ text: npc.name, color: npc.color, bold: true });
                lines.push({ text: npc.description, color: COLORS.textSecondary });
                if (!npc.interacted) {
                    lines.push({ text: '[E] Talk', color: '#ffcc00' });
                } else {
                    lines.push({ text: '(Already interacted)', color: '#666677' });
                }
            }
        }

        // Check for enemy at position
        const enemy = game.enemies.find(e => !e.isDead && e.x === this.mouseTileX && e.y === this.mouseTileY);
        if (enemy) {
            lines.push({ text: enemy.name, color: enemy.color, bold: true });
            lines.push({ text: `HP: ${enemy.hp}/${enemy.maxHp}`, color: COLORS.hpBar });
            lines.push({ text: `STR: ${enemy.str} DEF: ${enemy.def}`, color: COLORS.textSecondary });
            lines.push({ text: enemy.description, color: COLORS.textSecondary });
            if (enemy.boss) lines.push({ text: 'BOSS', color: '#ff8800', bold: true });
        }

        // Check for item at position
        const item = game.items.find(i => i.x === this.mouseTileX && i.y === this.mouseTileY);
        if (item) {
            if (lines.length > 0) lines.push({ text: '---' });
            lines.push({ text: item.name, color: getItemColor(item), bold: true });
            if (item.description) lines.push({ text: item.description, color: COLORS.textSecondary });
            if (item.isShopItem) lines.push({ text: `Price: ${item.shopPrice}g`, color: COLORS.textGold });
        }

        // Tile info
        const tile = game.dungeon.getTile(this.mouseTileX, this.mouseTileY);
        if (lines.length === 0) {
            const tileNames = {
                [TILE.FLOOR]: 'Floor',
                [TILE.WALL]: 'Wall',
                [TILE.DOOR]: 'Door',
                [TILE.STAIRS_DOWN]: 'Stairs Down',
                [TILE.STAIRS_UP]: 'Stairs Up',
                [TILE.WATER]: 'Water (slows)',
                [TILE.LAVA]: 'Lava (damages)',
                [TILE.TRAP]: 'Trap',
                [TILE.SHOP_FLOOR]: 'Shop',
                [TILE.CORRIDOR]: 'Corridor',
                [TILE.BARREL]: 'Barrel',
                [TILE.CRATE]: 'Crate',
                [TILE.LOCKED_DOOR]: 'Locked Door',
                [TILE.CRACKED_WALL]: 'Cracked Wall',
                [TILE.SPIKE_TRAP]: 'Spike Trap',
                [TILE.DART_TRAP]: 'Dart Trap',
                [TILE.ALARM_TRAP]: 'Alarm Trap',
            };
            if (tileNames[tile]) {
                lines.push({ text: tileNames[tile], color: COLORS.textSecondary });
            }
        }

        if (lines.length > 0) {
            this.tooltip = { x: this.mouseX, y: this.mouseY, lines };
        }
    }
}
