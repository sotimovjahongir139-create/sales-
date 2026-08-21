import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import SkillsPanel from '../components/SkillsPanel';
import { scoreColor, scoreBadgeClass, formatDateTimeUz } from '../lib/format';

export default function Sotuvchi() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get('/salesperson/summary')
      .then((res) => setSummary(res.data))
      .catch((err) => setError(err.response?.data?.error || "Ma'lumotlarni yuklashda xatolik yuz berdi."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state">Yuklanmoqda...</div>;
  if (error) return <div className="error-text">{error}</div>;

  const name = summary.salesperson?.name || 'Sotuvchi';

  if (summary.analyzedCallsCount === 0) {
    return (
      <div className="panel">
        <h3>{name}</h3>
        <div className="empty-state">Hozircha tahlil qilingan qo'ng'iroqlar yo'q.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="call-detail-grid">
        <div className="panel">
          <h3>{name}</h3>
          <div style={{ fontSize: 40, fontWeight: 700, color: scoreColor(summary.overallScore), letterSpacing: '-0.02em' }}>
            {summary.overallScore} <span style={{ fontSize: 20, color: 'var(--text-muted)', fontWeight: 600 }}>/ 100</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            O'rtacha ball — {summary.analyzedCallsCount} ta tahlil qilingan qo'ng'iroq asosida
          </p>
        </div>

        <SkillsPanel skills={summary.skills} />
      </div>

      <div className="panel">
        <h3>Kuchli tomonlar</h3>
        {summary.strengths.length === 0 && <div className="empty-state">Aniqlangan kuchli tomonlar yo'q.</div>}
        <ul>
          {summary.strengths.map((s, i) => (
            <li key={i} style={{ marginBottom: 6, fontSize: 14 }}>{s}</li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h3>Xatolar</h3>
        {summary.mistakes.length === 0 && <div className="empty-state">Xatolar aniqlanmadi.</div>}
        <ul>
          {summary.mistakes.map((m, i) => (
            <li key={i} style={{ marginBottom: 6, fontSize: 14 }}>{m}</li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h3>Tavsiyalar</h3>
        {summary.recommendations.length === 0 && <div className="empty-state">Tavsiyalar yo'q.</div>}
        <ul>
          {summary.recommendations.map((r, i) => (
            <li key={i} style={{ marginBottom: 6, fontSize: 14 }}>{r}</li>
          ))}
        </ul>
      </div>

      {summary.recentCalls?.length > 0 && (
        <div className="panel">
          <h3>So'nggi tahlil qilingan qo'ng'iroqlar</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Sana</th>
                <th>Mijoz</th>
                <th>AI baho</th>
              </tr>
            </thead>
            <tbody>
              {summary.recentCalls.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/calls/${c.id}`)}>
                  <td>{formatDateTimeUz(c.startedAt)}</td>
                  <td>{c.customerName || c.customerPhone || "Noma'lum"}</td>
                  <td>
                    <span className={`score-badge ${scoreBadgeClass(c.overallScore)}`}>{c.overallScore}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
