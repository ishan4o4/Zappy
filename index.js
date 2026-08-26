import { Client, GatewayIntentBits, Collection, EmbedBuilder } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { startMiningTask } from "./src/scheduledTasks.js";
import { startPresenceRotation } from "./src/presenceManager.js";
import GuildConfig from "./src/models/GuildConfig.js";

dotenv.config();

const PREFIX = process.env.PREFIX || "!";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

const __dirname = path.resolve();
const commandsPath = path.join(__dirname, "src", "commands");

async function loadCommands(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    if (file.isDirectory()) {
      await loadCommands(path.join(dir, file.name));
    } else if (file.name.endsWith(".js")) {
      const commandModule = await import(`file://${path.join(dir, file.name)}`);
      const command = commandModule.default;
      if (command && command.name) {
        client.commands.set(command.name, command);
        console.log(`✅ Loaded command: ${command.name}`);
      }
    }
  }
}
await loadCommands(commandsPath);

const eventsPath = path.join(__dirname, "src", "events");
for (const file of fs.readdirSync(eventsPath)) {
  if (file.endsWith(".js")) {
    const eventModule = await import(`file://${path.join(eventsPath, file)}`);
    const event = eventModule.default;
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
    console.log(`📡 Loaded event: ${event.name}`);
  }
}

client.on("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`💡 Prefix set to: ${PREFIX}`);

  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: "economyDB" });
    console.log("📦 MongoDB connected!");

    startPresenceRotation(client, PREFIX, 10000); // bot's Status changes every 10s
    startMiningTask(); // background mining
    console.log("⛏️ Mining background task started.");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
  }
});

// ------------------------------
// MongoDB & Client graceful shutdown
// ------------------------------
async function shutdown() {
  console.log("\n🛑 Shutting down bot...");
  try {
    await mongoose.disconnect();
    console.log("📦 MongoDB disconnected!");
  } catch (err) {
    console.error("❌ Error disconnecting MongoDB:", err);
  }

  try {
    await client.destroy();
    console.log("👋 Discord client destroyed!");
  } catch (err) {
    console.error("❌ Error destroying client:", err);
  }

  process.exit(0);
}

// Handle process signals
process.on("SIGINT", shutdown);  // Ctrl+C
process.on("SIGTERM", shutdown); // kill command / system stop
process.on("SIGQUIT", shutdown); // optional extra

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ✅ Fetch server prefix dynamically
  let PREFIX = process.env.PREFIX || "!";
  if (message.guild) {
    const guildConfig = await GuildConfig.findOne({ guildId: message.guild.id });
    if (guildConfig?.prefix) PREFIX = guildConfig.prefix;
  }

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command =
    client.commands.get(commandName) ||
    client.commands.find((cmd) => cmd.aliases?.includes(commandName));

  if (!command) return;

  const commandsNeedingUser = new Set([
    "balance",
    "shop",
    "buy",
    "mine",
    "sell",
    "minion",
  ]);

  if (commandsNeedingUser.has(command.name)) {
    let UserModel;
    try {
      UserModel = (await import("./src/models/User.js")).default;
    } catch (e) {
      console.error("Failed to load User model", e);
      return message.reply("❌ Internal error. Please try again later.");
    }

    let user;
    try {
      user = await UserModel.findOne({ userId: message.author.id });
      if (!user) {
        return message.reply(`❌ You need to register first! Use \`${PREFIX}register\`.`);
      }
    } catch (e) {
      console.error("Error fetching user data", e);
      return message.reply("❌ Failed to fetch your profile. Try again later.");
    }

    try {
      await command.execute(message, args, user, client);
    } catch (error) {
      console.error(error);
      const errorEmbed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("❌ Error")
        .setDescription("There was an error executing that command.");
      return message.reply({ embeds: [errorEmbed] });
    }
  } else {
    try {
      await command.execute(message, args, client);
    } catch (error) {
      console.error(error);
      const errorEmbed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("❌ Error")
        .setDescription("There was an error executing that command.");
      return message.reply({ embeds: [errorEmbed] });
    }
  }
});

client.login(process.env.TOKEN);