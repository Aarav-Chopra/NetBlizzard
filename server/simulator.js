// NetBlizzard — Multi-City Sensor Simulator
// Generates realistic AQI, PM2.5, CO2, and Noise data for 5 Indian Metros:
// Delhi NCR, Mumbai (Bombay), Bengaluru, Chennai, Lucknow

const { getNetworkStatus } = require('./networkManager');

// Multi-City Zones with realistic coordinates and environmental baselines
const ZONES = [
  // ── 1. Delhi NCR (8 Zones) ──
  { id: 1, name: 'Central Hub',       cityId: 'delhi', cityName: 'Delhi NCR', lat: 28.6139, lng: 77.2090, baseAqi: 95,  basePm25: 38, baseCo2: 820, baseNoise: 62 },
  { id: 2, name: 'Industrial Sector', cityId: 'delhi', cityName: 'Delhi NCR', lat: 28.6280, lng: 77.2200, baseAqi: 180, basePm25: 70, baseCo2: 1100,baseNoise: 85 },
  { id: 3, name: 'Green Zone',        cityId: 'delhi', cityName: 'Delhi NCR', lat: 28.5972, lng: 77.2300, baseAqi: 45,  basePm25: 18, baseCo2: 600, baseNoise: 40 },
  { id: 4, name: 'Market District',   cityId: 'delhi', cityName: 'Delhi NCR', lat: 28.6400, lng: 77.2000, baseAqi: 120, basePm25: 50, baseCo2: 900, baseNoise: 78 },
  { id: 5, name: 'Residential Zone',  cityId: 'delhi', cityName: 'Delhi NCR', lat: 28.5800, lng: 77.1900, baseAqi: 75,  basePm25: 28, baseCo2: 720, baseNoise: 55 },
  { id: 6, name: 'Transport Nexus',   cityId: 'delhi', cityName: 'Delhi NCR', lat: 28.6550, lng: 77.2350, baseAqi: 160, basePm25: 65, baseCo2: 950, baseNoise: 88 },
  { id: 7, name: 'Tech Park',         cityId: 'delhi', cityName: 'Delhi NCR', lat: 28.6050, lng: 77.2500, baseAqi: 60,  basePm25: 22, baseCo2: 680, baseNoise: 48 },
  { id: 8, name: 'Harbor Terminal',   cityId: 'delhi', cityName: 'Delhi NCR', lat: 28.6650, lng: 77.2100, baseAqi: 140, basePm25: 55, baseCo2: 870, baseNoise: 73 },

  // ── 2. Mumbai / Bombay (6 Zones) ──
  { id: 201, name: 'BKC Financial Center', cityId: 'mumbai', cityName: 'Mumbai (Bombay)', lat: 19.0665, lng: 72.8685, baseAqi: 110, basePm25: 42, baseCo2: 850, baseNoise: 75 },
  { id: 202, name: 'Andheri Industrial',   cityId: 'mumbai', cityName: 'Mumbai (Bombay)', lat: 19.1197, lng: 72.8690, baseAqi: 175, basePm25: 68, baseCo2: 1050,baseNoise: 84 },
  { id: 203, name: 'Nariman Point Coast',  cityId: 'mumbai', cityName: 'Mumbai (Bombay)', lat: 18.9256, lng: 72.8242, baseAqi: 50,  basePm25: 20, baseCo2: 590, baseNoise: 58 },
  { id: 204, name: 'Dharavi Transit Hub',  cityId: 'mumbai', cityName: 'Mumbai (Bombay)', lat: 19.0400, lng: 72.8550, baseAqi: 165, basePm25: 64, baseCo2: 980, baseNoise: 86 },
  { id: 205, name: 'Powai Tech Corridor',  cityId: 'mumbai', cityName: 'Mumbai (Bombay)', lat: 19.1176, lng: 72.9060, baseAqi: 70,  basePm25: 26, baseCo2: 700, baseNoise: 52 },
  { id: 206, name: 'Navi Mumbai Port',     cityId: 'mumbai', cityName: 'Mumbai (Bombay)', lat: 19.0330, lng: 73.0297, baseAqi: 135, basePm25: 52, baseCo2: 920, baseNoise: 76 },

  // ── 3. Bengaluru (6 Zones) ──
  { id: 301, name: 'MG Road Central Core',  cityId: 'bengaluru', cityName: 'Bengaluru', lat: 12.9750, lng: 77.6090, baseAqi: 85,  basePm25: 32, baseCo2: 760, baseNoise: 68 },
  { id: 302, name: 'Electronic City Ph-1', cityId: 'bengaluru', cityName: 'Bengaluru', lat: 12.8399, lng: 77.6770, baseAqi: 65,  basePm25: 24, baseCo2: 690, baseNoise: 54 },
  { id: 303, name: 'Whitefield IT Hub',    cityId: 'bengaluru', cityName: 'Bengaluru', lat: 12.9698, lng: 77.7500, baseAqi: 90,  basePm25: 35, baseCo2: 790, baseNoise: 66 },
  { id: 304, name: 'Peenya Industrial',    cityId: 'bengaluru', cityName: 'Bengaluru', lat: 13.0285, lng: 77.5185, baseAqi: 170, basePm25: 66, baseCo2: 1020,baseNoise: 83 },
  { id: 305, name: 'Indiranagar Metro',    cityId: 'bengaluru', cityName: 'Bengaluru', lat: 12.9784, lng: 77.6408, baseAqi: 75,  basePm25: 28, baseCo2: 710, baseNoise: 60 },
  { id: 306, name: 'Hebbal Flyover Nexus', cityId: 'bengaluru', cityName: 'Bengaluru', lat: 13.0358, lng: 77.5970, baseAqi: 145, basePm25: 56, baseCo2: 890, baseNoise: 87 },

  // ── 4. Chennai (6 Zones) ──
  { id: 401, name: 'T. Nagar Commercial', cityId: 'chennai', cityName: 'Chennai', lat: 13.0418, lng: 80.2341, baseAqi: 90,  basePm25: 34, baseCo2: 780, baseNoise: 76 },
  { id: 402, name: 'OMR Cyber Gateway',   cityId: 'chennai', cityName: 'Chennai', lat: 12.9150, lng: 80.2280, baseAqi: 68,  basePm25: 25, baseCo2: 670, baseNoise: 55 },
  { id: 403, name: 'Guindy Industrial',   cityId: 'chennai', cityName: 'Chennai', lat: 13.0067, lng: 80.2025, baseAqi: 155, basePm25: 60, baseCo2: 960, baseNoise: 82 },
  { id: 404, name: 'Marina Coastal Strip',cityId: 'chennai', cityName: 'Chennai', lat: 13.0500, lng: 80.2824, baseAqi: 48,  basePm25: 18, baseCo2: 580, baseNoise: 45 },
  { id: 405, name: 'Ennore Petrochemical',cityId: 'chennai', cityName: 'Chennai', lat: 13.2300, lng: 80.3200, baseAqi: 185, basePm25: 72, baseCo2: 1150,baseNoise: 88 },
  { id: 406, name: 'Sriperumbudur Auto',  cityId: 'chennai', cityName: 'Chennai', lat: 12.9700, lng: 79.9400, baseAqi: 130, basePm25: 50, baseCo2: 860, baseNoise: 74 },

  // ── 5. Lucknow (6 Zones) ──
  { id: 501, name: 'Hazratganj Central',   cityId: 'lucknow', cityName: 'Lucknow', lat: 26.8500, lng: 80.9450, baseAqi: 115, basePm25: 44, baseCo2: 840, baseNoise: 73 },
  { id: 502, name: 'Gomti Nagar IT Park', cityId: 'lucknow', cityName: 'Lucknow', lat: 26.8600, lng: 80.9950, baseAqi: 72,  basePm25: 27, baseCo2: 700, baseNoise: 50 },
  { id: 503, name: 'Amausi Airport Hub',  cityId: 'lucknow', cityName: 'Lucknow', lat: 26.7606, lng: 80.8893, baseAqi: 150, basePm25: 58, baseCo2: 940, baseNoise: 86 },
  { id: 504, name: 'Alambagh Multi-Modal',cityId: 'lucknow', cityName: 'Lucknow', lat: 26.8150, lng: 80.9100, baseAqi: 160, basePm25: 62, baseCo2: 970, baseNoise: 87 },
  { id: 505, name: 'Indira Nagar High-Res',cityId: 'lucknow', cityName: 'Lucknow', lat: 26.8850, lng: 80.9700, baseAqi: 80,  basePm25: 30, baseCo2: 740, baseNoise: 58 },
  { id: 506, name: 'Chowk Old Heritage',  cityId: 'lucknow', cityName: 'Lucknow', lat: 26.8680, lng: 80.9050, baseAqi: 140, basePm25: 54, baseCo2: 910, baseNoise: 79 },
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
    cityId: zone.cityId,
    cityName: zone.cityName,
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
      cityId: zone.cityId,
      cityName: zone.cityName,
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
  const zone = zoneState.find(z => z.id === Number(zoneId));
  if (!zone) return false;
  zone.spiked = true;
  zone.aqi = Math.max(zone.aqi, 240);
  zone.pm25 = Math.max(zone.pm25, 85);
  zone.noise = Math.max(zone.noise, 89);
  zone.co2 = Math.max(zone.co2, 1450);
  setTimeout(() => {
    if (zone.spiked) {
      zone.spiked = false;
      zone.aqi = zone.baseAqi;
      zone.pm25 = zone.basePm25;
      zone.noise = zone.baseNoise;
      zone.co2 = zone.baseCo2;
    }
  }, 30000); // Spike auto-resolves after 30s
  return true;
}

function resolveSpike(zoneId) {
  const zone = zoneState.find(z => z.id === Number(zoneId));
  if (!zone) return false;
  zone.spiked = false;
  zone.aqi = zone.baseAqi;
  zone.pm25 = zone.basePm25;
  zone.noise = zone.baseNoise;
  zone.co2 = zone.baseCo2;
  return true;
}

// Tick all zones every 500ms
function startSimulation(onTick) {
  setInterval(() => {
    const updates = zoneState.map(updateZone);
    onTick(updates);
  }, 500);
}

module.exports = { startSimulation, getCurrentReadings, triggerSpike, resolveSpike, zoneState, ZONES };
