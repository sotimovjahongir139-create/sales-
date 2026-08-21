export function formatDuration(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined) return '—';
  const seconds = Math.round(totalSeconds);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function scoreColor(score) {
  if (score === null || score === undefined) return 'var(--text-muted)';
  if (score >= 80) return 'var(--good)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--critical)';
}

export const ANALYSIS_STATUS_LABELS = {
  NOT_ANALYZED: 'Tahlil qilinmagan',
  PROCESSING: 'Tahlil qilinmoqda',
  COMPLETED: 'Tahlil tayyor',
  FAILED: 'Xatolik',
};

// Distinguishes "Gemini kvotasi tugagan, keyinroq o'zi tuzaladi" from a
// genuine per-call failure — same underlying analysisStatus (FAILED), but a
// very different, distinct message to the user: this one WILL succeed on
// retry once quota resets, a real failure might not.
export function isQuotaError(analysisError) {
  if (!analysisError) return false;
  return /RESOURCE_EXHAUSTED|quota/i.test(analysisError);
}

// Mirrors backend/src/lib/geminiErrors.js's isDailyQuotaError — only a
// per-day cap justifies "ertaga urinib ko'ring" copy; a short per-minute
// throttle clears itself in seconds and shouldn't tell someone to wait a day.
export function isDailyQuotaError(analysisError) {
  if (!analysisError) return false;
  return /PerDay/i.test(analysisError);
}

export function quotaErrorMessage(analysisError) {
  return isDailyQuotaError(analysisError)
    ? "Kvota tugagan, ertaga urinib ko'ring."
    : 'Kvota vaqtincha tugagan, birozdan so\'ng qayta urining.';
}

// isCappedAndEligible: true when the automatic worker has hit today's cap
// AND this specific call would otherwise have been eligible for it (has a
// recording, not yet analyzed) — that's the "Navbatda" case: calm, honest,
// not an error. A call with no recording is unaffected by the cap at all,
// it was never going anywhere regardless — stays "Audio yo'q".
export function analysisStatusLabel(call, workerStatus) {
  if (call.analysisStatus === 'FAILED' && isQuotaError(call.analysisError)) {
    return 'Kvota tugagan';
  }
  if (call.analysisStatus === 'NOT_ANALYZED' && call.recordingUrl && workerStatus?.cappedToday) {
    return 'Navbatda';
  }
  return ANALYSIS_STATUS_LABELS[call.analysisStatus] || call.analysisStatus;
}

// badge-{gray,blue,green,amber,red} — see .badge-* in styles.css.
export function statusBadgeClass(call, workerStatus) {
  if (call.analysisStatus === 'FAILED') {
    return isQuotaError(call.analysisError) ? 'badge-amber' : 'badge-red';
  }
  if (call.analysisStatus === 'PROCESSING') return 'badge-blue';
  if (call.analysisStatus === 'COMPLETED') return 'badge-green';
  if (call.analysisStatus === 'NOT_ANALYZED' && call.recordingUrl && workerStatus?.cappedToday) return 'badge-blue';
  return 'badge-gray'; // NOT_ANALYZED, not capped (or no recording)
}

export function scoreBadgeClass(score) {
  if (score === null || score === undefined) return 'badge-gray';
  if (score >= 80) return 'badge-green';
  if (score >= 60) return 'badge-amber';
  return 'badge-red';
}

export const DIRECTION_LABELS = {
  IN: 'Kiruvchi',
  OUT: 'Chiquvchi',
};

export function formatDateTimeUz(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('uz-Latn', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatTimeUz(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('uz-Latn', {
    timeZone: 'Asia/Tashkent',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
