import User from "../../models/User.js";
import { EmbedBuilder } from "discord.js";

export default {
  name: "leaderboard",
  aliases: ["lb"],
  category: "Economy",
  description: "Show the top users leaderboard based on total economy balance (wallet + bank + reserved).",
  async execute(message) {
    const PREFIX = process.env.PREFIX || "!";

    const topUsers = await User.aggregate([
      {
        $addFields: {
          bankBalance: { $ifNull: ["$bank.bankBalance", 0] },
          reserved: { $ifNull: ["$bank.reserved", 0] },
          wallet: { $ifNull: ["$balance", 0] }
        }
      },
      {
        $addFields: {
          totalBalance: { $add: ["$wallet", "$bankBalance", "$reserved"] }
        }
      },
      { $sort: { totalBalance: -1 } },
      { $limit: 10 }
    ]);

    if (!topUsers.length) {
      const embed = new EmbedBuilder()
        .setColor("Yellow")
        .setTitle("Leaderboard")
        .setDescription("No users found in the economy system yet. Be the first to register!");
      return message.reply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setColor("Gold")
      .setTitle("🏆 Economy Leaderboard")
      .setDescription("Top 10 users by total balance (wallet + bank + reserved):");

    let description = "";
    for (let i = 0; i < topUsers.length; i++) {
      const user = topUsers[i];
      const userTag = await message.client.users.fetch(user.userId).then(u => u.tag).catch(() => "Unknown User");
      description += `**${i + 1}.** ${userTag} - ${(user.totalBalance).toLocaleString()} <:zappcoin:1410248547781185567>\n`;
    }

    embed.setDescription(description);

    return message.reply({ embeds: [embed] });
  },
};