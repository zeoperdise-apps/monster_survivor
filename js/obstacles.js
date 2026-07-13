// Destructible world objects (pots, trees). They block the player like a
// solid body, and destroying one has a small chance to drop a gold coin.
// Placement is deterministic (hashed from world-cell coordinates) so the
// same cell always produces the same obstacle, without needing to store an
// ever-growing array as the player explores the unlimited field.
const OBSTACLE_CELL_SIZE = 300;
const OBSTACLE_SPAWN_CHANCE = 0.35;
const OBSTACLE_SAFE_ZONE_RADIUS = 250; // keep the player's starting spot clear
const GOLD_DROP_CHANCE = 0.25;

const obstacleTypes = [
    { name: "ツボ", hp: 20, radius: 20, img: "img/pot.png", color: '#c68a3c' },
    { name: "木", hp: 40, radius: 28, img: "img/tree.png", color: '#2f6b3a' }
];

const obstacles = [];
const destroyedObstacleCells = new Set();
let goldCoins = 0;

// Deterministic pseudo-random value in [0, 1) from two integers.
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

// Ensures obstacles exist for every cell currently near the camera, and
// drops obstacles that have drifted far out of view (they'll deterministically
// regenerate if the player comes back, unless that cell was already destroyed).
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

// Marks the obstacle's cell as permanently cleared, removes it, and rolls
// for a rare gold coin drop.
function destroyObstacle(o) {
    destroyedObstacleCells.add(cellKey(o.cx, o.cy));
    const idx = obstacles.indexOf(o);
    if (idx !== -1) obstacles.splice(idx, 1);

    effects.push(new Effect(o.x, o.y, 'hit'));

    if (Math.random() < GOLD_DROP_CHANCE) {
        goldCoins++;
        addBattleLog(`${o.name}を壊して金貨を手に入れた！（所持: ${goldCoins}枚）`);
    } else {
        addBattleLog(`${o.name}を壊した`);
    }
}

// Solid collision: pushes the player back out of any obstacle it overlaps.
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
