// ワールド上の拠点: 村（NPC仲間を勧誘できる）と要塞
// （「モンスターハウス」を突破すると救出したNPCが報酬になる）。
const villages = [];
const fortresses = [];

const FORTRESS_ENEMY_COUNT_BASE = 8;
const FORTRESS_CLEAR_REWARD_GEMS = 10;
const FORTRESS_RESPAWN_DELAY = 180; // クリア後、再出現までのフレーム数（3秒）
const FORTRESS_ICON_RADIUS = 120; // 描画アイコンの半径（以前の2倍）
const VILLAGE_ICON_RADIUS = 100; // 描画アイコンの半径（当たり判定用のvillage.radiusとは別。以前の2倍）

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
        radius: 520, // 侵入判定・封じ込め範囲（以前の2倍）
        state: 'idle', // 'idle'（待機中）| 'active'（戦闘中）| 'cleared'（クリア済み）
        clearedAt: 0,
        img: null
    };
    fortress.img = new Image();
    fortress.img.src = 'img/fortress.png';
    return fortress;
}

// 指定した原点の周囲に、初期状態の村・要塞を配置する
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

    // 守護者: 現在出現可能な敵の中で最も強いタイプを強化したもの
    const guardianType = availableTypes[availableTypes.length - 1];
    const guardian = createEnemy(guardianType, fortress.x, fortress.y - FORTRESS_ICON_RADIUS);
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

// プレイヤーと村・要塞の衝突を判定する（勧誘のトリガー／モンスターハウスのトリガー）
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

// クリアするまで、戦闘中の要塞のエリアからプレイヤーが出られないようにする
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
        ctx.drawImage(village.img, village.x - cameraX - VILLAGE_ICON_RADIUS, village.y - cameraY - VILLAGE_ICON_RADIUS, VILLAGE_ICON_RADIUS * 2, VILLAGE_ICON_RADIUS * 2);
    } else {
        ctx.beginPath();
        ctx.arc(village.x - cameraX, village.y - cameraY, VILLAGE_ICON_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#c8a060';
        ctx.fill();
        ctx.closePath();
    }
}

function drawFortress(fortress) {
    if (fortress.state === 'cleared') return;

    if (fortress.img && fortress.img.complete && fortress.img.naturalWidth !== 0) {
        ctx.drawImage(fortress.img, fortress.x - cameraX - FORTRESS_ICON_RADIUS, fortress.y - cameraY - FORTRESS_ICON_RADIUS, FORTRESS_ICON_RADIUS * 2, FORTRESS_ICON_RADIUS * 2);
    } else {
        ctx.beginPath();
        ctx.arc(fortress.x - cameraX, fortress.y - cameraY, FORTRESS_ICON_RADIUS, 0, Math.PI * 2);
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
