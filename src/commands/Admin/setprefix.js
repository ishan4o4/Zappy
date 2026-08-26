import GuildConfig from "../../models/GuildConfig.js";
import { EmbedBuilder, PermissionsBitField } from "discord.js";

export default {
  name: "setprefix",
  category: "Admin",
  description: "Change the bot's prefix for this server.",
  usage: "setprefix <new_prefix>",
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return message.reply("❌ You must have the **Manage Server** permission to change the prefix.");
    }

    const newPrefix = args[0];
    if (!newPrefix) {
      return message.reply("❌ Please provide a new prefix. Example: `!setprefix $`");
    }

    if (newPrefix.length > 5) {
      return message.reply("❌ Prefix too long! Please use a prefix with 5 characters or fewer.");
    }

    let guildConfig = await GuildConfig.findOne({ guildId: message.guild.id });
    if (!guildConfig) {
      guildConfig = new GuildConfig({ guildId: message.guild.id, prefix: newPrefix });
    } else {
      guildConfig.prefix = newPrefix;
    }
    await guildConfig.save();

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("✅ Prefix Updated")
      .setDescription(`The new prefix for this server is now **\`${newPrefix}\`**`);

    return message.reply({ embeds: [embed] });
  },
};