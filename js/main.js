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
const ENEMY_CONTACT_DAMAGE = 5;
const INVULNERABILITY_FRAMES = 30; // 0.5s of i-frames at 60fps after taking a hit

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 24, // Same size as the Skeleton enemy
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
    invulnerableUntil: 0
};

initPlayerAccessories(player);

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

// Background tile setup
const tileSize = 100;
const backgroundTiles = [];

// Create background tiles (simple grass pattern)
for (let y = -canvas.height; y < canvas.height * 2; y += tileSize) {
    for (let x = -canvas.width; x < canvas.width * 2; x += tileSize) {
        backgroundTiles.push({x, y});
    }
}

// Input
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);


// Projectile Class
class Projectile {
    constructor(x, y, targetX, targetY, damage, splashRadius = 0, color = '#ff0') {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.color = color;
        this.damage = damage;
        this.speed = 7;
        this.splashRadius = splashRadius;

        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        ctx.beginPath();

        ctx.arc(this.x - cameraX, this.y - cameraY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

// Effect Class
class Effect {
    constructor(x, y, type, range) {
        this.x = x;
        this.y = y;
        this.type = type; // 'hit', 'attack' or 'whip'
        this.range = range;
        this.life = 30; // frames to live
        this.maxLife = 30;
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
            }
        }
    }

    effects.push(new Effect(player.x, player.y, 'whip', weapon.range));
}

// Ranged weapons fire a single-target projectile at the nearest enemy in range.
function fireRangedWeapon(weapon, damage) {
    const target = findNearestEnemyInRange(weapon.range);
    if (!target) return false;

    projectiles.push(new Projectile(player.x, player.y, target.x, target.y, damage, 0, '#ff0'));
    effects.push(new Effect(player.x, player.y, 'attack'));
    return true;
}

// Magic weapons fire a projectile that splashes to nearby enemies on impact.
function fireMagicWeapon(weapon, damage) {
    const target = findNearestEnemyInRange(weapon.range);
    if (!target) return false;

    projectiles.push(new Projectile(player.x, player.y, target.x, target.y, damage, 60, '#a0f'));
    effects.push(new Effect(player.x, player.y, 'attack'));
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
        }

        if (fired) weapon.lastFire = frameCount;
    }

    // Projectile - Enemy Collision
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.update();

        // Remove once it leaves the visible area around the player
        if (p.x < cameraX - 50 || p.x > cameraX + canvas.width + 50 ||
            p.y < cameraY - 50 || p.y > cameraY + canvas.height + 50) {
            projectiles.splice(i, 1);
            continue;
        }

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
                            }
                        }
                    }
                } else {
                    e.hp -= p.damage;
                    effects.push(new Effect(e.x, e.y, 'hit'));
                    if (e.hp <= 0) {
                        gems.push(new Gem(e.x, e.y));
                        enemies.splice(j, 1);
                    }
                }

                projectiles.splice(i, 1);
                break;
            }
        }
    }
}

// Applies contact damage (and game over) when an enemy touches the player.
function handlePlayerDamage() {
    if (isGameOver || frameCount < player.invulnerableUntil) return;

    for (const e of enemies) {
        const dist = Math.hypot(player.x - e.x, player.y - e.y);
        if (dist < player.radius + e.radius) {
            player.hp -= getIncomingDamage(ENEMY_CONTACT_DAMAGE);
            player.invulnerableUntil = frameCount + INVULNERABILITY_FRAMES;
            effects.push(new Effect(player.x, player.y, 'hit'));

            if (player.hp <= 0) {
                player.hp = 0;
                gameOver();
            }
            break;
        }
    }
}

function updatePlayer() {
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

    // Update camera to follow player (keep player centered)
    cameraX = player.x - canvas.width / 2;
    cameraY = player.y - canvas.height / 2;

    // Gem collection
    for (let i = gems.length - 1; i >= 0; i--) {
        const g = gems[i];
        const dist = Math.sqrt((player.x - g.x)**2 + (player.y - g.y)**2);
        if (dist < player.radius + 20) {
            player.xp += g.xp;
            gems.splice(i, 1);
            if (player.xp >= player.nextXp) levelUp();
        }
    }

    handlePlayerDamage();
}

