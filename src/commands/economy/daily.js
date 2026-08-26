import User from "../../models/User.js";
import { EmbedBuilder } from "discord.js";
import { payDebtFromEarnings } from "../../utils/bankHelpers.js";

export default {
  name: "daily",
  category: "Economy",
  description: "Claim your daily reward",
  async execute(message) {
    const PREFIX = process.env.PREFIX || "!";
    const user = await User.findOne({ userId: message.author.id });

    if (!user) {
      return message.reply(`❌ You don’t have an account! Use \`${PREFIX}register\` first.`);
    }

    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000; 
    const timeSinceLast = now - user.lastDaily;

    if (timeSinceLast < cooldown) {
      const remaining = cooldown - timeSinceLast;
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);

      const embed = new EmbedBuilder()
        .setColor("Yellow")
        .setTitle("⏳ Daily Already Claimed")
        .setDescription(
          `You can claim your next daily in **${hours}h ${minutes}m ${seconds}s**.\n` +
          `Your current streak: **${user.dailyStreak || 0}** 🔥`
        );
      return message.reply({ embeds: [embed] });
    }

    const within48h = timeSinceLast <= 2 * cooldown;
    if (within48h) {
      user.dailyStreak = (user.dailyStreak || 0) + 1;
    } else {
      
      user.lastStreakReset = new Date();
      user.dailyStreak = 1;
    }

    const baseReward = Math.floor(Math.random() * 50) + 50; 
    const streakBonus = Math.floor(baseReward * Math.min(user.dailyStreak * 0.05, 1)); 
    const totalReward = baseReward + streakBonus;

    let jackpotMessage = "";
    if (Math.random() < 0.02) { 
      const jackpotAmount = Math.floor(Math.random() * 500) + 500; 
      jackpotMessage = `🎉 **JACKPOT!** You won an extra **${jackpotAmount} coins**!\n`;
      user.balance += jackpotAmount;
    }

    user.balance += await payDebtFromEarnings(user, totalReward);
    user.lastDaily = now;
    await user.save();

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("💰 Daily Reward")
      .setDescription(
        `${jackpotMessage}You claimed **${totalReward} coins** (*Base: ${baseReward}, Bonus: +${streakBonus}*).\n` +
        `🔥 Current Streak: **${user.dailyStreak} days**\n` +
        `💰 New Balance: **${user.balance}**`
      );

    if (user.lastStreakReset) {
      embed.setFooter({ text: `Your last streak was reset on ${user.lastStreakReset.toDateString()}` });
    }

    return message.reply({ embeds: [embed] });
  },
};