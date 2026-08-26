import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} from "discord.js";
import { shopItems } from "../../config/shopItems.js";
import User from "../../models/User.js";
import Minion from "../../models/Minion.js";

export default {
  name: "shop",
  category: "Shop",
  description: "Open the shop UI",
  async execute(message) {
    const prefix = process.env.PREFIX || "!";
    const zappcoinEmoji = "<:zappcoin:1410248547781185567>";

    // Category Dropdown
    const categoryRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("shop-category")
        .setPlaceholder("🏪 Select a category")
        .addOptions([
          { label: "Pickaxes", value: "Pickaxes", emoji: "⛏️" },
          { label: "Ores (Sell Only)", value: "Ores", emoji: "💎" },
          { label: "Minions", value: "Minions", emoji: "🤖" },
        ])
    );

    const embed = new EmbedBuilder()
      .setColor("Gold")
      .setTitle("🏪 ZappCoins Shop")
      .setDescription(
        `🎉 **Welcome to the Zapp Economy Shop!**\n\n` +
        `🛒 Choose a **category** below to browse items\n\n` +
        `💰 Check your balance with \`${prefix}balance\`\n\n` +
        `📦 Sell ores with \`${prefix}sell <ore> <amount>\`\n\n` +
        `⏰ *Shop expires after 30 seconds of inactivity*`
      )
      .setFooter({
        text: "🔥 Zapp Economy v1.0 • Click a category to start shopping!",
      });

    // Send shop UI
    const shopMessage = await message.reply({
      embeds: [embed],
      components: [categoryRow],
    });

    // Store current state for expiration
    let currentEmbed = embed;
    let currentComponents = [categoryRow];

    // Collector
    const filter = (i) => i.user.id === message.author.id;
    const collector = shopMessage.createMessageComponentCollector({
      filter,
      time: 30000,
    });

    // Timeout reset
    let timeout;
    const resetTimeout = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(async () => {
        collector.stop("time");
      }, 30000);
    };

    resetTimeout();

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "shop-category") {
        resetTimeout(); // Reset timer only on category select

        const result = await handleShopCategory(
          interaction,
          message.author.id,
          resetTimeout,
          prefix,
          zappcoinEmoji
        );
        if (result) {
          currentEmbed = result.embed;
          currentComponents = result.components;
        }
      } else if (interaction.customId.startsWith("shop-buy-")) {
        // Do NOT reset timeout on purchase actions
        await handleShopBuy(
          interaction,
          message.author.id,
          resetTimeout,
          zappcoinEmoji
        );
      }
    });

    collector.on("end", async (_, reason) => {
      if (timeout) clearTimeout(timeout);

      if (reason === "time") {
        const disabledComponents = currentComponents.map((row) => {
          const disabledRow = new ActionRowBuilder();
          row.components.forEach((component) => {
            if (component.data.type === 3) {
              disabledRow.addComponents(
                StringSelectMenuBuilder.from(component).setDisabled(true)
              );
            }
          });
          return disabledRow;
        });

        try {
          const expiredEmbed = EmbedBuilder.from(currentEmbed)
            .setColor("Red")
            .setFooter({
              text: "⏳ Shop expired! Run the shop command again to reopen.",
            });

          await shopMessage.edit({
            embeds: [expiredEmbed],
            components: disabledComponents,
          });
        } catch (error) {
          console.error("Failed to disable shop components:", error);
        }
      }
    });
  },
};

// ------------------ HANDLERS ------------------

