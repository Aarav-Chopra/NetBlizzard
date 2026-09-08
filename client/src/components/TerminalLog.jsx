// TerminalLog.jsx — Terminal-style alert feed with multi-tier filters and Excel export
import { useRef, useEffect, useState, useMemo } from 'react';
import { Download, Check, Filter } from 'lucide-react';

const PREFIX = {
  danger:  { t: '[CRIT]', c: '#ff4545', bg: '#2a0c0c', border: '#6a1e1e', label: 'CRIT' },
  warning: { t: '[WARN]', c: '#f5c518', bg: '#2a1f04', border: '#4a3808', label: 'WARN' },
  safe:    { t: '[ OK ]', c: '#1fe090', bg: '#0d2a1e', border: '#174d34', label: 'SAFE' },
  info:    { t: '[INFO]', c: '#38bdf8', bg: '#0c2233', border: '#164566', label: 'INFO' },
};

function fmt(ts) {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function parseAlertDetails(msg) {
  // Extract zone name, status transition, slice, latency if present in the message
  let zoneName = '';
  let slice = '';
  let latency = '';

  const zoneMatch = msg.match(/\(([^)]+)\)/);
  if (zoneMatch) zoneName = zoneMatch[1];

  const sliceMatch = msg.match(/slice:\s*([A-Za-z0-9]+)/i);
  if (sliceMatch) slice = sliceMatch[1];

  const latMatch = msg.match(/Latency:\s*([0-9.]+ms)/i);
  if (latMatch) latency = latMatch[1];

  return { zoneName, slice, latency };
}

