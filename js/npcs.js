// NPC companion job definitions. Each job has its own attack style, reusing
// the same melee/ranged/heal patterns the player's weapons use.
const npcJobTypes = [
    {
        id: 'warrior',
        name: '戦士',
        description: '近接攻撃で戦う仲間',
        attackType: 'melee',
        damage: 12,
        cooldown: 45,
        range: 90,
        hp: 60,
        speed: 2.6,
        img: 'img/npc_warrior.png'
    },
    {
        id: 'monk',
        name: '僧侶',
        description: '拳による近接攻撃で戦う仲間',
        attackType: 'melee',
        damage: 10,
        cooldown: 35,
        range: 70,
        hp: 70,
        speed: 2.4,
        img: 'img/npc_monk.png'
    },
    {
        id: 'mage',
        name: '魔導士',
        description: '魔法の弾を放つ仲間',
        attackType: 'ranged',
        damage: 14,
        cooldown: 55,
        range: 200,
        hp: 40,
        speed: 2.2,
        img: 'img/npc_mage.png'
    },
    {
        id: 'priest',
        name: '司祭',
        description: '味方を回復する仲間',
        attackType: 'heal',
        healAmount: 15,
        cooldown: 90,
        range: 180,
        hp: 45,
        speed: 2.2,
        img: 'img/npc_priest.png'
    },
    {
        id: 'merchant',
        name: '商人',
        description: 'そろばんで殴りかかる仲間',
        attackType: 'melee',
        damage: 16,
        cooldown: 50,
        range: 80,
        hp: 55,
        speed: 2.3,
        img: 'img/npc_merchant.png'
    },
    {
        id: 'thief',
        name: '盗賊',
        description: 'ナイフを投げる仲間',
        attackType: 'ranged',
        damage: 10,
        cooldown: 30,
        range: 160,
        hp: 35,
        speed: 3.0,
        img: 'img/npc_thief.png'
    },
    {
        id: 'gadabout',
        name: '風来坊',
        description: '他の職業の行動をランダムに行う仲間',
        attackType: 'random',
        damage: 12,
        cooldown: 45,
        range: 120,
        hp: 50,
        speed: 2.6,
        img: 'img/npc_gadabout.png'
    }
];

function getNpcJobById(id) {
    return npcJobTypes.find(j => j.id === id);
}

function createNpc(jobId, x, y) {
    const job = getNpcJobById(jobId) || npcJobTypes[0];
    const npc = {
        job: job.id,
        name: job.name,
        x: x,
        y: y,
        radius: 20,
        hp: job.hp,
        maxHp: job.hp,
        lastFire: 0,
        invulnerableUntil: 0,
        facingRight: true,
        img: null
    };
    if (job.img) {
        npc.img = new Image();
        npc.img.src = job.img;
    }
    return npc;
}

// Moves an NPC: chase the nearest enemy in range, otherwise stay near the player.
function updateNpcMovement(npc) {
    const job = getNpcJobById(npc.job);
    let target = null;
    let targetDist = 400; // chase radius

    for (const e of enemies) {
        const dist = Math.hypot(e.x - npc.x, e.y - npc.y);
        if (dist < targetDist) {
            target = e;
            targetDist = dist;
        }
    }

    if (target && targetDist > job.range * 0.8) {
        const dx = target.x - npc.x;
        const dy = target.y - npc.y;
        const dist = Math.hypot(dx, dy) || 1;
        npc.x += (dx / dist) * npc.speed;
        npc.y += (dy / dist) * npc.speed;
        npc.facingRight = dx > 0;
    } else if (!target) {
        const dx = player.x - npc.x;
        const dy = player.y - npc.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist > 80) {
            npc.x += (dx / dist) * npc.speed;
            npc.y += (dy / dist) * npc.speed;
            npc.facingRight = dx > 0;
        }
    }

    return target;
}

