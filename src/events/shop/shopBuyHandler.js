import User from "../../models/User.js";
import { shopItems } from "../../config/shopItems.js";

export default async function shopBuyHandler(interaction) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith("buy-")) return;

  const [, category, itemId] = interaction.customId.split("-");
  const item = shopItems[category]?.find(i => i.id === itemId);

  if (!item) {
    return interaction.reply({ content: "⚠️ Item not found.", ephemeral: true });
  }

  const user = await User.findOne({ userId: interaction.user.id });
  if (!user) {
    return interaction.reply({ content: "❌ Register first with `!register`.", ephemeral: true });
  }

  if (user.balance < item.cost) {
    return interaction.reply({ content: "❌ Not enough ZappCoins!", ephemeral: true });
  }

  // Deduct coins
  user.balance -= item.cost;

  // Add item
  if (category === "Pickaxes") {
    user.pickaxe = {
      name: item.name,
      durability: item.durability,
      maxDurability: item.durability,
      power: item.power,
    };
  } else if (category === "Minions") {
    user.inventory.minions.push({ id: item.id, name: item.name, tier: item.tier, speed: item.speed });
  }

  await user.save();

  await interaction.reply({
    content: `✅ You bought **${item.name}** for **${item.cost} ZappCoins**!`,
    ephemeral: true,
  });
}