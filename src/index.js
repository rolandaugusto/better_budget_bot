require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const db = require("./db");
const { todayRange, weekRange, monthRange } = require("./dateRanges");

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("Missing BOT_TOKEN. Copy .env.example to .env and set it.");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

function formatAmount(n) {
  return n.toFixed(2);
}

function formatExpenseRow(row) {
  const desc = row.description ? ` (${row.description})` : "";
  return `#${row.id} — ${formatAmount(row.amount)} · ${row.category}${desc}`;
}

function summaryMessage(title, chatId, start, end) {
  const expenses = db.getExpenses(chatId, start, end);
  if (expenses.length === 0) {
    return `${title}\nNo expenses recorded.`;
  }
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = db.getSummaryByCategory(chatId, start, end);
  const lines = byCategory.map(
    (r) => `  ${r.category}: ${formatAmount(r.total)} (${r.count})`
  );
  return `${title}\nTotal: ${formatAmount(total)}\n\nBy category:\n${lines.join("\n")}`;
}

// amount category [description]
// e.g. "15.50 food lunch with friends" or "12 transport"
const EXPENSE_PATTERN = /^([0-9]+(?:[.,][0-9]{1,2})?)\s+(\S+)(?:\s+(.*))?$/;

function parseExpenseText(text) {
  const match = text.trim().match(EXPENSE_PATTERN);
  if (!match) return null;
  const amount = parseFloat(match[1].replace(",", "."));
  if (Number.isNaN(amount) || amount <= 0) return null;
  const category = match[2];
  const description = match[3] || "";
  return { amount, category, description };
}

function recordExpense(chatId, parsed, reply) {
  const id = db.addExpense(chatId, parsed.amount, parsed.category, parsed.description);
  const desc = parsed.description ? ` (${parsed.description})` : "";
  reply(
    `Added #${id}: ${formatAmount(parsed.amount)} · ${parsed.category}${desc}`
  );
}

bot.onText(/^\/start$/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Welcome to Better Budget Bot!\n\n" +
      "Track your daily expenses by sending:\n" +
      "  <amount> <category> [description]\n" +
      "e.g. 15.50 food lunch with friends\n\n" +
      "Or use /add <amount> <category> [description]\n\n" +
      "Other commands: /today /week /month /list /delete <id> /help"
  );
});

bot.onText(/^\/help$/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Commands:\n" +
      "/add <amount> <category> [description] — log an expense\n" +
      "/today — today's expenses\n" +
      "/week — this week's expenses\n" +
      "/month — this month's expenses\n" +
      "/list [n] — recent expenses (default 10)\n" +
      "/delete <id> — remove an expense by id\n\n" +
      "Tip: you can skip /add and just send: 15.50 food lunch"
  );
});

bot.onText(/^\/add(?:@\S+)?\s+(.+)$/s, (msg, match) => {
  const parsed = parseExpenseText(match[1]);
  if (!parsed) {
    bot.sendMessage(
      msg.chat.id,
      "Couldn't parse that. Use: /add <amount> <category> [description]\ne.g. /add 15.50 food lunch"
    );
    return;
  }
  recordExpense(msg.chat.id, parsed, (text) => bot.sendMessage(msg.chat.id, text));
});

bot.onText(/^\/today$/, (msg) => {
  const { start, end } = todayRange();
  bot.sendMessage(msg.chat.id, summaryMessage("Today", msg.chat.id, start, end));
});

bot.onText(/^\/week$/, (msg) => {
  const { start, end } = weekRange();
  bot.sendMessage(msg.chat.id, summaryMessage("This week", msg.chat.id, start, end));
});

bot.onText(/^\/month$/, (msg) => {
  const { start, end } = monthRange();
  bot.sendMessage(msg.chat.id, summaryMessage("This month", msg.chat.id, start, end));
});

bot.onText(/^\/list(?:\s+(\d+))?$/, (msg, match) => {
  const limit = match[1] ? parseInt(match[1], 10) : 10;
  const rows = db.getRecentExpenses(msg.chat.id, limit);
  if (rows.length === 0) {
    bot.sendMessage(msg.chat.id, "No expenses recorded yet.");
    return;
  }
  const lines = rows.map(formatExpenseRow);
  bot.sendMessage(msg.chat.id, `Recent expenses:\n${lines.join("\n")}`);
});

bot.onText(/^\/delete(?:@\S+)?\s+(\d+)$/, (msg, match) => {
  const id = parseInt(match[1], 10);
  const deleted = db.deleteExpense(msg.chat.id, id);
  bot.sendMessage(
    msg.chat.id,
    deleted ? `Deleted expense #${id}.` : `No expense #${id} found.`
  );
});

// Fallback: treat plain text messages as quick expense entries.
bot.on("message", (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;
  const parsed = parseExpenseText(msg.text);
  if (!parsed) return;
  recordExpense(msg.chat.id, parsed, (text) => bot.sendMessage(msg.chat.id, text));
});

bot.on("polling_error", (err) => {
  console.error("Polling error:", err.message);
});

console.log("Better Budget Bot is running...");
