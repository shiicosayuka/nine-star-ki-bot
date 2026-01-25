const sekigiri = require("./sekigiri.json");

// 日付だけを安定して比較するためUTC化（時刻は使わない）
function toUtcDate(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d));
}

function parseIsoDate(iso) {
  const [y, m, d] = iso.split("-").map(n => parseInt(n, 10));
  return toUtcDate(y, m, d);
}

// 気学年（節替り当日は切替後扱い）
function getKigakuYear(dateUtc, westernYear) {
  const row = sekigiri[String(westernYear)];
  if (!row) throw new Error(`万年暦データがありません: ${westernYear}年`);

  const yearSwitch = parseIsoDate(row.yearSwitch);
  return (dateUtc < yearSwitch) ? westernYear - 1 : westernYear;
}

// 気学月（節替り当日は切替後扱い）
function getKigakuMonth(dateUtc, westernYear) {
  const row = sekigiri[String(westernYear)];
  if (!row) throw new Error(`万年暦データがありません: ${westernYear}年`);

  const boundaries = [];
  for (let i = 1; i <= 12; i++) {
    const iso = row.monthSwitch[String(i)];
    if (!iso) throw new Error(`${westernYear}年 monthSwitch[${i}] がありません`);
    boundaries.push({ monthIdx: i, date: parseIsoDate(iso) });
  }
  boundaries.sort((a, b) => a.date - b.date);

  for (let i = boundaries.length - 1; i >= 0; i--) {
    if (dateUtc >= boundaries[i].date) return boundaries[i].monthIdx;
  }

  // 1月節替りより前 → 前年12月扱い
  return 12;
}

module.exports = { toUtcDate, getKigakuYear, getKigakuMonth };

