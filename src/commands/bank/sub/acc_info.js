import { EmbedBuilder } from "discord.js";
import { createDropdown, replyWithDropdown } from "../../../utils/bankHelpers.js";
import User from "../../../models/User.js";

export default {
  async execute(message, args, user, bankTimeouts) {
    if (!user?.bank.hasAccount) return message.reply(`❌ You don't have a bank account. Use \`${process.env.PREFIX || "!"}bank acc register\`.`);

    let nextBankTaxDate = "N/A",
      nextInterestDate = "N/A",
      loanDueDate = "N/A";

    if (user.bank.lastBankTaxedAt) {
      nextBankTaxDate = new Date(user.bank.lastBankTaxedAt);
      nextBankTaxDate.setDate(nextBankTaxDate.getDate() + 30);
      nextBankTaxDate = nextBankTaxDate.toLocaleDateString();
    }

    if (user.bank.lastReservedInterestAt) {
      nextInterestDate = new Date(user.bank.lastReservedInterestAt);
      nextInterestDate.setDate(nextInterestDate.getDate() + 30);
      nextInterestDate = nextInterestDate.toLocaleDateString();
    }

    if (user.bank.loanDueAt) {
      loanDueDate = user.bank.loanDueAt.toLocaleDateString() + " " + user.bank.loanDueAt.toLocaleTimeString();
    }

    let loanInterestRate = 0.15 - user.bank.reserved / 100000;
    if (loanInterestRate < 0.05) loanInterestRate = 0.05;

    const embed = new EmbedBuilder()
      .setColor("Gold")
      .setTitle("🏦 Bank Account Summary")
      .setDescription("📋 Complete overview of your banking profile")
      .addFields(
        { name: "Bank Account ID", value: user.bank.bankAccountId || "N/A", inline: true },
        { name: "Account Created", value: user.bank.accountCreatedAt ? user.bank.accountCreatedAt.toLocaleDateString() : "N/A", inline: true },
        { name: "\u200B", value: "\u200B", inline: true },

        { name: "Wallet Balance", value: `${user.balance.toLocaleString()}${user.balance < 0 ? " (negative)" : ""}`, inline: true },
        { name: "Bank Balance", value: `${(user.bank.bankBalance || 0).toLocaleString()}\n(Withdrawable, taxed 2% monthly)`, inline: true },
        { name: "Reserved Balance", value: `${user.bank.reserved.toLocaleString()}\n(Locked, earns 3% interest)`, inline: true },

        { name: "Loan & Debt Information", value: "\u200B" },
        { name: "Outstanding Loan", value: `${user.bank.loan.toLocaleString()}`, inline: true },
        { name: "Outstanding Debt", value: `${(user.bank.debt || 0).toLocaleString()}${user.bank.debt > 0 ? "\n*(auto-collects from earnings)*" : ""}`, inline: true },
        { name: "Max Loan Limit", value: `${user.bank.reserved.toLocaleString()}`, inline: true },
        { name: "Current Loan Rate", value: `${(loanInterestRate * 100).toFixed(1)}% per month`, inline: true },
        { name: "Loan Due Date", value: loanDueDate, inline: true },
        { name: "\u200B", value: "\u200B", inline: true },

        { name: "Important Dates", value: "\u200B" },
        { name: "Next Bank Tax Due", value: nextBankTaxDate, inline: true },
        { name: "Next Interest Payment", value: nextInterestDate, inline: true },
        { name: "\u200B", value: "\u200B", inline: true }
      )
      .setFooter({ text: `Use ${process.env.PREFIX || "!"}bank loan/repay/reserved/deposit/withdraw for transactions` })
      .setTimestamp();

    return replyWithDropdown(message, embed, bankTimeouts, this);
  },

    async handleSelect(interaction) {
        const PREFIX = process.env.PREFIX || "!";
        const TOTAL_ECONOMY = 100000000;
        const user = await User.findOne({ userId: interaction.user.id });

        if (!user && interaction.values[0] !== "acc_register") {
            return interaction.update({
                content: "❌ You need to register first using the register command.",
                components: [],
                embeds: []
            });
        }

        switch (interaction.values[0]) {
            case "acc_register":
                if (user?.bank.hasAccount) {
                    return interaction.update({
                        content: "⚠️ You already have a bank account!",
                        components: [],
                        embeds: []
                    });
                }
                if (!user) {
                    return interaction.update({
                        content: `❌ You need to register first! Use \`${PREFIX}register\`.`,
                        components: [],
                        embeds: []
                    });
                }
                if (user.balance < 5000) {
                    return interaction.update({
                        content: "❌ You need **5,000 <:zappcoin:1410248547781185567>** to open a bank account (reserved).",
                        components: [],
                        embeds: []
                    });
                }

                const newBankAccountId = await generateUniqueBankId();
                user.balance -= 5000;
                user.bank.hasAccount = true;
                user.bank.reserved = 5000;
                user.bank.bankAccountId = newBankAccountId;
                user.bank.bankBalance = 0;
                user.bank.debt = 0; // Initialize debt
                user.bank.accountCreatedAt = new Date();
                user.bank.lastTaxedAt = new Date();
                user.bank.lastBankTaxedAt = new Date();
                user.bank.lastReservedInterestAt = new Date();
                await user.save();

                const registerEmbed = new EmbedBuilder()
                    .setColor("Green")
                    .setTitle("🏦 Bank Account Created")
                    .setDescription(`✅ **Welcome to Zappia Bank!**\n\nYou successfully opened a bank account with **5,000 <:zappcoin:1410248547781185567> reserved** (cannot withdraw, but earns 3% monthly interest!).\n\n🏷️ **Bank Account ID:** ${newBankAccountId}\n\n💡 **What's Next?**\n• Use **Account Info** to view your balances\n• Add more to **Reserved Balance** for higher interest\n• **Deposit** wallet funds to **Bank Balance** for easy access\n\n⚠️ **Important:** Loans auto-collect when due. Pay on time to avoid debt!`);

                return interaction.update({
                    content: null,
                    embeds: [registerEmbed],
                    components: [createDropdown()]
                });

            case "acc_info":
                if (!user?.bank.hasAccount) {
                    return interaction.update({
                        content: `❌ You don't have a bank account. Use \`${PREFIX}bank acc register\`.`,
                        embeds: [],
                        components: [createDropdown()]
                    });
                }

                let nextBankTaxDate = "N/A";
                let nextInterestDate = "N/A";
                let loanDueDate = "N/A";

                if (user.bank.lastBankTaxedAt) {
                    nextBankTaxDate = new Date(user.bank.lastBankTaxedAt);
                    nextBankTaxDate.setDate(nextBankTaxDate.getDate() + 30);
                    nextBankTaxDate = nextBankTaxDate.toLocaleDateString();
                }

                if (user.bank.lastReservedInterestAt) {
                    nextInterestDate = new Date(user.bank.lastReservedInterestAt);
                    nextInterestDate.setDate(nextInterestDate.getDate() + 30);
                    nextInterestDate = nextInterestDate.toLocaleDateString();
                }

                if (user.bank.loanDueAt) {
                    loanDueDate = user.bank.loanDueAt.toLocaleDateString() + " " + user.bank.loanDueAt.toLocaleTimeString();
                }

                // Calculate loan interest rate
                let loanInterestRate = 0.15 - user.bank.reserved / 100000;
                if (loanInterestRate < 0.05) loanInterestRate = 0.05;

                const accountEmbed = new EmbedBuilder()
                    .setColor("Gold")
                    .setTitle("🏦 Bank Account Summary")
                    .setDescription(`📋 **Complete overview of your banking profile**`)
                    .addFields(
                        { name: "🏷️ Bank Account ID", value: user.bank.bankAccountId || "N/A", inline: true },
                        { name: "📅 Account Created", value: user.bank.accountCreatedAt ? user.bank.accountCreatedAt.toLocaleDateString() : "N/A", inline: true },
                        { name: "\u200B", value: "\u200B", inline: true },

                        { name: "💰 Current Balances", value: "\u200B", inline: false },
                        { name: "🪙 Wallet Balance", value: `${user.balance.toLocaleString()} <:zappcoin:1410248547781185567>${user.balance < 0 ? ' (negative)' : ''}`, inline: true },
                        { name: "🏦 Bank Balance", value: `${(user.bank.bankBalance || 0).toLocaleString()} <:zappcoin:1410248547781185567>\n*(withdrawable, taxed 2% monthly)*`, inline: true },
                        { name: "🔒 Reserved Balance", value: `${user.bank.reserved.toLocaleString()} <:zappcoin:1410248547781185567>\n*(locked, earns 3% interest)*`, inline: true },

                        { name: "💳 Loan & Debt Information", value: "\u200B", inline: false },
                        { name: "💳 Outstanding Loan", value: `${user.bank.loan.toLocaleString()} <:zappcoin:1410248547781185567>`, inline: true },
                        { name: "🏦 Outstanding Debt", value: `${(user.bank.debt || 0).toLocaleString()} <:zappcoin:1410248547781185567>${user.bank.debt > 0 ? '\n*(auto-collects from earnings)*' : ''}`, inline: true },
                        { name: "🎯 Max Loan Limit", value: `${user.bank.reserved.toLocaleString()} <:zappcoin:1410248547781185567>`, inline: true },
                        { name: "📈 Current Loan Rate", value: `${(loanInterestRate * 100).toFixed(1)}% per month`, inline: true },
                        { name: "⏰ Loan Due Date", value: loanDueDate, inline: true },
                        { name: "\u200B", value: "\u200B", inline: true },

                        { name: "⏰ Important Dates", value: "\u200B", inline: false },
                        { name: "💸 Next Bank Tax Due", value: nextBankTaxDate, inline: true },
                        { name: "💰 Next Interest Payment", value: nextInterestDate, inline: true },
                        { name: "\u200B", value: "\u200B", inline: true }
                    )
                    .setFooter({ text: `Use ${PREFIX}bank loan/repay/reserved/deposit/withdraw for transactions` })
                    .setTimestamp();

                return interaction.update({
                    content: null,
                    embeds: [accountEmbed],
                    components: [createDropdown()]
                });

            case "stats": {
                const totalWalletBalance = (await User.aggregate([{ $group: { _id: null, total: { $sum: "$balance" } } }]))[0]?.total || 0;
                const totalBankBalance = (await User.aggregate([{ $group: { _id: null, total: { $sum: "$bank.bankBalance" } } }]))[0]?.total || 0;
                const totalReservedBalance = (await User.aggregate([{ $group: { _id: null, total: { $sum: "$bank.reserved" } } }]))[0]?.total || 0;
                const totalLoans = (await User.aggregate([{ $group: { _id: null, total: { $sum: "$bank.loan" } } }]))[0]?.total || 0;
                const totalDebt = (await User.aggregate([{ $group: { _id: null, total: { $sum: "$bank.debt" } } }]))[0]?.total || 0;
                const totalBankAccounts = await User.countDocuments({ "bank.hasAccount": true });
                const usersInDebt = await User.countDocuments({ "bank.debt": { $gt: 0 } });

                const inCirculation = totalWalletBalance + totalBankBalance;
                const bankReserve = TOTAL_ECONOMY - inCirculation - totalReservedBalance;
                const usedReserve = ((inCirculation / TOTAL_ECONOMY) * 100).toFixed(1);

                const progressBarLength = 20;
                const filledBars = Math.round((inCirculation / TOTAL_ECONOMY) * progressBarLength);
                const emptyBars = progressBarLength - filledBars;
                const progressBar = "▰".repeat(filledBars) + "▱".repeat(emptyBars);

                const statsEmbed = new EmbedBuilder()
                    .setColor("Gold")
                    .setTitle("🏦 Central Bank of Zappia")
                    .setDescription("📊 **Complete overview of the Zappia Economy**")
                    .addFields(
                        { name: "🌟 Economy Overview", value: "\u200B", inline: false },
                        { name: "💎 Total Economy", value: `${TOTAL_ECONOMY.toLocaleString()} <:zappcoin:1410248547781185567>`, inline: true },
                        { name: "🏛️ Bank Reserve", value: `${bankReserve.toLocaleString()} <:zappcoin:1410248547781185567>`, inline: true },
                        { name: "📊 Reserve Usage", value: `${progressBar} \`${usedReserve}%\``, inline: false },

                        { name: "💰 Money Distribution", value: "\u200B", inline: false },
                        { name: "🪙 In Wallets", value: `${totalWalletBalance.toLocaleString()} <:zappcoin:1410248547781185567>`, inline: true },
                        { name: "🏦 In Bank Accounts", value: `${totalBankBalance.toLocaleString()} <:zappcoin:1410248547781185567>`, inline: true },
                        { name: "🔒 In Reserved Accounts", value: `${totalReservedBalance.toLocaleString()} <:zappcoin:1410248547781185567>`, inline: true },

                        { name: "🏪 Banking Activity", value: "\u200B", inline: false },
                        { name: "👥 Total Bank Accounts", value: `${totalBankAccounts.toLocaleString()} accounts`, inline: true },
                        { name: "💳 Total Outstanding Loans", value: `${totalLoans.toLocaleString()} <:zappcoin:1410248547781185567>`, inline: true },
                        { name: "🏦 Total Outstanding Debt", value: `${totalDebt.toLocaleString()} <:zappcoin:1410248547781185567>`, inline: true },
                        { name: "⚠️ Users in Debt", value: `${usersInDebt.toLocaleString()} users`, inline: true },
                        { name: "📈 Economic Health", value: usedReserve < 50 ? "🟢 Stable" : usedReserve < 75 ? "🟡 Moderate" : "🔴 High Activity", inline: true },
                        { name: "💳 Debt Risk Level", value: totalDebt > totalReservedBalance * 0.5 ? "🔴 High" : totalDebt > totalReservedBalance * 0.2 ? "🟡 Moderate" : "🟢 Low", inline: true }
                    )
                    .setFooter({ text: `Updated every transaction • Use ${PREFIX}bank to manage your account` })
                    .setTimestamp();

                return interaction.update({
                    content: null,
                    embeds: [statsEmbed],
                    components: [createDropdown()]
                });
            }

            // FLEXIBLE LOAN CASE - Updated with debt warning
            case "loan":
                return interaction.update({
                    content: `**💳 Take a Loan (Flexible Duration - Max 1 Month)**\n\n` +
                             `**📋 Command Format:**\n` +
                             `\`${PREFIX}bank loan <amount> <period> <count>\`\n\n` +
                             `**⏰ Available Periods:**\n` +
                             `• **Days:** 1-30 days (\`day\` or \`days\`)\n` +
                             `• **Weeks:** 1-4 weeks (\`week\` or \`weeks\`)\n` +
                             `• **Months:** 1 month only (\`month\` or \`months\`)\n\n` +
                             `**📝 Examples:**\n` +
                             `• \`${PREFIX}bank loan 5000 day 15\` (15 days)\n` +
                             `• \`${PREFIX}bank loan 10000 week 3\` (3 weeks)\n` +
                             `• \`${PREFIX}bank loan 15000 month 1\` (1 month)\n` +
                             `• \`${PREFIX}bank loan 8000 days 7\` (7 days)\n\n` +
                             `**💡 Interest Calculation:**\n` +
                             `• **Base Rate:** 15% per month (decreases with higher reserved balance)\n` +
                             `• **Minimum Rate:** 5% per month\n` +
                             `• **Daily Rate:** Monthly rate ÷ 30\n` +
                             `• **Weekly Rate:** Daily rate × 7\n\n` +
                             `**🚨 IMPORTANT - AUTO COLLECTION:**\n` +
                             `🔄 **Loans automatically collect when due!**\n` +
                             `💰 **Collection Order:** Reserved → Bank → Wallet → **DEBT**\n` +
                             `⚠️ **If insufficient funds:** Remainder becomes debt\n` +
                             `💳 **Debt auto-collects from ALL future earnings**\n\n` +
                             `**🎯 Loan Rules:**\n` +
                             `✅ Maximum duration: **1 month equivalent**\n` +
                             `✅ Loan limit: Up to your reserved balance\n` +
                             `✅ Repay early to avoid auto-collection\n` +
                             `🏦 **NEW:** Loans are deposited directly to your bank balance!`,
                    components: [],
                    embeds: []
                });

            // For other commands that need parameters, show instruction and disable menu
            case "repay":
            case "reserved":
            case "deposit":
            case "withdraw":
                const commandInstructions = {
                    repay: `Use the command:\n\`${PREFIX}bank repay <amount>\` to repay your loan/debt.`,
                    reserved: `Use the command:\n\`${PREFIX}bank reserved <amount>\` to increase your reserved balance.\n\n⚠️ **Note:** If you have debt, part of this will go to debt payment first!`,
                    deposit: `Use the command:\n\`${PREFIX}bank deposit <amount>\` to deposit wallet funds into your bank balance (no interest, taxed monthly).`,
                    withdraw: `Use the command:\n\`${PREFIX}bank withdraw <amount>\` to withdraw funds from your bank balance back to your wallet.\n\n⚠️ **Note:** If you have debt, withdrawn funds will be used for debt payment first!`
                };

                return interaction.update({
                    content: commandInstructions[interaction.values[0]],
                    components: [],
                    embeds: []
                });

            default:
                return interaction.update({
                    content: "❌ Unknown selection.",
                    components: []
                });
        }
    },
};