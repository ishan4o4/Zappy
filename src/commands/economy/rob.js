import User from "../../models/User.js";
import { EmbedBuilder } from "discord.js";
import { payDebtFromEarnings } from "../../utils/bankHelpers.js";

const robCooldowns = new Map();

function weightedStealAmount(minPercent, maxPercent) {

  const weights = [
    { percent: 0.05, weight: 50 },  
    { percent: 0.10, weight: 25 },  
    { percent: 0.20, weight: 15 },  
    { percent: 0.35, weight: 7 },   
    { percent: 0.50, weight: 3 },   
  ];
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let random = Math.random() * totalWeight;
  for (const entry of weights) {
    if (random < entry.weight) return entry.percent;
    random -= entry.weight;
  }
  return 0.05; 
}

export default {
  name: "rob",
  category: "Economy",
  description: "Rob a user who has a wallet > 5,500.",
  async execute(message, args) {
    const prefix = process.env.PREFIX || "!";
    const authorId = message.author.id;
    const target = message.mentions.users.first();

    if (!target) {
      return message.reply(`⚠️ Mention a user to rob. Usage: \`${prefix}rob @user\``);
    }
    if (target.id === authorId) {
      return message.reply("❌ You cannot rob yourself!");
    }

    const cooldown = 60 * 1000;
    const lastRob = robCooldowns.get(authorId) || 0;
    const now = Date.now();
    if (now - lastRob < cooldown) {
      const remaining = Math.ceil((cooldown - (now - lastRob)) / 1000);
      return message.reply(`⏳ Please wait ${remaining}s before robbing again.`);
    }

    const user = await User.findOne({ userId: authorId });
    if (!user) {
      return message.reply(`❌ Register first with \`${prefix}register\`.`);
    }

    const victim = await User.findOne({ userId: target.id });
    if (!victim) {
      return message.reply("❌ Target user is not registered.");
    }

    if (victim.balance <= 5500) {
      return message.reply("❌ Target must have more than 5,500 in wallet to be robbed.");
    }

    const success = Math.random() < 0.8;
    if (!success) {
      
      const penalty = Math.min(Math.floor(user.balance * 0.1), user.balance);
      user.balance -= penalty;
      await user.save();
      robCooldowns.set(authorId, now);

      const failEmbed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("💥 Robbery Failed!")
        .setDescription(`You were caught and fined ${penalty.toLocaleString()} <:zappcoin:1410248547781185567>!`);

      return message.reply({ embeds: [failEmbed] });
    }

    const stealPercent = weightedStealAmount(0.05, 0.5);
    const stolenAmount = Math.max(1, Math.floor(victim.balance * stealPercent));

    victim.balance -= stolenAmount;
    user.balance += await payDebtFromEarnings(user, stolenAmount);
    await victim.save();
    await user.save();
    robCooldowns.set(authorId, now);

    const successEmbed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("💰 Robbery Successful!")
      .setDescription(`You robbed ${target.username} and stole ${stolenAmount.toLocaleString()} <:zappcoin:1410248547781185567>!`)
      .addFields(
        { name: "Your New Balance", value: user.balance.toLocaleString(), inline: true },
        { name: `${target.username}'s New Balance`, value: victim.balance.toLocaleString(), inline: true }
      );

    return message.reply({ embeds: [successEmbed] });
  }
};