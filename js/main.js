const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Game State
const playerImg1 = new Image();
playerImg1.src = 'img/player1.png';

const playerImg2 = new Image();
playerImg2.src = 'img/player2.png';

let currentPlayerImg = playerImg1;

const BASE_SPEED = 3;
const BASE_MAX_HP = 100;
const INVULNERABILITY_FRAMES = 30; // 0.5s of i-frames at 60fps after taking a hit

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 30, // Same size as the Goblin enemy
    color: '#4af',
    speed: BASE_SPEED,
    hp: BASE_MAX_HP,
    maxHp: BASE_MAX_HP,
    level: 1,
    xp: 0,
    nextXp: 50,
    facingRight: false,
    weapons: initPlayerWeapons(),
    accessories: [],
    bonusDamage: 0,
    bonusFireRate: 0,
    bonusSpeed: 0,
    bonusMaxHp: 0,
    bonusDefense: 0,
    bonusPickupRange: 0,
    invulnerableUntil: 0,
    npcs: []
};

initPlayerAccessories(player);
initStructures(player.x, player.y);

// Recomputes derived stats (speed, max HP) from the current bonus totals.
function applyPlayerStats() {
    const newMaxHp = BASE_MAX_HP * (1 + player.bonusMaxHp / 100);
    const hpGain = Math.max(0, newMaxHp - player.maxHp);
    player.maxHp = newMaxHp;
    player.hp = Math.min(player.maxHp, player.hp + hpGain);
    player.speed = BASE_SPEED * (1 + player.bonusSpeed / 100);
}

function getEffectiveDamage(weapon) {
    return weapon.damage * (1 + player.bonusDamage / 100);
}

function getEffectiveCooldown(weapon) {
    return Math.max(5, weapon.cooldown / (1 + player.bonusFireRate / 100));
}

function getIncomingDamage(baseDamage) {
    return baseDamage / (1 + player.bonusDefense / 100);
}

function getPickupRange() {
    return (player.radius + 20) * (1 + player.bonusPickupRange / 100);
}

const enemies = [];
const projectiles = [];
const gems = [];
const keys = {};
const effects = [];
let frameCount = 0;
let isPaused = false;
let isGameOver = false;
let startTime = Date.now();
let cameraX = 0;
let cameraY = 0;
let autoBattle = false;
let autoLevelUp = false;
let debugMode = false;
let invincible = false;

// Background tile setup. The field is unlimited: tiles aren't pre-generated
// into an array, they're derived on the fly each frame from the camera's
// current position, so the world extends forever in every direction.
const tileSize = 100;

// Biome definitions. Which biome a tile belongs to is a deterministic
// function of its world position (see getBiome), so no biome data needs to
// be stored - it can be recomputed identically anywhere, any time.
const BIOME_COLORS = {
    grassland: { fill: '#4a8c4a', detail: '#3d7a3d' },
    forest: { fill: '#2f6b3a', detail: '#204a28' },
    wasteland: { fill: '#a68a52', detail: '#8a703c' },
    cursed: { fill: '#5c3a6b', detail: '#432850' }
};

function getBiome(worldX, worldY) {
    const n = Math.sin(worldX * 0.0015) + Math.cos(worldY * 0.0015);
    if (n > 0.6) return 'forest';
    if (n > -0.2) return 'grassland';
    if (n > -0.8) return 'wasteland';
    return 'cursed';
}

// Input
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// Auto-battle toggle: hands movement over to a simple AI (see runAutoBattleMovement).
window.addEventListener('keydown', e => {
    if (e.code === 'KeyB') {
        autoBattle = !autoBattle;
        showToast(autoBattle ? '自動戦闘: ON' : '自動戦闘: OFF');
    }
});

// Auto-levelup toggle: skips the level-up modal and picks an option at random.
window.addEventListener('keydown', e => {
    if (e.code === 'KeyL') {
        autoLevelUp = !autoLevelUp;
        showToast(autoLevelUp ? '自動レベルアップ: ON' : '自動レベルアップ: OFF');
    }
});

// Debug menu toggle: a cheat panel for testing (level up, heal, spawn things, etc).
window.addEventListener('keydown', e => {
    if (e.code === 'F8') {
        e.preventDefault();
        debugMode = !debugMode;
        const menu = document.getElementById('debug-menu');
        if (debugMode) {
            buildDebugMenu();
            menu.style.display = 'flex';
            enableModalKeyboardNav('debug-menu');
        } else {
            menu.style.display = 'none';
            disableModalKeyboardNav();
        }
    }
});

// Generic keyboard navigation for any choice modal that lists .upgrade-btn
// buttons (level-up choices, NPC recruitment, etc.): arrow keys move the
// highlighted option, Enter/Space activates it.
let activeModalId = null;
let modalButtons = [];
let selectedModalIndex = 0;

function updateModalSelection() {
    modalButtons.forEach((btn, i) => {
        btn.classList.toggle('selected', i === selectedModalIndex);
    });
}

// Call this right after populating a modal's innerHTML and showing it.
function enableModalKeyboardNav(modalId) {
    const modal = document.getElementById(modalId);
    activeModalId = modalId;
    modalButtons = modal ? Array.from(modal.querySelectorAll('.upgrade-btn, .debug-btn')) : [];
    selectedModalIndex = 0;
    updateModalSelection();
}

function disableModalKeyboardNav() {
    activeModalId = null;
    modalButtons = [];
}

window.addEventListener('keydown', e => {
    if (!activeModalId) return;
    const modal = document.getElementById(activeModalId);
    if (!modal || modal.style.display !== 'flex' || modalButtons.length === 0) return;

    if (e.code === 'ArrowDown' || e.code === 'ArrowRight') {
        e.preventDefault();
        selectedModalIndex = (selectedModalIndex + 1) % modalButtons.length;
        updateModalSelection();
    } else if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') {
        e.preventDefault();
        selectedModalIndex = (selectedModalIndex - 1 + modalButtons.length) % modalButtons.length;
        updateModalSelection();
    } else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        modalButtons[selectedModalIndex].click();
    }
});

// Retry button on the game-over screen also responds to Enter/Space.
window.addEventListener('keydown', e => {
    if (!isGameOver) return;
    if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        location.reload();
    }
});


