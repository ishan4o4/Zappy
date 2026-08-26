import { EmbedBuilder } from "discord.js";
import Minion from "../../../models/Minion.js";
import User from "../../../models/User.js";
import { shopItems } from "../../../config/shopItems.js";

export default {
  async execute(message, args, user) {
    const prefix = process.env.PREFIX || "!";
    const userId = message.author.id;
    if (args.length < 2) return message.reply(`⚠️ Usage: \`${prefix}minion equip <slot> <minionId>\``);

    const slotNum = parseInt(args[0], 10);
    const minionId = args[1];

    if (isNaN(slotNum) || slotNum < 1 || slotNum > user.minionSlots)
      return message.reply(`⚠️ Slot must be 1 to ${user.minionSlots}`);

    // Check if user owns the minion in inventory
    const inventoryMinion = user.inventory.minions?.find(m => m.id === minionId);
    if (!inventoryMinion) return message.reply("❌ You don't own this minion.");

    // Check for equipped minions and slots
    const equippedMinions = await Minion.find({ userId, startedAt: { $ne: null } }).sort({ startedAt: 1 });
    if (equippedMinions.length >= slotNum) {
      const occupying = equippedMinions[slotNum - 1];
      if (occupying.minionId !== minionId)
        return message.reply(`❌ Slot ${slotNum} is occupied by minion \`${occupying.minionId}\`. Unequip first.`);
    }

    let minionDoc = await Minion.findOne({ userId, minionId });
    const now = new Date();

    if (!minionDoc) {
      minionDoc = new Minion({
        userId,
        minionId,
        ore: inventoryMinion.id.split("_")[0],
        startedAt: now,
        lastCollected: now,
        storage: inventoryMinion.storage || 0,
        capacity: inventoryMinion.maxStorage || 200,
        miningRate: inventoryMinion.speed,
      });
    } else {
      minionDoc.startedAt = now;
      minionDoc.lastCollected = now;
    }

    await minionDoc.save();

    const shopData = shopItems.Minions.find(m => m.id === inventoryMinion.id.split("_")[0]) || {};

    const embed = new EmbedBuilder()
      .setTitle("✅ Minion Equipped")
      .setColor("Green")
      .setDescription(`${shopData.emoji || "🤖"} **${inventoryMinion.name}** equipped in slot ${slotNum}!`)
      .addFields(
        { name: "⛏️ Ore", value: minionDoc.ore, inline: true },
        { name: "⚡ Speed", value: `${minionDoc.miningRate}s per ore`, inline: true },
        { name: "🪙 Yield", value: `${shopData.yield ? `${shopData.yield.min}–${shopData.yield.max}` : "N/A"} ores per cycle`, inline: true },
        { name: "📦 Storage Capacity", value: `${minionDoc.capacity}`, inline: true }
      );

    return message.channel.send({ embeds: [embed] });
  },
};