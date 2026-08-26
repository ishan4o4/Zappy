import GuildConfig from "../models/GuildConfig.js";

export default {
  name: "messageCreate",
  async execute(message, client) {
    
    if (message.author.bot) return;

    if (message.reference) {
      try {
        const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
        if (repliedMsg.author.id === client.user.id) {
          return; 
        }
      } catch {
        
      }
    }

    let PREFIX = process.env.PREFIX || "!";
    if (message.guild) {
      try {
        const guildConfig = await GuildConfig.findOne({ guildId: message.guild.id });
        if (guildConfig?.prefix) PREFIX = guildConfig.prefix;
      } catch (err) {
        console.error("⚠️ Failed to fetch guild prefix in messageCreate:", err);
      }
    }

    if (
      message.mentions.users.has(client.user.id) && 
      !message.mentions.everyone &&                 
      message.mentions.roles.size === 0             
    ) {
      return message.reply(
        `👋 Hey ${message.author}, my prefix is \`${PREFIX}\`.\nType \`${PREFIX}help\` to see my commands!`
      );
    }
  },
};