// Projectile Class
class Projectile {
    constructor(x, y, targetX, targetY, damage, splashRadius = 0, color = '#ff0', arc = false, blast = false, axe = false, arrow = false) {
        this.x = x;
        this.y = y;
        this.blast = blast;
        this.axe = axe;
        this.arrow = arrow;
        this.rotation = 0;
        this.radius = blast ? 9 : 5;
        this.color = color;
        this.damage = damage;
        this.speed = 7;
        this.splashRadius = splashRadius;
        this.arc = arc;

        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        this.angle = Math.atan2(dy, dx);

        if (arc) {
            // Curve toward the target via a quadratic Bezier instead of a straight line.
            this.startX = x;
            this.startY = y;
            this.endX = targetX;
            this.endY = targetY;
            const perpX = -dy / dist;
            const perpY = dx / dist;
            const curveAmount = dist * 0.4;
            const side = Math.random() < 0.5 ? 1 : -1;
            this.controlX = x + dx / 2 + perpX * curveAmount * side;
            this.controlY = y + dy / 2 + perpY * curveAmount * side;
            this.t = 0;
            this.tStep = this.speed / dist;
        } else {
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
        }
    }

    update() {
        if (this.axe) {
            this.rotation += 0.35;
        }

        const prevX = this.x;
        const prevY = this.y;

        if (this.arc) {
            this.t = Math.min(1, this.t + this.tStep);
            const t = this.t;
            const mt = 1 - t;
            this.x = mt * mt * this.startX + 2 * mt * t * this.controlX + t * t * this.endX;
            this.y = mt * mt * this.startY + 2 * mt * t * this.controlY + t * t * this.endY;
        } else {
            this.x += this.vx;
            this.y += this.vy;
        }

        if (this.arrow) {
            const dx = this.x - prevX;
            const dy = this.y - prevY;
            if (dx !== 0 || dy !== 0) {
                this.angle = Math.atan2(dy, dx);
            }
        }
    }

    draw() {
        if (this.arrow) {
            // Arrow: a thin shaft with fletching at the back and a point at the front,
            // oriented along the direction it's currently traveling.
            const screenX = this.x - cameraX;
            const screenY = this.y - cameraY;
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(this.angle);

            ctx.strokeStyle = '#8b5a2b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, 0);
            ctx.lineTo(6, 0);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(11, 0);
            ctx.lineTo(3, -4);
            ctx.lineTo(3, 4);
            ctx.closePath();
            ctx.fillStyle = '#ddd';
            ctx.fill();

            ctx.strokeStyle = '#d33';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, 0);
            ctx.lineTo(-5, -3);
            ctx.moveTo(-10, 0);
            ctx.lineTo(-5, 3);
            ctx.stroke();

            ctx.restore();
            return;
        }

        if (this.axe) {
            // Spinning axe silhouette: a short handle with a wedge-shaped blade.
            const screenX = this.x - cameraX;
            const screenY = this.y - cameraY;
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(this.rotation);

            ctx.strokeStyle = '#8b5a2b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-10, 0);
            ctx.lineTo(10, 0);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(4, 0);
            ctx.lineTo(14, -9);
            ctx.lineTo(14, 9);
            ctx.closePath();
            ctx.fillStyle = '#c8c8d2';
            ctx.fill();

            ctx.restore();
            return;
        }

        if (this.blast) {
            // Glowing blast: soft outer halo plus a bright core.
            const screenX = this.x - cameraX;
            const screenY = this.y - cameraY;
            const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, this.radius * 2.5);
            gradient.addColorStop(0, 'rgba(210, 140, 255, 0.9)');
            gradient.addColorStop(0.5, 'rgba(160, 80, 255, 0.5)');
            gradient.addColorStop(1, 'rgba(160, 80, 255, 0)');

            ctx.beginPath();
            ctx.arc(screenX, screenY, this.radius * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.closePath();

            ctx.beginPath();
            ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#f0e6ff';
            ctx.fill();
            ctx.closePath();
            return;
        }

