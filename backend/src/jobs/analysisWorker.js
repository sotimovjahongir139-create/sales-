const cron = require('node-cron');
const env = require('../config/env');
const prisma = require('../lib/prisma');
const analysisService = require('../services/analysis.service');
const autoAnalysisQuota = require('../services/autoAnalysisQuota.service');
const { isQuotaError, isDailyQuotaError } = require('../lib/geminiErrors');
const { CUTOFF_DATE } = require('../lib/callsCutoff');

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// In-memory only (resets on restart, same as the rest of this job's state) —
// good enough here: a restart just means one possibly-wasted attempt before
// the backoff re-triggers, not a real problem. This is a separate safety net
// from autoAnalysisQuota's DB-persisted daily cap below: that cap is meant
// to stop the worker BEFORE it ever hits a real 429 from its own volume;
// this pause handles the case where manual clicks alone already used up the
// shared 20/day quota before the worker's own cap kicked in.
let pausedUntil = 0;

async function runOnce() {
  if (Date.now() < pausedUntil) return { skipped: 'paused (quota backoff)' };

  const capped = await autoAnalysisQuota.isCappedToday();
  if (capped) return { skipped: 'daily auto-analysis cap reached' };

  // Oldest first (within scope) — clears the real backlog steadily day over
  // day instead of jumping around. The startedAt floor matters a lot here:
  // without it this picks the oldest NOT_ANALYZED row in the whole table,
  // which is pre-cutoff backlog (confirmed directly: 1403 pre-cutoff calls
  // are eligible vs 823 in-scope ones) — the worker would spend its entire
  // daily budget on calls no user-facing view ever shows, for months,
  // before ever reaching real data. One call per tick keeps this naturally
  // rate-limited without extra delay logic.
  const call = await prisma.call.findFirst({
    where: {
      analysisStatus: 'NOT_ANALYZED',
      recordingUrl: { not: null },
      startedAt: { gte: CUTOFF_DATE },
    },
    orderBy: { startedAt: 'asc' },
  });

  if (!call) return { skipped: 'nothing to analyze' };

  try {
    await analysisService.analyzeCall(call.id);
    const { count, justHitCap } = await autoAnalysisQuota.recordAutoAnalysis();
    console.log(`[analysis-worker] analyzed call ${call.id} (auto ${count}/${autoAnalysisQuota.DAILY_CAP} today)`);

    if (justHitCap) {
      const status = await autoAnalysisQuota.getStatus();
      console.log(
        `[analysis-worker] daily auto-analysis cap reached (${count}/${autoAnalysisQuota.DAILY_CAP}). ` +
        `Resuming at ${status.resumesAt}.`
      );
    }
    return { analyzed: call.id };
  } catch (err) {
    // analyzeCall stores the real Gemini/pipeline error on the call row and
    // only throws a generic ApiError — read the real one back to decide.
    const fresh = await prisma.call.findUnique({ where: { id: call.id } });
    const realError = fresh?.analysisError || err.message;

    if (isQuotaError(realError)) {
      const backoffMs = isDailyQuotaError(realError) ? ONE_DAY_MS : ONE_HOUR_MS;
      pausedUntil = Date.now() + backoffMs;
      console.log(
        `[analysis-worker] quota exhausted (before hitting the daily auto-cap — likely manual usage), ` +
        `pausing until ${new Date(pausedUntil).toISOString()}. Reason: ${realError}`
      );
      return { pausedFor: realError };
    }

    console.error(`[analysis-worker] call ${call.id} failed (not a quota error):`, realError);
    return { failed: call.id, error: realError };
  }
}

function startAnalysisWorker() {
  const minutes = Math.max(1, env.analysisWorkerIntervalMinutes);
  const expression = `*/${minutes} * * * *`;

  cron.schedule(expression, () => {
    runOnce().catch((err) => console.error('[analysis-worker] tick crashed:', err.message));
  });

  console.log(
    `[analysis-worker] scheduled every ${minutes} minute(s), oldest-first, ` +
    `capped at ${autoAnalysisQuota.DAILY_CAP} auto-analyses/day, respects quota backoff.`
  );
}

module.exports = { startAnalysisWorker, runOnce };
