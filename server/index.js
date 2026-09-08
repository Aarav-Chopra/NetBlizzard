// NetBlizzard — Express + WebSocket Server
const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { startSimulation, getCurrentReadings, triggerSpike, resolveSpike } = require('./simulator');

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// Track all connected clients and their subscriptions
const clients = new Set();

// Broadcast to all connected WS clients
function broadcast(type, data) {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  }
}

// --- WebSocket Handler ---
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected. Total: ${clients.size}`);

  // Send current state immediately on connect
  const initialReadings = getCurrentReadings();
  ws.send(JSON.stringify({
    type: 'INIT',
    data: initialReadings,
    timestamp: new Date().toISOString(),
  }));

  // Populate alert stream buffer with initial status for all zones (Green, Yellow, Red)
  initialReadings.forEach((z, idx) => {
    setTimeout(() => {
      if (ws.readyState !== 1) return;
      const code = z.network.status;
      const msg = code === 'danger'
        ? `Zone ${z.zoneId} (${z.zoneName}): Critical threshold breach (AQI: ${z.aqi})! URLLC slice provisioned.`
        : code === 'warning'
        ? `Zone ${z.zoneId} (${z.zoneName}): Elevated readings detected (AQI: ${z.aqi}, Noise: ${z.noise}dB). Active slice: mMTC.`
        : `Zone ${z.zoneId} (${z.zoneName}): Environmental metrics nominal on eMBB slice | Latency: ${z.network.latencyMs}ms`;

      ws.send(JSON.stringify({
        type: 'ALERT',
        data: {
          level: code,
          message: msg,
          zoneId: z.zoneId,
        },
        timestamp: new Date(Date.now() - (initialReadings.length - idx) * 2500).toISOString(),
      }));
    }, idx * 50);
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'SPIKE' && msg.zoneId) {
        const ok = triggerSpike(Number(msg.zoneId));
        if (ok) {
          const zone = getCurrentReadings().find(z => z.zoneId === Number(msg.zoneId));
          broadcast('ALERT', {
            level: 'danger',
            message: `⚠️ [${zone?.cityName || 'CITY'}] Manual pollution spike in ${zone?.zoneName || `Zone ${msg.zoneId}`}! Upgraded to URLLC slice.`,
            zoneId: msg.zoneId,
          });
        }
      }
      if (msg.type === 'RESOLVE' && msg.zoneId) {
        resolveSpike(Number(msg.zoneId));
      }
    } catch (e) {
      console.error('[WS] Bad message:', e.message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected. Total: ${clients.size}`);
  });
});

// --- REST API ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', server: 'NetBlizzard 5G/6G Monitor' }));
app.get('/api/zones', (req, res) => res.json(getCurrentReadings()));
const handleSpike = (req, res) => {
  const ok = triggerSpike(Number(req.params.zoneId));
  if (!ok) return res.status(404).json({ error: 'Zone not found' });
  const readings = getCurrentReadings();
  const zone = readings.find(z => z.zoneId === Number(req.params.zoneId));
  broadcast('ALERT', {
    level: 'danger',
    message: `⚠️ [${zone?.cityName || 'CITY'}] Spike triggered in ${zone?.zoneName}! Switching to URLLC slice.`,
    zoneId: req.params.zoneId,
  });
  res.json({ success: true, zone });
};

const handleResolve = (req, res) => {
  const ok = resolveSpike(Number(req.params.zoneId));
  if (!ok) return res.status(404).json({ error: 'Zone not found' });
  const readings = getCurrentReadings();
  const zone = readings.find(z => z.zoneId === Number(req.params.zoneId));
  res.json({ success: true, zone });
};

app.post('/api/spike/:zoneId', handleSpike);
app.post('/api/zones/:zoneId/spike', handleSpike);
app.post('/api/resolve/:zoneId', handleResolve);
app.post('/api/zones/:zoneId/resolve', handleResolve);


// --- Simulation Loop ---
let prevStatuses = {};
startSimulation((updates) => {
  // Broadcast sensor updates to all clients
  broadcast('SENSOR_UPDATE', updates);

  // Detect threshold crossings and auto-broadcast alerts
  for (const zone of updates) {
    const prev = prevStatuses[zone.zoneId];
    const curr = zone.network.status;
    if (prev && prev !== curr) {
      const emoji = curr === 'danger' ? '🔴' : curr === 'warning' ? '🟡' : '🟢';
      broadcast('ALERT', {
        level: curr,
        message: `${emoji} [${zone.cityName}] Zone ${zone.zoneId} (${zone.zoneName}): Status changed ${prev.toUpperCase()} → ${curr.toUpperCase()}. Slice: ${zone.network.slice} | Latency: ${zone.network.latencyMs}ms`,
        zoneId: zone.zoneId,
      });
    }
    prevStatuses[zone.zoneId] = curr;
  }
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 NetBlizzard Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready on ws://localhost:${PORT}`);
  console.log(`🛰️  5G/6G Simulation started for 8 city zones\n`);
});
