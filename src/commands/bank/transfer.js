import User from "../../models/User.js";
import { payDebtFromEarnings } from "../../utils/bankHelpers.js";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

// Command: transfer
// Category: Bank
// Usage (quick): `!bank transfer <recipientBankAccountId> <amount>`
// UI flow (if args missing): shows a nice embed with a button. When you click it a modal opens asking for Bank ID + Amount.
// Validations:
// - Giver must have a bank account
// - Giver must have NO loan and NO debt
// - Giver must maintain at least 5,000 reserved balance
// - Giver must have enough bankBalance to cover the gross amount
// - Cannot transfer to self
// Tax rules (bank fee burned):
// - reserved >= 100,000 => 0.5%
// - reserved >= 50,000  => 1.0%
// - reserved >= 10,000  => 1.5%
// - otherwise           => 2.0%

export default {
  name: "transfer",
  category: "Bank",
  description: "Transfer money to another user's bank account using their Bank Account ID.",
  // message = the Message that triggered the command
  // args = array of arguments after the command
  async execute(message, args) {
    const PREFIX = process.env.PREFIX || "!";
    const authorId = message.author.id;

    // Try quick path: if both bankId and amount provided in args, attempt immediate transfer
    const [maybeBankId, maybeAmount] = args;
    if (maybeBankId && maybeAmount) {
      return await this._processTransferByArgs(message, maybeBankId, maybeAmount);
    }

    // Otherwise show UI embed with button to open modal for details
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

    // Create a collector for the button click (only the command author can click)
    const filter = (i) => i.isButton() && i.customId === "bank_transfer_open_modal" && i.user.id === authorId;
    const collector = sent.createMessageComponentCollector({ filter, time: 120000, max: 1 });

    collector.on("collect", async (interaction) => {
      // Show a modal to collect Bank ID and Amount
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

      // Show modal to the user who clicked
      try {
        await interaction.showModal(modal);
      } catch (err) {
        console.error("Failed to show modal:", err);
        return interaction.reply({ content: "❌ Failed to open transfer modal.", ephemeral: true });
      }

      // Wait for the modal submit
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

          // _processTransferByArgs will reply on the interaction if it's an Interaction, otherwise on the message
          // If it returned a message embed, send it as ephemeral reply here
          if (result && typeof result === "object" && result.embed) {
            return modalInteraction.editReply({ embeds: [result.embed], content: result.content || null });
          }

          // Otherwise assume it already replied
          return;
        } catch (e) {
          console.error(e);
          try { await modalInteraction.editReply({ content: "❌ An unexpected error occurred while processing the transfer." }); } catch(e){}
        }
      });

      // collector end: if nobody clicked within time, disable button
      collector.on("end", async (collected) => {
        if (collected.size === 0) {
          try {
            await sent.edit({ components: [] });
          } catch (e) {}
        }
      });
    });
  },

  // Helper: handles both Message and Interaction contexts
  async _processTransferByArgs(context, recipientBankId, amountStr, fromInteraction = false) {
    // context can be a Message or an Interaction
    const isInteraction = Boolean(context?.isRepliable === undefined ? context?.isCommand?.() : false) || fromInteraction || (context?.isButton && true) || (context?.isModalSubmit && true) || (context?.user && context.fields);
    // Helper function to reply either via message or interaction
    const reply = async (payload) => {
      try {
        if (fromInteraction || (context && context.isModalSubmit) || (context && context.isCommand) || (context && context.reply && context.deferred)) {
          // Interaction replies
          if (payload.embeds || payload.content || payload.components) {
            // If already deferredUse editReply
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

    // Load giver user from DB (message.author id or interaction.user id)
    const userId = context.user?.id || context.author?.id;
    if (!userId) return reply({ content: "❌ Unable to determine user." });

    const giver = await User.findOne({ userId });
    if (!giver) return reply({ content: `❌ You don't have an account. Use \`${PREFIX}register\` first.` });

    // Basic validations
    if (!giver.bank?.hasAccount) return reply({ content: `❌ You don't have a bank account. Use \`${PREFIX}bank acc register\`.` });
    if ((giver.bank.loan || 0) > 0) return reply({ content: `❌ You cannot transfer while you have an outstanding loan. Repay it first.` });
    if ((giver.bank.debt || 0) > 0) return reply({ content: `❌ You cannot transfer while you have outstanding debt. Clear your debt first.` });
    const MIN_RESERVED = 5000;
    if ((giver.bank.reserved || 0) < MIN_RESERVED) return reply({ content: `❌ You must maintain a minimum reserved balance of ${MIN_RESERVED.toLocaleString()} to make transfers.` });

    // Parse amount
    const amount = Math.floor(Number(amountStr));
    if (!Number.isFinite(amount) || amount <= 0) return reply({ content: `❌ Please provide a valid amount greater than 0.` });

    // Check sufficient bank balance
    const giverBankBalance = giver.bank.bankBalance || 0;
    if (giverBankBalance < amount) return reply({ content: `❌ Insufficient bank balance. Your bank balance: ${giverBankBalance.toLocaleString()}.` });

    // Find recipient
    const recipient = await User.findOne({ "bank.bankAccountId": recipientBankId });
    if (!recipient || !recipient.bank?.hasAccount) return reply({ content: `❌ Recipient bank account ID not found. Make sure the Bank Account ID is correct.` });
    if (recipient.userId === giver.userId) return reply({ content: `❌ You cannot transfer to your own bank account.` });

    // Calculate tax based on reserved
    let taxRate = 0.02;
    const reserved = giver.bank.reserved || 0;
    if (reserved >= 100000) taxRate = 0.005;
    else if (reserved >= 50000) taxRate = 0.01;
    else if (reserved >= 10000) taxRate = 0.015;

    const taxAmount = Math.ceil(amount * taxRate);
    const netAmount = amount - taxAmount;
    if (netAmount <= 0) return reply({ content: `❌ Amount too small after tax. Increase the transfer amount.` });

    // Apply transfer
    giver.bank.bankBalance = giverBankBalance - amount;

    // Auto-pay recipient's outstanding debt (if any) from the net amount received using helper
    const recipientInitialDebt = recipient.bank.debt || 0;
    let amountAfterDebt = netAmount;
    if (recipientInitialDebt > 0) {
      // payDebtFromEarnings reduces recipient.bank.debt and saves recipient, returning remaining amount
      amountAfterDebt = await payDebtFromEarnings(recipient, netAmount);
    }
    const debtPaid = Math.min(netAmount, recipientInitialDebt);
    const creditedToBank = amountAfterDebt;

    // Credit remaining to recipient bankBalance
    recipient.bank.bankBalance = (recipient.bank.bankBalance || 0) + creditedToBank;

    // Persist giver and recipient (recipient already saved by payDebtFromEarnings if used)
    await giver.save();
    await recipient.save();

    // Build result embed
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

    // If called from an interaction/modal, return the embed to be sent as ephemeral reply
    if (fromInteraction) {
      return { embed: resultEmbed };
    }

    // Otherwise send as a normal message reply
    return await reply({ embeds: [resultEmbed], content: null });
  }
};