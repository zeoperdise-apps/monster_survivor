const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ゲーム状態
const playerImg1 = new Image();
playerImg1.src = 'img/player1.png';

const playerImg2 = new Image();
playerImg2.src = 'img/player2.png';

let currentPlayerImg = playerImg1;

const BASE_SPEED = 3;
const BASE_MAX_HP = 100;
const INVULNERABILITY_FRAMES = 30; // 被弾後、60fpsで0.5秒分の無敵時間

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 30, // ゴブリンと同じサイズ
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

// 現在の合計ボーナス値から派生ステータス（速度・最大HP）を再計算する
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
const enemyBullets = [];
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

// ゲームスピード倍率。0.5倍刻みで最大4倍まで上げられる（等倍が基準の1倍）。
const GAME_SPEED_MIN = 1;
const GAME_SPEED_MAX = 4;
const GAME_SPEED_STEP = 0.5;
let gameSpeed = 1;
let speedAccumulator = 0; // 端数のスピード倍率を複数フレームにわたって積み立てる

// 背景タイルの設定。フィールドは無制限: タイルは配列に事前生成せず、
// 毎フレームカメラの現在位置から動的に算出するため、ワールドは
// あらゆる方向に無限に広がる。
const tileSize = 100;

// バイオームの定義。タイルが属するバイオームはワールド座標から決定論的
// に算出される（getBiome参照）ため、データを保存する必要がなく、
// いつでもどこでも同じ結果を再計算できる。
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

// 入力
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// 自動戦闘の切替: 操作を簡易AIに委ねる（runAutoBattleMovement参照）
window.addEventListener('keydown', e => {
    if (e.code === 'KeyB') {
        autoBattle = !autoBattle;
        showToast(autoBattle ? '自動戦闘: ON' : '自動戦闘: OFF');
    }
});

// 自動レベルアップの切替: レベルアップ選択画面を出さずランダムに選ぶ
window.addEventListener('keydown', e => {
    if (e.code === 'KeyL') {
        autoLevelUp = !autoLevelUp;
        showToast(autoLevelUp ? '自動レベルアップ: ON' : '自動レベルアップ: OFF');
    }
});

// ゲームスピードの変更: +/-キーで0.5倍刻みに増減させる（1〜4倍の範囲）。
// キーボード配列やテンキーの有無によって物理キーのcodeが異なる場合が
// あるため、想定される主要キーとkey（実際に入力された文字）の両方で判定する。
const isSpeedUpKey = e => e.code === 'Equal' || e.code === 'NumpadAdd' || e.key === '+' || e.key === '=';
const isSpeedDownKey = e => e.code === 'Minus' || e.code === 'NumpadSubtract' || e.key === '-';

window.addEventListener('keydown', e => {
    if (isSpeedUpKey(e)) {
        gameSpeed = Math.min(GAME_SPEED_MAX, Math.round((gameSpeed + GAME_SPEED_STEP) * 10) / 10);
        showToast(`ゲームスピード: ${gameSpeed}倍`);
    } else if (isSpeedDownKey(e)) {
        gameSpeed = Math.max(GAME_SPEED_MIN, Math.round((gameSpeed - GAME_SPEED_STEP) * 10) / 10);
        showToast(`ゲームスピード: ${gameSpeed}倍`);
    }
});

// デバッグメニューの切替: テスト用のチートパネル（レベルアップ、回復、召喚など）
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

// .upgrade-btnボタンを並べる選択モーダル（レベルアップ選択、NPC勧誘など）
// 全般に使える汎用キーボードナビゲーション: 矢印キーでハイライトする
// 選択肢を移動し、Enter/Spaceで決定する。
let activeModalId = null;
let modalButtons = [];
let selectedModalIndex = 0;

function updateModalSelection() {
    modalButtons.forEach((btn, i) => {
        btn.classList.toggle('selected', i === selectedModalIndex);
    });
}

// モーダルのinnerHTMLを設定して表示した直後に呼び出すこと。
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

// ゲームオーバー画面のリトライボタンもEnter/Spaceに反応する。
window.addEventListener('keydown', e => {
    if (!isGameOver) return;
    if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        location.reload();
    }
});


