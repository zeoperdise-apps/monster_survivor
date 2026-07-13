// 挙動の異なる敵タイプの定義。各敵は自身の[minLevel, maxLevel]という
// プレイヤーレベル範囲内でのみ出現する（maxLevel省略時は上限なし）。
// 序盤の弱い敵は高レベルになると出現しなくなり、終盤の強敵は一度解放
// されるとずっと出現し続ける。
// hp・damageはともに解放順（minLevelの昇順）に沿って、ゴブリンを基準値・
// ドラゴンを最大値とした指数的カーブでなだらかに増加する（一律倍率では
// ないため、旧hpと旧damageの比率が敵ごとにばらばらになる問題を解消）。
// xpはそのhp+damageの合計に比例させており、強い敵ほど多くの経験値を
// 得られる。
const enemyTypes = [
    {
        color: '#f44',
        speed: 1,
        hp: 30,
        size: 30,
        damage: 5,
        xp: 10,
        img: 'img/Goblin.png',
        name: "ゴブリン",
        minLevel: 1,
        maxLevel: 10
    },
    {
        color: '#4f4',
        speed: 0.8,
        hp: 56,
        size: 45,
        damage: 9,
        xp: 19,
        img: 'img/Ogre.png',
        name: "オーガ",
        minLevel: 5,
        maxLevel: 14
    },
    {
        color: '#44f',
        speed: 1.5,
        hp: 41,
        size: 27,
        damage: 7,
        xp: 14,
        img: 'img/Skeleton.png',
        name: "スケルトン",
        minLevel: 3,
        maxLevel: 11
    },
    {
        color: '#ff4',
        speed: 0.6,
        hp: 77,
        size: 54,
        damage: 11,
        xp: 25,
        img: 'img/Troll.png',
        name: "トロール",
        minLevel: 6,
        maxLevel: 15
    },
    {
        color: '#f4f',
        speed: 1.2,
        hp: 105,
        size: 21,
        damage: 15,
        xp: 34,
        img: 'img/Ghost.png',
        name: "ゴースト",
        minLevel: 7,
        maxLevel: 16
    },
    {
        color: '#4ff',
        speed: 0.9,
        hp: 143,
        size: 27,
        damage: 20,
        xp: 47,
        img: 'img/Wizard.png',
        name: "ウィザード",
        minLevel: 8,
        maxLevel: 18,
        attackType: 'ranged',
        rangedDamage: 12,
        rangedCooldown: 90,
        rangedRange: 400,
        projectileSpeed: 5,
        projectileRadius: 6,
        projectileColor: '#0ff'
    },
    {
        color: '#f84',
        speed: 1.3,
        hp: 196,
        size: 36,
        damage: 26,
        xp: 63,
        img: 'img/Demon.png',
        name: "デーモン",
        minLevel: 10
    },
    {
        color: '#8f4',
        speed: 0.7,
        hp: 268,
        size: 66,
        damage: 34,
        xp: 86,
        img: 'img/Giant.png',
        name: "ジャイアント",
        minLevel: 12
    },
    {
        color: '#48f',
        speed: 1.1,
        hp: 366,
        size: 21,
        damage: 45,
        xp: 117,
        img: 'img/Shade.png',
        name: "シェード",
        minLevel: 15
    },
    {
        color: '#f48',
        speed: 0.5,
        hp: 500,
        size: 81,
        damage: 60,
        xp: 160,
        img: 'img/Dragon.png',
        name: "ドラゴン",
        minLevel: 18,
        attackType: 'ranged',
        rangedDamage: 25,
        rangedCooldown: 120,
        rangedRange: 500,
        projectileSpeed: 6,
        projectileRadius: 14,
        projectileColor: '#f60'
    }
];

// プレイヤーレベルに応じて出現可能な敵タイプ一覧を取得する
function getAvailableEnemyTypes(playerLevel) {
    const available = enemyTypes.filter(type => {
        const max = type.maxLevel === undefined ? Infinity : type.maxLevel;
        return playerLevel >= type.minLevel && playerLevel <= max;
    });

    // 安全策: 出現範囲の設定ミスなどで空にならないようにする
    return available.length > 0 ? available : [enemyTypes[0]];
}
