import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import PeriodSwitcher from '../components/PeriodSwitcher';
import PeriodNav from '../components/PeriodNav';
import StatGrid from '../components/StatGrid';
import SkillsPanel from '../components/SkillsPanel';
import TopMistakesPanel from '../components/TopMistakesPanel';
import WeeklyBreakdown from '../components/WeeklyBreakdown';
import MonthlyBreakdown from '../components/MonthlyBreakdown';
import CallsTable from '../components/CallsTable';
import { isQuotaError } from '../lib/format';

export default function Dashboard() {
  const [period, setPeriod] = useState('daily');
  const [date, setDate] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyzingId, setAnalyzingId] = useState(null);
  const [rowErrors, setRowErrors] = useState({});
  const [workerStatus, setWorkerStatus] = useState(null);

  const load = useCallback(async (p, d) => {
    setLoading(true);
    setError('');
    try {
      const params = { period: p };
      if (d) params.date = d;
      const res = await api.get('/dashboard', { params });
      setData(res.data);
      setDate(res.data.selectedDate);
    } catch (err) {
      setError(err.response?.data?.error || 'Ma\'lumotlarni yuklashda xatolik yuz berdi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    api
      .get('/analysis-worker/status')
      .then((res) => setWorkerStatus(res.data))
      .catch(() => setWorkerStatus(null));
  }, []);

  function handlePeriodChange(p) {
    setPeriod(p);
  }

  function handlePrev() {
    if (data?.prevDate) load(period, data.prevDate);
  }

  function handleNext() {
    if (data?.nextDate) load(period, data.nextDate);
  }

  function patchCall(callId, patch) {
    setData((prev) => (prev ? { ...prev, calls: prev.calls.map((c) => (c.id === callId ? { ...c, ...patch } : c)) } : prev));
  }

  async function handleAnalyze(callId) {
    setAnalyzingId(callId);
    setRowErrors((prev) => ({ ...prev, [callId]: undefined }));
    patchCall(callId, { analysisStatus: 'PROCESSING' });

    try {
      const res = await api.post(`/calls/${callId}/analyze`);
      const updated = res.data.call;
      patchCall(callId, { analysisStatus: updated.analysisStatus, overallScore: updated.analysis?.overallScore ?? null });
    } catch (err) {
      try {
        const fresh = await api.get(`/calls/${callId}`);
        const updated = fresh.data.call;
        patchCall(callId, { analysisStatus: updated.analysisStatus, analysisError: updated.analysisError });
        if (!isQuotaError(updated.analysisError)) {
          setRowErrors((prev) => ({ ...prev, [callId]: err.response?.data?.error || 'Tahlilda xatolik yuz berdi.' }));
        }
      } catch {
        setRowErrors((prev) => ({ ...prev, [callId]: err.response?.data?.error || 'Tahlilda xatolik yuz berdi.' }));
        patchCall(callId, { analysisStatus: 'FAILED' });
      }
    } finally {
      setAnalyzingId(null);
    }
  }

  return (
    <div>
      <PeriodSwitcher period={period} onChange={handlePeriodChange} />

      {data && <PeriodNav label={data.range.label} onPrev={handlePrev} onNext={handleNext} />}

      {loading && <div className="empty-state">Yuklanmoqda...</div>}
      {error && <div className="error-text">{error}</div>}

      {!loading && data && (
        <>
          <StatGrid totals={data.totals} />

          <div className="call-detail-grid">
            <SkillsPanel skills={data.skills} />
            <TopMistakesPanel topMistakes={data.topMistakes} />
          </div>

          {period === 'weekly' && data.breakdown && <WeeklyBreakdown breakdown={data.breakdown} />}
          {period === 'monthly' && data.breakdown && <MonthlyBreakdown breakdown={data.breakdown} />}

          <div className="panel">
            <h3>Batafsil qo'ng'iroqlar</h3>
            {data.callsTotal > data.callsShown && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8, marginBottom: 16 }}>
                So'nggi {data.callsShown} ta ko'rsatilmoqda (jami {data.callsTotal} ta).
              </p>
            )}
            <CallsTable
              calls={data.calls}
              analyzingId={analyzingId}
              rowErrors={rowErrors}
              onAnalyze={handleAnalyze}
              workerStatus={workerStatus}
            />
          </div>
        </>
      )}
    </div>
  );
}