function levelUp() {
    isPaused = true;
    player.level++;
    player.xp = 0; // Reset XP to 0 after level up
    player.nextXp = Math.floor(player.nextXp * 1.2);

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

    // Update the modal with weapon and accessory options
    const modal = document.getElementById('level-up-modal');
    let modalContent = `
        <h2>レベルアップ！選択してください：</h2>
        ${upgradeOptions.map((option) => {
            if (option.type === 'weapon') {
                return `<button class="upgrade-btn" onclick="selectWeapon('${option.data.name}')">${option.data.name} - ${option.data.description}</button>`;
            } else if (option.type === 'accessory') {
                return `<button class="upgrade-btn" onclick="selectAccessory('${option.data.name}')">${option.data.name} - ${option.data.description}</button>`;
            } else { // random upgrade
                return `<button class="upgrade-btn" onclick="selectRandomUpgrade()">${option.data.name} - ${option.data.description}</button>`;
            }
        }).join('')}
        <br><br>
        <button class="upgrade-btn" onclick="skipLevelUp()">スキップする</button>
    `;

    modal.innerHTML = modalContent;
    modal.style.display = 'flex';
}

// Function to skip level up selection
function skipLevelUp() {
    isPaused = false;
    document.getElementById('level-up-modal').style.display = 'none';
    requestAnimationFrame(gameLoop);
}

function selectRandomUpgrade() {
    // Apply a random upgrade (as a running bonus, same as accessory bonuses)
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


function gameOver() {
    isGameOver = true;
    document.getElementById('game-over').style.display = 'block';
    document.getElementById('final-time').innerText = document.getElementById('time-val').innerText;
}

function updateUI() {
    document.getElementById('level-val').innerText = player.level;
    document.getElementById('xp-val').innerText = player.xp;
    document.getElementById('next-xp-val').innerText = player.nextXp;
    document.getElementById('hp-val').innerText = Math.ceil(player.hp);

    // Update weapon information display with level
    const currentWeapon = player.weapons[0];
    const weaponInfoElement = document.getElementById('weapon-info');

    if (currentWeapon && currentWeapon.name) {
        // Get the weapon type to find its image
        const weaponType = getWeaponByName(currentWeapon.name);
        if (weaponType && weaponType.img) {
            // Create an img element for the weapon icon
            weaponInfoElement.innerHTML = `<img src="${weaponType.img}" alt="${currentWeapon.name}" style="width: 30px; height: 30px;"> Level ${currentWeapon.level}`;
        } else {
            // Fallback to text if no image available
            weaponInfoElement.innerText = `${currentWeapon.name} Level ${currentWeapon.level}`;
        }
    } else {
        weaponInfoElement.innerText = 'Whip';
    }

    // Display stat bonuses as percentages, 100% being the unmodified baseline
    const statBonusElement = document.getElementById('stat-bonus-info');
    if (statBonusElement) {
        statBonusElement.innerHTML = `
            <div>攻撃力: ${100 + player.bonusDamage}%</div>
            <div>移動速度: ${100 + player.bonusSpeed}%</div>
            <div>射撃速度: ${100 + player.bonusFireRate}%</div>
            <div>最大HP: ${100 + player.bonusMaxHp}%</div>
            <div>防御力: ${100 + player.bonusDefense}%</div>
        `;
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    document.getElementById('time-val').innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
}


function drawBackground() {
    // Draw grass tiles (offset by camera position)
    ctx.fillStyle = '#4a8c4a'; // Green color for grass
    backgroundTiles.forEach(tile => {
        const screenX = tile.x - cameraX;
        const screenY = tile.y - cameraY;
        if (screenX < canvas.width && screenX > -tileSize && screenY < canvas.height && screenY > -tileSize) {
            ctx.fillRect(screenX, screenY, tileSize, tileSize);
            // Draw grass details
            ctx.strokeStyle = '#3d7a3d';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(screenX + 10, screenY + tileSize - 5);
            ctx.lineTo(screenX + 20, screenY + tileSize - 15);
            ctx.lineTo(screenX + 30, screenY + tileSize - 8);
            ctx.stroke();
        }
    });
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

    // Draw HP bar above player
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

// Spawn enemy function
function spawnEnemy() {
    // Get available enemy types based on player level
    const availableTypes = getAvailableEnemyTypes(player.level);
    const enemyType = Math.floor(Math.random() * availableTypes.length); // Randomly select one of the available enemy types
    const selectedType = availableTypes[enemyType];

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

     // Create enemy object with update and draw methods
     const enemy = {
         x: x,
         y: y,
         radius: selectedType.size,
         color: selectedType.color,
         speed: selectedType.speed,
         hp: selectedType.hp,
         maxHp: selectedType.hp,
         type: enemyType,
         img: null, // Will be loaded later
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

     // Load enemy image
     if (selectedType.img) {
         enemy.img = new Image();
         enemy.img.src = selectedType.img;
     }

    enemies.push(enemy);
}
