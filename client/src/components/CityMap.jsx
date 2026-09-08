// CityMap.jsx — Multi-City Telemetry Map with EPA-scale markers, 5G/6G Network Towers, and Multi-Hop Data Flow
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;

import { CITIES_CONFIG } from '../constants/cities';


// EPA AQI — VIVID colors
function aqiToColor(aqi) {
  if (aqi <= 50)  return { fill: '#1fe090', ring: '#1fe090', label: 'GOOD' };
  if (aqi <= 100) return { fill: '#a0d428', ring: '#a0d428', label: 'MODERATE' };
  if (aqi <= 150) return { fill: '#f5c518', ring: '#f5c518', label: 'UNHEALTHY-S' };
  if (aqi <= 200) return { fill: '#ff8c00', ring: '#ff8c00', label: 'UNHEALTHY' };
  if (aqi <= 300) return { fill: '#ff4545', ring: '#ff4545', label: 'VERY-UNHEALTHY' };
  return           { fill: '#ff1e1e', ring: '#ff1e1e', label: 'HAZARDOUS' };
}

function statusRingClass(status, spiked) {
  if (spiked)           return 'ring-fast ring-fast-2';
  if (status === 'danger')  return 'ring-fast';
  if (status === 'warning') return 'ring-medium';
  return 'ring-slow';
}

function flowColor(zone) {
  return aqiToColor(zone.aqi).fill;
}