export async function handleShopCategory(
  interaction,
  authorId,
  resetTimeout,
  prefix,
  zappcoinEmoji
) {
  if (!interaction.isStringSelectMenu()) return null;
  if (interaction.customId !== "shop-category") return null;
  if (interaction.user.id !== authorId) return null;

  const category = interaction.values[0];
  const items = shopItems[category];

  if (!items) {
    await interaction.reply({
      content: "⚠️ Invalid category.",
      ephemeral: true,
    });
    return null;
  }

  if (resetTimeout) resetTimeout();

  const categoryInfo = {
    Pickaxes: {
      color: "Orange",
      icon: "⛏️",
      description: `🔨 **Mining Tools & Equipment**\n\n*Upgrade your pickaxe to mine better ores!*`,
    },
    Ores: {
      color: "Purple",
      icon: "💎",
      description: `💰 **Valuable Resources**\n\n*These can only be obtained through mining - sell them here!*`,
    },
    Minions: {
      color: "Blue",
      icon: "🤖",
      description: `<:minion:1410635951214170327> **Automated Workers**\n\n*Let minions do the work for you while you're away!*`,
    },
  };

  const info = categoryInfo[category];

  const embed = new EmbedBuilder()
    .setColor(info.color)
    .setTitle(`${info.icon} ${category} Shop`)
    .setDescription(`${info.description}\n\n**Available Items:**`)
    .setFooter({
      text: "🛒 Use the dropdown below to purchase items! • Expires in 30s",
    });

  if (category === "Pickaxes") {
    items.forEach((item) => {
      const unlocksText = item.unlocks
        ? `\n\n🔓 **Unlocks:** ${item.unlocks.join(", ")}`
        : "";
      const emoji = item.emoji ? item.emoji.replace(/\\_/g, "_") : "⛏️";
      embed.addFields({
        name: `${emoji} ${item.name}`,
        value: `💰 **${item.cost}** ${zappcoinEmoji}\n\n⚡ **Power:** ${item.power}\n🛡️ **Durability:** ${item.durability}${unlocksText}`,
        inline: true,
      });
    });
  } else if (category === "Ores") {
    embed.setDescription(
      `${info.description}\n\n**Ore Values:**\n*Note: You cannot buy ores, only sell them!*`
    );
    items.forEach((item) => {
      embed.addFields({
        name: `${item.emoji} ${item.name}`,
        value: `💰 **${item.value}** ${zappcoinEmoji} each\n\n📦 **Sell with:**\n\`${prefix}sell ${item.id} <amount>\``,
        inline: true,
      });
    });
  } else if (category === "Minions") {
    items.forEach((item) => {
      const minionEmoji = getMinionEmoji(item.id);
      embed.addFields({
        name: `${minionEmoji} ${item.name}`,
        value: `💰 **${item.cost}** ${zappcoinEmoji}\n\n⚡ **Speed:** Every ${item.speed}s\n📜 **Info:** ${item.description}`,
        inline: true,
      });
    });
  }

  const categoryRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("shop-category")
      .setPlaceholder("🏪 Select another category")
      .addOptions([
        { label: "Pickaxes", value: "Pickaxes", emoji: "⛏️" },
        { label: "Ores (Sell Only)", value: "Ores", emoji: "💎" },
        { label: "Minions", value: "Minions", emoji: "🤖" },
      ])
  );

  const components = [categoryRow];

  if (category !== "Ores") {
    const buyOptions = items.map((i) => {
      const emoji = i.emoji ? i.emoji.replace(/\\_/g, "_") : getMinionEmoji(i.id);
      // Discord SelectMenuEmoji requires name or id, but cannot take raw emoji string alone for custom emoji.
      // If emoji is a custom Discord emoji string like '<:name:id>', provide it in 'id' property, and 'name' must match emoji name. 
      // But Discord.js simplifies by accepting 'name' alone for unicode emojis.
      // To avoid issues, if emoji is a custom emote string like "<:zappcoin:123>", strip to id
      const customEmojiMatch = emoji.match(/^<a?:([^:]+):(\d+)>$/);
      if (customEmojiMatch) {
        return {
          label: i.name.length > 100 ? i.name.slice(0, 97) + "..." : i.name,
          description: `${i.cost} ZappCoins`,
          value: i.id,
          emoji: {
            id: customEmojiMatch[2],
            name: customEmojiMatch[1],
            animated: emoji.startsWith("<a:"),
          },
        };
      }
      // Unicode or fallback emoji:
      return {
        label: i.name.length > 100 ? i.name.slice(0, 97) + "..." : i.name,
        description: `${i.cost} ZappCoins`,
        value: i.id,
        emoji: emoji,
      };
    });

    const itemRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`shop-buy-${category}`)
        .setPlaceholder(`🛒 Select ${category.toLowerCase().slice(0, -1)} to purchase`)
        .addOptions(buyOptions)
    );
    components.push(itemRow);
  }

  await interaction.update({ embeds: [embed], components });
  return { embed, components };
}

