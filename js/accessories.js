// アクセサリの定義。ボーナス値は100%を基準としたパーセントポイントで
// （例: value 10は「+10%」を意味し、レベルを重ねるごとに加算される）。
const accessoryTypes = [
    {
        name: "力の腕輪",
        description: "攻撃力が上昇",
        effects: [{ type: "bonusDamage", value: 10 }],
        img: "img/power_bracelet.png",
        maxLevel: 5
    },
    {
        name: "神速の靴",
        description: "移動速度が上昇",
        effects: [{ type: "bonusSpeed", value: 10 }],
        img: "img/swift_boots.png",
        maxLevel: 5
    },
    {
        name: "生命の首飾り",
        description: "最大HPが上昇",
        effects: [{ type: "bonusMaxHp", value: 20 }],
        img: "img/life_necklace.png",
        maxLevel: 5
    },
    {
        name: "疾風の手甲",
        description: "攻撃速度が上昇",
        effects: [{ type: "bonusFireRate", value: 15 }],
        img: "img/gale_gauntlet.png",
        maxLevel: 5
    },
    {
        name: "守護の護符",
        description: "防御力が上昇（被ダメージを軽減）",
        effects: [{ type: "bonusDefense", value: 10 }],
        img: "img/guardian_amulet.png",
        maxLevel: 5
    },
    {
        name: "引き寄せのオーブ",
        description: "アイテムの収集範囲が上昇",
        effects: [{ type: "bonusPickupRange", value: 50 }],
        img: "img/orb_of_attraction.png",
        maxLevel: 5
    }
];

// 名前からアクセサリの定義データを取得する
function getAccessoryByName(name) {
    return accessoryTypes.find(a => a.name === name);
}

// プレイヤーが既にそのアクセサリを所持しているか確認する
function hasAccessory(player, name) {
    return player.accessories.some(a => a.name === name);
}

// 指定したアクセサリを1レベル分付与し（未所持なら新規追加）、
// そのレベル分のボーナスをプレイヤーの累計値に加算する
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

// main.jsのselectAccessory()から、プレイヤーがレベルアップ選択画面で
// アクセサリを選んだ際に呼び出される
function addAccessoryToPlayer(player, name) {
    return grantAccessory(player, name);
}

// アクセサリはレベルアップの選択肢からのみ入手できるため、開始時は何も持たない
function initPlayerAccessories(player) {
    player.accessories = [];
}
