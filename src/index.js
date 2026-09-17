require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const db = require("./db");
const {
  todayRange,
  weekRange,
  monthRange,
  allTimeRange,
  monthToDateRange,
} = require("./dateRanges");

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

function formatBar(fraction, width = 10) {
  const filled =
    fraction > 0
      ? Math.max(1, Math.min(width, Math.round(fraction * width)))
      : 0;
  return "█".repeat(filled) + "░".repeat(width - filled);
}

const STATS_PERIODS = {
  today: { range: todayRange, label: "Today" },
  week: { range: weekRange, label: "This week" },
  month: { range: monthRange, label: "This month" },
  all: { range: allTimeRange, label: "All time" },
};

function statsMessage(chatId, periodKey) {
  const { range, label } = STATS_PERIODS[periodKey];
  const { start, end } = range();
  const byCategory = db.getSummaryByCategory(chatId, start, end);
  if (byCategory.length === 0) {
    return `${label}\nNo expenses recorded.`;
  }
  const total = byCategory.reduce((sum, r) => sum + r.total, 0);
  const maxTotal = Math.max(...byCategory.map((r) => r.total));
  const lines = byCategory.map((r) => {
    const pct = total > 0 ? (r.total / total) * 100 : 0;
    const bar = formatBar(maxTotal > 0 ? r.total / maxTotal : 0);
    return `${r.category.padEnd(12).slice(0, 12)} ${bar} ${formatAmount(r.total)} (${pct.toFixed(0)}%)`;
  });
  return `${label} by category\nTotal: ${formatAmount(total)}\n\n\`\`\`\n${lines.join("\n")}\n\`\`\``;
}

function trendLine(label, previous, current) {
  const diff = current - previous;
  const arrow = diff > 0 ? "🔺" : diff < 0 ? "🔻" : "▪️";
  let pctText;
  if (previous === 0 && current > 0) {
    pctText = "new";
  } else if (previous === 0) {
    pctText = "0%";
  } else {
    pctText = `${diff >= 0 ? "+" : ""}${((diff / previous) * 100).toFixed(0)}%`;
  }
  return `${arrow} ${label}: ${formatAmount(previous)} → ${formatAmount(current)} (${pctText})`;
}

function trendMessage(chatId) {
  const current = monthToDateRange(0);
  const previous = monthToDateRange(1);
  const currentExpenses = db.getExpenses(chatId, current.start, current.end);
  const previousExpenses = db.getExpenses(chatId, previous.start, previous.end);
  if (currentExpenses.length === 0 && previousExpenses.length === 0) {
    return "Not enough data yet to show a trend.";
  }

  const currentTotal = currentExpenses.reduce((s, e) => s + e.amount, 0);
  const previousTotal = previousExpenses.reduce((s, e) => s + e.amount, 0);

  const currentByCategory = db.getSummaryByCategory(chatId, current.start, current.end);
  const previousByCategory = db.getSummaryByCategory(chatId, previous.start, previous.end);
  const byCategory = new Map();
  for (const r of previousByCategory) {
    byCategory.set(r.category, { previous: r.total, current: 0 });
  }
  for (const r of currentByCategory) {
    const entry = byCategory.get(r.category) || { previous: 0, current: 0 };
    entry.current = r.total;
    byCategory.set(r.category, entry);
  }
  const categoryLines = [...byCategory.entries()]
    .map(([category, v]) => ({ category, ...v, diff: Math.abs(v.current - v.previous) }))
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 8)
    .map((r) => trendLine(r.category, r.previous, r.current));

  const header = `${previous.label} (days 1–${previous.day}) → ${current.label} (days 1–${current.day})`;
  return (
    `Spending trend\n${header}\n\n` +
    `${trendLine("Total", previousTotal, currentTotal)}\n\n` +
    `By category:\n${categoryLines.join("\n")}`
  );
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
      "Other commands: /today /week /month /stats /trend /list /edit <id> <category> /delete <id> /backup /restore /help"
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
      "/stats [today|week|month|all] — category breakdown with bar chart (default month)\n" +
      "/trend — compare this month-to-date vs the same days last month\n" +
      "/list [n] — recent expenses (default 10)\n" +
      "/edit <id> <category> — fix a mistyped category on an expense\n" +
      "/delete <id> — remove an expense by id\n" +
      "/backup — download all your expenses as a JSON file\n" +
      "/restore — restore expenses from a /backup file (just send the file)\n\n" +
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