        ctx.beginPath();
        ctx.arc(this.x - cameraX, this.y - cameraY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

// Effect Class
class Effect {
    constructor(x, y, type, range, facingRight, life = 30) {
        this.x = x;
        this.y = y;
        this.type = type; // 'hit', 'attack', 'whip', 'slash' or 'thrust'
        this.range = range;
        this.facingRight = facingRight;
        this.life = life; // frames to live
        this.maxLife = life;
        this.size = 0;
        this.maxSize = 20;
    }

    update() {
        this.life--;
        if (this.type === 'hit') {
            this.size = (this.maxLife - this.life) / this.maxLife * this.maxSize;
        } else if (this.type === 'attack') {
            this.size = (this.maxLife - this.life) / this.maxLife * this.maxSize;
        } else if (this.type === 'whip') {
            this.size = (this.maxLife - this.life) / this.maxLife * this.maxSize;
        }
    }

    draw() {
        ctx.beginPath();

        if (this.type === 'hit') {
            // Hit effect - expanding circle
            ctx.arc(this.x - cameraX, this.y - cameraY, this.size, 0, Math.PI * 2);
            const alpha = this.life / this.maxLife;
            ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
            ctx.fill();
        } else if (this.type === 'attack') {
            // Attack effect - expanding circle
            ctx.arc(this.x - cameraX, this.y - cameraY, this.size, 0, Math.PI * 2);
            const alpha = this.life / this.maxLife;
            ctx.fillStyle = `rgba(255, 100, 0, ${alpha})`;
            ctx.fill();
        } else if (this.type === 'whip') {
            // Whip effect with more pronounced swinging motion visualization
            const alpha = this.life / this.maxLife;
            const range = this.range || 135; // Use the attacking weapon's range
            const swingProgress = 1 - (this.life / this.maxLife); // Progress of the swing motion

            // Draw the whip effect at player's position with direction and swinging motion
            const startX = player.x - cameraX;
            const startY = player.y - cameraY;

            // Create a more pronounced whip-like arc effect for better visual representation of swinging motion
            ctx.strokeStyle = `rgba(139, 69, 19, ${alpha * 0.9})`; // SaddleBrown color for whip
            ctx.lineWidth = 15; // Much thicker line for better visibility
            ctx.beginPath();

            if (player.facingRight) {
                // Whip swinging to the right with arc motion (more whip-like)
                // Create a more dramatic swing curve by varying the control point based on progress
                const controlX = startX + range * 0.6 * swingProgress;     // Control point X (middle of range, increases with swing progress)
                const controlY = startY - range * 0.3 * (1 - swingProgress); // Control point Y (upward curve, decreases with swing progress)
                ctx.moveTo(startX, startY);
                ctx.quadraticCurveTo(controlX, controlY, startX + range * 0.8, startY - range * 0.1);
            } else {
                // Whip swinging to the left with arc motion (more whip-like)
                // Create a more dramatic swing curve by varying the control point based on progress
                const controlX = startX - range * 0.6 * swingProgress;     // Control point X (middle of range, increases with swing progress)
                const controlY = startY - range * 0.3 * (1 - swingProgress); // Control point Y (upward curve, decreases with swing progress)
                ctx.moveTo(startX, startY);
                ctx.quadraticCurveTo(controlX, controlY, startX - range * 0.8, startY - range * 0.1);
            }
            ctx.stroke();

            // Add a secondary line to make it look more like a whip with multiple strands
            ctx.strokeStyle = `rgba(139, 69, 19, ${alpha * 0.7})`;
            ctx.lineWidth = 8;
            ctx.beginPath();

            if (player.facingRight) {
                // Secondary whip line with different curve for strand effect
                const controlX = startX + range * 0.4 * swingProgress;     // Control point X (middle of range, increases with swing progress)
                const controlY = startY - range * 0.2 * (1 - swingProgress); // Control point Y (upward curve, decreases with swing progress)
                ctx.moveTo(startX, startY);
                ctx.quadraticCurveTo(controlX, controlY, startX + range * 0.6, startY - range * 0.05);
            } else {
                // Secondary whip line with different curve for strand effect
                const controlX = startX - range * 0.4 * swingProgress;     // Control point X (middle of range, increases with swing progress)
                const controlY = startY - range * 0.2 * (1 - swingProgress); // Control point Y (upward curve, decreases with swing progress)
                ctx.moveTo(startX, startY);
                ctx.quadraticCurveTo(controlX, controlY, startX - range * 0.6, startY - range * 0.05);
            }
            ctx.stroke();
        } else if (this.type === 'slash') {
            // Sword slash - a fan-shaped sweep in the facing direction
            const alpha = this.life / this.maxLife;
            const range = this.range || 100;
            const progress = 1 - (this.life / this.maxLife); // 0 -> 1 over the effect's life

            const originX = player.x - cameraX;
            const originY = player.y - cameraY;
            const centerAngle = this.facingRight ? 0 : Math.PI;
            const spread = Math.PI / 2; // 90 degree fan
            const startAngle = centerAngle - spread / 2;
            const sweepAngle = startAngle + spread * Math.min(1, progress * 1.6);

            // Filled fan showing the slashed area
            ctx.beginPath();
            ctx.moveTo(originX, originY);
            ctx.arc(originX, originY, range, startAngle, sweepAngle);
            ctx.closePath();
            ctx.fillStyle = `rgba(230, 230, 255, ${alpha * 0.35})`;
            ctx.fill();

            // Bright blade edge along the leading edge of the sweep
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(originX, originY, range, startAngle, sweepAngle);
            ctx.stroke();
        } else if (this.type === 'thrust') {
            // Spear thrust - a quick jab straight out in the facing direction
            const alpha = this.life / this.maxLife;
            const range = this.range || 160;
            const progress = 1 - (this.life / this.maxLife); // 0 -> 1 over the effect's life
            const extend = Math.min(1, progress * 3); // reaches full length quickly, then holds while fading
            const dir = this.facingRight ? 1 : -1;
            const length = range * extend;

            const originX = player.x - cameraX;
            const originY = player.y - cameraY;
            const tipX = originX + dir * length;
            const tipY = originY;

            // Shaft
            ctx.strokeStyle = `rgba(150, 110, 70, ${alpha})`;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(originX, originY);
            ctx.lineTo(tipX, tipY);
            ctx.stroke();

            // Spearhead
            const headLength = 18;
            const headWidth = 10;
            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(tipX - dir * headLength, tipY - headWidth / 2);
            ctx.lineTo(tipX - dir * headLength, tipY + headWidth / 2);
            ctx.closePath();
            ctx.fillStyle = `rgba(225, 225, 235, ${alpha})`;
            ctx.fill();
        }

        ctx.closePath();
    }
}

// XP Gem Class
class Gem {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 4;
        this.color = '#5f5';
        this.xp = 10;
    }

    draw() {
        ctx.beginPath();

        ctx.arc(this.x - cameraX, this.y - cameraY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

// Finds the nearest enemy within range, or null if none are in range.
function findNearestEnemyInRange(range) {
    let nearest = null;
    let nearestDist = range;
    for (const e of enemies) {
        const dist = Math.hypot(e.x - player.x, e.y - player.y);
        if (dist <= nearestDist) {
            nearest = e;
            nearestDist = dist;
        }
    }
    return nearest;
}

// Melee weapons swing in the direction the player is facing and hit
// everything in range on that side.
function fireMeleeWeapon(weapon, damage) {
    for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= weapon.range &&
            ((player.facingRight && dx > 0) || (!player.facingRight && dx < 0))) {
            e.hp -= damage;
            effects.push(new Effect(e.x, e.y, 'hit'));

            if (e.hp <= 0) {
                gems.push(new Gem(e.x, e.y));
                enemies.splice(j, 1);
                addBattleLog(`${weapon.name}で${e.name}を倒した！`);
            }
        }
    }

    for (const o of obstacles) {
        const dx = o.x - player.x;
        const dy = o.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= weapon.range &&
            ((player.facingRight && dx > 0) || (!player.facingRight && dx < 0))) {
            o.hp -= damage;
            effects.push(new Effect(o.x, o.y, 'hit'));

            if (o.hp <= 0) {
                destroyObstacle(o);
            }
        }
    }

    const weaponType = getWeaponByName(weapon.name);
    const effectType = (weaponType && weaponType.effect) || 'whip';
    const effectDuration = (weaponType && weaponType.effectDuration) || 30;
    effects.push(new Effect(player.x, player.y, effectType, weapon.range, player.facingRight, effectDuration));
}

// Ranged weapons fire a single-target projectile at the nearest enemy in range.
function fireRangedWeapon(weapon, damage) {
    const target = findNearestEnemyInRange(weapon.range);
    if (!target) return false;

    const weaponType = getWeaponByName(weapon.name);
    const isArc = !!(weaponType && weaponType.arc);
    const isArrow = !!(weaponType && weaponType.projectileShape === 'arrow');
    projectiles.push(new Projectile(player.x, player.y, target.x, target.y, damage, 0, '#ff0', isArc, false, false, isArrow));
    effects.push(new Effect(player.x, player.y, 'attack'));
    return true;
}

// Magic weapons fire a projectile that splashes to nearby enemies on impact.
function fireMagicWeapon(weapon, damage) {
    const weaponType = getWeaponByName(weapon.name);

    // Unlimited-range weapons can target the nearest enemy anywhere on screen,
    // regardless of distance. The player is always drawn at screen center, so
    // half the screen's diagonal covers the entire visible viewport.
    const searchRange = (weaponType && weaponType.unlimitedRange)
        ? Math.hypot(canvas.width, canvas.height) / 2
        : weapon.range;

    const target = findNearestEnemyInRange(searchRange);
    if (!target) return false;

    const isBlast = !!(weaponType && weaponType.effect === 'blast');
    projectiles.push(new Projectile(player.x, player.y, target.x, target.y, damage, 60, '#a0f', false, isBlast));
    effects.push(new Effect(player.x, player.y, 'attack'));
    return true;
}

// Thrown weapons are hurled straight ahead in the facing direction (not
// aimed at a specific enemy), spinning as they arc through the air.
function fireThrownWeapon(weapon, damage) {
    const dir = player.facingRight ? 1 : -1;
    const targetX = player.x + dir * weapon.range;
    const targetY = player.y;

    projectiles.push(new Projectile(player.x, player.y, targetX, targetY, damage, 0, '#c68a3c', true, false, true));
    return true;
}

function handleCombat() {
    for (const weapon of player.weapons) {
        const cooldown = getEffectiveCooldown(weapon);
        if (frameCount - weapon.lastFire < cooldown) continue;

        const weaponType = getWeaponByName(weapon.name);
        const damage = getEffectiveDamage(weapon);
        let fired = true;

        if (!weaponType || weaponType.type === 'melee') {
            fireMeleeWeapon(weapon, damage);
        } else if (weaponType.type === 'ranged') {
            fired = fireRangedWeapon(weapon, damage);
        } else if (weaponType.type === 'magic') {
            fired = fireMagicWeapon(weapon, damage);
        } else if (weaponType.type === 'thrown') {
            fired = fireThrownWeapon(weapon, damage);
        }

        if (fired) weapon.lastFire = frameCount;
    }

    // Projectile - Enemy Collision
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.update();

        // Remove once it leaves the visible area around the player, or (for
        // arc shots) once it reaches the end of its curved flight path.
        if (p.x < cameraX - 50 || p.x > cameraX + canvas.width + 50 ||
            p.y < cameraY - 50 || p.y > cameraY + canvas.height + 50 ||
            (p.arc && p.t >= 1)) {
            projectiles.splice(i, 1);
            continue;
        }

        let hitSomething = false;

        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            const dist = Math.sqrt((p.x - e.x) ** 2 + (p.y - e.y) ** 2);
            if (dist < p.radius + e.radius) {
                if (p.splashRadius > 0) {
                    // Magic splash: damage every enemy within the blast radius
                    for (let k = enemies.length - 1; k >= 0; k--) {
                        const e2 = enemies[k];
                        const d2 = Math.hypot(p.x - e2.x, p.y - e2.y);
                        if (d2 <= p.splashRadius) {
                            e2.hp -= p.damage;
                            effects.push(new Effect(e2.x, e2.y, 'hit'));
                            if (e2.hp <= 0) {
                                gems.push(new Gem(e2.x, e2.y));
                                enemies.splice(k, 1);
                                addBattleLog(`${e2.name}を倒した！`);
                            }
                        }
                    }
                } else {
                    e.hp -= p.damage;
                    effects.push(new Effect(e.x, e.y, 'hit'));
                    if (e.hp <= 0) {
                        gems.push(new Gem(e.x, e.y));
                        enemies.splice(j, 1);
                        addBattleLog(`${e.name}を倒した！`);
                    }
                }

                hitSomething = true;
                break;
            }
        }

