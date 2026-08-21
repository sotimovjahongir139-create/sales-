const { DateTime } = require('luxon');
const prisma = require('../lib/prisma');
const env = require('../config/env');

// Reuses the AppSetting key-value table (already used for the Gemini key) —
// these two rows aren't secrets, so they're stored plain, no
// encrypt/decrypt. Resets at local midnight (Asia/Tashkent), not a rolling
// 24h window — simpler to reason about and matches how the free-tier quota
// itself is framed ("per day").
const DATE_KEY = 'autoAnalysisDate';
const COUNT_KEY = 'autoAnalysisCount';

// Leaves ~5 of the real 20/day Gemini quota free for manual
// "Tahlil qilish" / "Qayta urinish" clicks — those aren't capped by this
// number, they just share the same underlying 20/day with the worker.
const DAILY_CAP = 15;

function todayLocal() {
  return DateTime.now().setZone(env.timezone).toISODate();
}

function nextMidnightLocal() {
  return DateTime.now().setZone(env.timezone).plus({ days: 1 }).startOf('day').toISO();
}

// Reads today's count, resetting the counter first if the stored date isn't
// today (new day, or first run ever — AppSetting rows don't exist yet).
async function currentCount() {
  const today = todayLocal();
  const dateRow = await prisma.appSetting.findUnique({ where: { key: DATE_KEY } });

  if (!dateRow || dateRow.value !== today) {
    await prisma.appSetting.upsert({
      where: { key: DATE_KEY },
      update: { value: today },
      create: { key: DATE_KEY, value: today },
    });
    await prisma.appSetting.upsert({
      where: { key: COUNT_KEY },
      update: { value: '0' },
      create: { key: COUNT_KEY, value: '0' },
    });
    return 0;
  }

  const countRow = await prisma.appSetting.findUnique({ where: { key: COUNT_KEY } });
  return parseInt(countRow?.value || '0', 10);
}

async function isCappedToday() {
  return (await currentCount()) >= DAILY_CAP;
}

async function recordAutoAnalysis() {
  const count = await currentCount(); // also handles the day-rollover reset
  const newCount = count + 1;
  await prisma.appSetting.update({ where: { key: COUNT_KEY }, data: { value: String(newCount) } });
  return { count: newCount, justHitCap: newCount === DAILY_CAP };
}

async function getStatus() {
  const count = await currentCount();
  return {
    dailyCap: DAILY_CAP,
    autoAnalyzedToday: count,
    cappedToday: count >= DAILY_CAP,
    resumesAt: nextMidnightLocal(),
  };
}

module.exports = { isCappedToday, recordAutoAnalysis, getStatus, DAILY_CAP };