// Custom pulsing marker icon for Sensor Nodes — Equal uniform size for all zones (matching Zone 2)
function createMarkerIcon(zone) {
  const status = zone.network?.status || 'safe';
  const { fill, ring } = aqiToColor(zone.aqi);
  // Equal uniform radius for all zones matching Zone 2 size
  const r = 11;
  const ringClass = statusRingClass(status, zone.spiked);
  const glowSize = zone.spiked ? 18 : status === 'danger' ? 14 : 9;

  const html = `
    <div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;">
      <div class="${ringClass}" style="
        position:absolute;
        width:${r * 2}px;height:${r * 2}px;
        border-radius:50%;
        border:1.5px solid ${ring};
        opacity:0.7;
      "></div>
      <div style="
        position:relative;
        width:${r * 2}px;height:${r * 2}px;
        border-radius:50%;
        background:${fill};
        border:2px solid ${ring}cc;
        box-shadow:0 0 ${glowSize}px ${fill}99;
        z-index:10;
        display:flex;align-items:center;justify-content:center;
        font-family:'IBM Plex Mono',monospace;
        font-size:10px;
        font-weight:700;
        color:#000;
      ">${zone.zoneId}</div>
      <div style="
        position:absolute;
        bottom:0;left:50%;transform:translateX(-50%);
        font-family:'IBM Plex Mono',monospace;
        font-size:7.5px;
        color:${fill};
        white-space:nowrap;
        letter-spacing:0.05em;
        text-shadow:0 0 4px ${fill};
      ">Z${zone.zoneId}</div>
    </div>`;

  return L.divIcon({
    html,
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

// Custom Network Tower Icon (Macro Base Station / gNodeB)
function createTowerIcon(tower) {
  const html = `
    <div style="position:relative;width:64px;height:64px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
      <!-- Expanding radio wave aura -->
      <div class="tower-wave" style="
        position:absolute;
        width:40px;height:40px;
        border-radius:50%;
        border:2px solid #38bdf8;
        background:rgba(56,189,248,0.12);
        pointer-events:none;
      "></div>
      <!-- Secondary offset wave -->
      <div class="tower-wave" style="
        position:absolute;
        width:40px;height:40px;
        border-radius:50%;
        border:1.5px solid #0284c7;
        animation-delay:1.1s;
        pointer-events:none;
      "></div>
      
      <!-- Tower Node Badge -->
      <div style="
        position:relative;
        width:32px;height:32px;
        border-radius:50%;
        background:#071626;
        border:2px solid #38bdf8;
        box-shadow:0 0 16px rgba(56,189,248,0.65);
        display:flex;align-items:center;justify-content:center;
        z-index:15;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v20M8 7l8-2M8 12l8-2M8 17l8-2M5 22h14M10 2l2-2 2 2"/>
          <circle cx="12" cy="2" r="2.2" fill="#ff4545" class="tower-beacon" stroke="none"/>
        </svg>
      </div>

      <!-- Tag label -->
      <div style="
        position:absolute;
        bottom:-3px;left:50%;transform:translateX(-50%);
        font-family:'IBM Plex Mono',monospace;
        font-size:7.5px;
        font-weight:700;
        color:#38bdf8;
        background:#071626f0;
        border:1px solid #0284c7;
        padding:1px 4px;
        border-radius:2px;
        white-space:nowrap;
        letter-spacing:0.06em;
        text-shadow:0 0 5px rgba(56,189,248,0.8);
        box-shadow:0 2px 6px rgba(0,0,0,0.8);
        z-index:16;
      ">5G/6G TOWER</div>
    </div>`;

  return L.divIcon({
    html,
    className: '',
    iconSize: [64, 64],
    iconAnchor: [32, 32],
  });
}

function buildPopup(zone, cityConfig) {
  const { fill, label } = aqiToColor(zone.aqi);
  const noiseColor = zone.noise > 80 ? '#ff4545' : zone.noise > 65 ? '#f5c518' : '#1fe090';
  const routing = cityConfig?.routing || {};
  const relayId = routing[zone.zoneId];
  const routingType = relayId ? `Mesh Relay via Zone ${relayId}` : 'Direct Link to Macro Tower';

  return `
    <div style="background:#1e2228;color:#c8cdd6;padding:10px 12px;font-family:'IBM Plex Mono',monospace;min-width:220px;font-size:11px;line-height:1.9;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2c3340;padding-bottom:6px;margin-bottom:6px;">
        <span style="font-weight:600;font-size:12px;color:#dde2ea;">Z${zone.zoneId} · ${zone.zoneName}</span>
        <span style="background:${fill}22;border:1px solid ${fill}55;color:${fill};padding:1px 5px;font-size:9px;letter-spacing:0.08em;font-weight:700;">${label}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;color:#9aafc8;margin-bottom:8px;">
        <div>AQI <span style="color:${fill};font-weight:600;">${zone.aqi}</span></div>
        <div>PM2.5 <span style="color:#dde2ea;">${zone.pm25}<small style="color:#6a7d96;">μg/m³</small></span></div>
        <div>CO₂ <span style="color:#dde2ea;">${zone.co2}<small style="color:#6a7d96;">ppm</small></span></div>
        <div>Noise <span style="color:${noiseColor};">${zone.noise}<small style="color:#6a7d96;">dB</small></span></div>
      </div>
      <div style="border-top:1px solid #2c3340;padding-top:6px;color:#9aafc8;font-size:10px;">
        <div>Slice: <b style="color:#38bdf8;">${zone.network?.slice}</b> &nbsp;·&nbsp; Latency: <b style="color:#dde2ea;">${zone.network?.latencyMs}ms</b></div>
        <div style="color:#6a7d96;font-size:9px;margin-top:2px;">Route: <span style="color:#7dd3fc;">${routingType}</span></div>
      </div>
    </div>`;
}

// Hex-ish polygon grid overlay per zone
function HeatOverlay({ zones }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (layerRef.current) layerRef.current.remove();
    const layer = L.layerGroup();

    zones.forEach(zone => {
      const { fill } = aqiToColor(zone.aqi);
      const opacity = 0.12;
      // Uniform circle radius for all zones
      const radiusM = 1250;

      const hex = L.circle([zone.lat, zone.lng], {
        radius: radiusM,
        color: fill,
        fillColor: fill,
        fillOpacity: opacity,
        weight: 0.8,
        opacity: 0.35,
      });
      layer.addLayer(hex);
    });

    layer.addTo(map);
    layerRef.current = layer;
    return () => layer.remove();
  }, [zones, map]);

  return null;
}

// 2km grid lines
function GridOverlay() {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    const layer = L.layerGroup();
    const bounds = map.getBounds();
    const step = 0.02; // ~2km
    const latMin = Math.floor(bounds.getSouth() / step) * step;
    const latMax = Math.ceil(bounds.getNorth() / step) * step;
    const lngMin = Math.floor(bounds.getWest() / step) * step;
    const lngMax = Math.ceil(bounds.getEast() / step) * step;

    for (let lat = latMin; lat <= latMax; lat += step) {
      L.polyline([[lat, lngMin], [lat, lngMax]], {
        color: '#2c3340', weight: 0.4, opacity: 0.5,
      }).addTo(layer);
    }
    for (let lng = lngMin; lng <= lngMax; lng += step) {
      L.polyline([[latMin, lng], [latMax, lng]], {
        color: '#2c3340', weight: 0.4, opacity: 0.5,
      }).addTo(layer);
    }
    layer.addTo(map);
    layerRef.current = layer;
    return () => layer.remove();
  }, [map]);

  return null;
}

// Camera controller: smoothly flies to city center upon selection
function MapController({ center, zoom }) {
  const map = useMap();
  const prevCenterRef = useRef(center);

  useEffect(() => {
    if (center && (center[0] !== prevCenterRef.current?.[0] || center[1] !== prevCenterRef.current?.[1])) {
      prevCenterRef.current = center;
      map.flyTo(center, zoom || 12, { duration: 1.4 });
    }
  }, [center, zoom, map]);

  return null;
}

