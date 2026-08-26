import { EmbedBuilder } from "discord.js";
import User from "../../models/User.js";
import { shopItems } from "../../config/shopItems.js";

export default {
  name: "pickaxe",
  category: "Mining",
  description: "Check your current pickaxe or equip a new one",
  usage: "pickaxe [equip <pickaxe_id>]",
  async execute(message, args) {
    const prefix = process.env.PREFIX || "!";
    const zappcoinEmoji = "<:zappcoin:1410248547781185567>";
    
    const user = await User.findOne({ userId: message.author.id });
    if (!user) {
      return message.reply(`❌ Register first with \`${prefix}register\`.`);
    }

    if (!user.inventory) {
      user.inventory = { pickaxes: [], minions: [], ores: new Map() };
      await user.save();
    }

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
        const equippedExists = user.inventory.pickaxes.find(p => p.id === user.currentPickaxeId);
        if (!equippedExists) {
          user.currentPickaxeId = null;
        }
      }

      if (originalLength !== user.inventory.pickaxes.length) {
        await user.save();
      }
    }

    if (args[0] === "equip") {
      return await handleEquipPickaxe(message, args, user, prefix, zappcoinEmoji, removedPickaxes);
    }

    let currentPickaxe = null;
    let isLegacy = false;

    if (user.currentPickaxeId) {
      currentPickaxe = user.inventory.pickaxes?.find(p => p.id === user.currentPickaxeId);
    }

    if (!currentPickaxe && user.pickaxe) {
      currentPickaxe = user.pickaxe;
      isLegacy = true;

      if (currentPickaxe.durability <= 0) {
        currentPickaxe.durability = 1; 
        await user.save();
      }
    }

    if (!currentPickaxe) {
      return message.reply(`❌ You don't have any pickaxe equipped!\n💡 Use \`${prefix}shop\` to buy a pickaxe first.`);
    }

    const pickaxeEmoji = isLegacy 
      ? getPickaxeEmojiByName(currentPickaxe.name)
      : getPickaxeEmoji(currentPickaxe.id);

    const { name, durability, maxDurability, power } = currentPickaxe;

    const durabilityPercent = durability / maxDurability;
    const filledBars = Math.floor(durabilityPercent * 10);
    const emptyBars = 10 - filledBars;

    let durabilityBar;
    if (durabilityPercent > 0.7) {
      durabilityBar = "🟩".repeat(filledBars) + "⬜".repeat(emptyBars);
    } else if (durabilityPercent > 0.3) {
      durabilityBar = "🟨".repeat(filledBars) + "⬜".repeat(emptyBars);
    } else {
      durabilityBar = "🟥".repeat(filledBars) + "⬜".repeat(emptyBars);
    }

    let unlocksInfo = "";
    if (!isLegacy) {
      const pickaxeData = shopItems.Pickaxes.find(p => p.id === currentPickaxe.id);
      if (pickaxeData && pickaxeData.unlocks) {
        unlocksInfo = `\n🔓 **Unlocks:** ${pickaxeData.unlocks.join(", ")}`;
      }
    } else {
      
      const pickaxeData = shopItems.Pickaxes.find(p => p.name === currentPickaxe.name);
      if (pickaxeData && pickaxeData.unlocks) {
        unlocksInfo = `\n🔓 **Unlocks:** ${pickaxeData.unlocks.join(", ")}`;
      }
    }

    let specialNote = "";
    if (isLegacy && currentPickaxe.name === "Wooden Pickaxe") {
      specialNote = "\n🛡️ *This is your unbreakable starter pickaxe*";
    }

    let description = `**${name}**${isLegacy ? " *(Default)*" : ""}${unlocksInfo}${specialNote}`;
    if (removedPickaxes.length > 0) {
      description += `\n\n🗑️ **Cleanup:** Removed ${removedPickaxes.length} broken pickaxe(s): ${removedPickaxes.join(", ")}`;
    }

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle(`${pickaxeEmoji} Current Pickaxe`)
      .setDescription(description)
      .addFields(
        { 
          name: "🛡️ Durability", 
          value: `${durability}/${maxDurability} (${Math.round(durabilityPercent * 100)}%)\n${durabilityBar}`, 
          inline: true 
        },
        { 
          name: "⚡ Power", 
          value: `${power}`, 
          inline: true 
        },
        { 
          name: "📊 Status", 
          value: durabilityPercent > 0.7 ? "🟢 Excellent" : 
                 durabilityPercent > 0.3 ? "🟡 Worn" : "🔴 Nearly Broken", 
          inline: true 
        }
      )
      .setFooter({ 
        text: `Use ${prefix}mine to start mining • ${prefix}pickaxe equip <id> to change pickaxe • ${prefix}inventory to see all pickaxes` 
      });

    return message.reply({ embeds: [embed] });
  },
};

