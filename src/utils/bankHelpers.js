import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import User from "../models/User.js";

const bankTimeouts = new Map();

export function createDropdown() {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("bank_select")
    .setPlaceholder("Choose a bank command")
    .addOptions([
      { label: "Register Account", description: "Open a bank account (requires 5,000 ZappCoins reserved)", value: "acc_register" },
      { label: "Account Info", description: "View your bank account info and balances", value: "acc_info" },
      { label: "Loan", description: "Take out a loan (max 1 month)", value: "loan" },
      { label: "Repay Loan", description: "Repay your outstanding loan", value: "repay" },
      { label: "Increase Reserved Balance", description: "Add funds to reserved (earns 3% interest monthly)", value: "reserved" },
      { label: "Deposit to Bank Balance", description: "Move wallet funds to bank balance (taxed, no interest)", value: "deposit" },
      { label: "Withdraw from Bank Balance", description: "Withdraw funds from bank balance to wallet", value: "withdraw" },
      { label: "Economy Stats", description: "View global economy stats", value: "stats" },
    ]);
  return new ActionRowBuilder().addComponents(selectMenu);
}

export function createHomePageEmbed() {
  return new EmbedBuilder()
    .setColor("Blue")
    .setTitle("🏦 Welcome to Zappia Bank")
    .setDescription(
      "**🎯 New to banking? Here's how it works:**\n\n" +
      "**💰 WALLET** - Your current spending money (what you have now)\n" +
      "**🏦 BANK BALANCE** - Money you can deposit/withdraw anytime (taxed 2% monthly, no interest)\n" +
      "**🔒 RESERVED BALANCE** - Locked savings that earn 3% interest monthly (cannot withdraw)\n" +
      "**⚠️ DEBT** - Outstanding debt that automatically collects from all earnings\n\n" +
      "**📋 Getting Started:**\n" +
      "1️⃣ Register Account - Opens bank account (costs 5,000 reserved)\n" +
      "2️⃣ View Account Info - Check your balances and loan details\n" +
      "3️⃣ Choose Your Strategy:\n" +
      "   • Add to Reserved Balance = Earn 3% monthly interest (locked)\n" +
      "   • Add to Bank Balance = Withdraw anytime, but taxed 2%\n\n" +
      "**🏪 Banking Services:** Loans, Deposits, Withdrawals, Stats\n\n" +
      "**💡 Tips:** Higher reserved balance = lower loan rates\n" +
      "Bank balance taxed monthly, reserved balance earns interest\n" +
      "Loans auto-collect when due - pay on time to avoid debt!\n\n" +
      "Use the dropdown below to get started!"
    );
}

export async function replyWithDropdown(message, embed, bankTimeouts, commandContext) {
  const msg = await message.reply({ embeds: [embed], components: [createDropdown()] });
  setupBankTimeout(msg, commandContext);
  return msg;
}

export function setupBankTimeout(message, commandContext) {
  const TIMEOUT_MS = 30000;
  const messageId = message.id;

  if (bankTimeouts.has(messageId)) {
    const existing = bankTimeouts.get(messageId);
    clearTimeout(existing.timeout);
    if (existing.collector && !existing.collector.ended) {
      existing.collector.stop();
    }
  }

  async function disableCurrentPage() {
    try {
      if (!message.deleted) {
        await message.edit({ components: [] }).catch(() => { });
      }
    } catch (err) {
      console.error("Failed to disable components:", err);
    } finally {
      bankTimeouts.delete(messageId);
    }
  }

  const collector = message.createMessageComponentCollector({
    componentType: "SELECT_MENU",
    filter: i => i.customId === "bank_select",
    time: TIMEOUT_MS
  });

  const timeout = setTimeout(async () => {
    await disableCurrentPage();
    if (!collector.ended) collector.stop("timeout");
  }, TIMEOUT_MS);

  bankTimeouts.set(messageId, { timeout, collector });

  collector.on("collect", async interaction => {
    clearTimeout(timeout);
    await commandContext.handleSelectMenu(interaction);
    setTimeout(() => {
      if (!interaction.message.deleted) {
        setupBankTimeout(interaction.message, commandContext);
      }
    }, 100);
  });

  collector.on("end", () => {
    bankTimeouts.delete(messageId);
  });
}

export async function payDebtFromEarnings(user, earningsAmount) {
  if (!user.bank.debt || user.bank.debt <= 0) return earningsAmount;
  const debtPayment = Math.min(earningsAmount, user.bank.debt);
  user.bank.debt -= debtPayment;
  await user.save();
  return earningsAmount - debtPayment;
}

