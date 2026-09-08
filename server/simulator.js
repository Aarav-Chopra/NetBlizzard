// NetBlizzard — Sensor Simulator
// Generates realistic AQI, PM2.5, CO2, and Noise data for 8 city zones

const { getNetworkStatus } = require('./networkManager');

// 8 Smart City Zones with realistic lat/lng (approximate Delhi NCR area)
const ZONES = [
  { id: 1, name: 'Central Hub',      lat: 28.6139, lng: 77.2090, baseAqi: 95,  basePm25: 38, baseCo2: 820, baseNoise: 62 },
  { id: 2, name: 'Industrial Sector',lat: 28.6280, lng: 77.2200, baseAqi: 180, basePm25: 70, baseCo2: 1100,baseNoise: 85 },
  { id: 3, name: 'Green Zone',       lat: 28.5972, lng: 77.2300, baseAqi: 45,  basePm25: 18, baseCo2: 600, baseNoise: 40 },
  { id: 4, name: 'Market District',  lat: 28.6400, lng: 77.2000, baseAqi: 120, basePm25: 50, baseCo2: 900, baseNoise: 78 },
  { id: 5, name: 'Residential Zone', lat: 28.5800, lng: 77.1900, baseAqi: 75,  basePm25: 28, baseCo2: 720, baseNoise: 55 },
  { id: 6, name: 'Transport Nexus',  lat: 28.6550, lng: 77.2350, baseAqi: 160, basePm25: 65, baseCo2: 950, baseNoise: 88 },
  { id: 7, name: 'Tech Park',        lat: 28.6050, lng: 77.2500, baseAqi: 60,  basePm25: 22, baseCo2: 680, baseNoise: 48 },
  { id: 8, name: 'Harbor Terminal',  lat: 28.6650, lng: 77.2100, baseAqi: 140, basePm25: 55, baseCo2: 870, baseNoise: 73 },
];

// Per-zone state: readings + history + manual spike flag
const zoneState = ZONES.map(z => ({
  ...z,
  aqi: z.baseAqi,
  pm25: z.basePm25,
  co2: z.baseCo2,
  noise: z.baseNoise,
  spiked: false,
  history: [],
}));

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function drift(current, base, spiked) {
  if (spiked) {
    // Spike: push values toward danger thresholds
    return current + (Math.random() * 12 - 2);
  }
  // Normal random walk that slowly reverts to base
  const reversion = (base - current) * 0.05;
  const noise = Math.random() * 8 - 4;
  return current + reversion + noise;
}

function updateZone(zone) {
  zone.aqi   = clamp(Math.round(drift(zone.aqi,   zone.baseAqi,   zone.spiked)), 10,  500);
  zone.pm25  = clamp(parseFloat(drift(zone.pm25,  zone.basePm25,  zone.spiked).toFixed(1)), 1, 300);
  zone.co2   = clamp(Math.round(drift(zone.co2,   zone.baseCo2,   zone.spiked)), 400, 5000);
  zone.noise = clamp(parseFloat(drift(zone.noise, zone.baseNoise, zone.spiked).toFixed(1)), 20, 120);

  const network = getNetworkStatus(zone);
  const timestamp = new Date().toISOString();

  const reading = {
    zoneId: zone.id,
    zoneName: zone.name,
    lat: zone.lat,
    lng: zone.lng,
    timestamp,
    aqi: zone.aqi,
    pm25: zone.pm25,
    co2: zone.co2,
    noise: zone.noise,
    spiked: zone.spiked,
    network,
    history: zone.history.slice(-40), // include recent history for Charts tab
  };

  // Keep last 60 readings in history
  zone.history.push({ timestamp, aqi: zone.aqi, pm25: zone.pm25, co2: zone.co2, noise: zone.noise });
  if (zone.history.length > 60) zone.history.shift();

  return reading;
}

function getCurrentReadings() {
  return zoneState.map(zone => {
    const network = getNetworkStatus(zone);
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      lat: zone.lat,
      lng: zone.lng,
      timestamp: new Date().toISOString(),
      aqi: zone.aqi,
      pm25: zone.pm25,
      co2: zone.co2,
      noise: zone.noise,
      spiked: zone.spiked,
      network,
      history: zone.history.slice(-30),
    };
  });
}

function triggerSpike(zoneId) {
  const zone = zoneState.find(z => z.id === zoneId);
  if (!zone) return false;
  zone.spiked = true;
  setTimeout(() => { zone.spiked = false; }, 30000); // Spike lasts 30s
  return true;
}

function resolveSpike(zoneId) {
  const zone = zoneState.find(z => z.id === zoneId);
  if (!zone) return false;
  zone.spiked = false;
  return true;
}

// Tick all zones every 500ms (fastest possible interval)
function startSimulation(onTick) {
  setInterval(() => {
    const updates = zoneState.map(updateZone);
    onTick(updates);
  }, 500);
}

module.exports = { startSimulation, getCurrentReadings, triggerSpike, resolveSpike, zoneState };
