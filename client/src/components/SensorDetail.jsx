// SensorDetail.jsx — Live time-series charts for a selected zone
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { BarChart2 } from 'lucide-react';

const METRICS = [
  { key: 'aqi',   label: 'Air Quality Index (AQI)', unit: '',       threshold: 150,  color: '#b88c3a', over: '#a84040' },
  { key: 'pm25',  label: 'PM2.5 Fine Particles',    unit: 'μg/m³',  threshold: 55,   color: '#7ea848', over: '#a84040' },
  { key: 'co2',   label: 'Carbon Dioxide (CO₂)',    unit: 'ppm',    threshold: 1000, color: '#4a8fa0', over: '#a84040' },
  { key: 'noise', label: 'Ambient Noise',            unit: 'dB',     threshold: 80,   color: '#4fa389', over: '#a84040' },
];

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1e2228', border: '1px solid #333d4d', padding: '3px 8px',
      fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: '#dde2ea',
    }}>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.stroke }}>{p.value}</div>
      ))}
    </div>
  );
};

function MetricChart({ data, m }) {
  const pts    = data.map((d, i) => ({ i, v: typeof d[m.key] === 'number' ? d[m.key] : 0 }));
  const latest = pts[pts.length - 1]?.v ?? 0;
  const over   = latest > m.threshold;
  const col    = over ? m.over : m.color;

  return (
    <div style={{
      background: '#1e2228',
      border: `1px solid ${over ? '#5a2828' : '#272e38'}`,
      padding: '8px 10px',
      marginBottom: 6,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontFamily: 'IBM Plex Sans,sans-serif', fontSize: 11, color: '#8a9ab0' }}>
          {m.label}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 16, fontWeight: 600, color: col }}>
            {latest}
          </span>
          <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, color: '#5c6a7c' }}>{m.unit}</span>
          {over && (
            <span style={{
              fontFamily: 'IBM Plex Mono,monospace', fontSize: 8, fontWeight: 600,
              color: '#a84040', background: '#2e1414', border: '1px solid #5a2828',
              padding: '1px 4px', marginLeft: 4,
            }}>OVER</span>
          )}
        </div>
      </div>

      {/* Threshold label */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
        <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 8, color: '#5a2828' }}>
          limit: {m.threshold} {m.unit}
        </span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={52}>
        <LineChart data={pts} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
          <XAxis dataKey="i" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine y={m.threshold} stroke="#5a2828" strokeDasharray="2 4" strokeWidth={1} />
          <Line
            type="monotone" dataKey="v"
            stroke={col} strokeWidth={1.5}
            dot={false} isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function SensorDetail({ zone }) {
  if (!zone) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', gap: 8, color: '#5c6a7c' }}>
      <BarChart2 size={24} strokeWidth={1} />
      <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, letterSpacing: '.08em' }}>
        SELECT A ZONE
      </span>
    </div>
  );

  if (!zone.history || zone.history.length < 2) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', gap: 8, color: '#5c6a7c' }}>
      <BarChart2 size={24} strokeWidth={1} />
      <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, letterSpacing: '.08em' }}>
        COLLECTING DATA…
      </span>
      <span style={{ fontSize: 10, color: '#3a4455' }}>Charts appear after a few seconds</span>
    </div>
  );

  return (
    <div style={{ padding: '8px', overflowY: 'auto', height: '100%' }}>
      <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, color: '#5c6a7c',
        letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8,
        borderBottom: '1px solid #272e38', paddingBottom: 4 }}>
        Live Charts — {zone.zoneName}
      </div>
      {METRICS.map(m => <MetricChart key={m.key} data={zone.history} m={m} />)}
    </div>
  );
}
