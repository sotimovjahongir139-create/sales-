const axios = require('axios');
const env = require('../config/env');

// READ-ONLY client. Only GET requests are ever made against amoCRM.
// Never add POST/PATCH/DELETE calls here — the app must not mutate CRM data.
const client = axios.create({
  baseURL: `https://${env.amocrmDomain}/api/v4`,
  headers: { Authorization: `Bearer ${env.amocrmAccessToken}` },
  timeout: 20000,
});

// Call notes live on leads and contacts as note_type call_in / call_out.
// params typically contains: uniq, duration, source, link (recording URL, often null
// depending on the connected telephony integration), phone, call_result, call_status.
//
// Ordering/filtering by created_at is confirmed unreliable for this endpoint —
// order[created_at]=desc does not return newest-first (verified directly:
// page 1 came back as 2024 data while much newer notes existed), and
// filter[created_at][from] is silently ignored entirely (verified: 250/250
// results were before the requested cutoff). order[id]=desc, by contrast, IS
// reliably newest-first (verified directly against the live account) — note
// ids track true insertion order even when the created_at field doesn't
// sort correctly. Always use id for both ordering and cursoring here.
async function fetchCallNotes({ entityType, page = 1, limit = 250 } = {}) {
  const path = entityType === 'contacts' ? '/contacts/notes' : '/leads/notes';
  const params = {
    'filter[note_type][0]': 'call_in',
    'filter[note_type][1]': 'call_out',
    'order[id]': 'desc',
    limit,
    page,
  };
  try {
    const res = await client.get(path, { params });
    return res.data?._embedded?.notes || [];
  } catch (err) {
    if (err.response?.status === 204) return [];
    throw err;
  }
}

async function fetchLeadsForUser(amocrmUserId, { limit = 250 } = {}) {
  const res = await client.get('/leads', {
    params: {
      'filter[responsible_user_id]': amocrmUserId,
      limit,
    },
  });
  return res.data?._embedded?.leads || [];
}

async function fetchUsers() {
  const res = await client.get('/users', { params: { limit: 250 } });
  return res.data?._embedded?.users || [];
}

async function fetchAccount() {
  const res = await client.get('/account');
  return res.data;
}

module.exports = {
  fetchCallNotes,
  fetchLeadsForUser,
  fetchUsers,
  fetchAccount,
};
