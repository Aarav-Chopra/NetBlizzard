// useWebSocket.js — WebSocket hook with manual reconnect support
import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = 'ws://localhost:4000';

export function useWebSocket() {
  const wsRef        = useRef(null);
  const [zones,     setZones]     = useState([]);
  const [alerts,    setAlerts]    = useState([]);
  const [connected, setConnected] = useState(false);
  const reconnectRef = useRef(null);

  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const triggerSpike = useCallback((zoneId) => {
    send({ type: 'SPIKE', zoneId });
  }, [send]);

  const resolveSpike = useCallback((zoneId) => {
    send({ type: 'RESOLVE', zoneId });
  }, [send]);

  const connect = useCallback(() => {
    // Clear any pending reconnect timer
    if (reconnectRef.current) clearTimeout(reconnectRef.current);

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log('[WS] Connected');
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'INIT' || msg.type === 'SENSOR_UPDATE') {
          setZones(msg.data);
        }
        if (msg.type === 'ALERT') {
          setAlerts(prev => [
            { id: Date.now() + Math.random(), ...msg.data, timestamp: msg.timestamp },
            ...prev,
          ].slice(0, 60));
        }
      } catch (err) {
        console.error('[WS] Parse error', err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log('[WS] Disconnected. Reconnecting in 3s…');
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  // Manual reconnect — called by the UI toggle button
  const reconnect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    connect();
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { zones, alerts, connected, triggerSpike, resolveSpike, reconnect };
}
