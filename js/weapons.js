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
        description: "鋭い剣の斬撃",
        effect: "slash",
        effectDuration: 10
    },
    {
        name: "弓",
        type: "ranged",
        damage: 20,
        cooldown: 50,
        range: 140,
        maxLevel: 8,
        img: "img/bow.png",
        description: "弧を描いて飛ぶ矢の射撃",
        arc: true,
        projectileShape: "arrow"
    },
    {
        name: "杖",
        type: "magic",
        damage: 30,
        cooldown: 70,
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
        damage: 35,
        cooldown: 80,
        range: 240,
        maxLevel: 8,
        img: "img/axe.png",
        description: "弧を描きながら進行方向に投げつける"
    },
    {
        name: "槍",
        type: "melee",
        damage: 28,
        cooldown: 55,
        range: 160,
        maxLevel: 8,
        img: "img/spear.png",
        description: "向いている方向への突き攻撃",
        effect: "thrust"
    }
];

// Player weapons system
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

// Function to get available weapon upgrades based on player level
function getAvailableWeapons(playerLevel) {
    // All weapons are available from the start. Return a copy: callers
    // splice this array to build random selections, and must not mutate
    // the shared weaponTypes master list.
    return weaponTypes.slice();
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