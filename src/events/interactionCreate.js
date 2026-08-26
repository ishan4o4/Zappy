import { Events } from "discord.js";
import { handleShopCategory, handleShopBuy } from "../commands/shop/shop.js";
import bankCommand from "../commands/bank/bank.js"; // bank module

export default {
  name: Events.InteractionCreate,

  async execute(interaction) {
    try {
      // Bank dropdown select menu
      if (interaction.isStringSelectMenu() && interaction.customId === "bank_select") {
        return await bankCommand.handleSelectMenu(interaction);
      }

      // Shop category dropdown
      if (interaction.isStringSelectMenu() && interaction.customId === "shop-category") {
        return await handleShopCategory(interaction);
      }

      // Shop buy buttons
      if (interaction.isButton() && interaction.customId.startsWith("buy-")) {
        return await handleShopBuy(interaction);
      }

    } catch (err) {
      console.error("❌ Interaction error:", err);

      try {
        if (interaction.deferred || interaction.replied) {
          // Already acknowledged → send a follow-up
          await interaction.followUp({
            content: "⚠️ Something went wrong!",
            ephemeral: true,
          });
        } else {
          // Not acknowledged yet → safe to reply
          await interaction.reply({
            content: "⚠️ Something went wrong!",
            ephemeral: true,
          });
        }
      } catch (sendErr) {
        console.error("⚠️ Failed to send error reply:", sendErr.message);
      }
    }
  },
};