// 破壊可能なワールドオブジェクト（ツボ、木）。プレイヤーと同様に固い
// 当たり判定を持ち、破壊すると低確率で金貨がドロップする。配置は
// （ワールドのセル座標をハッシュ化した）決定論的な方式のため、同じ
// セルには常に同じオブジェクトが生成され、無制限フィールドを探索して
// も肥大化し続ける配列を保持する必要がない。
const OBSTACLE_CELL_SIZE = 300;
const OBSTACLE_SPAWN_CHANCE = 0.35;
const OBSTACLE_SAFE_ZONE_RADIUS = 250; // プレイヤーの開始地点周辺は空けておく
const GOLD_DROP_CHANCE = 0.01;
const MEAT_DROP_CHANCE = 0.05;
const MEAT_HEAL_RATIO = 0.3; // 最大HPの30%を回復

const obstacleTypes = [
    { name: "ツボ", hp: 20, radius: 20, img: "img/pot.png", color: '#c68a3c' },
    { name: "木", hp: 40, radius: 84, img: "img/tree.png", color: '#2f6b3a' }
];

const obstacles = [];
const destroyedObstacleCells = new Set();
let goldCoins = 0;

// 2つの整数から[0, 1)の決定論的な疑似乱数値を生成する
function hash2D(a, b) {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
}

function cellKey(cx, cy) {
    return `${cx},${cy}`;
}

function getObstacleTypeForCell(cx, cy) {
    const spawnRoll = hash2D(cx, cy);
    if (spawnRoll > OBSTACLE_SPAWN_CHANCE) return null;
    const typeRoll = hash2D(cx * 7 + 3, cy * 13 + 5);
    return obstacleTypes[Math.floor(typeRoll * obstacleTypes.length)];
}

function createObstacle(type, x, y, cx, cy) {
    const obstacle = {
        x: x,
        y: y,
        cx: cx,
        cy: cy,
        radius: type.radius,
        hp: type.hp,
        maxHp: type.hp,
        name: type.name,
        color: type.color,
        img: null
    };
    if (type.img) {
        obstacle.img = new Image();
        obstacle.img.src = type.img;
    }
    return obstacle;
}

// カメラ付近の各セルに障害物が存在するようにし、視界から大きく外れた
// 障害物は削除する（そのセルが既に破壊済みでない限り、プレイヤーが
// 戻ってくれば決定論的に再生成される）。
function updateObstacleSpawns() {
    const startCX = Math.floor(cameraX / OBSTACLE_CELL_SIZE) - 1;
    const endCX = Math.floor((cameraX + canvas.width) / OBSTACLE_CELL_SIZE) + 1;
    const startCY = Math.floor(cameraY / OBSTACLE_CELL_SIZE) - 1;
    const endCY = Math.floor((cameraY + canvas.height) / OBSTACLE_CELL_SIZE) + 1;

    for (let cy = startCY; cy <= endCY; cy++) {
        for (let cx = startCX; cx <= endCX; cx++) {
            const key = cellKey(cx, cy);
            if (destroyedObstacleCells.has(key)) continue;
            if (obstacles.some(o => o.cx === cx && o.cy === cy)) continue;

            const type = getObstacleTypeForCell(cx, cy);
            if (!type) continue;

            const offsetX = (hash2D(cx * 3 + 1, cy * 5 + 2) - 0.5) * OBSTACLE_CELL_SIZE * 0.6;
            const offsetY = (hash2D(cx * 11 + 4, cy * 17 + 6) - 0.5) * OBSTACLE_CELL_SIZE * 0.6;
            const worldX = cx * OBSTACLE_CELL_SIZE + OBSTACLE_CELL_SIZE / 2 + offsetX;
            const worldY = cy * OBSTACLE_CELL_SIZE + OBSTACLE_CELL_SIZE / 2 + offsetY;

            if (Math.hypot(worldX, worldY) < OBSTACLE_SAFE_ZONE_RADIUS) continue;

            obstacles.push(createObstacle(type, worldX, worldY, cx, cy));
        }
    }

    const margin = OBSTACLE_CELL_SIZE * 3;
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        if (o.x < cameraX - margin || o.x > cameraX + canvas.width + margin ||
            o.y < cameraY - margin || o.y > cameraY + canvas.height + margin) {
            obstacles.splice(i, 1);
        }
    }
}

function drawObstacle(o) {
    const screenX = o.x - cameraX;
    const screenY = o.y - cameraY;

    if (o.img && o.img.complete && o.img.naturalWidth !== 0) {
        ctx.drawImage(o.img, screenX - o.radius, screenY - o.radius, o.radius * 2, o.radius * 2);
    } else {
        ctx.beginPath();
        ctx.arc(screenX, screenY, o.radius, 0, Math.PI * 2);
        ctx.fillStyle = o.color;
        ctx.fill();
        ctx.closePath();
    }
}

// 障害物のセルを永続的にクリア済みとして記録し、障害物を削除したうえで
// 金貨・肉のレアドロップ判定を行う（両者は独立しており、両方発生することもある）。
function destroyObstacle(o) {
    destroyedObstacleCells.add(cellKey(o.cx, o.cy));
    const idx = obstacles.indexOf(o);
    if (idx !== -1) obstacles.splice(idx, 1);

    effects.push(new Effect(o.x, o.y, 'hit'));

    let gotDrop = false;

    if (Math.random() < GOLD_DROP_CHANCE) {
        goldCoins++;
        addBattleLog(`${o.name}を壊して金貨を手に入れた！（所持: ${goldCoins}枚）`);
        gotDrop = true;
    }

    if (Math.random() < MEAT_DROP_CHANCE) {
        const healAmount = player.maxHp * MEAT_HEAL_RATIO;
        player.hp = Math.min(player.maxHp, player.hp + healAmount);
        addBattleLog(`${o.name}から肉を手に入れて食べた！HPが${Math.round(healAmount)}回復した`);
        gotDrop = true;
    }

    if (!gotDrop) {
        addBattleLog(`${o.name}を壊した`);
    }
}

// 固い衝突判定: プレイヤーが重なった障害物から押し出す
function resolvePlayerObstacleCollisions() {
    for (const o of obstacles) {
        const dx = player.x - o.x;
        const dy = player.y - o.y;
        const dist = Math.hypot(dx, dy);
        const minDist = player.radius + o.radius;
        if (dist > 0 && dist < minDist) {
            const overlap = minDist - dist;
            player.x += (dx / dist) * overlap;
            player.y += (dy / dist) * overlap;
        }
    }
}
