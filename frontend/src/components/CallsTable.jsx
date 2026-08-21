import { useNavigate } from 'react-router-dom';
import {
  formatDuration,
  formatTimeUz,
  analysisStatusLabel,
  statusBadgeClass,
  scoreBadgeClass,
  isQuotaError,
  DIRECTION_LABELS,
} from '../lib/format';

export default function CallsTable({ calls, analyzingId, rowErrors, onAnalyze }) {
  const navigate = useNavigate();

  if (!calls || calls.length === 0) {
    return <div className="empty-state">Hozircha ma'lumot mavjud emas.</div>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Vaqt</th>
          <th>Mijoz</th>
          <th>Yo'nalish</th>
          <th>Davomiylik</th>
          <th>AI baho</th>
          <th>Holat</th>
          <th>Amal</th>
        </tr>
      </thead>
      <tbody>
        {calls.map((call) => {
          const isAnalyzing = analyzingId === call.id || call.analysisStatus === 'PROCESSING';
          const rowError = rowErrors?.[call.id];
          const canAnalyze = call.recordingUrl && (call.analysisStatus === 'NOT_ANALYZED' || call.analysisStatus === 'FAILED');
          const quotaFailed = call.analysisStatus === 'FAILED' && isQuotaError(call.analysisError);

          return (
            <tr key={call.id} onClick={() => navigate(`/calls/${call.id}`)}>
              <td>{formatTimeUz(call.startedAt)}</td>
              <td>{call.customerName || call.customerPhone || "Noma'lum"}</td>
              <td>{DIRECTION_LABELS[call.direction] || call.direction}</td>
              <td>{formatDuration(call.durationSeconds)}</td>
              <td>
                {call.overallScore !== null ? (
                  <span className={`score-badge ${scoreBadgeClass(call.overallScore)}`}>{call.overallScore}</span>
                ) : (
                  '—'
                )}
              </td>
              <td className="status-tag">
                {isAnalyzing ? (
                  <span className="badge badge-blue">Tahlil qilinmoqda...</span>
                ) : (
                  <span className={`badge ${statusBadgeClass(call)}`}>{analysisStatusLabel(call)}</span>
                )}
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                {canAnalyze && !isAnalyzing && (
                  <button className="analyze-btn-sm" onClick={() => onAnalyze(call.id)}>
                    {call.analysisStatus === 'FAILED' ? 'Qayta urinish' : 'Tahlil qilish'}
                  </button>
                )}
                {!canAnalyze && !isAnalyzing && call.analysisStatus === 'NOT_ANALYZED' && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Audio yo'q</span>
                )}
                {quotaFailed && !isAnalyzing && (
                  <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4 }}>
                    Birozdan so'ng qayta urining.
                  </div>
                )}
                {rowError && <div className="error-text" style={{ fontSize: 12, marginTop: 4 }}>{rowError}</div>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
