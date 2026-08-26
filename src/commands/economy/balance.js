import User from "../../models/User.js";
import { EmbedBuilder } from "discord.js";

export default {
  name: "balance",
  aliases: ["bal", "cash"],
  category: "Economy",
  description: "Show your wallet and bank balance.",
  async execute(message) {
    const PREFIX = process.env.PREFIX || "!";
    const user = await User.findOne({ userId: message.author.id });

    if (!user) {
      const embed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("❌ Not Registered")
        .setDescription(`You need to register first! Use \`${PREFIX}register\`.`);
      return message.reply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("💰 Your Account Balance")
      .addFields(
        { name: "🪙 Wallet", value: `${user.balance.toLocaleString()} <:zappcoin:1410248547781185567>`, inline: true }
      );

    if (user.bank.hasAccount) {
      embed.addFields(
        { name: "🏦 Bank Balance", value: `${user.bank.bankBalance.toLocaleString()} <:zappcoin:1410248547781185567>`, inline: true },
        { name: "🔒 Reserved Balance", value: `${user.bank.reserved.toLocaleString()} <:zappcoin:1410248547781185567> (cannot withdraw)`, inline: true },
        { name: "💳 Outstanding Loan", value: `${user.bank.loan.toLocaleString()} <:zappcoin:1410248547781185567>`, inline: true },
        { name: "🏦 Max Loan Limit", value: `${(user.bank.reserved).toLocaleString()} <:zappcoin:1410248547781185567>`, inline: true },
      );
    }

    return message.reply({ embeds: [embed] });
  },
};