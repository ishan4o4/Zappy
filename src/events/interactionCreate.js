import { Events } from "discord.js";
import { handleShopCategory, handleShopBuy } from "../commands/shop/shop.js";
import bankCommand from "../commands/bank/bank.js"; 

export default {
  name: Events.InteractionCreate,

  async execute(interaction) {
    try {
      
      if (interaction.isStringSelectMenu() && interaction.customId === "bank_select") {
        return await bankCommand.handleSelectMenu(interaction);
      }

      if (interaction.isStringSelectMenu() && interaction.customId === "shop-category") {
        return await handleShopCategory(interaction);
      }

      if (interaction.isButton() && interaction.customId.startsWith("buy-")) {
        return await handleShopBuy(interaction);
      }

    } catch (err) {
      console.error("❌ Interaction error:", err);

      try {
        if (interaction.deferred || interaction.replied) {
          
          await interaction.followUp({
            content: "⚠️ Something went wrong!",
            ephemeral: true,
          });
        } else {
          
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