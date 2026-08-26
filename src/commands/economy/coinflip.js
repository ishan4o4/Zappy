import { EmbedBuilder } from "discord.js";
import User from "../../models/User.js";
import { payDebtFromEarnings } from "../../utils/bankHelpers.js";

const cooldowns = new Map(); // In-memory cooldown tracking

export default {
  name: "coinflip",
  aliases: ["cf"],
  category: "Economy",
  description: "Flip a coin and bet ZappCoins",
  usage: "cf <amount> [h|t]",
  async execute(message, args) {
    const prefix = process.env.PREFIX || "!";
    const zappcoinEmoji = "<:zappcoin:1410248547781185567>";
    const userId = message.author.id;

    // Check per-user flip cooldown (5 seconds)
    const now = Date.now();
    const lastFlip = cooldowns.get(userId) || 0;
    if (now - lastFlip < 5000) {
      const remaining = Math.ceil((5000 - (now - lastFlip)) / 1000);
      return message.reply(`⏳ You must wait **${remaining}s** before flipping again.`);
    }
    cooldowns.set(userId, now);

    // Parse bet amount
    const amount = parseInt(args[0], 10);
    if (isNaN(amount) || amount <= 0) {
      return message.reply(`❌ Usage: \`${prefix}cf <amount> [h|t]\``);
    }
    if (amount > 100000) {
      return message.reply("❌ Maximum bet is 100,000 ZappCoins.");
    }

    // Find user
    const user = await User.findOne({ userId });
    if (!user) {
      return message.reply(`❌ You don’t have an account! Use \`${prefix}register\` first.`);
    }
    if (user.balance < amount) {
      return message.reply(`❌ You only have ${user.balance} ${zappcoinEmoji}.`);
    }

    // Determine user choice
    let choice = (args[1] || "h").toLowerCase();
    if (!["h", "t", "heads", "tails"].includes(choice)) choice = "h";
    choice = choice.startsWith("t") ? "t" : "h";
    const choiceName = choice === "h" ? "Heads" : "Tails";

    // Deduct bet
    user.balance -= amount;
    await user.save();

    // Send loading embed
    const loading = new EmbedBuilder()
      .setColor("Grey")
      .setTitle("🪙 Coinflip")
      .setDescription("Flipping the coin... please wait")
      .setFooter({ text: "This will take a couple of seconds." });
    const flipMessage = await message.reply({ embeds: [loading] });

    // Wait 2 seconds for animation effect
    await new Promise(res => setTimeout(res, 2000));

    // Perform flip — 45% chance to win, 55% to lose
    const flip = Math.random() < 0.45 ? "h" : "t";
    const resultName = flip === "h" ? "Heads" : "Tails";

    let embed;
    if (flip === choice) {
      const winnings = amount * 2;
      user.balance += await payDebtFromEarnings(user, winnings);
      await user.save();
      embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("🎉 You Win!")
        .setDescription(
          `You chose **${choiceName}** and it landed on **${resultName}**.\n\n` +
          `You won **${winnings}** ${zappcoinEmoji}!\n` +
          `Your new balance: **${user.balance}** ${zappcoinEmoji}`
        );
    } else {
      embed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("😞 You Lose")
        .setDescription(
          `You chose **${choiceName}** but it landed on **${resultName}**.\n\n` +
          `You lost **${amount}** ${zappcoinEmoji}.\n` +
          `Your new balance: **${user.balance}** ${zappcoinEmoji}`
        );
    }

    // Edit message with result embed
    await flipMessage.edit({ embeds: [embed] });
  },
};