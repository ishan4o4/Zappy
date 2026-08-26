import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { shopItems } from "../../config/shopItems.js";
import User from "../../models/User.js";

export default async function shopCategoryHandler(interaction) {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "shop-category") return;

  const category = interaction.values[0];
  const items = shopItems[category];

  if (!items) {
    return interaction.reply({ content: "⚠️ Invalid category.", ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor("Blue")
    .setTitle(`🛒 ${category} Shop`)
    .setDescription(
      items.map((i, index) => 
        `**${index + 1}. ${i.name}**\n💰 Price: ${i.cost || i.value} ZappCoins\n${i.description || ""}`
      ).join("\n\n")
    )
    .setFooter({ text: "Click a button below to buy!" });

  const rows = [];
  for (let i = 0; i < items.length; i++) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`buy-${category}-${items[i].id}`)
          .setLabel(`Buy ${items[i].name}`)
          .setStyle(ButtonStyle.Success)
      )
    );
  }

  await interaction.update({ embeds: [embed], components: rows });
}