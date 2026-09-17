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
- `/stats [today|week|month|all]` — category breakdown with a bar chart (default month)
- `/trend` — compare this month-to-date against the same number of days last month
- `/list [n]` — recent expenses (default 10)
- `/edit <id> <category>` — fix a mistyped category on an expense
- `/delete <id>` — remove an expense by id
- `/backup` — download all your expenses as a JSON file
- `/restore` — restore expenses from a `/backup` file (just send the file); safe to run repeatedly, duplicates are skipped
- `/help` — show available commands

Expenses are stored per Telegram chat in a SQLite database. By default this is
a local file (`expenses.db`), which is lost on redeploy in most hosting
environments unless you set `DB_PATH` to a file on persistent storage (e.g. a
mounted volume). Either way, run `/backup` periodically and keep the file
somewhere safe — `/restore` can rebuild your history from it if the database
is ever lost.
