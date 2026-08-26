import User from "../../models/User.js";
import * as BankHelpers from "../../utils/bankHelpers.js";

import accRegister from "./sub/acc_register.js";
import accInfo from "./sub/acc_info.js";
import loan from "./sub/loan.js";
import repay from "./sub/repay.js";
import reserved from "./sub/reserved.js";
import deposit from "./sub/deposit.js";
import withdraw from "./sub/withdraw.js";
import stats from "./sub/stats.js";

const bankTimeouts = new Map();

export default {
  name: "bank",
  category: "Bank",
  description: "Manage your bank account within the economy system. Use subcommands to register your bank account, view account info, take loans, repay debts, deposit and withdraw funds, manage reserved balances, and check bank-related stats.",

  async execute(message, args) {
    const PREFIX = process.env.PREFIX || "!";
    const subcommand = args[0]?.toLowerCase();
    const user = await User.findOne({ userId: message.author.id });

    if (!subcommand) {
      const embed = BankHelpers.createHomePageEmbed();
      return BankHelpers.replyWithDropdown(message, embed, bankTimeouts, this);
    }

    switch (subcommand) {
      case "acc":
        if (args[1]?.toLowerCase() === "register") return accRegister.execute(message, args, user, bankTimeouts);
        if (args[1]?.toLowerCase() === "info") return accInfo.execute(message, args, user, bankTimeouts);
        break;
      case "loan":
        return loan.execute(message, args, user, bankTimeouts);
      case "repay":
        return repay.execute(message, args, user, bankTimeouts);
      case "reserved":
        return reserved.execute(message, args, user, bankTimeouts);
      case "deposit":
        return deposit.execute(message, args, user, bankTimeouts);
      case "withdraw":
        return withdraw.execute(message, args, user, bankTimeouts);
      case "stats":
        return stats.execute(message, args, user, bankTimeouts);
      default:
        return message.reply(`❌ Invalid bank command. Use \`${PREFIX}bank\` for help.`);
    }
  },

  async handleSelectMenu(interaction) {
    const user = await User.findOne({ userId: interaction.user.id });
    switch (interaction.values[0]) {
      case "acc_register":
        return accRegister.handleSelect(interaction, user);
      case "acc_info":
        return accInfo.handleSelect(interaction, user);
      case "loan":
        return loan.handleSelect(interaction, user);
      case "repay":
        return repay.handleSelect(interaction, user);
      case "reserved":
        return reserved.handleSelect(interaction, user);
      case "deposit":
        return deposit.handleSelect(interaction, user);
      case "withdraw":
        return withdraw.handleSelect(interaction, user);
      case "stats":
        return stats.handleSelect(interaction, user);
      default:
        return interaction.update({ content: "❌ Unknown selection.", components: [] });
    }
  },

  runTaxDeduction: BankHelpers.runTaxDeduction,
  runLoanCollection: BankHelpers.runLoanCollection,
  payDebtFromEarnings: BankHelpers.payDebtFromEarnings,
};