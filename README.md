# Zappy

Zappy is a Discord economy bot built with Discord.js and MongoDB. It includes an economy system, banking, mining, minions, an item shop, inventory management, and server utilities.

## Features

- Economy accounts, balances, daily rewards, leaderboards, coin flips, and robbing
- Bank accounts with deposits, withdrawals, transfers, loans, repayments, and reserved funds
- Mining with pickaxes, ore collection, cooldowns, and anti-abuse checks
- Minions that mine ores over time
- Shop and inventory management
- Interactive help and shop menus
- Per-server command prefixes
- MongoDB persistence
- Automatic background tasks for mining and minions
- Configurable bot presence rotation

## Requirements

- Node.js 18 or newer
- A Discord bot application and bot token
- A MongoDB database

## Installation

1. Clone or download the project.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

4. Fill in the environment variables:

   ```env
   TOKEN=your_discord_bot_token
   MONGO_URI=your_mongodb_connection_string
   BANK_TAX_CHANNEL_ID=your_tax_channel_id
   PREFIX=!
   ```

5. Enable the required Discord gateway intents for the bot. The project uses Guilds, Guild Messages, and Message Content.
6. Start the bot:

   ```bash
   node index.js
   ```

## Commands

Commands are grouped into the following areas:

### General
- `help` — Open the interactive command menu
- `ping` — Check bot response time

### Economy
- `register` — Create an economy account
- `balance` — View your balances
- `daily` — Claim the daily reward
- `leaderboard` — View the richest users
- `coinflip` — Bet on a coin flip
- `rob` — Attempt to steal from another user

### Bank
- `bank` — Open the banking interface
- `transfer` — Transfer funds to another bank account

The bank module also provides account registration, account information, deposits, withdrawals, loans, repayments, reserved funds, and statistics.

### Mining
- `mine` — Mine ores
- `pickaxe` — View or manage pickaxes
- `appeal` — Submit a mining-related appeal

### Minions
- `minion` — Manage minions
- `minion collect` — Collect stored ores
- `minion equip` — Equip a minion
- `minion show` — View minion information
- `minion slots` — View active minion slots
- `minion unequip` — Unequip a minion

### Shop and Inventory
- `shop` — Browse available items
- `sell` — Sell ores
- `inv` — View your inventory

### Administration
- `setprefix` — Change the server command prefix

Run `help` in Discord for the current command list and interactive descriptions.

## Configuration

The default command prefix is `!`. It can be changed globally with `PREFIX` in `.env` or per server with the administration command.

MongoDB is used to store user accounts, guild configuration, minions, and other persistent economy data.

## Project Structure

```text
.
├── index.js
├── src/
│   ├── commands/
│   │   ├── Admin/
│   │   ├── bank/
│   │   ├── economy/
│   │   ├── general/
│   │   ├── inventory/
│   │   ├── mining/
│   │   ├── minion/
│   │   └── shop/
│   ├── events/
│   ├── models/
│   └── utils/
├── .env.example
├── .gitignore
├── package.json
└── package-lock.json
```

## Notes

- Never commit `.env` or your Discord token.
- Keep the MongoDB connection string private.
- The economy uses virtual currency only.
- Some features rely on background tasks that run while the bot is online.

## License

MIT License
