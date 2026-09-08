// App.jsx — NetBlizzard: fixed layout, interactive elements, better contrast
import { useState, useMemo, useEffect } from 'react';
import { Layers, Radio, BarChart2, Sliders, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useWebSocket } from './hooks/useWebSocket';
import CityMap from './components/CityMap';
import NetworkPanel from './components/NetworkPanel';
import SensorDetail from './components/SensorDetail';
import ControlPanel from './components/ControlPanel';
import TerminalLog from './components/TerminalLog';

/* ── Live clock ────────────────────────── */
function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return (
    <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: '#8a9ab0', letterSpacing: '.04em' }}>
      {t.toLocaleTimeString('en-US', { hour12: false })}
    </span>
  );
}

/* ── Signal bars ───────────────────────── */
function SignalBars({ latencyMs }) {
  const bars = latencyMs < 3 ? 4 : latencyMs < 10 ? 3 : latencyMs < 25 ? 2 : 1;
  const col  = bars === 4 ? '#a84040' : bars === 3 ? '#b88c3a' : bars === 2 ? '#7ea848' : '#4fa389';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 13 }}>
      {[1,2,3,4].map(i => (
        <div key={i} style={{ width: 3, height: `${i * 3 + 1}px`, background: i <= bars ? col : '#333d4d' }} />
      ))}
      <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, color: '#5c6a7c', marginLeft: 3 }}>
        {latencyMs}ms avg
      </span>
    </div>
  );
}

/* ── Zone counts ───────────────────────── */
function ZoneCounts({ zones }) {
  const c = useMemo(() => {
    const r = { safe: 0, warning: 0, danger: 0 };
    zones.forEach(z => { if (r[z.network?.status] !== undefined) r[z.network?.status]++; });
    return r;
  }, [zones]);
  const avgLat = zones.length
    ? Math.round(zones.reduce((s, z) => s + (z.network?.latencyMs || 0), 0) / zones.length * 10) / 10
    : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: '#9aafc8' }}>
        <span><span style={{ color: '#1fe090' }}>●</span> {c.safe} safe</span>
        <span><span style={{ color: '#f5c518' }}>●</span> {c.warning} warn</span>
        <span><span style={{ color: '#ff4545' }}>●</span> {c.danger} crit</span>
      </div>
      <SignalBars latencyMs={avgLat} />
    </div>
  );
}

/* ── Connection toggle switch ──────────── */
function ConnToggle({ connected, liveEnabled, onToggle }) {
  const [hovered, setHovered] = useState(false);

  if (connected && liveEnabled) {
    return (
      <button
        onClick={onToggle}
        title="Turn live updates off"
        aria-label="Turn live updates off"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px',
        fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, fontWeight: 600, letterSpacing: '.1em',
        color: hovered ? '#dde2ea' : '#4fa389', background: hovered ? '#2e1414' : '#1a302a',
        border: `1px solid ${hovered ? '#5a2828' : '#2d5048'}`,
        userSelect: 'none', cursor: 'pointer', transition: 'all .15s',
      }}>
        {/* Toggle track — ON state */}
        <div style={{
          width: 28, height: 14, background: '#2d5048', border: '1px solid #4fa389',
          position: 'relative', flexShrink: 0,
        }}>
          <div style={{
            position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)',
            width: 9, height: 9, background: '#4fa389', borderRadius: 1,
          }} />
        </div>
        {hovered ? 'OFF' : 'LIVE'}
      </button>
    );
  }

  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Turn live updates on"
      aria-label="Turn live updates on"
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px',
        fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, fontWeight: 600, letterSpacing: '.1em',
        color: hovered ? '#dde2ea' : '#a84040',
        background: hovered ? '#3a1818' : '#2e1414',
        border: `1px solid ${hovered ? '#a84040' : '#5a2828'}`,
        cursor: 'pointer', transition: 'all .15s',
      }}
    >
      {/* Toggle track — OFF state */}
      <div style={{
        width: 28, height: 14, background: '#1a0a0a', border: '1px solid #5a2828',
        position: 'relative', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', left: 2, top: '50%', transform: 'translateY(-50%)',
          width: 9, height: 9, background: '#5a2828', borderRadius: 1,
        }} />
      </div>
      {hovered ? <><RefreshCw size={9} strokeWidth={2} style={{ marginRight: 2 }} />ON</> : 'OFFLINE'}
    </button>
  );
}

