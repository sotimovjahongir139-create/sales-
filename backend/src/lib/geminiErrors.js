// Same detection the frontend uses (frontend/src/lib/format.js isQuotaError) —
// kept as a small separate backend copy since the two apps don't share a
// module boundary; keep both in sync if this changes.
function isQuotaError(message) {
  if (!message) return false;
  return /RESOURCE_EXHAUSTED|quota/i.test(message);
}

// Google's free-tier quotas include both daily caps
// (GenerateRequestsPerDayPerProjectPerModel-FreeTier) and short per-minute
// throttles. Only a daily cap justifies a long backoff — a per-minute one
// clears itself in seconds and a 1-hour pause would be needlessly wasteful.
function isDailyQuotaError(message) {
  if (!message) return false;
  return /PerDay/i.test(message);
}

module.exports = { isQuotaError, isDailyQuotaError };
