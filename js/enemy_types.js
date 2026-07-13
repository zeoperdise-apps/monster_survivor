// Enemy type definitions with different behaviors. Each enemy only appears
// within its own [minLevel, maxLevel] player-level range (maxLevel omitted
// means "no upper bound"). Weaker early enemies phase out at higher levels;
// late-game threats stay in the pool forever once unlocked.
const enemyTypes = [
    {
        color: '#f44',
        speed: 1,
        hp: 30,
        size: 30,
        damage: 5,
        img: 'img/Goblin.png',
        name: "ゴブリン",
        minLevel: 1,
        maxLevel: 10
    },
    {
        color: '#4f4',
        speed: 0.8,
        hp: 45,
        size: 45,
        damage: 8,
        img: 'img/Ogre.png',
        name: "オーガ",
        minLevel: 5,
        maxLevel: 14
    },
    {
        color: '#44f',
        speed: 1.5,
        hp: 24,
        size: 27,
        damage: 6,
        img: 'img/Skeleton.png',
        name: "スケルトン",
        minLevel: 3,
        maxLevel: 11
    },
    {
        color: '#ff4',
        speed: 0.6,
        hp: 60,
        size: 54,
        damage: 10,
        img: 'img/Troll.png',
        name: "トロール",
        minLevel: 6,
        maxLevel: 15
    },
    {
        color: '#f4f',
        speed: 1.2,
        hp: 18,
        size: 21,
        damage: 4,
        img: 'img/Ghost.png',
        name: "ゴースト",
        minLevel: 7,
        maxLevel: 16
    },
    {
        color: '#4ff',
        speed: 0.9,
        hp: 36,
        size: 27,
        damage: 7,
        img: 'img/Wizard.png',
        name: "ウィザード",
        minLevel: 8,
        maxLevel: 18
    },
    {
        color: '#f84',
        speed: 1.3,
        hp: 27,
        size: 36,
        damage: 9,
        img: 'img/Demon.png',
        name: "デーモン",
        minLevel: 10
    },
    {
        color: '#8f4',
        speed: 0.7,
        hp: 54,
        size: 66,
        damage: 14,
        img: 'img/Giant.png',
        name: "ジャイアント",
        minLevel: 12
    },
    {
        color: '#48f',
        speed: 1.1,
        hp: 21,
        size: 21,
        damage: 6,
        img: 'img/Shade.png',
        name: "シェード",
        minLevel: 15
    },
    {
        color: '#f48',
        speed: 0.5,
        hp: 75,
        size: 81,
        damage: 20,
        img: 'img/Dragon.png',
        name: "ドラゴン",
        minLevel: 18
    }
];

// Function to get available enemy types based on player level
function getAvailableEnemyTypes(playerLevel) {
    const available = enemyTypes.filter(type => {
        const max = type.maxLevel === undefined ? Infinity : type.maxLevel;
        return playerLevel >= type.minLevel && playerLevel <= max;
    });

    // Safety net: never return an empty pool (e.g. if ranges were misconfigured).
    return available.length > 0 ? available : [enemyTypes[0]];
}
