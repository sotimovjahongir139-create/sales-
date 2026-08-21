import { useEffect, useState } from 'react';
import api from '../api/client';
import CallsTable from '../components/CallsTable';
import { isQuotaError } from '../lib/format';

export default function Calls() {
  const [calls, setCalls] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyzingId, setAnalyzingId] = useState(null);
  const [rowErrors, setRowErrors] = useState({});
  const [workerStatus, setWorkerStatus] = useState(null);

  useEffect(() => {
    api
      .get('/calls')
      .then((res) => {
        setTotal(res.data.total);
        setCalls(
          res.data.calls.map((c) => ({
            ...c,
            overallScore: c.analysis?.overallScore ?? null,
          }))
        );
      })
      .catch((err) => setError(err.response?.data?.error || "Ma'lumotlarni yuklashda xatolik yuz berdi."))
      .finally(() => setLoading(false));

    api
      .get('/analysis-worker/status')
      .then((res) => setWorkerStatus(res.data))
      .catch(() => setWorkerStatus(null));
  }, []);

  async function handleAnalyze(callId) {
    setAnalyzingId(callId);
    setRowErrors((prev) => ({ ...prev, [callId]: undefined }));
    setCalls((prev) => prev.map((c) => (c.id === callId ? { ...c, analysisStatus: 'PROCESSING' } : c)));

    try {
      const res = await api.post(`/calls/${callId}/analyze`);
      const updated = res.data.call;
      setCalls((prev) =>
        prev.map((c) =>
          c.id === callId
            ? { ...c, analysisStatus: updated.analysisStatus, overallScore: updated.analysis?.overallScore ?? null }
            : c
        )
      );
    } catch (err) {
      // The POST failure response only carries a generic message — the real
      // analysisError (needed to tell a quota hiccup from a genuine failure,
      // and to show the right one, not both) is only on the call record.
      try {
        const fresh = await api.get(`/calls/${callId}`);
        const updated = fresh.data.call;
        setCalls((prev) =>
          prev.map((c) =>
            c.id === callId ? { ...c, analysisStatus: updated.analysisStatus, analysisError: updated.analysisError } : c
          )
        );
        if (!isQuotaError(updated.analysisError)) {
          setRowErrors((prev) => ({ ...prev, [callId]: err.response?.data?.error || 'Tahlilda xatolik yuz berdi.' }));
        }
      } catch {
        setRowErrors((prev) => ({ ...prev, [callId]: err.response?.data?.error || 'Tahlilda xatolik yuz berdi.' }));
        setCalls((prev) => prev.map((c) => (c.id === callId ? { ...c, analysisStatus: 'FAILED' } : c)));
      }
    } finally {
      setAnalyzingId(null);
    }
  }

  return (
    <div>
      <div className="panel">
        <h3>Barcha qo'ng'iroqlar</h3>
        {!loading && !error && total > calls.length && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8, marginBottom: 16 }}>
            So'nggi {calls.length} ta ko'rsatilmoqda (jami {total} ta).
          </p>
        )}
        {loading && <div className="empty-state">Yuklanmoqda...</div>}
        {error && <div className="error-text">{error}</div>}
        {!loading && !error && (
          <CallsTable
            calls={calls}
            analyzingId={analyzingId}
            rowErrors={rowErrors}
            onAnalyze={handleAnalyze}
            workerStatus={workerStatus}
          />
        )}
      </div>
    </div>
  );
}