// Network Tower Layer: Places that specific city's central 5G/6G gNodeB base station
function NetworkTowerLayer({ tower }) {
  const map = useMap();
  const towerMarkerRef = useRef(null);

  useEffect(() => {
    if (!tower) return;
    const icon = createTowerIcon(tower);
    const popupContent = `
      <div style="background:#1e2228;color:#c8cdd6;padding:12px 14px;font-family:'IBM Plex Mono',monospace;min-width:240px;font-size:11px;line-height:1.8;border:1px solid #0284c7;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #333d4d;padding-bottom:6px;margin-bottom:8px;">
          <span style="font-weight:700;font-size:12px;color:#38bdf8;">${tower.name}</span>
          <span style="background:#0c2233;border:1px solid #0284c7;color:#38bdf8;padding:1px 6px;font-size:9px;font-weight:700;">ONLINE</span>
        </div>
        <div style="color:#9aafc8;font-size:11px;">
          <div>Tower ID: <b style="color:#dde2ea;">${tower.id}</b></div>
          <div>Location: <b style="color:#dde2ea;">${tower.lat.toFixed(4)}°N, ${tower.lng.toFixed(4)}°E</b></div>
          <div>Carrier Band: <b style="color:#38bdf8;">${tower.frequency}</b></div>
          <div>Backhaul: <b style="color:#1fe090;">${tower.capacity}</b></div>
          <div>Topology: <b style="color:#f5c518;">Direct & Multi-Hop Ingress Links</b></div>
          <div style="border-top:1px solid #272e38;margin-top:6px;padding-top:5px;color:#6a7d96;font-size:10px;">
            Telemetry Sink: All smart-city sensor streams in this metro converge into this base station.
          </div>
        </div>
      </div>
    `;

    if (towerMarkerRef.current) {
      towerMarkerRef.current.setLatLng([tower.lat, tower.lng]);
      towerMarkerRef.current.setIcon(icon);
      towerMarkerRef.current.getPopup()?.setContent(popupContent);
    } else {
      const marker = L.marker([tower.lat, tower.lng], {
        icon,
        zIndexOffset: 1200,
      }).addTo(map).bindPopup(popupContent, { closeButton: false, offset: [0, -10], maxWidth: 280 });
      towerMarkerRef.current = marker;
    }

    return () => {
      if (towerMarkerRef.current) {
        towerMarkerRef.current.remove();
        towerMarkerRef.current = null;
      }
    };
  }, [tower, map]);

  return null;
}