        if (!hitSomething) {
            for (const o of obstacles) {
                const distO = Math.sqrt((p.x - o.x) ** 2 + (p.y - o.y) ** 2);
                if (distO < p.radius + o.radius) {
                    o.hp -= p.damage;
                    effects.push(new Effect(o.x, o.y, 'hit'));
                    if (o.hp <= 0) {
                        destroyObstacle(o);
                    }
                    hitSomething = true;
                    break;
                }
            }
        }

        if (hitSomething) {
            projectiles.splice(i, 1);
        }
    }
}

// Applies contact damage (and game over) when an enemy touches the player.
function handlePlayerDamage() {
    if (isGameOver || invincible || frameCount < player.invulnerableUntil) return;

    for (const e of enemies) {
        const dist = Math.hypot(player.x - e.x, player.y - e.y);
        if (dist < player.radius + e.radius) {
            const dmg = getIncomingDamage(e.damage);
            player.hp -= dmg;
            player.invulnerableUntil = frameCount + INVULNERABILITY_FRAMES;
            effects.push(new Effect(player.x, player.y, 'hit'));
            addBattleLog(`${e.name}の攻撃を受けた！（-${Math.round(dmg)} HP）`);

            if (player.hp <= 0) {
                player.hp = 0;
                gameOver();
            }
            break;
        }
    }
}

// Auto-battle: simple AI movement used in place of manual controls when enabled.
const AUTO_BATTLE_FLEE_HP_RATIO = 0.3;
const AUTO_BATTLE_CHASE_RADIUS = 400;
const AUTO_BATTLE_GEM_RADIUS = 500;
const AUTO_BATTLE_STOP_DISTANCE = 50;

function moveTowards(targetX, targetY) {
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    player.x += (dx / dist) * player.speed;
    player.y += (dy / dist) * player.speed;
    player.facingRight = dx > 0;
}

