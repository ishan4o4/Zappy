import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ComponentType,
} from "discord.js";
import GuildConfig from "../../models/GuildConfig.js";

export default {
  name: "help",
  category: "General",
  description: "Interactive help menu",
  async execute(message, args, client) {
    let PREFIX = process.env.PREFIX || "!";
    if (message.guild) {
      try {
        const guildConfig = await GuildConfig.findOne({ guildId: message.guild.id });
        if (guildConfig?.prefix) PREFIX = guildConfig.prefix; // ✅ fixed lowercase key
      } catch (err) {
        console.error("⚠️ Failed to fetch guild prefix:", err);
      }
    }

    // Collect all categories and their commands
    const categories = {};
    client.commands.forEach((cmd) => {
      const category = cmd.category || "General";
      if (!categories[category]) categories[category] = [];
      categories[category].push(cmd);
    });

    // Default embed (overview)
    const embed = new EmbedBuilder()
      .setColor("Purple")
      .setTitle("📜 Help Menu")
      .setDescription(
        `Select a category from the dropdown below.\nUse \`${PREFIX}<command>\` to run commands.`
      )
      .setFooter({
        text: `Requested by ${message.author.tag}`,
        iconURL: message.author.displayAvatarURL(),
      })
      .setTimestamp();

    // Create dropdown options dynamically
    const options = Object.keys(categories).map((cat) => ({
      label: cat,
      description: `View commands in ${cat}`,
      value: cat,
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("help-menu")
        .setPlaceholder("📂 Choose a category")
        .addOptions(options)
    );

    // Send the help menu
    const helpMessage = await message.reply({
      embeds: [embed],
      components: [row],
    });

    // Create a collector for dropdown interaction
    const collector = helpMessage.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60_000, // 1 min
    });

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({
          content: "❌ This menu isn’t for you!",
          ephemeral: true,
        });
      }

      const selectedCategory = interaction.values[0];
      const commandsList = categories[selectedCategory]
        .map((c) => `\`${PREFIX}${c.name}\` - ${c.description}`)
        .join("\n");

      const categoryEmbed = new EmbedBuilder()
        .setColor("Green")
        .setTitle(`📂 ${selectedCategory} Commands`)
        .setDescription(commandsList || "No commands in this category.")
        .setFooter({
          text: `Requested by ${message.author.tag}`,
          iconURL: message.author.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.update({ embeds: [categoryEmbed], components: [row] });
    });

    collector.on("end", () => {
      // Disable dropdown after timeout
      const disabledRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("help-menu")
          .setPlaceholder("📂 Menu expired")
          .addOptions(options)
          .setDisabled(true)
      );
      helpMessage.edit({ components: [disabledRow] });
    });
  },
};