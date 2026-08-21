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

export function analysisStatusLabel(call) {
  if (call.analysisStatus === 'FAILED' && isQuotaError(call.analysisError)) {
    return 'Kvota tugagan';
  }
  return ANALYSIS_STATUS_LABELS[call.analysisStatus] || call.analysisStatus;
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
