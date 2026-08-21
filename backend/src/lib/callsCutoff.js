// Calls before this date are excluded from the app entirely — both from
// what /calls, /dashboard, and /salesperson/summary return, and from what
// sync bothers fetching. Chosen because everything before this point is
// either old backlog or from the anonymous/unattributed telephony stream
// (see amoCRM investigation notes in sync.service.js) — real, correctly
// attributed data starts around here.
const CUTOFF_DATE = new Date('2026-08-01T00:00:00+05:00'); // Asia/Tashkent
const CUTOFF_UNIX = Math.floor(CUTOFF_DATE.getTime() / 1000);

module.exports = { CUTOFF_DATE, CUTOFF_UNIX };