function runAutoBattleMovement() {
    let nearestEnemy = null;
    let nearestEnemyDist = Infinity;
    for (const e of enemies) {
        const dist = Math.hypot(e.x - player.x, e.y - player.y);
        if (dist < nearestEnemyDist) {
            nearestEnemy = e;
            nearestEnemyDist = dist;
        }
    }

    // Badly hurt with an enemy nearby: run straight away from it.
    if (nearestEnemy && nearestEnemyDist < AUTO_BATTLE_CHASE_RADIUS &&
        player.hp / player.maxHp < AUTO_BATTLE_FLEE_HP_RATIO) {
        moveTowards(player.x + (player.x - nearestEnemy.x), player.y + (player.y - nearestEnemy.y));
        return;
    }

    // Otherwise close the distance to the nearest enemy so weapons can reach it.
    if (nearestEnemy && nearestEnemyDist < AUTO_BATTLE_CHASE_RADIUS) {
        if (nearestEnemyDist > AUTO_BATTLE_STOP_DISTANCE) {
            moveTowards(nearestEnemy.x, nearestEnemy.y);
        } else {
            player.facingRight = nearestEnemy.x > player.x;
        }
        return;
    }

    // No threats nearby: go pick up any leftover XP gems.
    let nearestGem = null;
    let nearestGemDist = Infinity;
    for (const g of gems) {
        const dist = Math.hypot(g.x - player.x, g.y - player.y);
        if (dist < nearestGemDist) {
            nearestGem = g;
            nearestGemDist = dist;
        }
    }
    if (nearestGem && nearestGemDist < AUTO_BATTLE_GEM_RADIUS) {
        moveTowards(nearestGem.x, nearestGem.y);
    }
}

function updatePlayer() {
    if (autoBattle) {
        runAutoBattleMovement();
    } else {
        if (keys['ArrowUp'] || keys['KeyW']) player.y -= player.speed;
        if (keys['ArrowDown'] || keys['KeyS']) player.y += player.speed;
        if (keys['ArrowLeft'] || keys['KeyA']) {
            player.x -= player.speed;
            player.facingRight = false;
        }
        if (keys['ArrowRight'] || keys['KeyD']) {
            player.x += player.speed;
            player.facingRight = true;
        }
    }

    clampPlayerToActiveFortress();
    resolvePlayerObstacleCollisions();

    // Update camera to follow player (keep player centered)
    cameraX = player.x - canvas.width / 2;
    cameraY = player.y - canvas.height / 2;

    checkStructureInteractions();

    // Gem collection
    for (let i = gems.length - 1; i >= 0; i--) {
        const g = gems[i];
        const dist = Math.sqrt((player.x - g.x)**2 + (player.y - g.y)**2);
        if (dist < getPickupRange()) {
            player.xp += g.xp;
            gems.splice(i, 1);
            if (player.xp >= player.nextXp) levelUp();
        }
    }

    handlePlayerDamage();
}

function levelUp() {
    player.level++;
    player.xp = 0; // Reset XP to 0 after level up
    player.nextXp = Math.floor(player.nextXp * 1.2);
    addBattleLog(`レベルアップ！Lv.${player.level}`);

    // Create a combined list of all possible upgrades (weapons and accessories)
    const upgradeOptions = [];

    // Get available weapons for this level
    const availableWeapons = getAvailableWeapons(player.level);
    const weaponOptions = [];

    // Select up to 2 unique weapons that the player doesn't already have
    while (weaponOptions.length < 2 && availableWeapons.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableWeapons.length);
        const weapon = availableWeapons[randomIndex];

        // Only add if player doesn't already have this weapon
        if (!hasWeapon(player, weapon.name)) {
            weaponOptions.push(weapon);
        }

        // Remove the selected weapon to avoid duplicates
        availableWeapons.splice(randomIndex, 1);
    }

    // If we don't have 2 unique weapons, fill with existing ones
    if (weaponOptions.length < 2) {
        const allWeapons = getAvailableWeapons(player.level);
        for (let i = 0; i < 2 - weaponOptions.length; i++) {
            const randomWeapon = allWeapons[Math.floor(Math.random() * allWeapons.length)];
            // Check that randomWeapon is valid before accessing its name
            if (randomWeapon && !weaponOptions.some(w => w.name === randomWeapon.name)) {
                weaponOptions.push(randomWeapon);
            }
        }
    }

    // Add weapons to upgrade options
    weaponOptions.forEach(weapon => {
        upgradeOptions.push({
            type: 'weapon',
            data: weapon
        });
    });

    // Add a random level-up option (10% chance)
    if (Math.random() < 0.1) { // 10% chance for random option
        const randomUpgrade = Math.floor(Math.random() * 4);
        switch(randomUpgrade) {
            case 0: // Increase damage
                upgradeOptions.push({
                    type: 'random',
                    data: {
                        name: "Damage Boost",
                        description: "すべての武器の攻撃力が10%上昇"
                    }
                });
                break;
            case 1: // Increase fire rate
                upgradeOptions.push({
                    type: 'random',
                    data: {
                        name: "Faster Fire Rate",
                        description: "すべての武器の射撃速度が15%上昇"
                    }
                });
                break;
            case 2: // Increase move speed
                upgradeOptions.push({
                    type: 'random',
                    data: {
                        name: "Speed Boost",
                        description: "移動速度が10%上昇"
                    }
                });
                break;
            case 3: // Heal & Max HP Up
                upgradeOptions.push({
                    type: 'random',
                    data: {
                        name: "Heal & Max HP Up",
                        description: "回復＆最大HPアップ"
                    }
                });
                break;
        }
    }

    // Add accessory options to the level up modal (only accessories the player doesn't have yet)
    const availableAccessories = accessoryTypes.filter(a => !hasAccessory(player, a.name));
    const accessoryOptions = [];

    while (accessoryOptions.length < 1 && availableAccessories.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableAccessories.length);
        accessoryOptions.push(availableAccessories[randomIndex]);
        availableAccessories.splice(randomIndex, 1);
    }

    // Add accessories to upgrade options
    accessoryOptions.forEach(accessory => {
        upgradeOptions.push({
            type: 'accessory',
            data: accessory
        });
    });

    // Ensure we have exactly 3 options (weapons + accessories)
    while (upgradeOptions.length < 3) {
        // Fill with random weapons if needed
        const allWeapons = getAvailableWeapons(player.level);
        const randomWeapon = allWeapons[Math.floor(Math.random() * allWeapons.length)];
        if (!upgradeOptions.some(option => option.type === 'weapon' && option.data.name === randomWeapon.name)) {
            upgradeOptions.push({
                type: 'weapon',
                data: randomWeapon
            });
        }
    }

    // Make sure we don't have undefined weapons or accessories
    for (let i = 0; i < upgradeOptions.length; i++) {
        if (!upgradeOptions[i].data) {
            // Remove invalid option
            upgradeOptions.splice(i, 1);
            i--;
        }
    }

    // Auto level-up: skip the modal entirely and apply a random option immediately.
    if (autoLevelUp) {
        const chosen = upgradeOptions[Math.floor(Math.random() * upgradeOptions.length)];
        if (chosen.type === 'weapon') {
            addWeaponToPlayer(player, chosen.data.name);
        } else if (chosen.type === 'accessory') {
            addAccessoryToPlayer(player, chosen.data.name);
        } else {
            applyRandomUpgradeEffect();
        }
        showToast(`レベルアップ（自動選択）: ${chosen.data.name}`);
        return;
    }

    isPaused = true;

    // Update the modal with weapon and accessory options
    const modal = document.getElementById('level-up-modal');
    const upgradeIcon = data => data.img
        ? `<img src="${data.img}" alt="${data.name}" style="width: 28px; height: 28px; vertical-align: middle; margin-right: 6px;">`
        : '';
    let modalContent = `
        <h2>レベルアップ！選択してください：</h2>
        ${upgradeOptions.map((option) => {
            if (option.type === 'weapon') {
                return `<button class="upgrade-btn" onclick="selectWeapon('${option.data.name}')">${upgradeIcon(option.data)}${option.data.name} - ${option.data.description}</button>`;
            } else if (option.type === 'accessory') {
                return `<button class="upgrade-btn" onclick="selectAccessory('${option.data.name}')">${upgradeIcon(option.data)}${option.data.name} - ${option.data.description}</button>`;
            } else { // random upgrade
                return `<button class="upgrade-btn" onclick="selectRandomUpgrade()">${option.data.name} - ${option.data.description}</button>`;
            }
        }).join('')}
        <br><br>
        <button class="upgrade-btn" onclick="skipLevelUp()">スキップする</button>
    `;

    modal.innerHTML = modalContent;
    modal.style.display = 'flex';

    enableModalKeyboardNav('level-up-modal');
}

