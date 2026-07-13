// World structures: villages (recruit an NPC companion) and fortresses
// (a "monster house" encounter that rewards a rescued NPC on clear).
const villages = [];
const fortresses = [];

const FORTRESS_ENEMY_COUNT_BASE = 8;
const FORTRESS_CLEAR_REWARD_GEMS = 10;
const FORTRESS_RESPAWN_DELAY = 180; // frames (3s) after being cleared

function createVillage(x, y) {
    const village = { x: x, y: y, radius: 50, consumed: false, img: null };
    village.img = new Image();
    village.img.src = 'img/village.png';
    return village;
}

function createFortress(x, y) {
    const fortress = {
        id: `f${Math.random().toString(36).slice(2)}`,
        x: x,
        y: y,
        radius: 260,
        state: 'idle', // 'idle' | 'active' | 'cleared'
        clearedAt: 0,
        img: null
    };
    fortress.img = new Image();
    fortress.img.src = 'img/fortress.png';
    return fortress;
}

// Places the initial set of villages/fortresses around the given origin point.
function initStructures(originX, originY) {
    for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 6000 + Math.random() * 6000;
        villages.push(createVillage(originX + Math.cos(angle) * dist, originY + Math.sin(angle) * dist));
    }
    for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 1000 + Math.random() * 800;
        fortresses.push(createFortress(originX + Math.cos(angle) * dist, originY + Math.sin(angle) * dist));
    }
}

function relocateFortress(fortress, originX, originY) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 1000 + Math.random() * 800;
    fortress.x = originX + Math.cos(angle) * dist;
    fortress.y = originY + Math.sin(angle) * dist;
    fortress.state = 'idle';
}

function activateFortress(fortress) {
    fortress.state = 'active';
    const availableTypes = getAvailableEnemyTypes(player.level);
    const count = FORTRESS_ENEMY_COUNT_BASE + player.level;

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * fortress.radius * 0.8;
        const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        const enemy = createEnemy(type, fortress.x + Math.cos(angle) * dist, fortress.y + Math.sin(angle) * dist);
        enemy.fortressId = fortress.id;
        enemies.push(enemy);
    }

    // Guardian: a tougher version of the strongest currently-available enemy type.
    const guardianType = availableTypes[availableTypes.length - 1];
    const guardian = createEnemy(guardianType, fortress.x, fortress.y - 60);
    guardian.hp *= 4;
    guardian.maxHp = guardian.hp;
    guardian.radius *= 1.4;
    guardian.fortressId = fortress.id;
    enemies.push(guardian);

    showToast('要塞に踏み込んだ！モンスターの群れが襲いかかる！');
}

function clearFortress(fortress) {
    fortress.state = 'cleared';
    fortress.clearedAt = frameCount;

    for (let i = 0; i < FORTRESS_CLEAR_REWARD_GEMS; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 60;
        gems.push(new Gem(fortress.x + Math.cos(angle) * dist, fortress.y + Math.sin(angle) * dist));
    }

    const job = npcJobTypes[Math.floor(Math.random() * npcJobTypes.length)];
    const npc = createNpc(job.id, fortress.x, fortress.y - 30);
    player.npcs.push(npc);
    showToast(`要塞を制圧した！捕虜の${job.name}を仲間にした！`);
}

function updateStructures() {
    for (const fortress of fortresses) {
        if (fortress.state === 'active') {
            const remaining = enemies.some(e => e.fortressId === fortress.id);
            if (!remaining) {
                clearFortress(fortress);
            }
        } else if (fortress.state === 'cleared') {
            if (frameCount - fortress.clearedAt >= FORTRESS_RESPAWN_DELAY) {
                relocateFortress(fortress, player.x, player.y);
            }
        }
    }
}

// Checks player collisions with villages/fortresses (recruit trigger / monster-house trigger).
function checkStructureInteractions() {
    for (const village of villages) {
        if (village.consumed) continue;
        const dist = Math.hypot(player.x - village.x, player.y - village.y);
        if (dist < village.radius + player.radius) {
            village.consumed = true;
            openNpcSelectModal();
            break;
        }
    }

    for (const fortress of fortresses) {
        if (fortress.state !== 'idle') continue;
        const dist = Math.hypot(player.x - fortress.x, player.y - fortress.y);
        if (dist < fortress.radius) {
            activateFortress(fortress);
        }
    }
}

// Keeps the player from leaving an active fortress's battle area until it's cleared.
function clampPlayerToActiveFortress() {
    const activeFortress = fortresses.find(f => f.state === 'active');
    if (!activeFortress) return;

    const dx = player.x - activeFortress.x;
    const dy = player.y - activeFortress.y;
    const dist = Math.hypot(dx, dy);
    if (dist > activeFortress.radius) {
        const angle = Math.atan2(dy, dx);
        player.x = activeFortress.x + Math.cos(angle) * activeFortress.radius;
        player.y = activeFortress.y + Math.sin(angle) * activeFortress.radius;
    }
}

function drawVillage(village) {
    if (village.consumed) return;
    if (village.img && village.img.complete && village.img.naturalWidth !== 0) {
        ctx.drawImage(village.img, village.x - cameraX - village.radius, village.y - cameraY - village.radius, village.radius * 2, village.radius * 2);
    } else {
        ctx.beginPath();
        ctx.arc(village.x - cameraX, village.y - cameraY, village.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#c8a060';
        ctx.fill();
        ctx.closePath();
    }
}

function drawFortress(fortress) {
    if (fortress.state === 'cleared') return;

    if (fortress.img && fortress.img.complete && fortress.img.naturalWidth !== 0) {
        ctx.drawImage(fortress.img, fortress.x - cameraX - 60, fortress.y - cameraY - 60, 120, 120);
    } else {
        ctx.beginPath();
        ctx.arc(fortress.x - cameraX, fortress.y - cameraY, 60, 0, Math.PI * 2);
        ctx.fillStyle = fortress.state === 'active' ? '#a33' : '#666';
        ctx.fill();
        ctx.closePath();
    }

    if (fortress.state === 'idle') {
        ctx.beginPath();
        ctx.arc(fortress.x - cameraX, fortress.y - cameraY, fortress.radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,80,80,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}