export async function runLoanCollection(client) {
  const COLLECTION_CHANNEL_ID = process.env.BANK_TAX_CHANNEL_ID || null;
  const now = new Date();

  const users = await User.find({
    "bank.hasAccount": true,
    "bank.loan": { $gt: 0 },
    "bank.loanDueAt": { $lte: now } 
  });

  for (const user of users) {
    let loanDueAmount = user.bank.loan;
    let collectedAmount = 0;
    let collectionSources = [];

    if (user.bank.reserved > 0) {
      const fromReserved = Math.min(loanDueAmount - collectedAmount, user.bank.reserved);
      user.bank.reserved -= fromReserved;
      collectedAmount += fromReserved;
      if (fromReserved > 0) collectionSources.push(`Reserved: ${fromReserved.toLocaleString()}`);
    }

    if (collectedAmount < loanDueAmount && user.bank.bankBalance > 0) {
      const fromBank = Math.min(loanDueAmount - collectedAmount, user.bank.bankBalance);
      user.bank.bankBalance -= fromBank;
      collectedAmount += fromBank;
      if (fromBank > 0) collectionSources.push(`Bank: ${fromBank.toLocaleString()}`);
    }

    if (collectedAmount < loanDueAmount && user.balance > 0) {
      const fromWallet = Math.min(loanDueAmount - collectedAmount, user.balance);
      user.balance -= fromWallet;
      collectedAmount += fromWallet;
      if (fromWallet > 0) collectionSources.push(`Wallet: ${fromWallet.toLocaleString()}`);
    }

    const remaining = loanDueAmount - collectedAmount;
    if (remaining > 0) {
      user.bank.debt = (user.bank.debt || 0) + remaining;
    }

    user.bank.loan = 0;
    user.bank.loanDueAt = null;
    user.bank.loanIssuedAt = null;

    await user.save();

    if (COLLECTION_CHANNEL_ID && collectedAmount > 0) {
      try {
        const channel = await client.channels.fetch(COLLECTION_CHANNEL_ID);
        if (channel) {
          let msg = `🏦 Loan Collection for <@${user.userId}>\nCollected: ${collectedAmount.toLocaleString()}\nSources: ${collectionSources.join(", ")}`;
          if (remaining > 0) msg += `\n⚠️ Amount moved to debt: ${remaining.toLocaleString()}`;
          await channel.send(msg);
        }
      } catch (err) {
        console.error("Failed to send loan collection notification:", err);
      }
    }
  }
}

export async function runTaxDeduction(client) {
  const TAX_BANK_PERCENT = 0.02; 
  const RESERVED_INTEREST_PERCENT = 0.03; 
  const TAX_CHANNEL_ID = process.env.BANK_TAX_CHANNEL_ID || null;
  const now = new Date();

  const users = await User.find({ "bank.hasAccount": true });

  for (const user of users) {
    
    if (!user.bank.lastBankTaxedAt) {
      user.bank.lastBankTaxedAt = now;
      await user.save();
      continue;
    }
    if (!user.bank.lastReservedInterestAt) {
      user.bank.lastReservedInterestAt = now;
      await user.save();
      continue;
    }

    if (!user.bank.lastBankTaxedAt) {
      user.bank.lastBankTaxedAt = now;
      await user.save();
    }

    const daysSinceBankTax = (now - new Date(user.bank.lastBankTaxedAt)) / (1000 * 60 * 60 * 24);

    if (daysSinceBankTax >= 30 && user.bank.bankBalance > 0) {
      const taxAmount = Math.floor(user.bank.bankBalance * TAX_BANK_PERCENT);
      user.bank.bankBalance -= taxAmount;
      user.bank.lastBankTaxedAt = now;
      await user.save();

      if (TAX_CHANNEL_ID) {
        try {
          const channel = await client.channels.fetch(TAX_CHANNEL_ID);
          if (channel) {
            await channel.send(
              `💸 **2% tax** deducted from <@${user.userId}>'s bank balance (test interval). Removed **${taxAmount.toLocaleString()}** <:zappcoin:1410248547781185567>.`
            );
          }
        } catch (err) {
          console.error("Failed to send bank tax notification:", err);
        }
      }
    }

    const daysSinceInterest = (now - new Date(user.bank.lastReservedInterestAt)) / (1000 * 60 * 60 * 24);

    if (daysSinceInterest >= 30 && user.bank.reserved > 0) {
      const interestAmount = Math.floor(user.bank.reserved * RESERVED_INTEREST_PERCENT);
      user.bank.reserved += interestAmount;
      user.bank.lastReservedInterestAt = now;
      await user.save();

      if (TAX_CHANNEL_ID) {
        try {
          const channel = await client.channels.fetch(TAX_CHANNEL_ID);
          if (channel) {
            await channel.send(
              `💰 **3% interest** added to <@${user.userId}>'s reserved balance. Added **${interestAmount.toLocaleString()}** <:zappcoin:1410248547781185567>.`
            );
          }
        } catch (err) {
          console.error("Failed to send reserved interest notification:", err);
        }
      }
    }
  }
}

export async function generateUniqueBankId() {
  let id;
  let exists = true;
  while (exists) {
    id = Math.floor(100000 + Math.random() * 900000).toString();
    exists = await User.exists({ "bank.bankAccountId": id });
  }
  return id;
}

export function calculateDueDate(periodType, periodCount) {
  const now = new Date();
  const dueDate = new Date(now);
  switch (periodType) {
    case "day":
      dueDate.setDate(dueDate.getDate() + periodCount);
      break;
    case "week":
      dueDate.setDate(dueDate.getDate() + periodCount * 7);
      break;
    case "month":
      dueDate.setMonth(dueDate.getMonth() + periodCount);
      break;
  }
  return dueDate;
}
