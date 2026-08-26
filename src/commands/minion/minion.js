import { EmbedBuilder } from "discord.js";
import User from "../../models/User.js";
import showMinions from "./subcommands/show.js";
import viewSlots from "./subcommands/slots.js";
import equipMinion from "./subcommands/equip.js";
import collectOres from "./subcommands/collect.js";
import unequipMinion from "./subcommands/unequip.js";

export default {
  name: "minion",
  description: "Manage your minions",
  category: "Minion",
  description: "Commands to manage your minions: view owned minions, manage minion slots, equip and unequip minions, collect ores, and more.",

  async execute(message, args) {
    const prefix = process.env.PREFIX || "!";
    const userId = message.author.id;
    const user = await User.findOne({ userId });
    if (!user) {
      return message.reply(`❌ You need to register first! Use \`${prefix}register\`.`);
    }

    const subcommand = args[0]?.toLowerCase();
    switch (subcommand) {
      case "show":
        return showMinions.execute(message, args.slice(1), user);
      case "slots":
        return viewSlots.execute(message, args.slice(1), user);
      case "equip":
        return equipMinion.execute(message, args.slice(1), user);
      case "collect":
        return collectOres.execute(message, args.slice(1), user);
      case "unequip":
        return unequipMinion.execute(message, args.slice(1), user);
      case "start":
        return startMinion.execute(message, args.slice(1), user);
      default:
        const embed = new EmbedBuilder()
          .setTitle("🛠️ Minion Command Help")
          .setColor("Purple")
          .setDescription(
            `\`${prefix}minion show\` • view all owned minions\n` +
            `\`${prefix}minion slots\` • view active slots\n` +
            `\`${prefix}minion equip <slot> <minionId>\` • equip a minion\n` +
            `\`${prefix}minion collect <slot|all>\` • collect ores\n` +
            `\`${prefix}minion unequip <slot>\` • unequip a minion\n`
          );
        return message.channel.send({ embeds: [embed] });
    }
  }
};