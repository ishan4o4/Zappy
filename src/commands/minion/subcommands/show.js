import { EmbedBuilder } from "discord.js";
import Minion from "../../../models/Minion.js";
import User from "../../../models/User.js";
import { shopItems } from "../../../config/shopItems.js";

export default {
  async execute(message, args, user) {
    const userId = message.author.id;

    if (!user.inventory || !user.inventory.minions || user.inventory.minions.length === 0) {
      return message.reply("😢 You don't own any minions yet! Buy some at the shop.");
    }

    // Fetch all equipped minions from DB to get up-to-date mining storage and status
    const equippedMinions = await Minion.find({ userId, startedAt: { $ne: null } });
    const equippedIds = new Set(equippedMinions.map(m => m.minionId));

    // Create map from minionId to DB minion document for quick lookup
    const equippedMinionsMap = new Map(equippedMinions.map(m => [m.minionId, m]));

    const embed = new EmbedBuilder()
      .setTitle(`🛠️ ${message.author.username}'s Minion Collection`)
      .setColor("Yellow")
      .setDescription(
        `You own **${user.inventory.minions.length}** minion${user.inventory.minions.length !== 1 ? "s" : ""}\n` +
        `Active: **${equippedMinions.length}/${user.minionSlots}** • Inactive: **${user.inventory.minions.length - equippedMinions.length}**`
      )
      .setFooter({ text: "🟢 = Active • 🔴 = Inactive" });

    for (const minion of user.inventory.minions) {
      // Extract base id (strip suffix _1 etc)
      const baseId = minion.id.match(/^([a-zA-Z0-9_]+?)(?:_\d+)?$/)?.[1] || minion.id;
      const shopData = shopItems.Minions.find(m => m.id === baseId);

      // Check if minion is equipped and actively mining
      const dbMinion = equippedMinionsMap.get(minion.id);
      const isActive = dbMinion && dbMinion.startedAt !== null;

      // Show storage only if actively mining, otherwise show 'N/A'
      const storage = isActive ? dbMinion.storage : null;
      const storagePercent = storage !== null ? Math.round((storage / (minion.maxStorage || 200)) * 100) : null;
      const storageDisplay = storage !== null ? `${storage}/${minion.maxStorage || 200} (${storagePercent}%)` : "N/A";

      embed.addFields({
        name: `${isActive ? "🟢" : "🔴"} ${shopData?.emoji || "🤖"} ${minion.name} (\`${minion.id}\`)`,
        value:
          `⚡ Mining Speed: Every ${minion.speed || shopData?.speed || "N/A"}s\n` +
          `📦 Storage: ${storageDisplay}\n` +
          (isActive ? "⛏️ Currently Mining" : "⏸️ Not Mining"),
        inline: false,
      });
    }

    return message.channel.send({ embeds: [embed] });
  },
};