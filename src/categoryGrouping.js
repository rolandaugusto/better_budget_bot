function levenshtein(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[rows - 1][cols - 1];
}

// Only group names of at least 4 characters, so short unrelated categories
// (e.g. "gas" and "gap") aren't merged purely by chance.
function isCloseMatch(a, b) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4) return false;
  return levenshtein(a, b) <= 1;
}

// Groups rows ({category, total, count}) whose category names differ by at
// most one character (e.g. "beer" and "beers"), transitively via union-find.
// Returns rows shaped the same way, using the highest-spending member's name
// as the group label, plus a `members` array of every raw category folded in.
function groupCategories(rows) {
  const parent = new Map(rows.map((r) => [r.category, r.category]));
  function find(x) {
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
    return parent.get(x);
  }
  function union(x, y) {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  }

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (isCloseMatch(rows[i].category, rows[j].category)) {
        union(rows[i].category, rows[j].category);
      }
    }
  }

  const groups = new Map();
  for (const r of rows) {
    const root = find(r.category);
    const group = groups.get(root) || { members: [], total: 0, count: 0 };
    group.members.push(r.category);
    group.total += r.total;
    group.count += r.count;
    groups.set(root, group);
  }

  return [...groups.values()]
    .map((g) => {
      const label = rows
        .filter((r) => g.members.includes(r.category))
        .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))[0].category;
      return { category: label, total: g.total, count: g.count, members: g.members };
    })
    .sort((a, b) => b.total - a.total);
}

// Groups the union of two periods' category rows together (so "beer" in one
// period and "beers" in the other land in the same group), then splits each
// group's total back into its previous/current contributions.
function groupCategoryTrend(currentRows, previousRows) {
  const totals = new Map();
  for (const r of previousRows) totals.set(r.category, { previous: r.total, current: 0 });
  for (const r of currentRows) {
    const entry = totals.get(r.category) || { previous: 0, current: 0 };
    entry.current = r.total;
    totals.set(r.category, entry);
  }

  const pseudoRows = [...totals.entries()].map(([category, v]) => ({
    category,
    total: v.previous + v.current,
    count: 1,
  }));

  return groupCategories(pseudoRows)
    .map((g) => {
      let previous = 0;
      let current = 0;
      for (const member of g.members) {
        const v = totals.get(member);
        previous += v.previous;
        current += v.current;
      }
      return { category: g.category, previous, current, members: g.members };
    })
    .sort((a, b) => Math.abs(b.current - b.previous) - Math.abs(a.current - a.previous));
}

module.exports = { groupCategories, groupCategoryTrend };