export async function handleShopBuy(
  interaction,
  authorId,
  resetTimeout,
  zappcoinEmoji
) {
  if (!interaction.isStringSelectMenu()) return;
  if (!interaction.customId.startsWith("shop-buy-")) return;
  if (interaction.user.id !== authorId) return;

  if (resetTimeout) resetTimeout();

  // Defer update to acknowledge interaction and avoid double response errors
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate();
  }

  const category = interaction.customId.replace("shop-buy-", "");
  const itemId = interaction.values[0];

  const item = shopItems[category]?.find((i) => i.id === itemId);

  if (!item) {
    return interaction.followUp({ content: "⚠️ Item not found.", ephemeral: true });
  }

  let user = await User.findOne({ userId: interaction.user.id });
  if (!user) {
    return interaction.followUp({
      content: `❌ You need to register first with \`${process.env.PREFIX || "!"}register\`.`,
      ephemeral: true,
    });
  }

  if (user.balance < item.cost) {
    return interaction.followUp({
      content: `❌ **Not enough ${zappcoinEmoji}!**\n\n💰 **You have:** ${user.balance} ${zappcoinEmoji}\n🏷️ **Item costs:** ${item.cost} ${zappcoinEmoji}\n💸 **You need:** ${item.cost - user.balance} more ${zappcoinEmoji}`,
      ephemeral: true,
    });
  }

  user.balance -= item.cost;

  if (category === "Pickaxes") {
    user.inventory = user.inventory || { pickaxes: [], minions: [], ores: new Map() };
    user.inventory.pickaxes = user.inventory.pickaxes || [];

    const existingPickaxe = user.inventory.pickaxes.find((p) => p.id === item.id);

    if (existingPickaxe) {
      existingPickaxe.quantity += 1;
    } else {
      user.inventory.pickaxes.push({
        id: item.id,
        name: item.name,
        durability: item.durability,
        maxDurability: item.durability,
        power: item.power,
        quantity: 1,
        unlocks: item.unlocks || [],
        purchasedAt: new Date(),
      });
    }

    await user.save();

    const emoji = item.emoji ? item.emoji.replace(/\\_/g, "_") : "⛏️";
    const currentQuantity = existingPickaxe ? existingPickaxe.quantity : 1;
    const totalPickaxes = user.inventory.pickaxes.reduce(
      (total, p) => total + p.quantity,
      0
    );

    await interaction.followUp({
      content: `✅ **Pickaxe Purchased!**\n\n${emoji} You bought **${item.name}** for **${item.cost}** ${zappcoinEmoji}!\n\n📊 **Item Stats:**\n⚡ **Power:** ${item.power}\n🛡️ **Durability:** ${item.durability}\n🔓 **Unlocks:** ${item.unlocks ? item.unlocks.join(", ") : "None"}\n\n📦 **Inventory:**\n🔢 **This pickaxe:** ${currentQuantity}x\n📊 **Total pickaxes:** ${totalPickaxes}x\n\n💰 **Remaining balance:** ${user.balance} ${zappcoinEmoji}\n\n💡 *Use \`${process.env.PREFIX || "!"}inventory\` to view all your pickaxes*`,
      ephemeral: true,
    });
  } else if (category === "Minions") {
    user.inventory = user.inventory || { pickaxes: [], minions: [], ores: new Map() };
    user.inventory.minions = user.inventory.minions || [];

    const sameTypeMinions = user.inventory.minions.filter(m => m.id.startsWith(item.id));
    const uniqueId = `${item.id}_${sameTypeMinions.length + 1}`;

    user.inventory.minions.push({
      id: uniqueId,
      name: item.name,
      tier: item.tier,
      speed: item.speed,
      storage: 0,
      maxStorage: 200,
      lastCollected: new Date(),
      purchasedAt: new Date(),
    });

    await user.save();

    const minionEmoji = getMinionEmoji(item.id);
    await interaction.followUp({
      content: `✅ **Minion Purchased!**\n\n${minionEmoji} You bought **${item.name}** for **${item.cost}** ${zappcoinEmoji}!\n\n📊 **Minion Stats:**\n⚡ **Mining speed:** Every ${item.speed} seconds\n🎯 **Resource:** ${item.ore}\n📦 **Storage:** 0/200 items\n\n💰 **Remaining balance:** ${user.balance} ${zappcoinEmoji}\n\n💡 Use \`${process.env.PREFIX || "!"}minion equip <slot> ${uniqueId}\` to activate it`,
      ephemeral: true,
    });
  } else if (category === "Ores") {
    return interaction.followUp({
      content: `⛏️ **Ores cannot be purchased!**\n\n💡 You can only obtain ores by mining with your pickaxe or using minions!\n🛒 Use \`${process.env.PREFIX || "!"}mine\` to start mining for ores.`,
      ephemeral: true,
    });
  }
}

// Helper: Minion Emoji
function getMinionEmoji(minionId) {
  const oreType = minionId.split("_")[0];
  const oreData = shopItems.Ores.find(o => o.id === oreType);
  const minionBaseEmoji = "<:minion:1410635951214170327>";
  return oreData ? `${oreData.emoji}${minionBaseEmoji}` : minionBaseEmoji;
}