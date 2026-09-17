const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "expenses.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_expenses_chat_id ON expenses(chat_id);
`);

function addExpense(chatId, amount, category, description = "") {
  const stmt = db.prepare(
    "INSERT INTO expenses (chat_id, amount, category, description) VALUES (?, ?, ?, ?)"
  );
  const info = stmt.run(chatId, amount, category.toLowerCase(), description);
  return info.lastInsertRowid;
}

function deleteExpense(chatId, id) {
  const stmt = db.prepare("DELETE FROM expenses WHERE id = ? AND chat_id = ?");
  const info = stmt.run(id, chatId);
  return info.changes > 0;
}

function updateCategory(chatId, id, category) {
  const stmt = db.prepare(
    "UPDATE expenses SET category = ? WHERE id = ? AND chat_id = ?"
  );
  const info = stmt.run(category.toLowerCase(), id, chatId);
  return info.changes > 0;
}

function getExpenses(chatId, start, end) {
  const stmt = db.prepare(`
    SELECT * FROM expenses
    WHERE chat_id = ? AND date(created_at) BETWEEN date(?) AND date(?)
    ORDER BY created_at DESC
  `);
  return stmt.all(chatId, start, end);
}

function getRecentExpenses(chatId, limit = 10) {
  const stmt = db.prepare(
    "SELECT * FROM expenses WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?"
  );
  return stmt.all(chatId, limit);
}

function getSummaryByCategory(chatId, start, end) {
  const stmt = db.prepare(`
    SELECT category, SUM(amount) as total, COUNT(*) as count
    FROM expenses
    WHERE chat_id = ? AND date(created_at) BETWEEN date(?) AND date(?)
    GROUP BY category
    ORDER BY total DESC
  `);
  return stmt.all(chatId, start, end);
}

module.exports = {
  addExpense,
  deleteExpense,
  updateCategory,
  getExpenses,
  getRecentExpenses,
  getSummaryByCategory,
};
