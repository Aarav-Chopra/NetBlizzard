// NetBlizzard — 5G/6G Network Manager
// Handles slice assignment, QoS, latency, and bandwidth simulation

const THRESHOLDS = {
  aqi: 150,
  noise: 80,
  pm25: 55,
  co2: 1000,
};

const NETWORK_PROFILES = {
  safe: {
    slice: 'eMBB',
    sliceDesc: 'Enhanced Mobile Broadband',
    priority: 3,
    priorityLabel: 'LOW',
    updateIntervalMs: 5000,
    frequencyHz: 0.2,
    latencyMs: () => 40 + Math.random() * 10,
    bandwidthMbps: () => 2 + Math.random() * 2,
    color: 'green',
  },
  danger: {
    slice: 'URLLC',
    sliceDesc: 'Ultra-Reliable Low-Latency Communication',
    priority: 1,
    priorityLabel: 'CRITICAL',
    updateIntervalMs: 500,
    frequencyHz: 2.0,
    latencyMs: () => 1 + Math.random() * 1.5,
    bandwidthMbps: () => 10 + Math.random() * 5,
    color: 'red',
  },
  warning: {
    slice: 'mMTC',
    sliceDesc: 'Massive Machine-Type Communications',
    priority: 2,
    priorityLabel: 'HIGH',
    updateIntervalMs: 2000,
    frequencyHz: 0.5,
    latencyMs: () => 15 + Math.random() * 5,
    bandwidthMbps: () => 5 + Math.random() * 3,
    color: 'yellow',
  },
};

function classifyZone(sensor) {
  const { aqi, noise, pm25, co2 } = sensor;
  if (
    aqi > THRESHOLDS.aqi ||
    noise > THRESHOLDS.noise ||
    pm25 > THRESHOLDS.pm25 ||
    co2 > THRESHOLDS.co2
  ) {
    return 'danger';
  }
  if (
    aqi > THRESHOLDS.aqi * 0.7 ||
    noise > THRESHOLDS.noise * 0.75 ||
    pm25 > THRESHOLDS.pm25 * 0.7 ||
    co2 > THRESHOLDS.co2 * 0.8
  ) {
    return 'warning';
  }
  return 'safe';
}

function getNetworkStatus(sensor) {
  const status = classifyZone(sensor);
  const profile = NETWORK_PROFILES[status];
  return {
    status,
    slice: profile.slice,
    sliceDesc: profile.sliceDesc,
    priority: profile.priority,
    priorityLabel: profile.priorityLabel,
    updateIntervalMs: profile.updateIntervalMs,
    frequencyHz: profile.frequencyHz,
    latencyMs: parseFloat(profile.latencyMs().toFixed(2)),
    bandwidthMbps: parseFloat(profile.bandwidthMbps().toFixed(2)),
    color: profile.color,
  };
}

module.exports = { getNetworkStatus, classifyZone, THRESHOLDS, NETWORK_PROFILES };