export default function TerminalLog({ alerts }) {
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'safe' | 'warning' | 'danger'
  const [exported, setExported] = useState(false);
  const endRef = useRef(null);

  // Counts for each category
  const counts = useMemo(() => {
    return {
      all: alerts.length,
      safe: alerts.filter(a => a.level === 'safe').length,
      warning: alerts.filter(a => a.level === 'warning').length,
      danger: alerts.filter(a => a.level === 'danger').length,
    };
  }, [alerts]);

  // Filtered alerts list
  const filteredAlerts = useMemo(() => {
    if (filter === 'ALL') return alerts;
    return alerts.filter(a => a.level === filter);
  }, [alerts, filter]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredAlerts.length]);

  // Export to Excel-compatible CSV with UTF-8 BOM
  const exportToExcel = () => {
    const listToExport = filteredAlerts.length ? filteredAlerts : alerts;
    if (!listToExport.length) return;

    // Headers
    const headers = [
      'Timestamp (ISO)',
      'Local Date',
      'Local Time',
      'Severity Level',
      'Severity Code',
      'Zone ID',
      'Zone Name',
      'Network Slice',
      'Latency',
      'Event Message',
    ];

    const csvRows = [headers.join(',')];

    listToExport.forEach(a => {
      const d = new Date(a.timestamp);
      const iso = a.timestamp || d.toISOString();
      const localDate = d.toLocaleDateString('en-US');
      const localTime = d.toLocaleTimeString('en-US', { hour12: false });
      const sev = (a.level || 'info').toUpperCase();
      const code = PREFIX[a.level]?.t || '[INFO]';
      const zoneId = a.zoneId ?? '';
      const { zoneName, slice, latency } = parseAlertDetails(a.message || '');
      // Clean emoji or quotes for safe CSV
      const cleanMessage = (a.message || '').replace(/"/g, '""');

      csvRows.push(
        `"${iso}","${localDate}","${localTime}","${sev}","${code}","${zoneId}","${zoneName}","${slice}","${latency}","${cleanMessage}"`
      );
    });

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const dateStr = new Date().toISOString().slice(0, 10);
    const filterTag = filter !== 'ALL' ? `_${filter.toUpperCase()}` : '';
    link.setAttribute('href', url);
    link.setAttribute('download', `NetBlizzard_Alerts${filterTag}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExported(true);
    setTimeout(() => setExported(false), 2200);
  };

  return (
    <div
      className="app-terminal"
      style={{
        background: '#141719',
        borderTop: '1px solid #333d4d',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Top Bar: Prompt, Filter Pills, and Excel Export Button ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '3px 10px',
          borderBottom: '1px solid #1e2228',
          background: '#1a1d21',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        {/* Left: Terminal prompt */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {['#ff4545', '#f5c518', '#1fe090'].map(c => (
              <span
                key={c}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: c,
                  display: 'inline-block',
                  opacity: 0.8,
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontFamily: 'IBM Plex Mono,monospace',
              fontSize: 10,
              color: '#6a7d96',
              letterSpacing: '.07em',
            }}
          >
            netblizzard@sensor-net:~$ alert-stream
          </span>
          <span
            className="blink"
            style={{
              fontFamily: 'IBM Plex Mono,monospace',
              fontSize: 12,
              color: '#1fe090',
              marginLeft: 1,
            }}
          >
            ▋
          </span>
        </div>

        {/* Center: Filter Pills (All, Green, Yellow, Red) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontFamily: 'IBM Plex Mono,monospace',
              fontSize: 9,
              color: '#6a7d96',
              textTransform: 'uppercase',
              marginRight: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Filter size={10} /> Filter:
          </span>

          {/* ALL */}
          <button
            onClick={() => setFilter('ALL')}
            style={{
              fontFamily: 'IBM Plex Mono,monospace',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '.05em',
              padding: '2px 7px',
              border: '1px solid',
              cursor: 'pointer',
              background: filter === 'ALL' ? '#252a32' : 'transparent',
              borderColor: filter === 'ALL' ? '#4a8fa0' : '#272e38',
              color: filter === 'ALL' ? '#dde2ea' : '#6a7d96',
              borderRadius: 2,
              transition: 'all .15s',
            }}
          >
            ALL ({counts.all})
          </button>

          {/* GREEN / SAFE */}
          <button
            onClick={() => setFilter('safe')}
            style={{
              fontFamily: 'IBM Plex Mono,monospace',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '.05em',
              padding: '2px 7px',
              border: '1px solid',
              cursor: 'pointer',
              background: filter === 'safe' ? '#0d2a1e' : 'transparent',
              borderColor: filter === 'safe' ? '#174d34' : '#272e38',
              color: filter === 'safe' ? '#1fe090' : '#0d8c50',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all .15s',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#1fe090',
                display: 'inline-block',
                boxShadow: filter === 'safe' ? '0 0 5px #1fe090' : 'none',
              }}
            />
            GREEN ({counts.safe})
          </button>

          {/* YELLOW / WARN */}
          <button
            onClick={() => setFilter('warning')}
            style={{
              fontFamily: 'IBM Plex Mono,monospace',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '.05em',
              padding: '2px 7px',
              border: '1px solid',
              cursor: 'pointer',
              background: filter === 'warning' ? '#2a1f04' : 'transparent',
              borderColor: filter === 'warning' ? '#4a3808' : '#272e38',
              color: filter === 'warning' ? '#f5c518' : '#c49a10',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all .15s',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#f5c518',
                display: 'inline-block',
                boxShadow: filter === 'warning' ? '0 0 5px #f5c518' : 'none',
              }}
            />
            YELLOW ({counts.warning})
          </button>

          {/* RED / CRIT */}
          <button
            onClick={() => setFilter('danger')}
            style={{
              fontFamily: 'IBM Plex Mono,monospace',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '.05em',
              padding: '2px 7px',
              border: '1px solid',
              cursor: 'pointer',
              background: filter === 'danger' ? '#2a0c0c' : 'transparent',
              borderColor: filter === 'danger' ? '#6a1e1e' : '#272e38',
              color: filter === 'danger' ? '#ff4545' : '#c02828',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all .15s',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#ff4545',
                display: 'inline-block',
                boxShadow: filter === 'danger' ? '0 0 5px #ff4545' : 'none',
              }}
            />
            RED ({counts.danger})
          </button>
        </div>

        {/* Right: Export to Excel Button */}
        <div>
          <button
            onClick={exportToExcel}
            title="Download alert telemetry into an Excel-compatible (.CSV) file"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 9px',
              fontFamily: 'IBM Plex Mono,monospace',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              background: exported ? '#0d2a1e' : '#1e2836',
              border: `1px solid ${exported ? '#1fe090' : '#334155'}`,
              color: exported ? '#1fe090' : '#7dd3fc',
              borderRadius: 2,
              transition: 'all .15s',
            }}
          >
            {exported ? <Check size={11} strokeWidth={2.5} /> : <Download size={11} strokeWidth={1.8} />}
            {exported ? 'EXPORTED' : 'DOWNLOAD EXCEL (.CSV)'}
          </button>
        </div>
      </div>

      {/* ── Log Stream Display ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px' }}>
        {filteredAlerts.length === 0 ? (
          <div
            style={{
              fontFamily: 'IBM Plex Mono,monospace',
              fontSize: 11,
              color: '#6a7d96',
              paddingTop: 6,
            }}
          >
            -- no {filter !== 'ALL' ? `[${filter.toUpperCase()}] ` : ''}events in current stream buffer --
          </div>
        ) : (
          filteredAlerts
            .slice(0, 40)
            .reverse()
            .map((a, idx) => {
              const p = PREFIX[a.level] || PREFIX.info;
              return (
                <div
                  key={`${a.id || a.timestamp}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 10,
                    fontFamily: 'IBM Plex Mono,monospace',
                    fontSize: 11,
                    lineHeight: 1.75,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ color: '#6a7d96', flexShrink: 0, fontSize: 10 }}>
                    {fmt(a.timestamp)}
                  </span>
                  <span
                    style={{
                      color: p.c,
                      background: p.bg,
                      border: `1px solid ${p.border}`,
                      padding: '0 4px',
                      borderRadius: 2,
                      fontSize: 9,
                      flexShrink: 0,
                      fontWeight: 600,
                      letterSpacing: '.05em',
                    }}
                  >
                    {p.t}
                  </span>
                  <span
                    style={{
                      color: a.level === 'danger' ? '#ffd4d4' : a.level === 'warning' ? '#fef3c7' : '#9aafc8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {a.message}
                  </span>
                </div>
              );
            })
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
