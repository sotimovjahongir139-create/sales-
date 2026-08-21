const axios = require('axios');
const prisma = require('../lib/prisma');
const env = require('../config/env');
const amocrm = require('./amocrm.service');
const { CUTOFF_UNIX } = require('../lib/callsCutoff');

// order[id]=desc is reliably newest-first (verified directly against the
// live account — note id tracks true insertion order even though the
// created_at field's own ordering/filtering do not, see amocrm.service.js).
// That makes both of these valid again:
//  - a persisted per-entity-type "highest note id seen" cursor (SyncState),
//    so steady-state runs only fetch the handful of genuinely new notes
//    instead of rescanning everything every time;
//  - stopping the moment a note's id is <= the cursor, or its created_at is
//    before CUTOFF_UNIX — since the order is reliable, everything after
//    that point is guaranteed to be even older/already-synced.
const MAX_PAGES_PER_RUN = 8;

const client = axios.create({
  baseURL: `https://${env.amocrmDomain}/api/v4`,
  headers: { Authorization: `Bearer ${env.amocrmAccessToken}` },
  timeout: 20000,
});

async function fetchEntityName(entityType, entityId) {
  try {
    const res = await client.get(`/${entityType}/${entityId}`);
    return res.data?.name || null;
  } catch {
    return null;
  }
}

// A note is only trusted as Asadbek's call when amoCRM itself attributes it to
// his user id, either as the note author or as the responsible user on the
// lead/contact the note is attached to. Notes created by the integration
// (created_by: 0) with no matching responsible_user_id are skipped rather than
// guessed at.
function belongsToSalesperson(note, amocrmUserId) {
  const createdBy = String(note.created_by);
  const responsibleId = String(note.responsible_user_id);
  return createdBy === String(amocrmUserId) || responsibleId === String(amocrmUserId);
}

async function upsertCallFromNote(note, entityType, salespersonId) {
  const amocrmCallId = `${entityType}:${note.id}`;
  const params = note.params || {};

  const existing = await prisma.call.findUnique({ where: { amocrmCallId } });
  if (existing) return { created: false };

  const customerName = await fetchEntityName(entityType, note.entity_id);

  try {
    await prisma.call.create({
      data: {
        amocrmCallId,
        salespersonId,
        customerName,
        customerPhone: params.phone || null,
        direction: note.note_type === 'call_in' ? 'IN' : 'OUT',
        startedAt: new Date(note.created_at * 1000),
        durationSeconds: params.duration || 0,
        recordingUrl: params.link || null,
        analysisStatus: 'NOT_ANALYZED',
      },
    });
  } catch (err) {
    // amoCRM's live pagination can shift mid-crawl and hand us the same note
    // twice in one run; a unique-constraint hit here just means another
    // iteration already inserted it first.
    if (err.code !== 'P2002') throw err;
  }
  return { created: true };
}

async function syncEntityType(entityType, salesperson) {
  // "-v2": earlier code wrote to plain `notes:${entityType}` using an
  // order[created_at]=desc crawl later proven unreliable — its recorded
  // lastNoteId can't be trusted to sit on the correct side of either "already
  // synced" or the Aug-2026 cutoff. Starting this key fresh (cursor 0) costs
  // one slightly-larger first run, bounded by MAX_PAGES_PER_RUN same as
  // always, and guarantees nothing real gets silently skipped.
  const stateKey = `notes-v2:${entityType}`;
  const state = await prisma.syncState.upsert({
    where: { key: stateKey },
    update: {},
    create: { key: stateKey, lastNoteId: 0 },
  });

  let fetched = 0;
  let created = 0;
  let skippedUnattributed = 0;
  let highestNoteIdSeen = state.lastNoteId;
  let stopReason = 'exhausted';

  pages: for (let page = 1; page <= MAX_PAGES_PER_RUN; page += 1) {
    const notes = await amocrm.fetchCallNotes({ entityType, page });
    if (notes.length === 0) break;

    for (const note of notes) {
      if (note.id <= state.lastNoteId) {
        stopReason = 'caught up to last sync';
        break pages;
      }
      if (note.created_at < CUTOFF_UNIX) {
        stopReason = 'reached cutoff date';
        break pages;
      }

      if (note.id > highestNoteIdSeen) highestNoteIdSeen = note.id;
      fetched += 1;

      if (!belongsToSalesperson(note, salesperson.amocrmUserId)) {
        skippedUnattributed += 1;
        continue;
      }
      const result = await upsertCallFromNote(note, entityType, salesperson.id);
      if (result.created) created += 1;
    }

    if (notes.length < 250) break;
  }

  if (highestNoteIdSeen > state.lastNoteId) {
    await prisma.syncState.update({
      where: { key: stateKey },
      data: { lastNoteId: highestNoteIdSeen },
    });
  }

  console.log(`[sync:${entityType}] fetched=${fetched} created=${created} skippedUnattributed=${skippedUnattributed} stopReason="${stopReason}"`);
  return { fetched, created, skippedUnattributed };
}

async function syncAmoCrmCalls() {
  if (!env.amocrmAccessToken || !env.amocrmDomain) {
    throw new Error('amoCRM ulanish sozlanmagan (AMOCRM_DOMAIN / AMOCRM_ACCESS_TOKEN).');
  }

  const salesperson = await prisma.salesperson.findUnique({
    where: { amocrmUserId: env.asadbekAmocrmUserId },
  });
  if (!salesperson) {
    throw new Error('Sotuvchi (Asadbek) bazada topilmadi. Avval seed skriptini ishga tushiring.');
  }

  const totals = { fetched: 0, created: 0, skippedUnattributed: 0 };
  for (const entityType of ['leads', 'contacts']) {
    const result = await syncEntityType(entityType, salesperson);
    totals.fetched += result.fetched;
    totals.created += result.created;
    totals.skippedUnattributed += result.skippedUnattributed;
  }

  return totals;
}

module.exports = { syncAmoCrmCalls };
