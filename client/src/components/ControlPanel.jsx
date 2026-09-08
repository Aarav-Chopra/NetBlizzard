// ControlPanel.jsx — Zone spike controls with vivid flickering dots
import { AlertTriangle, ShieldCheck } from 'lucide-react';

function dotClass(zone) {
  if (zone.spiked) return 'dot dot-spike';
  const st = zone.network?.status || 'safe';
  return st === 'safe' ? 'dot dot-good' : st === 'warning' ? 'dot dot-mod' : 'dot dot-danger';
}

const SLICE_COL = { URLLC: '#ff7070', mMTC: '#f5c518', eMBB: '#1fe090' };
const DOT_VAL   = { safe: '#1fe090', warning: '#f5c518', danger: '#ff4545' };

export default function ControlPanel({ zones, onSpike, onResolve }) {
  return (
    <div style={{ padding: 8, overflowY: 'auto', height: '100%' }}>
      <div style={{
        fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: '#6a7d96',
        letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8,
        borderBottom: '1px solid #272e38', paddingBottom: 5,
      }}>
        Zone Control · Demo
      </div>

      {zones.map(z => {
        const st      = z.network?.status || 'safe';
        const bdrCol  = z.spiked ? '#6a1e1e' : st === 'danger' ? '#5a2020' : st === 'warning' ? '#4a3808' : '#272e38';
        const dotVal  = z.spiked ? '#ff1e1e' : DOT_VAL[st];
        const sliceCol = SLICE_COL[z.network?.slice] || '#1fe090';

        return (
          <div key={z.zoneId} style={{
            background: '#1e2228', border: `1px solid ${bdrCol}`,
            padding: '8px 10px', marginBottom: 5,
          }}>
            {/* Zone header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div className={dotClass(z)} />
                <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, fontWeight: 600, color: '#dde2ea' }}>
                  Z{z.zoneId}
                </span>
                <span style={{ fontSize: 11, color: '#9aafc8',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>
                  {z.zoneName}
                </span>
              </div>
              <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 9,
                color: sliceCol, letterSpacing: '.06em', flexShrink: 0 }}>
                {z.network?.slice}
              </span>
            </div>

            {/* Readings */}
            <div style={{
              display: 'flex', gap: 8, fontFamily: 'IBM Plex Mono,monospace',
              fontSize: 10, color: '#9aafc8', marginBottom: 7,
            }}>
              <span>AQI <b style={{ color: dotVal }}>{z.aqi}</b></span>
              <span>{z.noise}dB</span>
              <span>{z.network?.latencyMs}ms</span>
              <span>{z.network?.frequencyHz}Hz</span>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 5 }}>
              <button className="btn btn-spike" style={{ flex: 1, fontSize: 10 }}
                onClick={() => onSpike(z.zoneId)} disabled={z.spiked}>
                <AlertTriangle size={10} strokeWidth={2} /> {z.spiked ? 'SPIKED' : 'SPIKE'}
              </button>
              <button className="btn btn-resolve" style={{ flex: 1, fontSize: 10 }}
                onClick={() => onResolve(z.zoneId)} disabled={!z.spiked}>
                <ShieldCheck size={10} strokeWidth={2} /> RESOLVE
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