// Runs one NPC's job-specific attack. Returns true if it actually acted
// (so the caller only resets the attack cooldown on a real action).
function performNpcAttack(npc, target) {
    const job = getNpcJobById(npc.job);
    let attackType = job.attackType;
    if (attackType === 'random') {
        attackType = ['melee', 'ranged', 'heal'][Math.floor(Math.random() * 3)];
    }

    if (attackType === 'heal') {
        let lowest = null;
        let lowestRatio = 1;
        if (player.hp < player.maxHp) {
            lowest = player;
            lowestRatio = player.hp / player.maxHp;
        }
        for (const other of player.npcs) {
            if (other === npc || other.hp >= other.maxHp) continue;
            const dist = Math.hypot(other.x - npc.x, other.y - npc.y);
            const ratio = other.hp / other.maxHp;
            if (dist <= job.range && ratio < lowestRatio) {
                lowest = other;
                lowestRatio = ratio;
            }
        }
        if (!lowest) return false;
        lowest.hp = Math.min(lowest.maxHp, lowest.hp + job.healAmount);
        effects.push(new Effect(lowest.x, lowest.y, 'attack'));
        return true;
    }

    if (!target) return false;
    const dist = Math.hypot(target.x - npc.x, target.y - npc.y);
    if (dist > job.range) return false;

    if (attackType === 'melee') {
        target.hp -= job.damage;
        effects.push(new Effect(target.x, target.y, 'hit'));
        if (target.hp <= 0) {
            gems.push(new Gem(target.x, target.y));
            const idx = enemies.indexOf(target);
            if (idx !== -1) enemies.splice(idx, 1);
            addBattleLog(`${npc.name}が${target.name}を倒した！`);
        }
        return true;
    }

    if (attackType === 'ranged') {
        projectiles.push(new Projectile(npc.x, npc.y, target.x, target.y, job.damage, 0, '#0ff'));
        return true;
    }

    return false;
}

function updateNpc(npc) {
    const target = updateNpcMovement(npc);
    const job = getNpcJobById(npc.job);

    if (frameCount - npc.lastFire >= job.cooldown) {
        if (performNpcAttack(npc, target)) {
            npc.lastFire = frameCount;
        }
    }

    // Contact damage from touching enemies (mirrors handlePlayerDamage)
    if (frameCount >= npc.invulnerableUntil) {
        for (const e of enemies) {
            const dist = Math.hypot(npc.x - e.x, npc.y - e.y);
            if (dist < npc.radius + e.radius) {
                npc.hp -= ENEMY_CONTACT_DAMAGE;
                npc.invulnerableUntil = frameCount + INVULNERABILITY_FRAMES;
                effects.push(new Effect(npc.x, npc.y, 'hit'));
                break;
            }
        }
    }
}

function drawNpc(npc) {
    if (npc.img && npc.img.complete && npc.img.naturalWidth !== 0) {
        ctx.save();
        if (!npc.facingRight) {
            ctx.scale(-1, 1);
            ctx.drawImage(npc.img, -(npc.x - cameraX + npc.radius), npc.y - cameraY - npc.radius, npc.radius * 2, npc.radius * 2);
        } else {
            ctx.drawImage(npc.img, npc.x - cameraX - npc.radius, npc.y - cameraY - npc.radius, npc.radius * 2, npc.radius * 2);
        }
        ctx.restore();
    } else {
        ctx.beginPath();
        ctx.arc(npc.x - cameraX, npc.y - cameraY, npc.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#6cf';
        ctx.fill();
        ctx.closePath();
    }

    const barWidth = npc.radius * 2;
    const barHeight = 4;
    const barX = npc.x - cameraX - barWidth / 2;
    const barY = npc.y - cameraY - npc.radius - 10;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    const hpRatio = Math.max(0, npc.hp / npc.maxHp);
    ctx.fillStyle = hpRatio > 0.5 ? '#0f0' : hpRatio > 0.25 ? '#ff0' : '#f00';
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
}