bot.onText(/^\/stats(?:@\S+)?(?:\s+(today|week|month|all))?$/i, (msg, match) => {
  const periodKey = (match[1] || "month").toLowerCase();
  bot.sendMessage(msg.chat.id, statsMessage(msg.chat.id, periodKey), {
    parse_mode: "Markdown",
  });
});

bot.onText(/^\/trend$/, (msg) => {
  bot.sendMessage(msg.chat.id, trendMessage(msg.chat.id));
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

bot.onText(/^\/edit(?:@\S+)?\s+(\d+)\s+(\S+)$/i, (msg, match) => {
  const id = parseInt(match[1], 10);
  const category = match[2];
  const updated = db.updateCategory(msg.chat.id, id, category);
  bot.sendMessage(
    msg.chat.id,
    updated
      ? `Updated #${id} category to ${category.toLowerCase()}.`
      : `No expense #${id} found.`
  );
});

bot.onText(/^\/backup$/, (msg) => {
  const chatId = msg.chat.id;
  const rows = db.getAllExpenses(chatId);
  if (rows.length === 0) {
    bot.sendMessage(chatId, "No expenses to back up yet.");
    return;
  }
  const records = rows.map((r) => ({
    amount: r.amount,
    category: r.category,
    description: r.description,
    created_at: r.created_at,
  }));
  const buffer = Buffer.from(JSON.stringify(records, null, 2), "utf-8");
  const filename = `expenses-backup-${new Date().toISOString().slice(0, 10)}.json`;
  bot.sendDocument(
    chatId,
    buffer,
    {
      caption: `Backup of ${records.length} expense${records.length === 1 ? "" : "s"}. Send this file back anytime to /restore it.`,
    },
    { filename, contentType: "application/json" }
  );
});

bot.onText(/^\/restore$/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Send me the .json backup file created by /backup and I'll restore any expenses that aren't already in your history."
  );
});

function isValidBackupRecord(r) {
  return (
    r &&
    typeof r.amount === "number" &&
    Number.isFinite(r.amount) &&
    r.amount > 0 &&
    typeof r.category === "string" &&
    r.category.trim() !== "" &&
    typeof r.created_at === "string" &&
    r.created_at.trim() !== ""
  );
}

const MAX_RESTORE_FILE_SIZE = 5 * 1024 * 1024; // 5MB

bot.on("document", async (msg) => {
  const chatId = msg.chat.id;
  const doc = msg.document;
  if (doc.file_size && doc.file_size > MAX_RESTORE_FILE_SIZE) {
    bot.sendMessage(chatId, "That file is too large to restore (max 5MB).");
    return;
  }

  let records;
  try {
    const fileLink = await bot.getFileLink(doc.file_id);
    const response = await fetch(fileLink);
    const parsed = JSON.parse(await response.text());
    if (!Array.isArray(parsed)) throw new Error("Backup file must contain a JSON array");
    records = parsed;
  } catch (err) {
    bot.sendMessage(
      chatId,
      "Couldn't read that file. Make sure it's a valid backup .json file created by /backup."
    );
    return;
  }

  let inserted = 0;
  let skipped = 0;
  for (const r of records) {
    if (
      !isValidBackupRecord(r) ||
      db.expenseExists(chatId, r.amount, r.category, r.description || "", r.created_at)
    ) {
      skipped++;
      continue;
    }
    db.addExpenseRaw(chatId, r.amount, r.category, r.description || "", r.created_at);
    inserted++;
  }
  bot.sendMessage(
    chatId,
    `Restore complete: ${inserted} expense${inserted === 1 ? "" : "s"} added, ${skipped} skipped (already present or invalid).`
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
