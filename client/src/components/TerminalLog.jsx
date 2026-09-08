// TerminalLog.jsx — Terminal-style alert feed
import { useRef, useEffect } from 'react';

const PREFIX = {
  danger:  { t:'[CRIT]', c:'#a84040' },
  warning: { t:'[WARN]', c:'#b88c3a' },
  safe:    { t:'[ OK ]', c:'#4fa389' },
  info:    { t:'[INFO]', c:'#4a8fa0' },
};

function fmt(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

export default function TerminalLog({ alerts }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [alerts.length]);

  return (
    <div className="app-terminal" style={{
      background:'#141719', borderTop:'1px solid #333d4d',
      display:'flex', flexDirection:'column', overflow:'hidden',
    }}>
      {/* Bar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'2px 10px',
        borderBottom:'1px solid #1e2228', background:'#1a1d21', flexShrink:0 }}>
        <div style={{ display:'flex', gap:4 }}>
          {['#5a2828','#4a3618','#1a302a'].map(c => (
            <span key={c} style={{ width:7, height:7, borderRadius:'50%', background:c, display:'inline-block' }} />
          ))}
        </div>
        <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: '#6a7d96', letterSpacing: '.07em' }}>
          netblizzard@sensor-net:~$ alert-stream
        </span>
        <span className="blink" style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12, color: '#1fe090', marginLeft: 2 }}>▋</span>
      </div>
      {/* Log */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '3px 10px' }}>
        {alerts.length === 0 && (
          <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: '#6a7d96', paddingTop: 3 }}>
            -- no events yet --
          </div>
        )}
        {[...alerts].slice(0, 15).reverse().map(a => {
          const p = PREFIX[a.level] || PREFIX.info;
          return (
            <div key={a.id} style={{ display: 'flex', gap: 10, fontFamily: 'IBM Plex Mono,monospace',
              fontSize: 11, lineHeight: 1.7, whiteSpace: 'nowrap' }}>
              <span style={{ color: '#6a7d96', flexShrink: 0 }}>{fmt(a.timestamp)}</span>
              <span style={{ color: p.c, flexShrink: 0, fontWeight: 600 }}>{p.t}</span>
              <span style={{ color: '#9aafc8', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.message}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
