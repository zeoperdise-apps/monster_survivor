// Enemy type definitions with different behaviors
const enemyTypes = [
    { 
        color: '#f44', 
        speed: 1, 
        hp: 30,
        size: 30,
        img: 'img/Goblin.png',
        name: "ゴブリン"
    },
    { 
        color: '#4f4', 
        speed: 0.8, 
        hp: 45,
        size: 36,
        img: 'img/Ogre.png',
        name: "オーガ"
    },
    { 
        color: '#44f', 
        speed: 1.5, 
        hp: 24,
        size: 24,
        img: 'img/Skeleton.png',
        name: "スケルトン"
    },
    { 
        color: '#ff4', 
        speed: 0.6, 
        hp: 60,
        size: 44,
        img: 'img/Troll.png',
        name: "トロール"
    },
    { 
        color: '#f4f', 
        speed: 1.2, 
        hp: 18,
        size: 10,
        img: 'img/Ghost.png',
        name: "ゴースト"
    },
    { 
        color: '#4ff', 
        speed: 0.9, 
        hp: 36,
        size: 16,
        img: 'img/Wizard.png',
        name: "ウィザード"
    },
    { 
        color: '#f84', 
        speed: 1.3, 
        hp: 27,
        size: 13,
        img: 'img/Demon.png',
        name: "デーモン"
    },
    { 
        color: '#8f4', 
        speed: 0.7, 
        hp: 54,
        size: 19,
        img: 'img/Giant.png',
        name: "ジャイアント"
    },
    { 
        color: '#48f', 
        speed: 1.1, 
        hp: 21,
        size: 9,
        img: 'img/Shade.png',
        name: "シェード"
    },
    { 
        color: '#f48', 
        speed: 0.5, 
        hp: 75,
        size: 27,
        img: 'img/Dragon.png',
        name: "ドラゴン"
    }
];

// Function to get available enemy types based on player level
function getAvailableEnemyTypes(playerLevel) {
    let maxEnemyType;
    if (playerLevel < 3) {
        maxEnemyType = 2; // Only Goblins and Ogres in early levels
    } else if (playerLevel < 6) {
        maxEnemyType = 4; // Up to Skeletons
    } else if (playerLevel < 10) {
        maxEnemyType = 6; // Up to Demons
    } else if (playerLevel < 15) {
        maxEnemyType = 8; // Up to Shades
    } else {
        maxEnemyType = 9; // All enemy types available at level 15+
    }
    
    return enemyTypes.slice(0, maxEnemyType + 1);
}
