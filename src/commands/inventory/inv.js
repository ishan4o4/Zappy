import { EmbedBuilder } from "discord.js";
import Minion from "../../models/Minion.js";
import User from "../../models/User.js";
import { shopItems } from "../../config/shopItems.js";

export default {
  name: "inventory",
  aliases: ["inv", "bag"],
  category: "Inventory",
  description: "View your items and inventory",
  async execute(message) {
    const zappcoinEmoji = "<:zappcoin:1410248547781185567>";
    const prefix = process.env.PREFIX || "!";
    
    const user = await User.findOne({ userId: message.author.id });
    if (!user) {
      return message.reply(`❌ You need to register first with \`${prefix}register\`.`);
    }

    // Initialize inventory if not exists
    if (!user.inventory) {
      user.inventory = { pickaxes: [], minions: [], ores: new Map() };
      await user.save();
    }

    // Fetch minions mining state from DB to get up-to-date storage
    const dbMinions = await Minion.find({ userId: message.author.id });
    const dbMinionsMap = new Map(dbMinions.map(m => [m.minionId, m]));

    // Clean up broken pickaxes from inventory
    let removedPickaxes = [];
    if (user.inventory.pickaxes && user.inventory.pickaxes.length > 0) {
      const originalLength = user.inventory.pickaxes.length;
      user.inventory.pickaxes = user.inventory.pickaxes.filter(pickaxe => {
        if (pickaxe.durability <= 0) {
          removedPickaxes.push(pickaxe.name);
          return false;
        }
        return true;
      });
      
      if (user.currentPickaxeId) {
        const hasEquipped = user.inventory.pickaxes.find(p => p.id === user.currentPickaxeId);
        if (!hasEquipped) {
          user.currentPickaxeId = null;
        }
      }
      
      if (originalLength !== user.inventory.pickaxes.length) {
        await user.save();
      }
    }

    // Pickaxe info
    let pickaxeInfo = "";
    let currentEquippedInfo = "None equipped";

    if (user.pickaxe && user.pickaxe.name && user.pickaxe.durability > 0) {
      const legacyEmoji = getPickaxeEmojiByName(user.pickaxe.name);
      const isEquipped = !user.currentPickaxeId ? " 🔥" : "";
      pickaxeInfo += `${legacyEmoji} **${user.pickaxe.name}** *(Default)*${isEquipped}\n📦 Quantity: 1x | ⚡ Power: ${user.pickaxe.power} | 🛡️ ${user.pickaxe.durability}/${user.pickaxe.maxDurability}`;
      if (!user.currentPickaxeId) {
        currentEquippedInfo = `${legacyEmoji} **${user.pickaxe.name}** *(Default)*\n🛡️ Durability: ${user.pickaxe.durability}/${user.pickaxe.maxDurability}\n⚡ Power: ${user.pickaxe.power}`;
      }
    }

    if (user.inventory.pickaxes && user.inventory.pickaxes.length > 0) {
      const equippedPickaxe = user.currentPickaxeId
        ? user.inventory.pickaxes.find(p => p.id === user.currentPickaxeId)
        : null;

      if (equippedPickaxe) {
        const pickaxeEmoji = getPickaxeEmoji(equippedPickaxe.id);
        currentEquippedInfo = `${pickaxeEmoji} **${equippedPickaxe.name}**\n🛡️ Durability: ${equippedPickaxe.durability}/${equippedPickaxe.maxDurability}\n⚡ Power: ${equippedPickaxe.power}`;
      }

      const pickaxeList = user.inventory.pickaxes.map(pickaxe => {
        const emoji = getPickaxeEmoji(pickaxe.id);
        const isEquipped = user.currentPickaxeId === pickaxe.id ? " 🔥" : "";
        return `${emoji} **${pickaxe.name}**${isEquipped}\n📦 Quantity: ${pickaxe.quantity}x | ⚡ Power: ${pickaxe.power} | 🛡️ ${pickaxe.durability}/${pickaxe.maxDurability}`;
      });

      if (pickaxeInfo) {
        pickaxeInfo += "\n\n" + pickaxeList.join("\n\n");
      } else {
        pickaxeInfo = pickaxeList.join("\n\n");
      }
    }

    if (!pickaxeInfo) {
      pickaxeInfo = `No pickaxes owned\n💡 Use \`${prefix}shop\` to buy your first pickaxe`;
      currentEquippedInfo = "❌ No pickaxe equipped\n💡 Buy a pickaxe from the shop";
    }

    // Ores info
    let oresInfo = "No ores";
    let totalOreValue = 0;

    if (user.inventory.ores && user.inventory.ores.size > 0) {
      const oreList = Array.from(user.inventory.ores.entries()).map(([oreId, quantity]) => {
        const normalizedOreId = oreId.replace(/\\_/g, '_').toLowerCase();

        let oreData = shopItems.Ores.find(o => 
          o.id === normalizedOreId || 
          o.id === oreId || 
          o.id.toLowerCase() === normalizedOreId ||
          o.name.toLowerCase() === normalizedOreId
        );

        if (oreData) {
          const oreValue = oreData.value * quantity;
          totalOreValue += oreValue;
          const oreEmoji = oreData.emoji ? oreData.emoji.replace(/\\_/g, '_') : "💎";
          return `${oreEmoji} **${oreData.name}** x${quantity}\n💰 Value: ${oreValue} ${zappcoinEmoji}`;
        }

        return `❓ **${oreId}** x${quantity}\n💰 Value: Unknown`;
      });

      oresInfo = oreList.join("\n\n");
    }

    // Minions info - use DB storage if available
    let minionsInfo = "No minions";

    if (user.inventory.minions && user.inventory.minions.length > 0) {
      const minionList = user.inventory.minions.map(minion => {
        const minionEmoji = getMinionEmoji(minion.id);
        const dbMinion = dbMinionsMap.get(minion.id);
        const storage = dbMinion ? dbMinion.storage : minion.storage;
        const maxStorage = minion.maxStorage || 200;
        const storagePercent = Math.round((storage / maxStorage) * 100);
        const statusEmoji = storage === maxStorage ? "🔴" : storage > 0 ? "🟡" : "🟢";
        const speed = minion.speed || "N/A";

        return `${minionEmoji} **${minion.name}**\n${statusEmoji} Storage: ${storage}/${maxStorage} (${storagePercent}%)\n⚡ Speed: Every ${speed}s`;
      });

      minionsInfo = minionList.join("\n\n");
    }

    let description = `💰 **Current Balance:** ${user.balance} ${zappcoinEmoji}`;
    if (removedPickaxes.length > 0) {
      description += `\n\n🗑️ **Cleanup:** Removed ${removedPickaxes.length} broken pickaxe(s): ${removedPickaxes.join(", ")}`;
    }

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle(`🎒 ${message.author.username}'s Inventory`)
      .setDescription(description)
      .addFields(
        { name: "⚔️ Currently Equipped", value: currentEquippedInfo, inline: false },
        { name: "⛏️ All Pickaxes", value: pickaxeInfo.length > 1024 ? pickaxeInfo.substring(0, 1021) + "..." : pickaxeInfo, inline: false },
        { name: `💎 Ores Collection (${totalOreValue} ${zappcoinEmoji})`, value: oresInfo.length > 1024 ? oresInfo.substring(0, 1021) + "..." : oresInfo, inline: false },
        { name: "🤖 Minion Workers", value: minionsInfo.length > 1024 ? minionsInfo.substring(0, 1021) + "..." : minionsInfo, inline: false }
      )
      .setFooter({
        text: `🎰 Minion Slots: ${user.inventory.minions?.length || 0}/${user.minionSlots} | Use ${prefix}pickaxe equip to change pickaxe`
      });

    return message.reply({ embeds: [embed] });
  },
};

function getPickaxeEmoji(pickaxeId) {
  const normalizedId = pickaxeId.replace(/\\_/g, '_');
  const pickaxeData = shopItems.Pickaxes.find(p => 
    p.id === normalizedId || 
    p.id === pickaxeId ||
    p.id.replace(/\\_/g, '_') === normalizedId
  );
  if (pickaxeData && pickaxeData.emoji) {
    return pickaxeData.emoji.replace(/\\_/g, '_');
  }
  return "⛏️";
}

function getPickaxeEmojiByName(pickaxeName) {
  const pickaxeData = shopItems.Pickaxes.find(p => p.name === pickaxeName);
  if (pickaxeData && pickaxeData.emoji) {
    return pickaxeData.emoji.replace(/\\_/g, '_');
  }
  return "⛏️";
}

function getMinionEmoji(minionId) {
  const normalizedId = minionId.replace(/\\_/g, '_');
  const emojiMap = {
    coal_m1: "<:coal:1410248546900250675><:minion:1410635951214170327>",
    iron_m1: "<:iron:1411408259100835993><:minion:1410635951214170327>",
  };
  return emojiMap[normalizedId] || emojiMap[minionId] || "<:minion:1410635951214170327>";
}