// 弾クラス
class Projectile {
    constructor(x, y, targetX, targetY, damage, splashRadius = 0, color = '#ff0', arc = false, blast = false, axe = false, arrow = false, boomerang = false) {
        this.x = x;
        this.y = y;
        this.blast = blast;
        this.axe = axe;
        this.arrow = arrow;
        this.boomerang = boomerang;
        this.piercing = boomerang;
        this.hitEnemies = boomerang ? new Map() : null;
        this.reversed = false;
        this.rotation = 0;
        this.radius = blast ? 9 : (boomerang ? 8 : 5);
        this.color = color;
        this.damage = damage;
        this.speed = 7;
        this.splashRadius = splashRadius;
        this.arc = arc;

        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        this.angle = Math.atan2(dy, dx);

        if (boomerang) {
            // 出発地点からの飛行距離を測るための基準点と、折り返すまでの距離を覚えておく
            this.originX = x;
            this.originY = y;
            this.maxRange = dist;
        }

        if (arc) {
            // 直線ではなく2次ベジエ曲線で目標に向かって弧を描く。
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
        if (this.axe || this.boomerang) {
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

            if (this.boomerang && !this.reversed) {
                // 出発地点から射程まで届いたら、逆方向へ折り返す（帰り道でプレイヤーを
                // 通り過ぎ、そのまま後方へ飛んでいき、画面外に出て消える）
                const traveled = Math.hypot(this.x - this.originX, this.y - this.originY);
                if (traveled >= this.maxRange) {
                    this.vx = -this.vx;
                    this.vy = -this.vy;
                    this.reversed = true;
                }
            }
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
            // 矢: 後端に矢羽根、先端に鏃を持つ細い軸で、現在の進行方向を向く
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

        if (this.boomerang) {
            // 回転しながら飛ぶV字形のブーメラン
            const screenX = this.x - cameraX;
            const screenY = this.y - cameraY;
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(this.rotation);

            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-12, -9);
            ctx.lineTo(-7, -11);
            ctx.lineTo(2, -2);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-12, 9);
            ctx.lineTo(-7, 11);
            ctx.lineTo(2, 2);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
            return;
        }

        if (this.axe) {
            // 回転する斧のシルエット: 短い柄とくさび形の刃
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
            // 発光するブラスト: やわらかい外側のハローと明るい中心部
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

// エフェクトクラス
class Effect {
    constructor(x, y, type, range, facingRight, life = 30) {
        this.x = x;
        this.y = y;
        this.type = type; // 'hit'（被弾）, 'attack'（攻撃）, 'whip'（鞭）, 'slash'（斬撃）, 'thrust'（突き）
        this.range = range;
        this.facingRight = facingRight;
        this.life = life; // 生存フレーム数
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
            // 被弾エフェクト - 広がる円
            ctx.arc(this.x - cameraX, this.y - cameraY, this.size, 0, Math.PI * 2);
            const alpha = this.life / this.maxLife;
            ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
            ctx.fill();
        } else if (this.type === 'attack') {
            // 攻撃エフェクト - 広がる円
            ctx.arc(this.x - cameraX, this.y - cameraY, this.size, 0, Math.PI * 2);
            const alpha = this.life / this.maxLife;
            ctx.fillStyle = `rgba(255, 100, 0, ${alpha})`;
            ctx.fill();
        } else if (this.type === 'whip') {
            // 鞭のクラック: 先端が細くなる波打つ帯状の形が素早く伸びて
            // 消えていき、伸びきると先端が光る。
            const alpha = this.life / this.maxLife;
            const range = this.range || 135;
            const progress = 1 - (this.life / this.maxLife); // エフェクト生存期間での進行度（0→1）
            const extend = Math.min(1, progress * 2.5); // 素早く伸びきり、その後は消えるまで保持
            const length = range * extend;
            const dir = this.facingRight ? 1 : -1;

            const startX = player.x - cameraX;
            const startY = player.y - cameraY;

            const segments = 12;
            const waveAmount = 16 * (1 - extend * 0.6); // 伸びるにつれて波が収まっていく
            const topPoints = [];
            const bottomPoints = [];

            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const segX = startX + dir * length * t;
                const wave = Math.sin(t * Math.PI * 2.2 + progress * 8) * waveAmount * (1 - t * 0.7);
                const segY = startY - length * 0.12 * t + wave;
                const halfWidth = (10 * (1 - t) + 1.5) / 2;
                topPoints.push({ x: segX, y: segY - halfWidth });
                bottomPoints.push({ x: segX, y: segY + halfWidth });
            }

            ctx.beginPath();
            ctx.moveTo(topPoints[0].x, topPoints[0].y);
            for (const p of topPoints) ctx.lineTo(p.x, p.y);
            for (let i = bottomPoints.length - 1; i >= 0; i--) ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
            ctx.closePath();
            ctx.fillStyle = `rgba(139, 90, 43, ${alpha})`;
            ctx.fill();

            // 鞭がほぼ伸びきったタイミングで先端が光るフラッシュ
            if (extend > 0.75) {
                const tip = topPoints[topPoints.length - 1];
                const flashAlpha = alpha * ((extend - 0.75) / 0.25);
                ctx.beginPath();
                ctx.arc(tip.x, tip.y + 5, 6, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 240, 200, ${flashAlpha})`;
                ctx.fill();
            }
        } else if (this.type === 'slash') {
            // 剣の斬撃 - 向いている方向への扇形の一閃
            const alpha = this.life / this.maxLife;
            const range = this.range || 100;
            const progress = 1 - (this.life / this.maxLife); // エフェクト生存期間での進行度（0→1）

            const originX = player.x - cameraX;
            const originY = player.y - cameraY;
            const centerAngle = this.facingRight ? 0 : Math.PI;
            const spread = Math.PI / 2; // 90度の扇形
            const startAngle = centerAngle - spread / 2;
            const sweepAngle = startAngle + spread * Math.min(1, progress * 1.6);

            // 斬られた範囲を示す塗りつぶし扇形
            ctx.beginPath();
            ctx.moveTo(originX, originY);
            ctx.arc(originX, originY, range, startAngle, sweepAngle);
            ctx.closePath();
            ctx.fillStyle = `rgba(230, 230, 255, ${alpha * 0.35})`;
            ctx.fill();

            // 一閃の先端に沿った明るい刃の線
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(originX, originY, range, startAngle, sweepAngle);
            ctx.stroke();
        } else if (this.type === 'thrust') {
            // 槍の突き - 向いている方向へまっすぐ素早く突き出す
            const alpha = this.life / this.maxLife;
            const range = this.range || 160;
            const progress = 1 - (this.life / this.maxLife); // エフェクト生存期間での進行度（0→1）
            const extend = Math.min(1, progress * 3); // 素早く伸びきり、その後は消えるまで保持
            const dir = this.facingRight ? 1 : -1;
            const length = range * extend;

            const originX = player.x - cameraX;
            const originY = player.y - cameraY;
            const tipX = originX + dir * length;
            const tipY = originY;

            // 柄
            ctx.strokeStyle = `rgba(150, 110, 70, ${alpha})`;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(originX, originY);
            ctx.lineTo(tipX, tipY);
            ctx.stroke();

            // 穂先
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

// XP宝石クラス
class Gem {
    constructor(x, y, xp = 10) {
        this.x = x;
        this.y = y;
        this.radius = 4;
        this.color = '#5f5';
        this.xp = xp;
    }

    draw() {
        ctx.beginPath();

        ctx.arc(this.x - cameraX, this.y - cameraY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

// 遠距離攻撃を持つ敵（ウィザードの弾、ドラゴンのブレスなど）がプレイヤーへ放つ弾
class EnemyProjectile {
    constructor(x, y, targetX, targetY, damage, speed, radius, color, sourceName) {
        this.x = x;
        this.y = y;
        this.damage = damage;
        this.radius = radius;
        this.color = color;
        this.sourceName = sourceName;

        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.hypot(dx, dy) || 1;
        this.vx = (dx / dist) * speed;
        this.vy = (dy / dist) * speed;
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

// 敵の弾を更新し、プレイヤーに命中したらダメージ・ゲームオーバー判定を行う
function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.update();

        if (b.x < cameraX - 100 || b.x > cameraX + canvas.width + 100 ||
            b.y < cameraY - 100 || b.y > cameraY + canvas.height + 100) {
            enemyBullets.splice(i, 1);
            continue;
        }

        const dist = Math.hypot(b.x - player.x, b.y - player.y);
        if (dist < b.radius + player.radius) {
            enemyBullets.splice(i, 1);

            if (isGameOver || invincible || frameCount < player.invulnerableUntil) continue;

            const dmg = getIncomingDamage(b.damage);
            player.hp -= dmg;
            player.invulnerableUntil = frameCount + INVULNERABILITY_FRAMES;
            effects.push(new Effect(player.x, player.y, 'hit'));
            addBattleLog(`${b.sourceName}の遠距離攻撃を受けた！（-${Math.round(dmg)} HP）`);

            if (player.hp <= 0) {
                player.hp = 0;
                gameOver();
            }
        }
    }
}

// 射程内で最も近い敵を探す。範囲内に敵がいなければnullを返す
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

// 近接武器はプレイヤーの向いている方向へ振り、その側の射程内にいる
// すべての敵にダメージを与える。
const SLASH_HIT_SPREAD = Math.PI / 2; // 剣の斬撃エフェクト（'slash'）と同じ90度の扇形

function fireMeleeWeapon(weapon, damage) {
    const weaponType = getWeaponByName(weapon.name);
    const centerAngle = player.facingRight ? 0 : Math.PI;
    // 剣は斬撃エフェクトと同じ90度の扇形に当たり判定を絞る。
    // それ以外の近接武器は従来通り前方半円（180度）で判定する。
    const hitSpread = (weaponType && weaponType.effect === 'slash') ? SLASH_HIT_SPREAD : null;

    const isInMeleeArc = (dx, dy, dist) => {
        if (dist > weapon.range) return false;
        if (hitSpread !== null) {
            const angle = Math.atan2(dy, dx);
            let diff = angle - centerAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            return Math.abs(diff) <= hitSpread / 2;
        }
        return player.facingRight ? dx > 0 : dx < 0;
    };

    for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (isInMeleeArc(dx, dy, dist)) {
            e.hp -= damage;
            effects.push(new Effect(e.x, e.y, 'hit'));
            addBattleLog(`${weapon.name}で${e.name}に${Math.round(damage)}のダメージ`);

            if (e.hp <= 0) {
                gems.push(new Gem(e.x, e.y, e.xp));
                enemies.splice(j, 1);
                addBattleLog(`${weapon.name}で${e.name}を倒した！`);
            }
        }
    }

    for (const o of obstacles) {
        const dx = o.x - player.x;
        const dy = o.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (isInMeleeArc(dx, dy, dist)) {
            o.hp -= damage;
            effects.push(new Effect(o.x, o.y, 'hit'));

            if (o.hp <= 0) {
                destroyObstacle(o);
            }
        }
    }

    const effectType = (weaponType && weaponType.effect) || 'whip';
    const effectDuration = (weaponType && weaponType.effectDuration) || 30;
    effects.push(new Effect(player.x, player.y, effectType, weapon.range, player.facingRight, effectDuration));
}

// 遠隔武器は射程内の最も近い敵1体を狙って単一の弾を発射する。
function fireRangedWeapon(weapon, damage) {
    const target = findNearestEnemyInRange(weapon.range);
    if (!target) return false;

    const weaponType = getWeaponByName(weapon.name);
    const isArc = !!(weaponType && weaponType.arc);
    const isArrow = !!(weaponType && weaponType.projectileShape === 'arrow');
    const proj = new Projectile(player.x, player.y, target.x, target.y, damage, 0, '#ff0', isArc, false, false, isArrow);
    proj.sourceLabel = `${weapon.name}で`;
    projectiles.push(proj);
    effects.push(new Effect(player.x, player.y, 'attack'));
    return true;
}

// 魔法武器は命中時に周囲の敵へ範囲ダメージを与える弾を発射する。
function fireMagicWeapon(weapon, damage) {
    const weaponType = getWeaponByName(weapon.name);

    // 射程無制限の武器は距離を問わず画面内の最も近い敵を狙える。
    // プレイヤーは常に画面中央に描画されるため、画面の対角線の半分が
    // 表示範囲全体をカバーする。
    const searchRange = (weaponType && weaponType.unlimitedRange)
        ? Math.hypot(canvas.width, canvas.height) / 2
        : weapon.range;

    const target = findNearestEnemyInRange(searchRange);
    if (!target) return false;

    const isBlast = !!(weaponType && weaponType.effect === 'blast');
    const proj = new Projectile(player.x, player.y, target.x, target.y, damage, 60, '#a0f', false, isBlast);
    proj.sourceLabel = `${weapon.name}で`;
    projectiles.push(proj);
    effects.push(new Effect(player.x, player.y, 'attack'));
    return true;
}

// 投擲武器は（特定の敵を狙わず）向いている方向へまっすぐ投げつけられ、
// 空中を弧を描きながら回転して飛ぶ。
function fireThrownWeapon(weapon, damage) {
    const dir = player.facingRight ? 1 : -1;
    const targetX = player.x + dir * weapon.range;
    const targetY = player.y;

    const proj = new Projectile(player.x, player.y, targetX, targetY, damage, 0, '#c68a3c', true, false, true);
    proj.sourceLabel = `${weapon.name}で`;
    projectiles.push(proj);
    return true;
}

// ブーメランは狙いを定めず、向いている方向へまっすぐ投げつける。射程まで
// 届くと反転し、プレイヤーを通り過ぎて後方へ飛び続け、画面外に出るまで
// 前方・後方どちらの敵も貫通してダメージを与え続ける。
const BOOMERANG_HIT_COOLDOWN = 20; // 同じ敵への連続ヒットを防ぐフレーム間隔

function fireBoomerangWeapon(weapon, damage) {
    const dir = player.facingRight ? 1 : -1;
    const targetX = player.x + dir * weapon.range;
    const targetY = player.y;

    const proj = new Projectile(player.x, player.y, targetX, targetY, damage, 0, '#3ad9c0', false, false, false, false, true);
    proj.sourceLabel = `${weapon.name}で`;
    projectiles.push(proj);
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
        } else if (weaponType.type === 'boomerang') {
            fired = fireBoomerangWeapon(weapon, damage);
        }

        if (fired) weapon.lastFire = frameCount;
    }

    // 弾 - 敵の当たり判定
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.update();

        // プレイヤー周辺の表示範囲外に出たら、または（弧を描く弾の場合）
        // 曲線軌道の終点に達したら削除する。
        if (p.x < cameraX - 50 || p.x > cameraX + canvas.width + 50 ||
            p.y < cameraY - 50 || p.y > cameraY + canvas.height + 50 ||
            (p.arc && p.t >= 1)) {
            projectiles.splice(i, 1);
            continue;
        }

        if (p.piercing) {
            // 貫通する弾（ブーメラン）: 敵に当たっても消えず、同じ敵への
            // 連続ヒットのみクールダウンで防ぐ。障害物とは衝突しない。
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                const dist = Math.hypot(p.x - e.x, p.y - e.y);
                if (dist < p.radius + e.radius) {
                    const lastHit = p.hitEnemies.get(e);
                    if (lastHit === undefined || frameCount - lastHit >= BOOMERANG_HIT_COOLDOWN) {
                        p.hitEnemies.set(e, frameCount);
                        e.hp -= p.damage;
                        effects.push(new Effect(e.x, e.y, 'hit'));
                        addBattleLog(`${p.sourceLabel}${e.name}に${Math.round(p.damage)}のダメージ`);
                        if (e.hp <= 0) {
                            gems.push(new Gem(e.x, e.y, e.xp));
                            enemies.splice(j, 1);
                            addBattleLog(`${p.sourceLabel}${e.name}を倒した！`);
                        }
                    }
                }
            }
            continue;
        }

        let hitSomething = false;

        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            const dist = Math.sqrt((p.x - e.x) ** 2 + (p.y - e.y) ** 2);
            if (dist < p.radius + e.radius) {
                if (p.splashRadius > 0) {
                    // 魔法の範囲ダメージ: 爆発半径内のすべての敵にダメージを与える
                    for (let k = enemies.length - 1; k >= 0; k--) {
                        const e2 = enemies[k];
                        const d2 = Math.hypot(p.x - e2.x, p.y - e2.y);
                        if (d2 <= p.splashRadius) {
                            e2.hp -= p.damage;
                            effects.push(new Effect(e2.x, e2.y, 'hit'));
                            addBattleLog(`${p.sourceLabel}${e2.name}に${Math.round(p.damage)}のダメージ`);
                            if (e2.hp <= 0) {
                                gems.push(new Gem(e2.x, e2.y, e2.xp));
                                enemies.splice(k, 1);
                                addBattleLog(`${p.sourceLabel}${e2.name}を倒した！`);
                            }
                        }
                    }
                } else {
                    e.hp -= p.damage;
                    effects.push(new Effect(e.x, e.y, 'hit'));
                    addBattleLog(`${p.sourceLabel}${e.name}に${Math.round(p.damage)}のダメージ`);
                    if (e.hp <= 0) {
                        gems.push(new Gem(e.x, e.y, e.xp));
                        enemies.splice(j, 1);
                        addBattleLog(`${p.sourceLabel}${e.name}を倒した！`);
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

// 敵がプレイヤーに触れたときの接触ダメージ（およびゲームオーバー処理）を適用する。
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

// 自動戦闘: 有効時に手動操作の代わりに使われるシンプルなAI移動。
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

    // 瀕死かつ敵が近くにいる場合は、まっすぐ逃げる。
    if (nearestEnemy && nearestEnemyDist < AUTO_BATTLE_CHASE_RADIUS &&
        player.hp / player.maxHp < AUTO_BATTLE_FLEE_HP_RATIO) {
        moveTowards(player.x + (player.x - nearestEnemy.x), player.y + (player.y - nearestEnemy.y));
        return;
    }

    // それ以外は武器が届くように最も近い敵との距離を詰める。
    if (nearestEnemy && nearestEnemyDist < AUTO_BATTLE_CHASE_RADIUS) {
        if (nearestEnemyDist > AUTO_BATTLE_STOP_DISTANCE) {
            moveTowards(nearestEnemy.x, nearestEnemy.y);
        } else {
            player.facingRight = nearestEnemy.x > player.x;
        }
        return;
    }

    // 近くに脅威がない場合は、残っている経験値ジェムを拾いに行く。
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

    // プレイヤーを追従するようにカメラを更新する（常に画面中央に保つ）
    cameraX = player.x - canvas.width / 2;
    cameraY = player.y - canvas.height / 2;

    checkStructureInteractions();

    // ジェムの回収
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
    player.xp = 0; // レベルアップ後、経験値を0にリセット
    player.nextXp = Math.floor(player.nextXp * 1.2);
    addBattleLog(`レベルアップ！Lv.${player.level}`);

    // 選択可能なアップグレード（武器・アクセサリー）をまとめたリストを作成する
    const upgradeOptions = [];

    // 所持中でレベルMAXに達した武器は、選んでも何も起きない選択肢に
    // なってしまうため、以降のすべての候補プールから除外する。
    const isWeaponMaxed = weaponTypeEntry => {
        const owned = player.weapons.find(w => w.name === weaponTypeEntry.name);
        return !!owned && owned.level >= owned.maxLevel;
    };

    // このレベルで選択可能な武器を取得する。既に武器数の上限（4つ）に
    // 達している場合は新しい武器種を装備できないため、選んでも何も
    // 起きない選択肢にならないよう、既に所持している武器のみを提示する。
    const atMaxWeapons = player.weapons.length >= 4;
    const availableWeapons = getAvailableWeapons(player.level).filter(w => !isWeaponMaxed(w));
    const weaponOptions = [];

    // まだ所持していない武器を最大2種類選ぶ
    // （武器数上限に達している場合は、既に所持している武器から2種類選ぶ）
    while (weaponOptions.length < 2 && availableWeapons.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableWeapons.length);
        const weapon = availableWeapons[randomIndex];

        if (atMaxWeapons ? hasWeapon(player, weapon.name) : !hasWeapon(player, weapon.name)) {
            weaponOptions.push(weapon);
        }

        // 重複を避けるため、選択済みの武器を除去する
        availableWeapons.splice(randomIndex, 1);
    }

    // 2種類揃わない場合は、既存の武器で埋める（武器数上限に達している場合は
    // 装備できない新規武器を混ぜないよう、既に所持している武器のみに絞る）
    if (weaponOptions.length < 2) {
        const allWeapons = getAvailableWeapons(player.level).filter(w => !isWeaponMaxed(w));
        const candidatePool = atMaxWeapons ? allWeapons.filter(w => hasWeapon(player, w.name)) : allWeapons;
        for (let i = 0; i < 2 - weaponOptions.length; i++) {
            const randomWeapon = candidatePool[Math.floor(Math.random() * candidatePool.length)];
            // randomWeaponのnameにアクセスする前に有効な値か確認する
            if (randomWeapon && !weaponOptions.some(w => w.name === randomWeapon.name)) {
                weaponOptions.push(randomWeapon);
            }
        }
    }

    // 武器をアップグレード選択肢に追加する
    weaponOptions.forEach(weapon => {
        upgradeOptions.push({
            type: 'weapon',
            data: weapon
        });
    });

    // レベルアップモーダルにアクセサリーの選択肢を追加する。アクセサリーは
    // 最大4種類まで所持可能。既に上限に達している場合は新しい種類を提示せず、
    // 既に所持していて最大レベルに達していないものだけをレベルアップとして
    // 提示する（提示するものがなければ、この枠は下の武器での穴埋め処理に回る）。
    const atMaxAccessories = player.accessories.length >= 4;
    const availableAccessories = atMaxAccessories
        ? accessoryTypes.filter(a => {
            const owned = player.accessories.find(o => o.name === a.name);
            return owned && owned.level < a.maxLevel;
        })
        : accessoryTypes.filter(a => !hasAccessory(player, a.name));
    const accessoryOptions = [];

    while (accessoryOptions.length < 1 && availableAccessories.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableAccessories.length);
        accessoryOptions.push(availableAccessories[randomIndex]);
        availableAccessories.splice(randomIndex, 1);
    }

    // アクセサリーをアップグレード選択肢に追加する
    accessoryOptions.forEach(accessory => {
        upgradeOptions.push({
            type: 'accessory',
            data: accessory
        });
    });

    // 選択肢を最大3つに制限する: 武器は常に2つ含まれ、アクセサリーの枠が
    // 加わると合計が4つになることがある。特定のカテゴリーだけが常に
    // 除外されないよう、超過分はランダムに間引く。
    while (upgradeOptions.length > 3) {
        upgradeOptions.splice(Math.floor(Math.random() * upgradeOptions.length), 1);
    }

    // 選択肢がちょうど3つ（武器＋アクセサリー）になるようにする。武器数が
    // 上限に達している場合は、既に所持している武器（レベルアップ用）のみで
    // 穴埋めし、装備できない新しい武器種は絶対に入れない。
    while (upgradeOptions.length < 3) {
        const allWeapons = getAvailableWeapons(player.level).filter(w => !isWeaponMaxed(w));
        const candidatePool = atMaxWeapons ? allWeapons.filter(w => hasWeapon(player, w.name)) : allWeapons;
        // 既に選択肢に入っている武器を除いた、本当に追加できるものだけを候補にする。
        // これをしないと、候補が1つだけかつ既に選択肢に含まれている場合に
        // 何も追加されないまま無限ループしてしまう。
        const newCandidates = candidatePool.filter(w => !upgradeOptions.some(option => option.type === 'weapon' && option.data.name === w.name));
        if (newCandidates.length === 0) break; // 穴埋めに使えるものがもうない

        const randomWeapon = newCandidates[Math.floor(Math.random() * newCandidates.length)];
        upgradeOptions.push({
            type: 'weapon',
            data: randomWeapon
        });
    }

    // 未定義の武器・アクセサリーが紛れ込んでいないか確認する
    for (let i = 0; i < upgradeOptions.length; i++) {
        if (!upgradeOptions[i].data) {
            // 無効な選択肢を除去する
            upgradeOptions.splice(i, 1);
            i--;
        }
    }

    // 自動レベルアップ: モーダルを完全にスキップし、ランダムな選択肢を即座に適用する。
    if (autoLevelUp) {
        // 武器・アクセサリーとも上限＆全レベルMAXなら提示できる選択肢がない
        if (upgradeOptions.length === 0) {
            showToast('レベルアップ！（強化できるものがありません）');
            return;
        }

        const chosen = upgradeOptions[Math.floor(Math.random() * upgradeOptions.length)];
        if (chosen.type === 'weapon') {
            addWeaponToPlayer(player, chosen.data.name);
        } else {
            addAccessoryToPlayer(player, chosen.data.name);
        }
        showToast(`レベルアップ（自動選択）: ${chosen.data.name}`);
        return;
    }

    isPaused = true;

    // モーダルに武器・アクセサリーの選択肢を反映する
    const modal = document.getElementById('level-up-modal');
    const upgradeIcon = data => data.img
        ? `<img src="${data.img}" alt="${data.name}" style="width: 28px; height: 28px; vertical-align: middle; margin-right: 6px;">`
        : '';
    let modalContent = `
        <h2>レベルアップ！選択してください：</h2>
        ${upgradeOptions.map((option) => {
            if (option.type === 'weapon') {
                return `<button class="upgrade-btn" onclick="selectWeapon('${option.data.name}')">${upgradeIcon(option.data)}${option.data.name} - ${option.data.description}</button>`;
            } else {
                return `<button class="upgrade-btn" onclick="selectAccessory('${option.data.name}')">${upgradeIcon(option.data)}${option.data.name} - ${option.data.description}</button>`;
            }
        }).join('')}
        <br><br>
        <button class="upgrade-btn" onclick="skipLevelUp()">スキップする</button>
    `;

    modal.innerHTML = modalContent;
    modal.style.display = 'flex';

    enableModalKeyboardNav('level-up-modal');
}

// レベルアップの選択をスキップする関数
function skipLevelUp() {
    isPaused = false;
    document.getElementById('level-up-modal').style.display = 'none';
    requestAnimationFrame(gameLoop);
}

function selectWeapon(weaponName) {
    // 選択した武器をプレイヤーの所持リストに追加する
    addWeaponToPlayer(player, weaponName);

    // モーダルを閉じる
    document.getElementById('level-up-modal').style.display = 'none';

    // ゲームを再開する
    isPaused = false;
    requestAnimationFrame(gameLoop);
}

function selectAccessory(accessoryName) {
    // 選択したアクセサリーをプレイヤーの所持リストに追加し、その効果を適用する
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

// 画面下部に表示する、スクロール可能な永続的な戦闘ログ。
const BATTLE_LOG_MAX_LINES = 500; // セッション全体がスクロールし続けられるよう余裕を持たせた上限（無限増加は防ぐ）
const battleLog = [];

function addBattleLog(message) {
    battleLog.push(message);
    if (battleLog.length > BATTLE_LOG_MAX_LINES) {
        battleLog.shift();
    }

    const logElement = document.getElementById('battle-log');
    if (logElement) {
        const wasScrolledToBottom = logElement.scrollHeight - logElement.scrollTop <= logElement.clientHeight + 4;
        logElement.innerHTML = battleLog.map(line => `<div>${line}</div>`).join('');
        // プレイヤーが履歴を読むために上へスクロールしていない場合のみ、最新行へ自動スクロールする。
        if (wasScrolledToBottom) {
            logElement.scrollTop = logElement.scrollHeight;
        }
    }
}

// デバッグパネルの内容を構築する（無敵切替時などに再構築もされる）。
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
    enableModalKeyboardNav('debug-menu'); // 再構築されたボタンは新しいDOMノードになるため
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

// プレイヤーが村を訪れたときに、3つの職業から選ぶ勧誘選択肢を表示する。
function openNpcSelectModal() {
    const jobChoices = [];
    const pool = [...npcJobTypes];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        jobChoices.push(pool[randomIndex]);
        pool.splice(randomIndex, 1);
    }

    // 自動レベルアップは村の勧誘にも適用される: モーダルをスキップしランダムに選ぶ。
    if (autoLevelUp) {
        const chosen = jobChoices[Math.floor(Math.random() * jobChoices.length)];
        player.npcs.push(createNpc(chosen.id, player.x, player.y));
        showToast(`村人（自動選択）: ${chosen.name}を仲間にした`);
        return;
    }

    isPaused = true;

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

    // 武器表示: アイコンのみ（名前／レベルはホバー時のツールチップで確認可能）
    const weaponInfoElement = document.getElementById('weapon-info');
    if (weaponInfoElement) {
        weaponInfoElement.innerHTML = player.weapons.map(weapon => {
            const weaponType = getWeaponByName(weapon.name);
            const title = `${weapon.name} Lv.${weapon.level}`;
            if (weaponType && weaponType.img) {
                return `<span class="icon-badge" title="${title}">
                    <img src="${weaponType.img}" alt="${weapon.name}">
                    <span class="icon-badge-level">${weapon.level}</span>
                </span>`;
            }
            return '';
        }).join('');
    }

    // ステータスボーナスをパーセンテージで表示する。100%が未強化の基準値。
    const statBonusElement = document.getElementById('stat-bonus-info');
    if (statBonusElement) {
        statBonusElement.innerHTML = `
            <div>攻撃力: ${100 + player.bonusDamage}%</div>
            <div>移動速度: ${100 + player.bonusSpeed}%</div>
            <div>攻撃速度: ${100 + player.bonusFireRate}%</div>
            <div>最大HP: ${Math.round(player.maxHp)}</div>
            <div>防御力: ${100 + player.bonusDefense}%</div>
            <div>収集範囲: ${100 + player.bonusPickupRange}%</div>
        `;
    }

    // アクセサリー表示: アイコンのみ（名前／レベルはホバー時のツールチップで確認可能）
    const accessoryInfoElement = document.getElementById('accessory-info');
    if (accessoryInfoElement) {
        accessoryInfoElement.innerHTML = player.accessories.map(accessory => {
            const accessoryType = getAccessoryByName(accessory.name);
            const title = `${accessory.name} Lv.${accessory.level}`;
            if (accessoryType && accessoryType.img) {
                return `<span class="icon-badge" title="${title}">
                    <img src="${accessoryType.img}" alt="${accessory.name}">
                    <span class="icon-badge-level">${accessory.level}</span>
                </span>`;
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
        if (gameSpeed !== 1) parts.push(`ゲームスピード: ${gameSpeed}倍 (+/-)`);
        autoBattleInfoElement.innerText = parts.join(' / ');
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    document.getElementById('time-val').innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
}


function drawBackground() {
    // カメラ周辺の現在表示されているタイルのみを生成するため、プレイヤーが
    // どれだけ遠くまで移動してもフィールドが尽きることはない。
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

    // ゲームスピードが1倍より速ければ1回の描画で複数回、遅ければ数回に
    // 1回だけゲームを進行させる（0.5倍刻みの端数はここで積み立てて処理する）。
    speedAccumulator += gameSpeed;
    while (speedAccumulator >= 1) {
        stepGame();
        speedAccumulator -= 1;
        if (isPaused || isGameOver) return;
    }

    requestAnimationFrame(gameLoop);
}

function stepGame() {
    // 10フレームごとにプレイヤー画像を切り替えてアニメーションさせる
    if (frameCount % 10 === 0) {
        currentPlayerImg = currentPlayerImg === playerImg1 ? playerImg2 : playerImg1;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // まず背景を描画する
    drawBackground();

    updatePlayer();
    handleCombat();
    updateStructures();
    updateObstacleSpawns();

    // カメラオフセットを適用して村・要塞を更新・描画する
    villages.forEach(v => drawVillage(v));
    fortresses.forEach(f => drawFortress(f));

    // カメラオフセットを適用して破壊可能オブジェクトを描画する
    obstacles.forEach(o => drawObstacle(o));

    // エフェクトを更新・描画する
    for (let i = effects.length - 1; i >= 0; i--) {
        effects[i].update();
        effects[i].draw();
        if (effects[i].life <= 0) {
            effects.splice(i, 1);
        }
    }

    // カメラオフセットを適用してジェムを描画する
    gems.forEach(g => g.draw());


    // カメラオフセットを適用して敵を更新・描画する
    enemies.forEach(e => {
        e.update();
        e.draw();
    });

    // NPC仲間を更新・描画し、倒れた者は除去する
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


    // カメラオフセットを適用して弾を描画する
    projectiles.forEach(p => p.draw());

    // 敵の遠距離攻撃を更新・描画する
    updateEnemyBullets();
    enemyBullets.forEach(b => b.draw());

    // 敵を出現させる
    if (frameCount % 100 === 0) { // 100フレームごとに敵を1体出現させる
        spawnEnemy();
    }

// プレイヤーを画面中央に描画する（カメラは常にプレイヤーが中央になるよう調整されている）
    ctx.save();

    ctx.translate(canvas.width / 2, canvas.height / 2); // 常に画面中央にプレイヤーを描画する
    if (!player.facingRight) {
        ctx.scale(-1, 1);
    }
    ctx.drawImage(currentPlayerImg, -player.radius, -player.radius, player.radius * 2, player.radius * 2);

    ctx.restore();

    // プレイヤーが左を向いてもスプライトと一緒に反転しないよう、HPバーは
    // 別の（ミラーしていない）変換の中でプレイヤーの上に描画する。
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);

    const barWidth = player.radius * 2;
    const barHeight = 4;
    const barX = -barWidth / 2;
    const barY = -player.radius - 10;

    // HPバーの背景
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // HP残量部分のバー
    const hpRatio = player.hp / player.maxHp;
    ctx.fillStyle = hpRatio > 0.5 ? '#0f0' : hpRatio > 0.25 ? '#ff0' : '#f00';
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

    ctx.restore();

    updateUI();
    frameCount++;
}

gameLoop();

// リサイズ処理
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// 敵タイプの定義から、指定したワールド座標に敵オブジェクト
// （update/drawメソッド込み）を生成する。通常のスポーンと要塞の
// モンスターハウスイベントの両方で共用する。
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
        xp: selectedType.xp,
        name: selectedType.name,
        img: null, // 下で読み込まれる
        facingRight: true, // 画像反転のための向きを記録する

        // 遠距離攻撃のステータス（attackTypeが'ranged'の敵にのみ設定される）
        attackType: selectedType.attackType || 'melee',
        rangedDamage: selectedType.rangedDamage,
        rangedCooldown: selectedType.rangedCooldown,
        rangedRange: selectedType.rangedRange,
        projectileSpeed: selectedType.projectileSpeed,
        projectileRadius: selectedType.projectileRadius,
        projectileColor: selectedType.projectileColor,
        lastRangedAttack: frameCount,

        update() {
            // プレイヤーに向かって移動する
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
                this.x += (dx / dist) * this.speed;
                this.y += (dy / dist) * this.speed;

                // 移動方向に応じて向きを更新する。dxが0付近で揺れ動く場合
                // （例: 複数の敵が同じ目標に重なっている場合）に画像が
                // ちらつかないよう、不感帯を設ける。
                const FACING_DEADZONE = 5;
                if (dx > FACING_DEADZONE) {
                    this.facingRight = true;
                } else if (dx < -FACING_DEADZONE) {
                    this.facingRight = false;
                }
            }

            if (this.attackType === 'ranged' && dist <= this.rangedRange &&
                frameCount - this.lastRangedAttack >= this.rangedCooldown) {
                enemyBullets.push(new EnemyProjectile(
                    this.x, this.y, player.x, player.y,
                    this.rangedDamage, this.projectileSpeed, this.projectileRadius,
                    this.projectileColor, this.name
                ));
                effects.push(new Effect(this.x, this.y, 'attack'));
                this.lastRangedAttack = frameCount;
            }
        },

        draw() {
            // 画像が利用可能で読み込み済みならそれを描画し、そうでなければ円で代用する
            if (this.img && this.img.complete && this.img.naturalWidth !== 0) {
                // 向きに応じて画像を反転する
                ctx.save();
                if (!this.facingRight) {
                    ctx.scale(-1, 1);
                    ctx.drawImage(this.img, -(this.x - cameraX + this.radius), this.y - cameraY - this.radius, this.radius * 2, this.radius * 2);
                } else {
                    ctx.drawImage(this.img, this.x - cameraX - this.radius, this.y - cameraY - this.radius, this.radius * 2, this.radius * 2);
                }
                ctx.restore();
            } else {
                // 色付きの円で代用する
                ctx.beginPath();
                ctx.arc(this.x - cameraX, this.y - cameraY, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
                ctx.closePath();
            }

            // 敵の上にHPバーを描画する
            const barWidth = this.radius * 2;
            const barHeight = 4;
            const barX = this.x - cameraX - barWidth / 2;
            const barY = this.y - cameraY - this.radius - 10;

            // HPバーの背景
            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // HP残量部分のバー
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

// 敵を出現させる関数
function spawnEnemy() {
    // プレイヤーレベルに応じて出現可能な敵タイプを取得する
    const availableTypes = getAvailableEnemyTypes(player.level);
    const selectedType = availableTypes[Math.floor(Math.random() * availableTypes.length)];

    // 表示範囲のすぐ外側、ワールド（カメラ基準）座標に出現させる
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
