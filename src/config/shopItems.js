export const shopItems = {
  Pickaxes: [
    { id: "wooden_pickaxe",  name: "Wooden Pickaxe",  emoji: "<:wooden_pickaxe:1410319533498961930>", cost: 50,    durability: 50,  power: 1, unlocks: ["Stone"] },
    { id: "stone_pickaxe",   name: "Stone Pickaxe",   emoji: "<:stone_pickaxe:1410317836299276399>", cost: 400,   durability: 80,  power: 1, unlocks: ["Iron"] },
    { id: "iron_pickaxe",    name: "Iron Pickaxe",    emoji: "<:iron_pickaxe:1410319883857690754>", cost: 1500,  durability: 130, power: 2, unlocks: ["Gold"] },
    { id: "diamond_pickaxe", name: "Diamond Pickaxe", emoji: "<:diamond_pickaxe:1410319466574643290>", cost: 4000,  durability: 300, power: 3, unlocks: ["Diamond"] },
    { id: "netherite_pickaxe", name: "Netherite Pickaxe", emoji: "<:netherite_pickaxe:1410318006248018071>", cost: 10000, durability: 600, power: 4, unlocks: ["Emerald", "Netherite"] },
  ],

  Ores: [
    { id: "stone",    name: "Stone",    emoji: "<:stone:1410610727579947141>",     value: 2   },
    { id: "coal",     name: "Coal",     emoji: "<:coal:1410248546900250675>",      value: 20  },
    { id: "iron",     name: "Iron",     emoji: "<:iron:1411408259100835993>",      value: 35  },
    { id: "gold",     name: "Gold",     emoji: "<:gold:1410248549207113779>",      value: 80  },
    { id: "diamond",  name: "Diamond",  emoji: "<:diamond:1410248546242002984>",   value: 220 },
    { id: "emerald",  name: "Emerald",  emoji: "<:emerald:1410248548510859325>",   value: 500 },
    { id: "netherite",name: "Netherite",emoji: "<:netherite:1410248807144230962>", value: 1200 },
  ],

  Minions: [
    {
      id: "coal_m1",
      name: "Coal Minion",
      emoji: "<:minion:1410635951214170327>",
      cost: 30000,
      tier: 1,
      ore: "coal",
      yield: { min: 1, max: 3 },
      speed: 50,
      description: "Mines coal steadily every 50s."
    },
    {
      id: "iron_m1",
      name: "Iron Minion",
      emoji: "<:minion:1410635951214170327>",
      cost: 70000,
      tier: 1,
      ore: "iron",
      yield: { min: 1, max: 5 },
      speed: 50,
      description: "Mines 1–5 iron ores every 50s."
    }
  ],
};