// Function to skip level up selection
function skipLevelUp() {
    isPaused = false;
    document.getElementById('level-up-modal').style.display = 'none';
    requestAnimationFrame(gameLoop);
}

// Applies one of the four random level-up bonuses (as a running stat bonus,
// same as accessory bonuses). Shared by the manual and auto-levelup paths.
function applyRandomUpgradeEffect() {
    const upgradeType = Math.floor(Math.random() * 4);
    switch(upgradeType) {
        case 0: // Increase damage for all weapons
            player.bonusDamage += 10;
            break;
        case 1: // Increase fire rate for all weapons
            player.bonusFireRate += 15;
            break;
        case 2: // Increase move speed
            player.bonusSpeed += 10;
            applyPlayerStats();
            break;
        case 3: // Heal & Max HP Up
            player.bonusMaxHp += 20;
            applyPlayerStats();
            player.hp = player.maxHp;
            break;
    }
}

function selectRandomUpgrade() {
    applyRandomUpgradeEffect();

    isPaused = false;
    document.getElementById('level-up-modal').style.display = 'none';
    requestAnimationFrame(gameLoop);
}

function selectWeapon(weaponName) {
    // Add the selected weapon to player's inventory
    addWeaponToPlayer(player, weaponName);

    // Close the modal
    document.getElementById('level-up-modal').style.display = 'none';

    // Resume game
    isPaused = false;
    requestAnimationFrame(gameLoop);
}

function selectAccessory(accessoryName) {
    // Add the selected accessory to player's inventory and apply its bonus
    addAccessoryToPlayer(player, accessoryName);

    isPaused = false;
    document.getElementById('level-up-modal').style.display = 'none';
    requestAnimationFrame(gameLoop);
}

let toastTimeout = null;
function showToast(message) {
    const toast = document.getElementById('toast-message');
    if (!toast) return;
    toast.innerText = message;
    toast.style.display = 'block';
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);

    addBattleLog(message);
}

// Persistent scrolling battle log shown at the bottom of the screen.
const BATTLE_LOG_MAX_LINES = 8;
const battleLog = [];

function addBattleLog(message) {
    battleLog.push(message);
    if (battleLog.length > BATTLE_LOG_MAX_LINES) {
        battleLog.shift();
    }

    const logElement = document.getElementById('battle-log');
    if (logElement) {
        logElement.innerHTML = battleLog.map(line => `<div>${line}</div>`).join('');
    }
}

// Builds (and rebuilds, e.g. after toggling invincibility) the debug panel's contents.
function buildDebugMenu() {
    const menu = document.getElementById('debug-menu');
    if (!menu) return;

    const weaponButtons = weaponTypes
        .map(w => `<button class="debug-btn" onclick="debugAddWeapon('${w.name}')">${w.name}</button>`)
        .join('');
    const accessoryButtons = accessoryTypes
        .map(a => `<button class="debug-btn" onclick="debugAddAccessory('${a.name}')">${a.name}</button>`)
        .join('');
    const enemyButtons = enemyTypes
        .map(e => `<button class="debug-btn" onclick="debugSpawnEnemy('${e.name}')">${e.name}</button>`)
        .join('');
    const npcButtons = npcJobTypes
        .map(j => `<button class="debug-btn" onclick="debugRecruitNpc('${j.id}')">${j.name}</button>`)
        .join('');

    menu.innerHTML = `
        <h3>デバッグメニュー（F8で閉じる）</h3>
        <button class="debug-btn" onclick="levelUp()">強制レベルアップ</button>
        <button class="debug-btn" onclick="debugFullHeal()">全回復</button>
        <button class="debug-btn" onclick="debugToggleInvincible()">無敵: ${invincible ? 'ON' : 'OFF'}（切替）</button>
        <button class="debug-btn" onclick="debugKillAllEnemies()">敵を全滅させる</button>
        <h3>武器を追加</h3>
        ${weaponButtons}
        <h3>アクセサリを追加</h3>
        ${accessoryButtons}
        <h3>敵を召喚</h3>
        ${enemyButtons}
        <h3>NPCを仲間にする</h3>
        ${npcButtons}
    `;
}

