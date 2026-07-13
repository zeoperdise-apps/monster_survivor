// 攻撃タイプとレベルが異なる武器の定義
const weaponTypes = [
    {
        name: "鞭",
        type: "melee",
        damage: 15,
        cooldown: 30,
        range: 135,
        maxLevel: 8,
        img: "img/whip.png",
        description: "シンプルな鞭攻撃",
        hitSpread: Math.PI * 2 / 3 // 120度: 横に広く薙ぎ払うが全周は殴れない
    },
    {
        name: "剣",
        type: "melee",
        damage: 25,
        cooldown: 60,
        range: 100,
        maxLevel: 8,
        img: "img/sword.png",
        description: "鋭い剣の斬撃",
        effect: "slash",
        effectDuration: 10,
        hitSpread: Math.PI / 2 // 90度: 斬撃エフェクトと同じ扇形
    },
    {
        name: "弓",
        type: "ranged",
        damage: 24,
        cooldown: 90,
        range: 300,
        maxLevel: 8,
        img: "img/bow.png",
        description: "弧を描いて飛ぶ矢の射撃",
        arc: true,
        projectileShape: "arrow"
    },
    {
        name: "杖",
        type: "magic",
        damage: 20,
        cooldown: 120,
        range: 150,
        maxLevel: 8,
        img: "img/staff.png",
        description: "画面内の最も近い敵へ距離を問わずブラストを放つ",
        effect: "blast",
        unlimitedRange: true
    },
    {
        name: "斧",
        type: "thrown",
        damage: 34,
        cooldown: 100,
        range: 200,
        maxLevel: 8,
        img: "img/axe.png",
        description: "弧を描きながら進行方向に投げつける"
    },
    {
        name: "槍",
        type: "melee",
        damage: 28,
        cooldown: 70,
        range: 150,
        maxLevel: 8,
        img: "img/spear.png",
        description: "向いている方向への突き攻撃",
        effect: "thrust",
        hitSpread: Math.PI / 4 // 45度: まっすぐ突く攻撃なので狭い範囲のみ
    },
    {
        name: "ブーメラン",
        type: "boomerang",
        damage: 18,
        cooldown: 85,
        range: 220,
        maxLevel: 8,
        img: "img/boomerang.png",
        description: "前方の敵を貫通して飛び、帰りに後方の敵も攻撃する。画面外に出るまで飛び続ける"
    }
];

// プレイヤーの初期武器
function initPlayerWeapons() {
    return [
        {
            name: '剣',
            damage: 25,
            cooldown: 60,
            lastFire: 0,
            range: 100,
            level: 1,
            maxLevel: 8
        }
    ];
}

// プレイヤーレベルに応じて選択可能な武器一覧を取得する
function getAvailableWeapons(playerLevel) {
    // 現状は最初から全武器が選択可能。呼び出し元がこの配列をsplice()して
    // ランダム選択を作るため、コピーを返し、共有元のweaponTypesを
    // 直接変更しないようにする。
    return weaponTypes.slice();
}

// プレイヤーが既にその武器を所持しているか確認する
function hasWeapon(player, weaponName) {
    return player.weapons.some(weapon => weapon.name === weaponName);
}

// プレイヤーの所持武器に新しい武器を追加する
function addWeaponToPlayer(player, weaponName) {
    // 既に所持している場合はレベルアップ扱いにする
    if (hasWeapon(player, weaponName)) {
        const weapon = player.weapons.find(w => w.name === weaponName);
        if (weapon.level < weapon.maxLevel) {
            weapon.level++;
            // レベルに応じてステータスを強化
            const baseWeapon = weaponTypes.find(w => w.name === weaponName);
            if (baseWeapon) {
                weapon.damage = Math.floor(baseWeapon.damage * (1 + (weapon.level - 1) * 0.2));
                weapon.cooldown = Math.max(10, Math.floor(baseWeapon.cooldown * (1 - (weapon.level - 1) * 0.1)));
            }
        }
        return false; // 既に所持していたのでレベルアップとして処理した
    }

    // 所持武器が上限に達しているか確認
    if (player.weapons.length >= 4) {
        return false; // 武器数の上限に達している
    }

    // 新しい武器を追加
    const baseWeapon = weaponTypes.find(w => w.name === weaponName);
    if (baseWeapon) {
        const newWeapon = {
            name: baseWeapon.name,
            damage: baseWeapon.damage,
            cooldown: baseWeapon.cooldown,
            lastFire: 0,
            range: baseWeapon.range,
            level: 1,
            maxLevel: baseWeapon.maxLevel
        };
        player.weapons.push(newWeapon);
        return true;
    }

    return false;
}

// 名前から武器の定義データを取得する
function getWeaponByName(weaponName) {
    return weaponTypes.find(w => w.name === weaponName);
}
