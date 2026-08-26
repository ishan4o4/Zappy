import { EmbedBuilder } from "discord.js";
import Minion from "../../../models/Minion.js";
import User from "../../../models/User.js";
import { shopItems } from "../../../config/shopItems.js";

export default {
  async execute(message, args, user) {
    const userId = message.author.id;
    const prefix = process.env.PREFIX || "!";

    if (!args[0]) {
      const helpEmbed = new EmbedBuilder()
        .setTitle("🔄 Unequip Minion Help")
        .setDescription("Remove a minion from an active slot")
        .setColor("Blue")
        .addFields(
          {
            name: "📖 Usage:",
            value: "`-minion unequip <slot>`",
            inline: false,
          },
          {
            name: "📝 Example:",
            value: "`-minion unequip 1` - Remove minion from slot 1",
            inline: false,
          },
          {
            name: "⚠️ Important:",
            value:
              "• Unequipped minions will stop mining\n• Any uncollected ores will remain in storage\n• You can re-equip the minion later",
          }
        );

      return message.channel.send({ embeds: [helpEmbed] });
    }

    const slotNum = parseInt(args[0], 10);

    // Validate slot number dynamically from user's minionSlots
    if (isNaN(slotNum) || slotNum < 1 || slotNum > user.minionSlots) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Invalid Slot Number")
        .setDescription(`Slot number must be between **1** and **${user.minionSlots}**`)
        .setColor("Red");

      return message.channel.send({ embeds: [errorEmbed] });
    }

    // Get all active minions sorted by start time
    const activeMinions = await Minion.find({
      userId,
      startedAt: { $ne: null },
    }).sort({ startedAt: 1 });

    // Check if minion exists in the specified slot
    const targetMinion = activeMinions[slotNum - 1];

    if (!targetMinion) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Empty Slot")
        .setDescription(`No minion found in slot ${slotNum}`)
        .setColor("Red")
        .addFields({
          name: "💡 Check your slots:",
          value: "Use `-minion slots` to see which slots have active minions",
        });

      return message.channel.send({ embeds: [errorEmbed] });
    }

    // Normalize minion ID to base ID by removing suffix (_1, _2, etc.)
    const baseMinionId = targetMinion.minionId.replace(/_\d+$/, "");

    // Get shop data with normalized ID
    const shopData = shopItems.Minions.find((m) => m.id === baseMinionId);
    if (!shopData) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Invalid Minion Data")
        .setDescription("This minion's data could not be found")
        .setColor("Red");

      return message.channel.send({ embeds: [errorEmbed] });
    }

    // Calculate final mining results before unequipping
    const now = new Date();
    const secondsSinceLastCollection = Math.floor((now - targetMinion.lastCollected) / 1000);
    const completedCycles = Math.floor(secondsSinceLastCollection / shopData.speed);

    let finalOresMined = 0;
    if (completedCycles > 0) {
      for (let i = 0; i < completedCycles; i++) {
        const oreAmount =
          Math.floor(Math.random() * (shopData.yield.max - shopData.yield.min + 1)) + shopData.yield.min;
        finalOresMined += oreAmount;
      }

      // Apply storage limit
      const availableStorage = targetMinion.capacity - targetMinion.storage;
      finalOresMined = Math.min(finalOresMined, availableStorage);

      // Update storage with final mining results
      targetMinion.storage += finalOresMined;
    }

    // Calculate total work time
    const workDuration = Math.floor((now - targetMinion.startedAt) / 1000);
    const workHours = Math.floor(workDuration / 3600);
    const workMinutes = Math.floor((workDuration % 3600) / 60);

    // Store final stats before unequipping
    const finalStats = {
      workDuration: `${workHours}h ${workMinutes}m`,
      finalStorage: targetMinion.storage,
      capacity: targetMinion.capacity,
      finalOresMined,
      hasUncollectedOres: targetMinion.storage > 0,
    };

    // Unequip the minion
    targetMinion.startedAt = null;
    targetMinion.lastCollected = now;
    await targetMinion.save();

    // Create success embed
    const oreEmoji = shopItems.Ores.find((o) => o.id === shopData.ore)?.emoji || "⛏️";

    const embed = new EmbedBuilder()
      .setTitle("🔄 Minion Unequipped")
      .setDescription(`${shopData.emoji} **${shopData.name}** has been removed from slot **${slotNum}**`)
      .setColor(finalStats.hasUncollectedOres ? "Yellow" : "Orange")
      .addFields(
        {
          name: "📊 Final Work Summary:",
          value: [
            `⏰ **Work Duration:** ${finalStats.workDuration}`,
            `${oreEmoji} **Mining:** ${shopData.ore}`,
            `📦 **Final Storage:** ${finalStats.finalStorage}/${finalStats.capacity}`,
            finalStats.finalOresMined > 0
              ? `⚡ **Last Mining:** +${finalStats.finalOresMined} ores`
              : "⚡ **Last Mining:** No new ores",
          ].join("\n"),
          inline: false,
        }
      );

    // Add warning about uncollected ores
    if (finalStats.hasUncollectedOres) {
      embed.addFields({
        name: "⚠️ Uncollected Ores",
        value: `This minion has **${finalStats.finalStorage}** uncollected ores!\nUse \`-minion equip ${slotNum} ${targetMinion.minionId}\` to re-equip and then collect them.`,
        inline: false,
      });
    }

    // Add next steps
    embed.addFields({
      name: "💡 Next Steps:",
      value: [
        `• The minion \`${targetMinion.minionId}\` is now available to equip elsewhere`,
        `• Use \`${prefix}minion show\` to see all your minions`,
        `• Use \`${prefix}minion equip <slot> <minionId>\` to put a minion back to work`,
        finalStats.hasUncollectedOres ? "• **Don't forget to collect the stored ores!**" : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return message.channel.send({ embeds: [embed] });
  },
};