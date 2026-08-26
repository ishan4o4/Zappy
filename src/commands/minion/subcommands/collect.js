import { EmbedBuilder } from "discord.js";
import Minion from "../../../models/Minion.js";
import User from "../../../models/User.js";
import { shopItems } from "../../../config/shopItems.js";

export default {
  async execute(message, args, user) {
    const prefix = process.env.PREFIX || "!";
    const userId = message.author.id;
    const target = args[0]?.toLowerCase();

    if (!target) {
      return message.reply(`⚠️ Use \`${prefix}minion collect <slot|all>\``);
    }

    // === NEW: Prevent collection if overall ore storage exceeds cap ===
    let totalStoredOre = 0;
    for (const qty of (user.inventory.ores?.values() || [])) {
      totalStoredOre += qty;
    }
    if (totalStoredOre > 1000) {
      return message.reply(
        `❌ Your inventory is full (total stored ore: ${totalStoredOre}/1000).\n` +
        `💡 Please sell some ores with \`${prefix}sell\` before collecting from minions.`
      );
    }
    // ===============================================================

    let minions = [];
    if (target === "all") {
      minions = await Minion.find({ userId, startedAt: { $ne: null } });
      if (minions.length === 0) {
        return message.reply("❌ You have no active minions.");
      }
    } else {
      const slot = parseInt(target, 10);
      if (isNaN(slot) || slot < 1 || slot > user.minionSlots) {
        return message.reply(`⚠️ Invalid slot number (1-${user.minionSlots}).`);
      }
      const activeMinions = await Minion.find({ userId, startedAt: { $ne: null } }).sort({ startedAt: 1 });
      if (!activeMinions[slot - 1]) {
        return message.reply(`❌ No minion in slot ${slot}.`);
      }
      minions = [activeMinions[slot - 1]];
    }

    const collectedTotals = {};
    const collectedDetails = [];

    for (let i = 0; i < minions.length; i++) {
      const minion = minions[i];

      if (minion.storage <= 0) {
        collectedDetails.push({
          slot: minions.length > 1 ? i + 1 : null,
          name: shopItems.Minions.find(m => m.id === minion.minionId.split("_")[0])?.name ?? "Unknown",
          collected: 0,
          status: "⏰ No ores to collect",
          storage: minion.storage
        });
        continue;
      }

      // Recalculate total before adding this minion's storage
      totalStoredOre = 0;
      for (const qty of (user.inventory.ores?.values() || [])) {
        totalStoredOre += qty;
      }
      if (totalStoredOre + minion.storage > 1000) {
        collectedDetails.push({
          slot: minions.length > 1 ? i + 1 : null,
          name: shopItems.Minions.find(m => m.id === minion.minionId.split("_")[0])?.name ?? "Unknown",
          collected: 0,
          status: `❌ Cannot collect: would exceed storage cap (${totalStoredOre}/${1000})`,
          storage: minion.storage
        });
        continue;
      }
      // ==============================================================================

      // Add ores from storage to user inventory
      const oreType = minion.ore;
      const userOres = user.inventory.ores || new Map();
      const currentQty = userOres.get(oreType) ?? 0;
      userOres.set(oreType, currentQty + minion.storage);
      user.inventory.ores = userOres;

      const collectedAmount = minion.storage;
      minion.storage = 0;
      await minion.save();

      collectedTotals[oreType] = (collectedTotals[oreType] || 0) + collectedAmount;
      collectedDetails.push({
        slot: minions.length > 1 ? i + 1 : null,
        name: shopItems.Minions.find(m => m.id === minion.minionId.split("_")[0])?.name ?? "Unknown",
        collected: collectedAmount,
        status: "✅ Collected",
        storage: minion.storage
      });
    }

    await user.save();

    if (Object.keys(collectedTotals).length === 0) {
      return message.reply("⛏️ No ores available for collection.");
    }

    const embed = new EmbedBuilder()
      .setTitle("📦 Minion Collection")
      .setColor("Green");

    for (const [ore, qty] of Object.entries(collectedTotals)) {
      const oreData = shopItems.Ores.find(o => o.id === ore);
      embed.addFields({
        name: oreData?.emoji + " " + (oreData?.name || ore),
        value: `${qty}x`,
        inline: true,
      });
    }

    collectedDetails.forEach(detail => {
      embed.addFields({
        name: detail.slot ? `Slot ${detail.slot}: ${detail.name}` : detail.name,
        value: `${detail.status}\n📦 Storage now: ${detail.storage}`,
        inline: false,
      });
    });

    embed.addFields({
      name: "💡 Tip",
      value: `Please sell some ores with \`${prefix}sell\` before collecting.`,
      inline: false,
    });

    return message.channel.send({ embeds: [embed] });
  },
};