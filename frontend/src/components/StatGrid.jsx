import { formatDuration } from '../lib/format';

const ICON_PROPS = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

function PhoneIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4 12 14.01l-3-3" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
      <path d="M12 12 15 8" />
      <path d="M12 4v2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export default function StatGrid({ totals }) {
  const tiles = [
    { label: "Jami qo'ng'iroqlar", value: totals.totalCalls, icon: <PhoneIcon /> },
    { label: 'Tahlil qilingan', value: totals.analyzedCalls, icon: <CheckIcon /> },
    { label: "O'rtacha AI baho", value: totals.avgScore !== null ? `${totals.avgScore} / 100` : '—', icon: <GaugeIcon /> },
    { label: "O'rtacha davomiylik", value: formatDuration(totals.avgDurationSeconds), icon: <ClockIcon /> },
  ];

  return (
    <div className="stat-grid">
      {tiles.map((t) => (
        <div className="stat-tile" key={t.label}>
          <div className="stat-icon">{t.icon}</div>
          <div className="label">{t.label}</div>
          <div className="value">{t.value}</div>
        </div>
      ))}
    </div>
  );
}
