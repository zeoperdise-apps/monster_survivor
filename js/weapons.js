// Weapon definitions with different attack types and levels
const weaponTypes = [
    { 
        name: "鞭", 
        type: "melee",
        damage: 15,
        cooldown: 40,
        range: 135,
        maxLevel: 8,
        img: "img/whip.png",
        description: "シンプルな鞭攻撃"
    },
    { 
        name: "剣", 
        type: "melee",
        damage: 25,
        cooldown: 60,
        range: 100,
        maxLevel: 8,
        img: "img/sword.png",
        description: "鋭い剣の斬撃"
    },
    { 
        name: "弓", 
        type: "ranged",
        damage: 20,
        cooldown: 50,
        range: 200,
        maxLevel: 8,
        img: "img/bow.png",
        description: "正確な弓の射撃"
    },
    { 
        name: "杖", 
        type: "magic",
        damage: 30,
        cooldown: 70,
        range: 150,
        maxLevel: 8,
        img: "img/staff.png",
        description: "魔法の杖のblast"
    },
    { 
        name: "斧", 
        type: "melee",
        damage: 35,
        cooldown: 80,
        range: 120,
        maxLevel: 8,
        img: "img/axe.png",
        description: "強力な斧の振り下ろし"
    },
    { 
        name: "槍", 
        type: "melee",
        damage: 28,
        cooldown: 55,
        range: 160,
        maxLevel: 8,
        img: "img/spear.png",
        description: "突き刺す槍攻撃"
    },
    { 
        name: "火の杖", 
        type: "magic",
        damage: 32,
        cooldown: 65,
        range: 180,
        maxLevel: 8,
        img: "img/fire_staff.png",
        description: "ファイアボールの呪文"
    },
    { 
        name: "氷の弓", 
        type: "ranged",
        damage: 22,
        cooldown: 45,
        range: 220,
        maxLevel: 8,
        img: "img/ice_bow.png",
        description: "氷の矢の射撃"
    },
    { 
        name: "雷のハンマー", 
        type: "melee",
        damage: 40,
        cooldown: 90,
        range: 140,
        maxLevel: 8,
        img: "img/lightning_hammer.png",
        description: "雷のようなハンマーの打撃"
    },
    { 
        name: "毒の短剣", 
        type: "melee",
        damage: 24,
        cooldown: 50,
        range: 90,
        maxLevel: 8,
        img: "img/dagger.png",
        description: "毒を湛えた短剣の突き刺し"
    }
];

// Player weapons system
function initPlayerWeapons() {
    return [
        { 
            name: '鞭', 
            damage: 15, 
            cooldown: 40, 
            lastFire: 0, 
            range: 135,
            level: 1,
            maxLevel: 8
        }
    ];
}

// Function to get available weapon upgrades based on player level
function getAvailableWeapons(playerLevel) {
    // All weapons are available from the start
    return weaponTypes;
}

// Function to check if player already has a weapon
function hasWeapon(player, weaponName) {
    return player.weapons.some(weapon => weapon.name === weaponName);
}

// Function to add a new weapon to player's inventory
function addWeaponToPlayer(player, weaponName) {
    // Check if player already has this weapon
    if (hasWeapon(player, weaponName)) {
        // If they have it, level it up instead
        const weapon = player.weapons.find(w => w.name === weaponName);
        if (weapon.level < weapon.maxLevel) {
            weapon.level++;
            // Increase stats based on level
            const baseWeapon = weaponTypes.find(w => w.name === weaponName);
            if (baseWeapon) {
                weapon.damage = Math.floor(baseWeapon.damage * (1 + (weapon.level - 1) * 0.2));
                weapon.cooldown = Math.max(10, Math.floor(baseWeapon.cooldown * (1 - (weapon.level - 1) * 0.1)));
            }
        }
        return false; // Weapon already existed and was leveled up
    }
    
    // Check if player has max weapons
    if (player.weapons.length >= 4) {
        return false; // Max weapons reached
    }
    
    // Add new weapon
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

// Function to get weapon by name
function getWeaponByName(weaponName) {
    return weaponTypes.find(w => w.name === weaponName);
}