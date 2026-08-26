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

    // Initialize inventory if not exists
    if (!user.inventory) {
      user.inventory = { pickaxes: [], minions: [], ores: new Map() };
      await user.save();
    }

    // Clean up broken pickaxes from inventory (but keep default pickaxe always available)
    let removedPickaxes = [];
    if (user.inventory.pickaxes && user.inventory.pickaxes.length > 0) {
      const originalLength = user.inventory.pickaxes.length;
      user.inventory.pickaxes = user.inventory.pickaxes.filter(pickaxe => {
        if (pickaxe.durability <= 0) {
          removedPickaxes.push(pickaxe.name);
          return false; // Remove broken pickaxe
        }
        return true; // Keep working pickaxe
      });
      
      // If currently equipped pickaxe was broken, reset to null (will fall back to default)
      if (user.currentPickaxeId) {
        const equippedExists = user.inventory.pickaxes.find(p => p.id === user.currentPickaxeId);
        if (!equippedExists) {
          user.currentPickaxeId = null;
        }
      }
      
      // Save changes if any pickaxes were removed
      if (originalLength !== user.inventory.pickaxes.length) {
        await user.save();
      }
    }

    // Handle subcommands
    if (args[0] === "equip") {
      return await handleEquipPickaxe(message, args, user, prefix, zappcoinEmoji, removedPickaxes);
    }

    // Show current pickaxe stats
    let currentPickaxe = null;
    let isLegacy = false;

    // Try to find equipped pickaxe from inventory first
    if (user.currentPickaxeId) {
      currentPickaxe = user.inventory.pickaxes?.find(p => p.id === user.currentPickaxeId);
    }

    // Fall back to legacy/default pickaxe if no equipped pickaxe found
    if (!currentPickaxe && user.pickaxe) {
      currentPickaxe = user.pickaxe;
      isLegacy = true;
      
      // Make sure default wooden pickaxe is never broken
      if (currentPickaxe.durability <= 0) {
        currentPickaxe.durability = 1; // Reset to 1 if somehow it got to 0
        await user.save();
      }
    }

    if (!currentPickaxe) {
      return message.reply(`❌ You don't have any pickaxe equipped!\n💡 Use \`${prefix}shop\` to buy a pickaxe first.`);
    }

    // Get pickaxe emoji and data
    const pickaxeEmoji = isLegacy 
      ? getPickaxeEmojiByName(currentPickaxe.name)
      : getPickaxeEmoji(currentPickaxe.id);

    const { name, durability, maxDurability, power } = currentPickaxe;

    // Create durability bar
    const durabilityPercent = durability / maxDurability;
    const filledBars = Math.floor(durabilityPercent * 10);
    const emptyBars = 10 - filledBars;
    
    // Color durability bar based on condition
    let durabilityBar;
    if (durabilityPercent > 0.7) {
      durabilityBar = "🟩".repeat(filledBars) + "⬜".repeat(emptyBars);
    } else if (durabilityPercent > 0.3) {
      durabilityBar = "🟨".repeat(filledBars) + "⬜".repeat(emptyBars);
    } else {
      durabilityBar = "🟥".repeat(filledBars) + "⬜".repeat(emptyBars);
    }

    // Get unlocks info if available
    let unlocksInfo = "";
    if (!isLegacy) {
      const pickaxeData = shopItems.Pickaxes.find(p => p.id === currentPickaxe.id);
      if (pickaxeData && pickaxeData.unlocks) {
        unlocksInfo = `\n🔓 **Unlocks:** ${pickaxeData.unlocks.join(", ")}`;
      }
    } else {
      // For legacy pickaxe, get unlocks from shopItems
      const pickaxeData = shopItems.Pickaxes.find(p => p.name === currentPickaxe.name);
      if (pickaxeData && pickaxeData.unlocks) {
        unlocksInfo = `\n🔓 **Unlocks:** ${pickaxeData.unlocks.join(", ")}`;
      }
    }

    // Add special note for default pickaxe
    let specialNote = "";
    if (isLegacy && currentPickaxe.name === "Wooden Pickaxe") {
      specialNote = "\n🛡️ *This is your unbreakable starter pickaxe*";
    }

    // Create description with cleanup notification if any pickaxes were removed
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

// Handle equipping pickaxes
async function handleEquipPickaxe(message, args, user, prefix, zappcoinEmoji, removedPickaxes) {
  if (!args[1]) {
    // Show available pickaxes to equip (including default if exists)
    let pickaxeList = "";
    let availableCount = 0;
    
    // Add default pickaxe if exists
    if (user.pickaxe && user.pickaxe.name) {
      const emoji = getPickaxeEmojiByName(user.pickaxe.name);
      const isEquipped = !user.currentPickaxeId ? " 🔥 *(Equipped)*" : "";
      pickaxeList += `**0.** ${emoji} ${user.pickaxe.name} *(Default)*${isEquipped}\n   ⚡ Power: ${user.pickaxe.power} | 🛡️ ${user.pickaxe.durability}/${user.pickaxe.maxDurability} | 📦 Unbreakable`;
      availableCount++;
    }
    
    // Add inventory pickaxes
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

  // Try to find by number first
  if (!isNaN(pickaxeId)) {
    const index = parseInt(pickaxeId);
    if (index === 0 && user.pickaxe && user.pickaxe.name) {
      // Equip default pickaxe
      targetPickaxe = user.pickaxe;
      isDefault = true;
    } else if (index > 0 && user.inventory.pickaxes) {
      targetPickaxe = user.inventory.pickaxes[index - 1];
    }
  } else {
    // Try to find by ID or name
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

  // Check if already equipped
  if (isDefault && !user.currentPickaxeId) {
    const emoji = getPickaxeEmojiByName(targetPickaxe.name);
    return message.reply(`${emoji} **${targetPickaxe.name}** *(Default)* is already equipped!`);
  } else if (!isDefault && user.currentPickaxeId === targetPickaxe.id) {
    const emoji = getPickaxeEmoji(targetPickaxe.id);
    return message.reply(`${emoji} **${targetPickaxe.name}** is already equipped!`);
  }

  // Equip the pickaxe
  if (isDefault) {
    user.currentPickaxeId = null; // null means use default
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

// Helper function to get pickaxe emoji by ID
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

// Helper function to get pickaxe emoji by name (for legacy support)
function getPickaxeEmojiByName(pickaxeName) {
  const pickaxeData = shopItems.Pickaxes.find(p => p.name === pickaxeName);
  if (pickaxeData && pickaxeData.emoji) {
    return pickaxeData.emoji.replace(/\\_/g, '_');
  }
  return "⛏️";
}