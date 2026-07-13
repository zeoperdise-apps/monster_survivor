// Enemy type definitions with different behaviors
const enemyTypes = [
    {
        color: '#f44',
        speed: 1,
        hp: 30,
        size: 30,
        damage: 5,
        img: 'img/Goblin.png',
        name: "ゴブリン"
    },
    {
        color: '#4f4',
        speed: 0.8,
        hp: 45,
        size: 45,
        damage: 8,
        img: 'img/Ogre.png',
        name: "オーガ"
    },
    {
        color: '#44f',
        speed: 1.5,
        hp: 24,
        size: 27,
        damage: 6,
        img: 'img/Skeleton.png',
        name: "スケルトン"
    },
    {
        color: '#ff4',
        speed: 0.6,
        hp: 60,
        size: 54,
        damage: 10,
        img: 'img/Troll.png',
        name: "トロール"
    },
    {
        color: '#f4f',
        speed: 1.2,
        hp: 18,
        size: 21,
        damage: 4,
        img: 'img/Ghost.png',
        name: "ゴースト"
    },
    {
        color: '#4ff',
        speed: 0.9,
        hp: 36,
        size: 27,
        damage: 7,
        img: 'img/Wizard.png',
        name: "ウィザード"
    },
    {
        color: '#f84',
        speed: 1.3,
        hp: 27,
        size: 36,
        damage: 9,
        img: 'img/Demon.png',
        name: "デーモン"
    },
    {
        color: '#8f4',
        speed: 0.7,
        hp: 54,
        size: 66,
        damage: 14,
        img: 'img/Giant.png',
        name: "ジャイアント"
    },
    {
        color: '#48f',
        speed: 1.1,
        hp: 21,
        size: 21,
        damage: 6,
        img: 'img/Shade.png',
        name: "シェード"
    },
    {
        color: '#f48',
        speed: 0.5,
        hp: 75,
        size: 81,
        damage: 20,
        img: 'img/Dragon.png',
        name: "ドラゴン"
    }
];

// Each enemy appears only within its [min, max] player-level range. Weaker
// early enemies phase out at higher levels; late-game threats (no max) stay
// in the pool forever once unlocked.
const ENEMY_LEVEL_RANGES = {
    "ゴブリン": [1, 10],
    "スケルトン": [3, 11],
    "オーガ": [5, 14],
    "トロール": [6, 15],
    "ゴースト": [7, 16],
    "ウィザード": [8, 18],
    "デーモン": [10, Infinity],
    "ジャイアント": [12, Infinity],
    "シェード": [15, Infinity],
    "ドラゴン": [18, Infinity]
};

// Function to get available enemy types based on player level
function getAvailableEnemyTypes(playerLevel) {
    const available = enemyTypes.filter(type => {
        const range = ENEMY_LEVEL_RANGES[type.name];
        if (!range) return true;
        const [min, max] = range;
        return playerLevel >= min && playerLevel <= max;
    });

    // Safety net: never return an empty pool (e.g. if ranges were misconfigured).
    return available.length > 0 ? available : [enemyTypes[0]];
}
