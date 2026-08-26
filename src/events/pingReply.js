import GuildConfig from "../models/GuildConfig.js";

export default {
  name: "messageCreate",
  async execute(message, client) {
    // Ignore bots
    if (message.author.bot) return;

    // Ignore replies *to the bot’s messages*
    if (message.reference) {
      try {
        const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
        if (repliedMsg.author.id === client.user.id) {
          return; // user replied to bot → don't trigger
        }
      } catch {
        // ignore if fetch fails
      }
    }

    // ✅ Determine correct prefix (use guild-specific if exists)
    let PREFIX = process.env.PREFIX || "!";
    if (message.guild) {
      try {
        const guildConfig = await GuildConfig.findOne({ guildId: message.guild.id });
        if (guildConfig?.prefix) PREFIX = guildConfig.prefix;
      } catch (err) {
        console.error("⚠️ Failed to fetch guild prefix in messageCreate:", err);
      }
    }

    // ✅ Only respond if the bot itself is directly mentioned
    if (
      message.mentions.users.has(client.user.id) && // bot is mentioned
      !message.mentions.everyone &&                 // not @everyone
      message.mentions.roles.size === 0             // not a role mention
    ) {
      return message.reply(
        `👋 Hey ${message.author}, my prefix is \`${PREFIX}\`.\nType \`${PREFIX}help\` to see my commands!`
      );
    }
  },
};