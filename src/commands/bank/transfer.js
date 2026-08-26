import User from "../../models/User.js";
import { payDebtFromEarnings } from "../../utils/bankHelpers.js";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

export default {
  name: "transfer",
  category: "Bank",
  description: "Transfer money to another user's bank account using their Bank Account ID.",

  async execute(message, args) {
    const PREFIX = process.env.PREFIX || "!";
    const authorId = message.author.id;

    const [maybeBankId, maybeAmount] = args;
    if (maybeBankId && maybeAmount) {
      return await this._processTransferByArgs(message, maybeBankId, maybeAmount);
    }

    const uiEmbed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("💸 Bank Transfer")
      .setDescription("Transfer funds to another user's bank account using their **Bank Account ID**. Click the button below to enter transfer details.")
      .addFields(
        { name: "Minimum Reserved", value: `5,000 (must be maintained)`, inline: true },
        { name: "Loans/Debts", value: "You cannot transfer if you have an outstanding loan or debt.", inline: true },
        { name: "Tax", value: "A small bank fee applies (less fee with higher reserved balance).", inline: true }
      )
      .setFooter({ text: `Quick command: ${PREFIX}bank transfer <BankID> <amount>` })
      .setTimestamp();

    const openModalButton = new ButtonBuilder()
      .setCustomId("bank_transfer_open_modal")
      .setLabel("Enter Transfer Details")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(openModalButton);

    const sent = await message.reply({ embeds: [uiEmbed], components: [row] });

    const filter = (i) => i.isButton() && i.customId === "bank_transfer_open_modal" && i.user.id === authorId;
    const collector = sent.createMessageComponentCollector({ filter, time: 120000, max: 1 });

    collector.on("collect", async (interaction) => {
      
      const modal = new ModalBuilder().setCustomId("bank_transfer_modal").setTitle("Bank Transfer Details");

      const bankIdInput = new TextInputBuilder()
        .setCustomId("bankId")
        .setLabel("Recipient Bank Account ID")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. B-1234-ABCD")
        .setRequired(true);

      const amountInput = new TextInputBuilder()
        .setCustomId("amount")
        .setLabel("Amount to transfer (gross)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Enter a whole number, e.g. 15000")
        .setRequired(true);

      const firstRow = new ActionRowBuilder().addComponents(bankIdInput);
      const secondRow = new ActionRowBuilder().addComponents(amountInput);

      modal.addComponents(firstRow, secondRow);

      try {
        await interaction.showModal(modal);
      } catch (err) {
        console.error("Failed to show modal:", err);
        return interaction.reply({ content: "❌ Failed to open transfer modal.", ephemeral: true });
      }

      const modalFilter = (m) => m.isModalSubmit() && m.customId === "bank_transfer_modal" && m.user.id === authorId;

      const modalCollector = interaction.client.once("interactionCreate", async (modalInteraction) => {
        try {
          if (!modalInteraction.isModalSubmit()) return;
          if (modalInteraction.customId !== "bank_transfer_modal") return;
          if (modalInteraction.user.id !== authorId) {
            return modalInteraction.reply({ content: "❌ You cannot submit this modal.", ephemeral: true });
          }

          const recipientBankId = modalInteraction.fields.getTextInputValue("bankId").trim();
          const amountStr = modalInteraction.fields.getTextInputValue("amount").trim();

          await modalInteraction.deferReply({ ephemeral: true });
          const result = await this._processTransferByArgs(modalInteraction, recipientBankId, amountStr, true);

          if (result && typeof result === "object" && result.embed) {
            return modalInteraction.editReply({ embeds: [result.embed], content: result.content || null });
          }

          return;
        } catch (e) {
          console.error(e);
          try { await modalInteraction.editReply({ content: "❌ An unexpected error occurred while processing the transfer." }); } catch(e){}
        }
      });

      collector.on("end", async (collected) => {
        if (collected.size === 0) {
          try {
            await sent.edit({ components: [] });
          } catch (e) {}
        }
      });
    });
  },

  async _processTransferByArgs(context, recipientBankId, amountStr, fromInteraction = false) {
    
    const isInteraction = Boolean(context?.isRepliable === undefined ? context?.isCommand?.() : false) || fromInteraction || (context?.isButton && true) || (context?.isModalSubmit && true) || (context?.user && context.fields);
    
    const reply = async (payload) => {
      try {
        if (fromInteraction || (context && context.isModalSubmit) || (context && context.isCommand) || (context && context.reply && context.deferred)) {
          
          if (payload.embeds || payload.content || payload.components) {
            
            try {
              return await context.editReply(payload);
            } catch (e) {
              return await context.reply({ ...payload, ephemeral: true });
            }
          }
          return await context.reply({ content: payload.content || null, embeds: payload.embeds || [], ephemeral: true });
        } else if (context && context.reply) {
          return await context.reply(payload);
        }
      } catch (err) {
        console.error("Reply failed:", err);
      }
    };

    const PREFIX = process.env.PREFIX || "!";

    const userId = context.user?.id || context.author?.id;
    if (!userId) return reply({ content: "❌ Unable to determine user." });

    const giver = await User.findOne({ userId });
    if (!giver) return reply({ content: `❌ You don't have an account. Use \`${PREFIX}register\` first.` });

    if (!giver.bank?.hasAccount) return reply({ content: `❌ You don't have a bank account. Use \`${PREFIX}bank acc register\`.` });
    if ((giver.bank.loan || 0) > 0) return reply({ content: `❌ You cannot transfer while you have an outstanding loan. Repay it first.` });
    if ((giver.bank.debt || 0) > 0) return reply({ content: `❌ You cannot transfer while you have outstanding debt. Clear your debt first.` });
    const MIN_RESERVED = 5000;
    if ((giver.bank.reserved || 0) < MIN_RESERVED) return reply({ content: `❌ You must maintain a minimum reserved balance of ${MIN_RESERVED.toLocaleString()} to make transfers.` });

    const amount = Math.floor(Number(amountStr));
    if (!Number.isFinite(amount) || amount <= 0) return reply({ content: `❌ Please provide a valid amount greater than 0.` });

    const giverBankBalance = giver.bank.bankBalance || 0;
    if (giverBankBalance < amount) return reply({ content: `❌ Insufficient bank balance. Your bank balance: ${giverBankBalance.toLocaleString()}.` });

    const recipient = await User.findOne({ "bank.bankAccountId": recipientBankId });
    if (!recipient || !recipient.bank?.hasAccount) return reply({ content: `❌ Recipient bank account ID not found. Make sure the Bank Account ID is correct.` });
    if (recipient.userId === giver.userId) return reply({ content: `❌ You cannot transfer to your own bank account.` });

    let taxRate = 0.02;
    const reserved = giver.bank.reserved || 0;
    if (reserved >= 100000) taxRate = 0.005;
    else if (reserved >= 50000) taxRate = 0.01;
    else if (reserved >= 10000) taxRate = 0.015;

    const taxAmount = Math.ceil(amount * taxRate);
    const netAmount = amount - taxAmount;
    if (netAmount <= 0) return reply({ content: `❌ Amount too small after tax. Increase the transfer amount.` });

    giver.bank.bankBalance = giverBankBalance - amount;

    const recipientInitialDebt = recipient.bank.debt || 0;
    let amountAfterDebt = netAmount;
    if (recipientInitialDebt > 0) {
      
      amountAfterDebt = await payDebtFromEarnings(recipient, netAmount);
    }
    const debtPaid = Math.min(netAmount, recipientInitialDebt);
    const creditedToBank = amountAfterDebt;

    recipient.bank.bankBalance = (recipient.bank.bankBalance || 0) + creditedToBank;

    await giver.save();
    await recipient.save();

    const resultEmbed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("💸 Transfer Complete")
      .setDescription(`**${amount.toLocaleString()}** has been transferred to **${recipient.userId}** (Bank ID: ${recipientBankId}).`)
      .addFields(
        { name: "Transferred (gross)", value: `${amount.toLocaleString()}`, inline: true },
        { name: "Tax deducted", value: `${taxAmount.toLocaleString()} (${(taxRate * 100).toFixed(2)}%)`, inline: true },
        { name: "Recipient received (net)", value: `${netAmount.toLocaleString()}`, inline: true },
        { name: "Paid towards recipient's debt", value: `${debtPaid.toLocaleString()}`, inline: true },
        { name: "Credited to recipient's bank", value: `${creditedToBank.toLocaleString()}`, inline: true },
        { name: "Your new bank balance", value: `${giver.bank.bankBalance.toLocaleString()}`, inline: true },
        { name: "Recipient new bank balance", value: `${recipient.bank.bankBalance.toLocaleString()}`, inline: true }
      )
      .setFooter({ text: `Use ${PREFIX}bank acc info to view account details` })
      .setTimestamp();

    if (fromInteraction) {
      return { embed: resultEmbed };
    }

    return await reply({ embeds: [resultEmbed], content: null });
  }
};