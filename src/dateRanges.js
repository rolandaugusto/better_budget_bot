function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function todayRange() {
  const today = toISODate(new Date());
  return { start: today, end: today };
}

function weekRange() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  return { start: toISODate(monday), end: toISODate(now) };
}

function monthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: toISODate(first), end: toISODate(now) };
}

module.exports = { todayRange, weekRange, monthRange };
