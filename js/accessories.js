// Accessory definitions. All bonus values are percentage points on top of a
// 100% baseline (e.g. value 10 means "+10%", applied additively across levels).
const accessoryTypes = [
    {
        name: "力の腕輪",
        description: "攻撃力が上昇",
        effects: [{ type: "bonusDamage", value: 10 }],
        img: "img/accessory_damage.png",
        maxLevel: 5
    },
    {
        name: "神速の靴",
        description: "移動速度が上昇",
        effects: [{ type: "bonusSpeed", value: 10 }],
        img: "img/accessory_speed.png",
        maxLevel: 5
    },
    {
        name: "生命の首飾り",
        description: "最大HPが上昇",
        effects: [{ type: "bonusMaxHp", value: 20 }],
        img: "img/accessory_hp.png",
        maxLevel: 5
    },
    {
        name: "疾風の手甲",
        description: "射撃速度が上昇",
        effects: [{ type: "bonusFireRate", value: 15 }],
        img: "img/accessory_fire_rate.png",
        maxLevel: 5
    },
    {
        name: "守護の護符",
        description: "防御力が上昇（被ダメージを軽減）",
        effects: [{ type: "bonusDefense", value: 10 }],
        img: "img/accessory_defense.png",
        maxLevel: 5
    }
];

// Accessories the player is equipped with from the start of the run.
const STARTER_ACCESSORY_NAMES = ["力の腕輪", "神速の靴", "生命の首飾り", "疾風の手甲"];

function getAccessoryByName(name) {
    return accessoryTypes.find(a => a.name === name);
}

function hasAccessory(player, name) {
    return player.accessories.some(a => a.name === name);
}

// Grants one level of the named accessory (adding it if the player doesn't
// have it yet) and applies that level's bonus to the player's running totals.
function grantAccessory(player, name) {
    const type = getAccessoryByName(name);
    if (!type) return false;

    let owned = player.accessories.find(a => a.name === name);
    if (owned) {
        if (owned.level >= type.maxLevel) return false;
        owned.level++;
    } else {
        owned = { name: name, level: 1 };
        player.accessories.push(owned);
    }

    for (const effect of type.effects) {
        player[effect.type] += effect.value;
    }
    applyPlayerStats();
    return true;
}

// Used by selectAccessory() in main.js when the player picks an accessory
// from the level-up modal.
function addAccessoryToPlayer(player, name) {
    return grantAccessory(player, name);
}

// Equips the starter accessory set on a freshly created player.
function initPlayerAccessories(player) {
    player.accessories = [];
    STARTER_ACCESSORY_NAMES.forEach(name => grantAccessory(player, name));
}
