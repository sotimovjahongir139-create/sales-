const cron = require('node-cron');
const env = require('../config/env');
const prisma = require('../lib/prisma');
const analysisService = require('../services/analysis.service');
const { isQuotaError, isDailyQuotaError } = require('../lib/geminiErrors');

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// In-memory only (resets on restart, same as the rest of this job's state) —
// good enough here: a restart just means one possibly-wasted attempt before
// the backoff re-triggers, not a real problem.
let pausedUntil = 0;

async function runOnce() {
  if (Date.now() < pausedUntil) return { skipped: 'paused' };

  // Newest first — a sales dashboard cares more about recent calls than
  // clearing a multi-year backlog in order. One call per tick keeps this
  // naturally rate-limited without extra delay logic.
  const call = await prisma.call.findFirst({
    where: { analysisStatus: 'NOT_ANALYZED', recordingUrl: { not: null } },
    orderBy: { startedAt: 'desc' },
  });

  if (!call) return { skipped: 'nothing to analyze' };

  try {
    await analysisService.analyzeCall(call.id);
    console.log(`[analysis-worker] analyzed call ${call.id}`);
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
        `[analysis-worker] quota exhausted, pausing until ${new Date(pausedUntil).toISOString()}. ` +
        `Reason: ${realError}`
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

  console.log(`[analysis-worker] scheduled every ${minutes} minute(s), newest-first, respects quota backoff.`);
}

module.exports = { startAnalysisWorker, runOnce };
