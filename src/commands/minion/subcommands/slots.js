import { EmbedBuilder } from "discord.js";
import Minion from "../../../models/Minion.js";
import { shopItems } from "../../../config/shopItems.js";

export default {
  async execute(message, args, user) {
    const prefix = process.env.PREFIX || "!";
    const userId = message.author.id;

    const activeMinions = await Minion.find({ 
      userId, 
      startedAt: { $ne: null } 
    }).sort({ startedAt: 1 }); 

    if (activeMinions.length === 0) {
      const noActiveEmbed = new EmbedBuilder()
        .setTitle("🎛️ No Active Minion Slots")
        .setDescription("You don't have any minions currently working!")
        .setColor("Orange")
        .addFields(
          {
            name: "💡 How to activate minions:",
            value: `Use \`${prefix}minion equip <slot> <minionId>\` to put a minion to work`
          },
          {
            name: "📋 Available minions:",
            value: `Check \`${prefix}minion list\` to see your owned minions`
          }
        )
        .setFooter({ text: `You have ${user.minionSlots} minion slot${user.minionSlots !== 1 ? 's' : ''} available` });

      return message.channel.send({ embeds: [noActiveEmbed] });
    }

    const embed = new EmbedBuilder()
      .setTitle("🎛️ Active Minion Slots")
      .setDescription(`${activeMinions.length}/${user.minionSlots} slots occupied`)
      .setColor("Green")
      .setFooter({ text: `💡 Use \`${prefix}minion collect all\` to gather all mined ores` });

    const now = new Date();

    activeMinions.forEach((minion, index) => {
      const shopData = shopItems.Minions.find(m => m.id === minion.minionId);
      if (!shopData) return;

      const secondsSinceStart = Math.floor((now - minion.lastCollected) / 1000);
      const cycleProgress = secondsSinceStart % shopData.speed;
      const completedCycles = Math.floor(secondsSinceStart / shopData.speed);
      const progressPercentage = Math.floor((cycleProgress / shopData.speed) * 100);

      let potentialOres = 0;
      for (let i = 0; i < completedCycles; i++) {
        potentialOres += Math.floor(
          Math.random() * (shopData.yield.max - shopData.yield.min + 1)
        ) + shopData.yield.min;
      }
      
      const actualStorage = Math.min(minion.storage + potentialOres, minion.capacity);
      const isFull = actualStorage >= minion.capacity;

      const progressBarLength = 10;
      const filledBars = Math.floor((progressPercentage / 100) * progressBarLength);
      const emptyBars = progressBarLength - filledBars;
      const progressBar = "▓".repeat(filledBars) + "░".repeat(emptyBars);

      const statusEmoji = isFull ? "🔴" : potentialOres > 0 ? "🟡" : "🟢";
      const statusText = isFull ? "Storage Full!" : potentialOres > 0 ? "Ready to Collect" : "Mining...";

      const oreEmoji = shopItems.Ores.find(o => o.id === shopData.ore)?.emoji || "⛏️";

      embed.addFields({
        name: `${statusEmoji} Slot ${index + 1}: ${shopData.emoji} ${shopData.name}`,
        value: [
          `${oreEmoji} **Mining:** ${shopData.ore}`,
          `📦 **Storage:** ${actualStorage}/${minion.capacity}`,
          `⚡ **Speed:** ${shopData.speed}s per ore`,
          `🪙 **Yield:** ${shopData.yield.min}-${shopData.yield.max} coins`,
          `📊 **Progress:** ${progressBar} ${progressPercentage}%`,
          `📈 **Status:** ${statusText}`,
          `🕐 **Started:** <t:${Math.floor(minion.startedAt.getTime() / 1000)}:R>`
        ].join('\n'),
        inline: false
      });
    });

    const availableSlots = user.minionSlots - activeMinions.length;
    if (availableSlots > 0) {
      embed.addFields({
        name: "🆓 Available Slots",
        value: `You have **${availableSlots}** empty slot${availableSlots !== 1 ? 's' : ''} available.\nUse \`${prefix}minion equip <slot> <minionId>\` to fill them!`,
        inline: false
      });
    }

    return message.channel.send({ embeds: [embed] });
  }
};