function debugFullHeal() {
    player.hp = player.maxHp;
}

function debugToggleInvincible() {
    invincible = !invincible;
    showToast(invincible ? '無敵: ON' : '無敵: OFF');
    buildDebugMenu();
    enableModalKeyboardNav('debug-menu'); // rebuilt buttons are new DOM nodes
}

function debugKillAllEnemies() {
    enemies.length = 0;
}

function debugAddWeapon(name) {
    addWeaponToPlayer(player, name);
}

function debugAddAccessory(name) {
    addAccessoryToPlayer(player, name);
}

function debugSpawnEnemy(name) {
    const type = enemyTypes.find(e => e.name === name);
    if (!type) return;
    const dir = player.facingRight ? 1 : -1;
    enemies.push(createEnemy(type, player.x + dir * 100, player.y));
}

function debugRecruitNpc(jobId) {
    player.npcs.push(createNpc(jobId, player.x, player.y));
}

// Shows a 3-job recruitment choice when the player visits a village.
function openNpcSelectModal() {
    isPaused = true;

    const jobChoices = [];
    const pool = [...npcJobTypes];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        jobChoices.push(pool[randomIndex]);
        pool.splice(randomIndex, 1);
    }

    const modal = document.getElementById('npc-select-modal');
    modal.innerHTML = `
        <h2>村人を仲間にする：</h2>
        ${jobChoices.map(job => `<button class="upgrade-btn" onclick="selectNpcJob('${job.id}')">${job.name} - ${job.description}</button>`).join('')}
        <br><br>
        <button class="upgrade-btn" onclick="skipNpcSelect()">スキップする</button>
    `;
    modal.style.display = 'flex';

    enableModalKeyboardNav('npc-select-modal');
}

function selectNpcJob(jobId) {
    player.npcs.push(createNpc(jobId, player.x, player.y));

    isPaused = false;
    document.getElementById('npc-select-modal').style.display = 'none';
    requestAnimationFrame(gameLoop);
}

function skipNpcSelect() {
    isPaused = false;
    document.getElementById('npc-select-modal').style.display = 'none';
    requestAnimationFrame(gameLoop);
}


function gameOver() {
    isGameOver = true;
    document.getElementById('game-over').style.display = 'block';
    document.getElementById('final-time').innerText = document.getElementById('time-val').innerText;
    addBattleLog('力尽きた……ゲームオーバー');
}

