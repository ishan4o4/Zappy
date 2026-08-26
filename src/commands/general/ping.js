import { EmbedBuilder } from "discord.js";

export default {
  name: "ping",
  category: "General",
  description: "Check bot latency",
  async execute(message, args, client) {
    const sent = await message.reply("🏓 Pinging...");
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("🏓 Pong!")
      .addFields(
        { name: "Message Latency", value: `${latency}ms`, inline: true },
        { name: "API Latency", value: `${apiLatency}ms`, inline: true }
      )
      .setTimestamp();

    sent.edit({ content: " ", embeds: [embed] });
  },
};