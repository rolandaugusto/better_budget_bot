# Better Budget Bot

A Telegram bot to track your daily expenses, built with Node.js and SQLite.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a bot with [@BotFather](https://t.me/BotFather) on Telegram and copy its token.

3. Copy `.env.example` to `.env` and set your token:

   ```bash
   cp .env.example .env
   ```

4. Run the bot:

   ```bash
   npm start
   ```

## Usage

Send a message in the format `<amount> <category> [description]` and the bot logs it as an expense:

```
15.50 food lunch with friends
```

Or use the explicit command:

```
/add 15.50 food lunch with friends
```

### Commands

- `/add <amount> <category> [description]` — log an expense
- `/today` — today's expenses, totaled by category
- `/week` — this week's expenses (Mon–today), totaled by category
- `/month` — this month's expenses, totaled by category
- `/list [n]` — recent expenses (default 10)
- `/delete <id>` — remove an expense by id
- `/help` — show available commands

Expenses are stored per Telegram chat in a local SQLite database (`expenses.db`).
