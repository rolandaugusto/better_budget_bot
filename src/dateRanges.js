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

function allTimeRange() {
  return { start: "1970-01-01", end: toISODate(new Date()) };
}

function monthLabel(d) {
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

// Month-to-date range for the month `monthsAgo` months back (0 = current
// month). Past months are capped to today's day-of-month so the comparison
// covers the same number of days as the current, still-in-progress month.
function monthToDateRange(monthsAgo = 0) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = monthsAgo === 0 ? now.getDate() : Math.min(now.getDate(), daysInTargetMonth);
  const end = new Date(target.getFullYear(), target.getMonth(), day);
  return { start: toISODate(target), end: toISODate(end), label: monthLabel(target), day };
}

module.exports = {
  todayRange,
  weekRange,
  monthRange,
  allTimeRange,
  monthToDateRange,
};
