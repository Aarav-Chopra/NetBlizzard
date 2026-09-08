// cities.js — Multi-City Telemetry, Base Station Towers, and Routing Topologies

export const CITIES_CONFIG = {
  delhi: {
    id: 'delhi',
    name: 'Delhi NCR',
    state: 'National Capital Region',
    center: [28.6210, 77.2145],
    zoom: 12,
    tower: {
      id: 'gNodeB-DEL-01',
      name: 'Delhi NCR Macro Tower (Connaught Core)',
      lat: 28.6210,
      lng: 77.2145,
      frequency: '3.5 GHz (n78) / 28 GHz mmWave / 6G Sub-THz',
      capacity: '100 Gbps Core Optical Backhaul',
    },
    routing: {
      1: null, 2: null, 4: null, 7: null,
      5: 1, 3: 7, 6: 2, 8: 4,
    },
  },
  mumbai: {
    id: 'mumbai',
    name: 'Mumbai (Bombay)',
    state: 'Maharashtra',
    center: [19.0650, 72.8680],
    zoom: 12,
    tower: {
      id: 'gNodeB-BOM-01',
      name: 'Mumbai Macro Tower (BKC Telecom Hub)',
      lat: 19.0650,
      lng: 72.8680,
      frequency: '3.5 GHz (n78) / 28 GHz mmWave',
      capacity: '120 Gbps Coastal Fiber Ring',
    },
    routing: {
      201: null, 204: null, 205: null,
      202: 205, 203: 204, 206: 201,
    },
  },
  bengaluru: {
    id: 'bengaluru',
    name: 'Bengaluru',
    state: 'Karnataka',
    center: [12.9716, 77.6100],
    zoom: 12,
    tower: {
      id: 'gNodeB-BLR-01',
      name: 'Bengaluru Macro Tower (MG Road Core)',
      lat: 12.9716,
      lng: 77.6100,
      frequency: '3.5 GHz (n78) / 6G Sub-THz',
      capacity: '100 Gbps Low-Loss Fiber Mesh',
    },
    routing: {
      301: null, 305: null, 306: null,
      302: 301, 303: 305, 304: 306,
    },
  },
  chennai: {
    id: 'chennai',
    name: 'Chennai',
    state: 'Tamil Nadu',
    center: [13.0450, 80.2300],
    zoom: 12,
    tower: {
      id: 'gNodeB-CHN-01',
      name: 'Chennai Macro Tower (T. Nagar Core)',
      lat: 13.0450,
      lng: 80.2300,
      frequency: '3.5 GHz (n78) / 28 GHz mmWave',
      capacity: '100 Gbps Subsea Fiber Ingress',
    },
    routing: {
      401: null, 403: null, 404: null,
      402: 403, 405: 404, 406: 401,
    },
  },
  lucknow: {
    id: 'lucknow',
    name: 'Lucknow',
    state: 'Uttar Pradesh',
    center: [26.8500, 80.9450],
    zoom: 12,
    tower: {
      id: 'gNodeB-LKO-01',
      name: 'Lucknow Macro Tower (Hazratganj Core)',
      lat: 26.8500,
      lng: 80.9450,
      frequency: '3.5 GHz (n78) / 5G SA Core',
      capacity: '80 Gbps Regional Optical Mesh',
    },
    routing: {
      501: null, 504: null, 506: null,
      502: 501, 503: 504, 505: 501,
    },
  },
};