function updateUI() {
    document.getElementById('level-val').innerText = player.level;
    document.getElementById('xp-val').innerText = player.xp;
    document.getElementById('next-xp-val').innerText = player.nextXp;
    document.getElementById('hp-val').innerText = Math.ceil(player.hp);
    document.getElementById('gold-val').innerText = goldCoins;

    // Weapon display: icons only (name/level available via tooltip on hover)
    const weaponInfoElement = document.getElementById('weapon-info');
    if (weaponInfoElement) {
        weaponInfoElement.innerHTML = player.weapons.map(weapon => {
            const weaponType = getWeaponByName(weapon.name);
            const title = `${weapon.name} Lv.${weapon.level}`;
            if (weaponType && weaponType.img) {
                return `<img src="${weaponType.img}" alt="${weapon.name}" title="${title}" style="width: 28px; height: 28px; margin-right: 4px;">`;
            }
            return '';
        }).join('');
    }

    // Display stat bonuses as percentages, 100% being the unmodified baseline
    const statBonusElement = document.getElementById('stat-bonus-info');
    if (statBonusElement) {
        statBonusElement.innerHTML = `
            <div>攻撃力: ${100 + player.bonusDamage}%</div>
            <div>移動速度: ${100 + player.bonusSpeed}%</div>
            <div>射撃速度: ${100 + player.bonusFireRate}%</div>
            <div>最大HP: ${Math.round(player.maxHp)}</div>
            <div>防御力: ${100 + player.bonusDefense}%</div>
            <div>収集範囲: ${100 + player.bonusPickupRange}%</div>
        `;
    }

    // Accessory display: icons only (name/level available via tooltip on hover)
    const accessoryInfoElement = document.getElementById('accessory-info');
    if (accessoryInfoElement) {
        accessoryInfoElement.innerHTML = player.accessories.map(accessory => {
            const accessoryType = getAccessoryByName(accessory.name);
            const title = `${accessory.name} Lv.${accessory.level}`;
            if (accessoryType && accessoryType.img) {
                return `<img src="${accessoryType.img}" alt="${accessory.name}" title="${title}" style="width: 28px; height: 28px; margin-right: 4px;">`;
            }
            return '';
        }).join('');
    }

    const npcInfoElement = document.getElementById('npc-info');
    if (npcInfoElement) {
        if (player.npcs.length > 0) {
            npcInfoElement.innerText = `仲間: ${player.npcs.map(n => n.name).join('、')}`;
        } else {
            npcInfoElement.innerText = '';
        }
    }

    const autoBattleInfoElement = document.getElementById('auto-battle-info');
    if (autoBattleInfoElement) {
        const parts = [];
        if (autoBattle) parts.push('自動戦闘: ON (B)');
        if (autoLevelUp) parts.push('自動レベルアップ: ON (L)');
        autoBattleInfoElement.innerText = parts.join(' / ');
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    document.getElementById('time-val').innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
}


function drawBackground() {
    // Generate only the tiles currently visible around the camera, so the
    // field never runs out no matter how far the player wanders.
    const startTileX = Math.floor(cameraX / tileSize) - 1;
    const endTileX = Math.floor((cameraX + canvas.width) / tileSize) + 1;
    const startTileY = Math.floor(cameraY / tileSize) - 1;
    const endTileY = Math.floor((cameraY + canvas.height) / tileSize) + 1;

    for (let ty = startTileY; ty <= endTileY; ty++) {
        for (let tx = startTileX; tx <= endTileX; tx++) {
            const worldX = tx * tileSize;
            const worldY = ty * tileSize;
            const screenX = worldX - cameraX;
            const screenY = worldY - cameraY;
            const colors = BIOME_COLORS[getBiome(worldX, worldY)];

            ctx.fillStyle = colors.fill;
            ctx.fillRect(screenX, screenY, tileSize, tileSize);

            ctx.strokeStyle = colors.detail;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(screenX + 10, screenY + tileSize - 5);
            ctx.lineTo(screenX + 20, screenY + tileSize - 15);
            ctx.lineTo(screenX + 30, screenY + tileSize - 8);
            ctx.stroke();
        }
    }
}

function gameLoop() {
    if (isPaused || isGameOver) return;

    // Switch between player images for animation every 10 frames
    if (frameCount % 10 === 0) {
        currentPlayerImg = currentPlayerImg === playerImg1 ? playerImg2 : playerImg1;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background first
    drawBackground();

    updatePlayer();
    handleCombat();
    updateStructures();
    updateObstacleSpawns();

    // Update and draw villages/fortresses with camera offset
    villages.forEach(v => drawVillage(v));
    fortresses.forEach(f => drawFortress(f));

    // Draw destructible obstacles with camera offset
    obstacles.forEach(o => drawObstacle(o));

    // Update and draw effects
    for (let i = effects.length - 1; i >= 0; i--) {
        effects[i].update();
        effects[i].draw();
        if (effects[i].life <= 0) {
            effects.splice(i, 1);
        }
    }

    // Draw gems with camera offset
    gems.forEach(g => g.draw());


    // Update and draw enemies with camera offset
    enemies.forEach(e => {
        e.update();
        e.draw();
    });

    // Update and draw NPC companions, removing any that have fallen
    for (let i = player.npcs.length - 1; i >= 0; i--) {
        const npc = player.npcs[i];
        updateNpc(npc);
        if (npc.hp <= 0) {
            effects.push(new Effect(npc.x, npc.y, 'hit'));
            player.npcs.splice(i, 1);
        } else {
            drawNpc(npc);
        }
    }


    // Draw projectiles with camera offset
    projectiles.forEach(p => p.draw());

    // Spawn enemies
    if (frameCount % 100 === 0) { // Spawn enemy every 100 frames
        spawnEnemy();
    }

// Draw player at center of screen (camera is adjusted so player stays in center)
    ctx.save();

    ctx.translate(canvas.width / 2, canvas.height / 2); // Always draw player at center
    if (!player.facingRight) {
        ctx.scale(-1, 1);
    }
    ctx.drawImage(currentPlayerImg, -player.radius, -player.radius, player.radius * 2, player.radius * 2);

    ctx.restore();

    // Draw HP bar above player in its own (unmirrored) transform so it doesn't
    // flip along with the sprite when the player faces left.
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);

    const barWidth = player.radius * 2;
    const barHeight = 4;
    const barX = -barWidth / 2;
    const barY = -player.radius - 10;

    // Background of HP bar
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // HP portion of bar
    const hpRatio = player.hp / player.maxHp;
    ctx.fillStyle = hpRatio > 0.5 ? '#0f0' : hpRatio > 0.25 ? '#ff0' : '#f00';
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

    ctx.restore();

    updateUI();
    frameCount++;
    requestAnimationFrame(gameLoop);
}

gameLoop();

// Handle resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Creates an enemy object (update/draw methods included) from an enemy-type
// definition at a specific world position. Shared by the ambient spawner and
// the fortress monster-house event.
function createEnemy(selectedType, x, y) {
    const enemy = {
        x: x,
        y: y,
        radius: selectedType.size,
        color: selectedType.color,
        speed: selectedType.speed,
        hp: selectedType.hp,
        maxHp: selectedType.hp,
        damage: selectedType.damage,
        name: selectedType.name,
        img: null, // Will be loaded below
        facingRight: true, // Track direction for flipping image

        update() {
            // Move towards player
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
                this.x += (dx / dist) * this.speed;
                this.y += (dy / dist) * this.speed;

                // Update facing direction based on movement
                this.facingRight = dx > 0;
            }
        },

        draw() {
            // Draw enemy image if available and loaded, otherwise fallback to circle
            if (this.img && this.img.complete && this.img.naturalWidth !== 0) {
                // Flip image based on direction
                ctx.save();
                if (!this.facingRight) {
                    ctx.scale(-1, 1);
                    ctx.drawImage(this.img, -(this.x - cameraX + this.radius), this.y - cameraY - this.radius, this.radius * 2, this.radius * 2);
                } else {
                    ctx.drawImage(this.img, this.x - cameraX - this.radius, this.y - cameraY - this.radius, this.radius * 2, this.radius * 2);
                }
                ctx.restore();
            } else {
                // Fallback to drawing a colored circle
                ctx.beginPath();
                ctx.arc(this.x - cameraX, this.y - cameraY, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
                ctx.closePath();
            }

            // Draw HP bar above enemy
            const barWidth = this.radius * 2;
            const barHeight = 4;
            const barX = this.x - cameraX - barWidth / 2;
            const barY = this.y - cameraY - this.radius - 10;

            // Background of HP bar
            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // HP portion of bar
            const hpRatio = this.hp / this.maxHp;
            ctx.fillStyle = hpRatio > 0.5 ? '#0f0' : hpRatio > 0.25 ? '#ff0' : '#f00';
            ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
        }
    };

    if (selectedType.img) {
        enemy.img = new Image();
        enemy.img.src = selectedType.img;
    }

    return enemy;
}

// Spawn enemy function
function spawnEnemy() {
    // Get available enemy types based on player level
    const availableTypes = getAvailableEnemyTypes(player.level);
    const selectedType = availableTypes[Math.floor(Math.random() * availableTypes.length)];

    // Spawn just outside the visible viewport, in world (camera-relative) coordinates
    const size = selectedType.size;
    let x, y;
    if (Math.random() < 0.5) {
        x = cameraX + Math.random() * canvas.width;
        y = cameraY + (Math.random() < 0.5 ? -size : canvas.height + size);
    } else {
        x = cameraX + (Math.random() < 0.5 ? -size : canvas.width + size);
        y = cameraY + Math.random() * canvas.height;
    }

    enemies.push(createEnemy(selectedType, x, y));
}
