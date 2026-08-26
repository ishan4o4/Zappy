import User from "../../models/User.js";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export default {
  name: "register",
  category: "Economy",
  description: "Register your account in the economy system",
  async execute(message) {
    const PREFIX = process.env.PREFIX || "!";
    let user = await User.findOne({ userId: message.author.id });

    if (user) {
      const embed = new EmbedBuilder()
        .setColor("Yellow")
        .setTitle("⚠️ Already Registered")
        .setDescription("You already have an economy account!");
      return message.reply({ embeds: [embed] });
    }

    const termsEmbed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("📋 Economy System Terms and Rules")
      .setDescription("Please read the terms below and click **I Agree** to register your account.")
      .addFields([
        {
          name: "🔹 Virtual Currency Only",
          value: "The currency in this system is purely virtual and has no real-world monetary value.",
          inline: false
        },
        {
          name: "🔹 No Real Money Transactions",
          value: "No exchange of bot currency for real money is allowed.",
          inline: false
        },
        {
          name: "🔹 Fair Use",
          value: "Any attempts at cheating, exploiting, or botting may result in penalties or account suspension.",
          inline: false
        },
        {
          name: "🔹 Data Privacy",
          value: "Your Discord ID and economy data are stored securely and not shared externally.",
          inline: false
        },
        {
          name: "🔹 Age Limit",
          value: "You must be aged 13 or older to use this system.",
          inline: false
        },
        {
          name: "🔹 Admin Rights",
          value: "Admins reserve the right to reset or modify accounts to maintain system integrity.",
          inline: false
        }
      ])
      .setFooter({ text: "Click 'I Agree' below to accept these terms and register." })
      .setTimestamp();

    const agreeButton = new ButtonBuilder()
      .setCustomId("agree_terms")
      .setLabel("✅ I Agree")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(agreeButton);

    const termsMessage = await message.reply({ embeds: [termsEmbed], components: [row] });

    const collector = termsMessage.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id,
      time: 300000,
      max: 1
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "agree_terms") {
        
        const disabledRow = new ActionRowBuilder().addComponents(
          agreeButton.setDisabled(true)
        );

        user = new User({
          userId: message.author.id,
          agreedToTerms: true,
          agreedAt: new Date()
        });
        await user.save();

        const successEmbed = new EmbedBuilder()
          .setColor("Green")
          .setTitle("🎉 Account Registered")
          .setDescription(`Your economy account is now registered! Use \`${PREFIX}daily\` to claim rewards.`)
          .setTimestamp();

        await interaction.update({ embeds: [successEmbed], components: [disabledRow] });
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        
        const disabledRow = new ActionRowBuilder().addComponents(
          agreeButton.setDisabled(true)
        );
        termsMessage.edit({ components: [disabledRow] }).catch(() => {});
      }
    });
  },
};