async function handleEquipPickaxe(message, args, user, prefix, zappcoinEmoji, removedPickaxes) {
  if (!args[1]) {
    
    let pickaxeList = "";
    let availableCount = 0;

    if (user.pickaxe && user.pickaxe.name) {
      const emoji = getPickaxeEmojiByName(user.pickaxe.name);
      const isEquipped = !user.currentPickaxeId ? " 🔥 *(Equipped)*" : "";
      pickaxeList += `**0.** ${emoji} ${user.pickaxe.name} *(Default)*${isEquipped}\n   ⚡ Power: ${user.pickaxe.power} | 🛡️ ${user.pickaxe.durability}/${user.pickaxe.maxDurability} | 📦 Unbreakable`;
      availableCount++;
    }

    if (user.inventory.pickaxes && user.inventory.pickaxes.length > 0) {
      const inventoryList = user.inventory.pickaxes.map((pickaxe, index) => {
        const emoji = getPickaxeEmoji(pickaxe.id);
        const isEquipped = user.currentPickaxeId === pickaxe.id ? " 🔥 *(Equipped)*" : "";
        return `**${index + 1}.** ${emoji} ${pickaxe.name}${isEquipped}\n   ⚡ Power: ${pickaxe.power} | 🛡️ ${pickaxe.durability}/${pickaxe.maxDurability} | 📦 Qty: ${pickaxe.quantity}x`;
      }).join("\n\n");
      
      if (pickaxeList) {
        pickaxeList += "\n\n" + inventoryList;
      } else {
        pickaxeList = inventoryList;
      }
      availableCount += user.inventory.pickaxes.length;
    }

    if (availableCount === 0) {
      return message.reply(`❌ You don't own any pickaxes!\n💡 Use \`${prefix}shop\` to buy pickaxes first.`);
    }

    let description = `**Available Pickaxes:**\n\n${pickaxeList}`;
    if (removedPickaxes.length > 0) {
      description += `\n\n🗑️ **Cleanup:** Removed ${removedPickaxes.length} broken pickaxe(s): ${removedPickaxes.join(", ")}`;
    }

    const embed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("⚔️ Equip Pickaxe")
      .setDescription(description)
      .setFooter({ text: `Use ${prefix}pickaxe equip <number> to equip a pickaxe (0 = default)` });

    return message.reply({ embeds: [embed] });
  }

  const pickaxeId = args[1];
  let targetPickaxe = null;
  let isDefault = false;

  if (!isNaN(pickaxeId)) {
    const index = parseInt(pickaxeId);
    if (index === 0 && user.pickaxe && user.pickaxe.name) {
      
      targetPickaxe = user.pickaxe;
      isDefault = true;
    } else if (index > 0 && user.inventory.pickaxes) {
      targetPickaxe = user.inventory.pickaxes[index - 1];
    }
  } else {
    
    if (user.inventory.pickaxes) {
      targetPickaxe = user.inventory.pickaxes.find(p => 
        p.id === pickaxeId || 
        p.id.replace(/\\_/g, '_') === pickaxeId ||
        p.name.toLowerCase().includes(pickaxeId.toLowerCase())
      );
    }
  }

  if (!targetPickaxe) {
    return message.reply(`❌ Pickaxe not found!\n💡 Use \`${prefix}pickaxe equip\` to see available pickaxes.`);
  }

  if (isDefault && !user.currentPickaxeId) {
    const emoji = getPickaxeEmojiByName(targetPickaxe.name);
    return message.reply(`${emoji} **${targetPickaxe.name}** *(Default)* is already equipped!`);
  } else if (!isDefault && user.currentPickaxeId === targetPickaxe.id) {
    const emoji = getPickaxeEmoji(targetPickaxe.id);
    return message.reply(`${emoji} **${targetPickaxe.name}** is already equipped!`);
  }

  if (isDefault) {
    user.currentPickaxeId = null; 
  } else {
    user.currentPickaxeId = targetPickaxe.id;
  }
  await user.save();

  const emoji = isDefault ? getPickaxeEmojiByName(targetPickaxe.name) : getPickaxeEmoji(targetPickaxe.id);
  
  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("✅ Pickaxe Equipped!")
    .setDescription(`${emoji} You equipped **${targetPickaxe.name}**${isDefault ? " *(Default)*" : ""}!`)
    .addFields(
      { name: "⚡ Power", value: `${targetPickaxe.power}`, inline: true },
      { name: "🛡️ Durability", value: `${targetPickaxe.durability}/${targetPickaxe.maxDurability}`, inline: true },
      { name: "📦 Status", value: isDefault ? "Unbreakable" : `${targetPickaxe.quantity}x owned`, inline: true }
    )
    .setFooter({ text: `Use ${prefix}mine to start mining with your new pickaxe!` });

  return message.reply({ embeds: [embed] });
}

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