// Multi-Hop and Direct Data Flow for the active city:
function DataFlowOverlay({ zones, tower, routing }) {
  const map = useMap();
  const animationRef = useRef(null);
  const layerRef = useRef(null);
  const flowStateRef = useRef({ routes: new Map(), packets: new Map(), items: [] });
  const zonesRef = useRef(zones);

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  useEffect(() => {
    if (layerRef.current) layerRef.current.remove();
    if (!tower || !zones || zones.length < 2) return undefined;

    const layer = L.layerGroup().addTo(map);
    const packetItems = [];
    const routesMap = new Map();
    const packetMarkers = new Map();

    const createPacketIcon = zone => {
      const color = flowColor(zone);
      const isUrgent = zone.network?.status === 'danger' || zone.spiked;
      const size = isUrgent ? 9 : 7;
      return L.divIcon({
        className: '',
        html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};box-shadow:0 0 ${size * 2}px ${color};border:1.5px solid #ffffff;"></span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    };

    zones.forEach((zone, index) => {
      const relayId = routing ? routing[zone.zoneId] : null;
      const relayZone = relayId ? zones.find(z => z.zoneId === relayId) : null;
      const color = flowColor(zone);
      const isAlert = zone.network?.status === 'danger' || zone.spiked;

      const waypoints = relayZone
        ? [
            [zone.lat, zone.lng],
            [relayZone.lat, relayZone.lng],
            [tower.lat, tower.lng],
          ]
        : [
            [zone.lat, zone.lng],
            [tower.lat, tower.lng],
          ];

      const routePolyline = L.polyline(waypoints, {
        color,
        weight: isAlert ? 2 : 1.2,
        opacity: isAlert ? 0.65 : 0.35,
        dashArray: relayZone ? '4 6' : '3 7',
        interactive: false,
      });
      layer.addLayer(routePolyline);
      routesMap.set(zone.zoneId, routePolyline);

      // Pipelined 2 packets per zone
      [0, 0.5].forEach((phaseShift, pIdx) => {
        const packet = L.marker([zone.lat, zone.lng], {
          icon: createPacketIcon(zone),
          interactive: false,
          zIndexOffset: 500,
        });
        layer.addLayer(packet);
        if (pIdx === 0) packetMarkers.set(zone.zoneId, packet);

        packetItems.push({
          packet,
          zone,
          waypoints,
          offset: (index / zones.length + phaseShift) % 1,
        });
      });
    });

    flowStateRef.current = { routes: routesMap, packets: packetMarkers, items: packetItems, createPacketIcon };

    const animate = now => {
      packetItems.forEach(({ packet, zone, waypoints, offset }) => {
        const isUrgent = zone.network?.status === 'danger' || zone.spiked;
        const duration = isUrgent ? 1400 : 2800;
        const progress = ((now / duration + offset) % 1);

        if (waypoints.length === 2) {
          const [start, twr] = waypoints;
          const lat = start[0] + (twr[0] - start[0]) * progress;
          const lng = start[1] + (twr[1] - start[1]) * progress;
          packet.setLatLng([lat, lng]);
        } else if (waypoints.length === 3) {
          const [start, relay, twr] = waypoints;
          if (progress < 0.5) {
            const localT = progress / 0.5;
            const lat = start[0] + (relay[0] - start[0]) * localT;
            const lng = start[1] + (relay[1] - start[1]) * localT;
            packet.setLatLng([lat, lng]);
          } else {
            const localT = (progress - 0.5) / 0.5;
            const lat = relay[0] + (twr[0] - relay[0]) * localT;
            const lng = relay[1] + (twr[1] - relay[1]) * localT;
            packet.setLatLng([lat, lng]);
          }
        }
      });
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    layerRef.current = layer;

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      layer.remove();
      layerRef.current = null;
      flowStateRef.current = { routes: new Map(), packets: new Map(), items: [] };
    };
  }, [zones, tower, routing, map]);

  useEffect(() => {
    const { routes, packets, createPacketIcon } = flowStateRef.current;
    if (!createPacketIcon) return;

    zones.forEach(zone => {
      const route = routes.get(zone.zoneId);
      const packet = packets.get(zone.zoneId);
      const isAlert = zone.network?.status === 'danger' || zone.spiked;
      if (route) {
        route.setStyle({
          color: flowColor(zone),
          weight: isAlert ? 2.2 : 1.2,
          opacity: isAlert ? 0.75 : 0.35,
        });
      }
      if (packet) packet.setIcon(createPacketIcon(zone));
    });
  }, [zones]);

  return null;
}

// Markers Layer: Handles active city's sensor nodes
function MarkersLayer({ zones, cityConfig, selectedZoneId, onSelectZone }) {
  const map = useMap();
  const markersRef = useRef({});

  useEffect(() => {
    // Clean up old markers that are no longer in this city
    const currentZoneIds = new Set(zones.map(z => z.zoneId));
    Object.keys(markersRef.current).forEach(id => {
      if (!currentZoneIds.has(Number(id))) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    zones.forEach(zone => {
      const icon = createMarkerIcon(zone);
      const popup = buildPopup(zone, cityConfig);
      const existing = markersRef.current[zone.zoneId];
      if (existing) {
        existing.setLatLng([zone.lat, zone.lng]);
        existing.setIcon(icon);
        existing.getPopup()?.setContent(popup);
      } else {
        const m = L.marker([zone.lat, zone.lng], { icon, zIndexOffset: 800 })
          .addTo(map)
          .bindPopup(popup, { closeButton: false, offset: [0, -10], maxWidth: 240 });
        m.on('click', () => onSelectZone(zone.zoneId));
        markersRef.current[zone.zoneId] = m;
      }
    });
  }, [zones, cityConfig, map, onSelectZone]);

  useEffect(() => {
    const m = markersRef.current[selectedZoneId];
    if (m) m.openPopup();
  }, [selectedZoneId]);

  return null;
}

export default function CityMap({ zones, cityId = 'delhi', selectedZoneId, onSelectZone }) {
  const cityConfig = CITIES_CONFIG[cityId] || CITIES_CONFIG.delhi;

  return (
    <MapContainer
      center={cityConfig.center}
      zoom={cityConfig.zoom}
      style={{ width: '100%', height: '100%' }}
      zoomControl
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
      <MapController center={cityConfig.center} zoom={cityConfig.zoom} />
      <GridOverlay />
      <HeatOverlay zones={zones} />
      <DataFlowOverlay zones={zones} tower={cityConfig.tower} routing={cityConfig.routing} />
      <NetworkTowerLayer tower={cityConfig.tower} />
      <MarkersLayer zones={zones} cityConfig={cityConfig} selectedZoneId={selectedZoneId} onSelectZone={onSelectZone} />
    </MapContainer>
  );
}