/* ── Zone list sidebar ─────────────────── */
const DOT_COLOR  = { safe: '#1fe090', warning: '#f5c518', danger: '#ff4545', spike: '#ff1e1e' };
const SLICE_COL  = { URLLC: '#ff7070', mMTC: '#f5c518', eMBB: '#1fe090' };

function dotClass(zone) {
  if (zone.spiked) return 'dot dot-spike';
  const st = zone.network?.status || 'safe';
  return st === 'safe' ? 'dot dot-good' : st === 'warning' ? 'dot dot-mod' : 'dot dot-danger';
}

function ZoneList({ zones, selectedId, onSelect }) {
  return (
    <div className="app-zones panel-base" style={{ borderRight: '1px solid #333d4d' }}>
      <div className="sec-label" style={{ fontSize: 11 }}>Zones ({zones.length})</div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {zones.map(z => {
          const st  = z.network?.status || 'safe';
          const sel = z.zoneId === selectedId;
          const dotCol = z.spiked ? DOT_COLOR.spike : DOT_COLOR[st];
          return (
            <button key={z.zoneId} onClick={() => onSelect(z.zoneId)}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 10px', cursor: 'pointer',
                background: sel ? '#252a32' : 'transparent',
                borderBottom: '1px solid #272e38',
                borderLeft: `2px solid ${sel ? dotCol : 'transparent'}`,
                display: 'block',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div className={dotClass(z)} />
                  <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, fontWeight: 600, color: '#dde2ea' }}>
                    Z{z.zoneId}
                  </span>
                </div>
                <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 9,
                  color: SLICE_COL[z.network?.slice] || '#1fe090', letterSpacing: '.05em' }}>
                  {z.network?.slice}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#9aafc8', paddingLeft: 16,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {z.zoneName}
              </div>
              <div style={{ display: 'flex', gap: 8, paddingLeft: 16, marginTop: 2,
                fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: '#6a7d96' }}>
                <span style={{ color: dotCol }}>AQI {z.aqi}</span>
                <span>{z.noise}dB</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── AQI Legend (collapsible, transparent) ─ */
const AQI_ENTRIES = [
  ['0–50',   '#4fa389', 'Good'],
  ['51–100', '#7ea848', 'Moderate'],
  ['101–150','#b88c3a', 'Unhealthy-SG'],
  ['151–200','#c06030', 'Unhealthy'],
  ['200+',   '#a84040', 'Very Unhealthy'],
];

function AqiLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 1000 }}>
      {/* Toggle button — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px',
          background: 'rgba(20,23,25,0.82)', border: '1px solid #333d4d',
          fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, color: '#8a9ab0',
          letterSpacing: '.08em', cursor: 'pointer',
          backdropFilter: 'blur(4px)',
        }}
      >
        {/* Mini color bar */}
        <div style={{ display: 'flex', gap: 2 }}>
          {AQI_ENTRIES.map(([,c]) => (
            <div key={c} style={{ width: 6, height: 6, background: c }} />
          ))}
        </div>
        AQI Scale
        {open ? <ChevronDown size={9} /> : <ChevronUp size={9} />}
      </button>

      {/* Expanded legend */}
      {open && (
        <div style={{
          marginTop: 3, padding: '7px 10px',
          background: 'rgba(20,23,25,0.90)', border: '1px solid #333d4d',
          backdropFilter: 'blur(6px)',
        }}>
          {AQI_ENTRIES.map(([r, c, l]) => (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <div style={{ width: 9, height: 9, background: c, flexShrink: 0 }} />
              <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, color: '#8a9ab0', minWidth: 42 }}>{r}</span>
              <span style={{ fontSize: 10, color: '#dde2ea' }}>{l}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #272e38', marginTop: 4, paddingTop: 3,
            fontFamily: 'IBM Plex Mono,monospace', fontSize: 8, color: '#5c6a7c' }}>
            EPA / WHO Standard
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tabs ──────────────────────────────── */
const TABS = [
  { id: 'network', label: 'Network', icon: Radio },
  { id: 'charts',  label: 'Charts',  icon: BarChart2 },
  { id: 'control', label: 'Control', icon: Sliders },
];

/* ── Right panel (with tabs) ───────────── */
function RightPanel({ zone, zones, triggerSpike, resolveSpike }) {
  const [tab, setTab] = useState('network');
  return (
    <div className="app-panel panel-base right">
      <div className="tab-bar">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`tab-btn${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            <Icon size={12} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'network' && <NetworkPanel zone={zone} />}
        {tab === 'charts'  && <SensorDetail zone={zone} />}
        {tab === 'control' && <ControlPanel zones={zones} onSpike={triggerSpike} onResolve={resolveSpike} />}
      </div>
      <div style={{
        padding: '4px 8px', borderTop: '1px solid #272e38', flexShrink: 0,
        textAlign: 'center', fontFamily: 'IBM Plex Mono,monospace',
        fontSize: 8, color: '#5c6a7c', letterSpacing: '.05em',
      }}>
        PROTOWAVE 2026 · THEME 7 · PROTOTYPE 4
      </div>
    </div>
  );
}

/* ── Root App ──────────────────────────── */
export default function App() {
  const { zones, alerts, connected, liveEnabled, triggerSpike, resolveSpike, toggleConnection } = useWebSocket();
  const [selectedId, setSelectedId] = useState(null);

  // Auto-select first zone once data loads
  useEffect(() => {
    if (!selectedId && zones.length) setSelectedId(zones[0].zoneId);
  }, [zones, selectedId]);

  const selectedZone = zones.find(z => z.zoneId === selectedId) || zones[0];

  return (
    <div className="app-grid">

      {/* ── Header ── */}
      <header className="app-header" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px', background: '#1a1d21', borderBottom: '1px solid #333d4d',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Layers size={14} strokeWidth={1.5} color="#4a8fa0" />
          <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 13, fontWeight: 600,
            color: '#dde2ea', letterSpacing: '.06em' }}>NETBLIZZARD</span>
          <span style={{ width: 1, height: 14, background: '#333d4d' }} />
          <span style={{ fontSize: 11, color: '#5c6a7c' }}>5G/6G Environmental Monitor</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <ZoneCounts zones={zones} />
          <span style={{ width: 1, height: 14, background: '#333d4d' }} />
          <LiveClock />
          <ConnToggle connected={connected} liveEnabled={liveEnabled} onToggle={toggleConnection} />
        </div>
      </header>

      {/* ── Zone list ── */}
      <ZoneList zones={zones} selectedId={selectedId} onSelect={setSelectedId} />

      {/* ── Map ── */}
      <div className="app-map" style={{ position: 'relative', overflow: 'hidden', background: '#141719' }}>
        {zones.length > 0
          ? <CityMap zones={zones} selectedZoneId={selectedId} onSelectZone={setSelectedId} />
          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: '#5c6a7c', fontFamily: 'IBM Plex Mono,monospace', fontSize: 11 }}>
              CONNECTING TO SENSOR NETWORK…
            </div>
        }

        {/* Collapsible AQI legend */}
        <AqiLegend />

        {/* Coordinate display */}
        {selectedZone && (
          <div style={{
            position: 'absolute', bottom: 10, right: 10, zIndex: 1000,
            fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, color: '#8a9ab0',
            background: 'rgba(20,23,25,0.82)', border: '1px solid #333d4d',
            padding: '3px 8px', backdropFilter: 'blur(4px)',
          }}>
            {selectedZone.lat?.toFixed(4)}°N {selectedZone.lng?.toFixed(4)}°E
          </div>
        )}
      </div>

      {/* ── Right panel ── */}
      <RightPanel
        zone={selectedZone}
        zones={zones}
        triggerSpike={triggerSpike}
        resolveSpike={resolveSpike}
      />

      {/* ── Terminal log ── */}
      <TerminalLog alerts={alerts} />
    </div>
  );
}
