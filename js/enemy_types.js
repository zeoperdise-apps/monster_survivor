// 挙動の異なる敵タイプの定義。各敵は自身の[minLevel, maxLevel]という
// プレイヤーレベル範囲内でのみ出現する（maxLevel省略時は上限なし）。
// 序盤の弱い敵は高レベルになると出現しなくなり、終盤の強敵は一度解放
// されるとずっと出現し続ける。xpは各敵の総合的な強さ（hp+damage）に
// 応じてスケールしており、強い敵ほど多くの経験値を得られる。
// hpは解放順に沿ってゴブリン（30）からドラゴン（500）まで、旧値への
// 一律倍率ではなく、なだらかに（ほぼ指数的に）増加するようにしている。
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
        damage: 24,
        xp: 23,
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
        damage: 18,
        xp: 15,
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
        damage: 30,
        xp: 30,
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
        damage: 12,
        xp: 11,
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
        damage: 21,
        xp: 20,
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
        damage: 27,
        xp: 20,
        img: 'img/Demon.png',
        name: "デーモン",
        minLevel: 10
    },
    {
        color: '#8f4',
        speed: 0.7,
        hp: 268,
        size: 66,
        damage: 42,
        xp: 35,
        img: 'img/Giant.png',
        name: "ジャイアント",
        minLevel: 12
    },
    {
        color: '#48f',
        speed: 1.1,
        hp: 366,
        size: 21,
        damage: 18,
        xp: 14,
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
        xp: 50,
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
