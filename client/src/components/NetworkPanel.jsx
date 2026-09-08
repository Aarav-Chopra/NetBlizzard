// NetworkPanel.jsx — Dense telemetry, vivid colors, larger text
import { Clock, TrendingUp, Wifi, Layers, Activity, Volume2, Wind, Gauge } from 'lucide-react';

function aqiMeta(aqi) {
  if (aqi <= 50)  return { color: '#1fe090', label: 'GOOD',          cls: 'good'   };
  if (aqi <= 100) return { color: '#a0d428', label: 'MODERATE',      cls: 'mod'    };
  if (aqi <= 150) return { color: '#f5c518', label: 'UNHLTHY-SG',    cls: 'mod'    };
  if (aqi <= 200) return { color: '#ff8c00', label: 'UNHEALTHY',     cls: 'danger' };
  return                  { color: '#ff4545', label: 'VERY UNHLTHY', cls: 'danger' };
}

function thresholdColor(val, warn, crit) {
  if (val >= crit) return '#ff4545';
  if (val >= warn) return '#f5c518';
  return '#1fe090';
}

const SLICE_MAP = {
  URLLC: { bg: '#2a0c0c', border: '#6a1e1e', text: '#ff7070' },
  mMTC:  { bg: '#2a1f04', border: '#4a3808', text: '#f5c518' },
  eMBB:  { bg: '#0d2a1e', border: '#174d34', text: '#1fe090' },
};
const PRIO_COL = { CRITICAL: '#ff7070', HIGH: '#f5c518', LOW: '#1fe090' };

function Row({ icon: Icon, label, value, unit, color }) {
  return (
    <div className="stat-row">
      <div className="stat-label" style={{ fontSize: 11 }}>
        <Icon size={12} strokeWidth={1.5} />
        {label}
      </div>
      <div className="stat-val" style={{ color: color || '#dde2ea', fontSize: 13 }}>
        {value ?? '—'}<span className="stat-unit" style={{ fontSize: 10 }}>{unit}</span>
      </div>
    </div>
  );
}

function SecLabel({ children }) {
  return (
    <div style={{
      fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, letterSpacing: '.08em',
      textTransform: 'uppercase', color: '#6a7d96', padding: '8px 10px 4px',
      borderBottom: '1px solid #272e38',
    }}>
      {children}
    </div>
  );
}

export default function NetworkPanel({ zone }) {
  if (!zone) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      height:'100%', color:'#5c6a7c', gap:8 }}>
      <Wifi size={22} strokeWidth={1} />
      <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, letterSpacing:'.08em' }}>
        SELECT A ZONE
      </span>
    </div>
  );

  const { network: n } = zone;
  const aqi = aqiMeta(zone.aqi);
  const sl  = SLICE_MAP[n.slice] || SLICE_MAP.eMBB;

  return (
    <div style={{ overflowY:'auto', height:'100%' }}>

      {/* Zone identity */}
      <div style={{ padding: '9px 10px 7px', borderBottom: '1px solid #272e38' }}>
        <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 13, fontWeight: 600, color: '#dde2ea' }}>
          Z{zone.zoneId} / {zone.zoneName}
        </div>
        <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: '#6a7d96', marginTop: 2 }}>
          {zone.lat?.toFixed(4)}°N &nbsp;{zone.lng?.toFixed(4)}°E
        </div>
      </div>

      {/* AQI big display */}
      <div style={{ margin: '8px 10px', padding: '9px 10px',
        background: aqi.color + '18', border: `1px solid ${aqi.color}55`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 30, fontWeight: 600,
            color: aqi.color, lineHeight: 1 }}>{zone.aqi}</div>
          <div style={{ fontSize: 10, color: '#9aafc8', marginTop: 4, fontFamily: 'IBM Plex Sans,sans-serif',
            letterSpacing: '.05em', textTransform: 'uppercase' }}>AQI Index</div>
        </div>
        <div className={`badge badge-${aqi.cls}`} style={{ fontSize: 10 }}>{aqi.label}</div>
      </div>

      {/* Sensor readings */}
      <SecLabel>Sensor Readings</SecLabel>
      <Row icon={Gauge}   label="AQI"   value={zone.aqi}   unit=""       color={aqi.color} />
      <Row icon={Wind}    label="PM2.5" value={zone.pm25}  unit=" μg/m³" color={thresholdColor(zone.pm25,  35, 55)} />
      <Row icon={Activity}label="CO₂"   value={zone.co2}   unit=" ppm"   color={thresholdColor(zone.co2,  800,1000)} />
      <Row icon={Volume2} label="Noise" value={zone.noise} unit=" dB"    color={thresholdColor(zone.noise, 65, 80)} />

      {/* Network slice */}
      <SecLabel>Network Slice</SecLabel>
      <div style={{ margin:'6px 10px', padding:'7px 10px',
        background: sl.bg, border:`1px solid ${sl.border}`,
        display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:16, fontWeight:600, color: sl.text }}>
            {n.slice}
          </div>
          <div style={{ fontSize:10, color:'#8a9ab0', marginTop:2 }}>{n.sliceDesc}</div>
        </div>
        <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, fontWeight:600,
          color: PRIO_COL[n.priorityLabel]||'#4fa389', letterSpacing:'.08em' }}>
          P{n.priority}<br/>
          <span style={{ fontSize:8 }}>{n.priorityLabel}</span>
        </div>
      </div>

      {/* Link telemetry */}
      <SecLabel>Link Telemetry</SecLabel>
      <Row icon={Clock}      label="Latency"  value={n.latencyMs}      unit=" ms"   color={n.latencyMs<5?'#a84040':n.latencyMs<20?'#b88c3a':'#4fa389'} />
      <Row icon={TrendingUp} label="Rate"     value={n.frequencyHz}    unit=" Hz"   color={n.frequencyHz>=2?'#a84040':n.frequencyHz>=0.5?'#b88c3a':'#4fa389'} />
      <Row icon={Wifi}       label="Interval" value={n.updateIntervalMs} unit=" ms" color="#8a9ab0" />
      <Row icon={Layers}     label="Bandwidth" value={n.bandwidthMbps} unit=" Mbps" color="#4a8fa0" />
    </div>
  );
}
