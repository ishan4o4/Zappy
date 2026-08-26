import { shopItems } from "../../config/shopItems.js";
import User from "../../models/User.js";
import { payDebtFromEarnings } from "../../utils/bankHelpers.js";

export default {
  name: "sell",
  category: "Shop",
  description: "Sell ores for ZappCoins",
  async execute(message, args) {
    const prefix = process.env.PREFIX || "!";
    const zappcoinEmoji = "<:zappcoin:1410248547781185567>";
    const [id, amountStr] = args;
    const amount = parseInt(amountStr);

    if (!id || isNaN(amount) || amount <= 0) {
      return message.reply(`❌ Usage: \`${prefix}sell <ore> <amount>\``);
    }

    const ore = shopItems.Ores.find(o => o.id === id || o.id.replace(/\\_/g, '_') === id);
    if (!ore) {
      return message.reply(`❌ Invalid ore ID. Use ore IDs like: stone, coal, iron, gold, diamond, emerald, netherite`);
    }

    const user = await User.findOne({ userId: message.author.id });
    if (!user) {
      return message.reply(`❌ Register first with \`${prefix}register\`.`);
    }

    if (!user.inventory) {
      user.inventory = { pickaxes: [], minions: [], ores: new Map() };
    }

    const userAmount = user.inventory.ores.get(ore.id) || 0;
    if (userAmount < amount) {
      return message.reply(`❌ You only have **${userAmount}** ${ore.emoji} ${ore.name}.\n💡 Use \`${prefix}inventory\` to see your ores.`);
    }

    const earned = amount * ore.value;

    const remainingAmount = userAmount - amount;
    if (remainingAmount === 0) {
      user.inventory.ores.delete(ore.id); 
    } else {
      user.inventory.ores.set(ore.id, remainingAmount);
    }

    user.balance += await payDebtFromEarnings(user, earned);

    await user.save();

    const oreEmoji = ore.emoji ? ore.emoji.replace(/\\_/g, '_') : "💎";

    return message.reply(
      `✅ **Sale Successful!**\n\n` +
      `${oreEmoji} Sold **${amount}x ${ore.name}**\n` +
      `💰 Earned: **${earned}** ${zappcoinEmoji}\n` +
      `🏦 New Balance: **${user.balance}** ${zappcoinEmoji}\n\n` +
      `📦 Remaining ${ore.name}: **${remainingAmount}**`
    );
  },
};