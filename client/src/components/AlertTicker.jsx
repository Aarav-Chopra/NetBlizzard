// AlertTicker.jsx — Scrolling live alert feed at the top of the dashboard
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';

const LEVEL_STYLES = {
  danger:  { color: 'text-red-400',    icon: AlertTriangle },
  warning: { color: 'text-yellow-400', icon: AlertTriangle },
  safe:    { color: 'text-green-400',  icon: CheckCircle },
  info:    { color: 'text-sky-400',    icon: Info },
};

export default function AlertTicker({ alerts }) {
  if (!alerts.length) return null;

  const text = alerts
    .slice(0, 8)
    .map(a => `  •  ${new Date(a.timestamp).toLocaleTimeString()}  ${a.message}`)
    .join('    ');

  const latestAlert = alerts[0];
  const { color, icon: Icon } = LEVEL_STYLES[latestAlert?.level] || LEVEL_STYLES.info;

  return (
    <div className="flex items-center gap-2 bg-[#040f24] border-b border-[#1e3a5f] px-3 py-1.5 overflow-hidden">
      <div className={`flex items-center gap-1.5 shrink-0 ${color}`}>
        <Icon size={13} />
        <span className="text-xs font-mono font-bold tracking-widest uppercase">Live</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <span className={`ticker-inner text-xs font-mono ${color}`}>{text}</span>
      </div>
    </div>
  );
}
