
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import User from "../../models/User.js";
import { clearStrikes } from "../../utils/miningProtection.js";

const MOD_CHANNEL_ID = process.env.MOD_CHANNEL_ID || "1411340085462302831";

export default {
  name: "appeal",
  category: "Mining",
  description: "Submit an appeal to request review of mining strikes/locks.",
  usage: "appeal <reason>",
  async execute(message, args) {
    const prefix = process.env.PREFIX || "!";
    const reason = args.join(" ").trim();
    if (!reason) return message.reply(`❌ Usage: \`${prefix}appeal <reason>\` — explain why you believe the strikes/lock are a mistake.`);

    const userId = message.author.id;
    const user = await User.findOne({ userId });
    if (!user) return message.reply("❌ You don't have an account to appeal for.");

    const embed = new EmbedBuilder()
      .setTitle("⚖️ Mining Appeal")
      .setDescription(`User <@${user.userId}> submitted an appeal.`)
      .addFields(
        { name: "User ID", value: user.userId, inline: true },
        { name: "Strikes", value: `${user.miningProtection?.strikes || 0}`, inline: true },
        { name: "Locked Until", value: user.miningProtection?.lockedUntil ? new Date(user.miningProtection.lockedUntil).toLocaleString() : "N/A", inline: true },
        { name: "Reason", value: reason }
      )
      .setTimestamp();

    const approve = new ButtonBuilder().setCustomId(`appeal_approve_${user.userId}`).setLabel("Approve").setStyle(ButtonStyle.Success);
    const reject = new ButtonBuilder().setCustomId(`appeal_reject_${user.userId}`).setLabel("Reject").setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(approve, reject);

    const modChannel = await message.client.channels.fetch(MOD_CHANNEL_ID);
    if (!modChannel) {
      return message.reply("❌ Moderator channel not found. Contact admins.");
    }

    const sent = await modChannel.send({ content: `<@&${modChannel.guild?.roles?.moderator || ""}>`, embeds: [embed], components: [row] });

    await message.reply("✅ Your appeal has been submitted to moderators. You will be notified of the decision.");

    const filter = i => i.isButton();
    const collector = sent.createMessageComponentCollector({ filter, time: 3 * 24 * 60 * 60 * 1000 }); 

    collector.on("collect", async (interaction) => {
      
      const member = interaction.member;
      if (!member?.permissions?.has("ManageGuild")) {
        return interaction.reply({ content: "❌ You must be a moderator to perform this action.", ephemeral: true });
      }

      const [action, , targetUserId] = interaction.customId.split("_"); 
      if (!targetUserId) return interaction.reply({ content: "Invalid action.", ephemeral: true });

      const targetUser = await User.findOne({ userId: targetUserId });
      if (!targetUser) {
        await interaction.update({ content: "Target user not found in database.", embeds: [], components: [] });
        return;
      }

      if (action === "appeal" && interaction.customId.startsWith("appeal_approve")) {
        await clearStrikes(targetUser, interaction.user.id);
        await interaction.update({ content: `✅ Appeal approved by <@${interaction.user.id}>. Strikes reset for <@${targetUserId}>.`, embeds: [], components: [] });
        try {
          const dm = await message.client.users.fetch(targetUserId);
          await dm.send(`✅ Your appeal has been approved by a moderator. Your mining strikes have been reset. You may resume normal activity.`);
        } catch (e) {  }
      } else {
        await interaction.update({ content: `❌ Appeal rejected by <@${interaction.user.id}>.`, embeds: [], components: [] });
        try {
          const dm = await message.client.users.fetch(targetUserId);
          await dm.send(`❌ Your appeal was rejected by a moderator. If you believe this is an error, you may open another appeal or contact the moderation team.`);
        } catch (e) {}
      }
    });

    collector.on("end", async () => {
      
      try { await sent.edit({ components: [] }); } catch (e) {}
    });
  }
};