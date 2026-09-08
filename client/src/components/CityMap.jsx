// CityMap.jsx — Telemetry-grade map with EPA-scale markers and hex overlay
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;

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

// Custom pulsing marker icon
function createMarkerIcon(zone) {
  const status = zone.network?.status || 'safe';
  const { fill, ring } = aqiToColor(zone.aqi);
  const r = status === 'danger' || zone.spiked ? 11 : status === 'warning' ? 9 : 7;
  const ringClass = statusRingClass(status, zone.spiked);
  const glowSize = zone.spiked ? 18 : status === 'danger' ? 14 : 8;

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
        font-size:${r - 1}px;
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

function buildPopup(zone) {
  const { fill, label } = aqiToColor(zone.aqi);
  const noiseColor = zone.noise > 80 ? '#a84040' : zone.noise > 65 ? '#b88c3a' : '#4fa389';
  return `
    <div style="background:#1e2228;color:#c8cdd6;padding:10px 12px;font-family:'IBM Plex Mono',monospace;min-width:200px;font-size:11px;line-height:1.9;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2c3340;padding-bottom:6px;margin-bottom:6px;">
        <span style="font-weight:600;font-size:12px;color:#c8cdd6;">Zone ${zone.zoneId} / ${zone.zoneName}</span>
        <span style="background:${fill}22;border:1px solid ${fill}55;color:${fill};padding:1px 5px;font-size:9px;letter-spacing:0.08em;">${label}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;color:#7a8699;margin-bottom:8px;">
        <div>AQI <span style="color:${fill};font-weight:600;">${zone.aqi}</span></div>
        <div>PM2.5 <span style="color:#c8cdd6;">${zone.pm25}<small style="color:#4a5568;">μg/m³</small></span></div>
        <div>CO₂ <span style="color:#c8cdd6;">${zone.co2}<small style="color:#4a5568;">ppm</small></span></div>
        <div>Noise <span style="color:${noiseColor};">${zone.noise}<small style="color:#4a5568;">dB</small></span></div>
      </div>
      <div style="border-top:1px solid #2c3340;padding-top:6px;color:#7a8699;font-size:10px;">
        <div>Slice <span style="color:#4a8fa0;">${zone.network?.slice}</span>
          &nbsp;·&nbsp; ${zone.network?.latencyMs}ms
          &nbsp;·&nbsp; ${zone.network?.frequencyHz}Hz
        </div>
      </div>
    </div>`;
}

// Hex-ish polygon grid overlay (hexagonal color cells per zone)
function HeatOverlay({ zones }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (layerRef.current) layerRef.current.remove();
    const layer = L.layerGroup();

    zones.forEach(zone => {
      const { fill } = aqiToColor(zone.aqi);
      const opacity = 0.10 + (zone.aqi / 500) * 0.16;
      const radiusM = 900 + (zone.aqi / 500) * 900;

      // Hexagonal polygon approximation (8 points)
      const hex = L.circle([zone.lat, zone.lng], {
        radius: radiusM,
        color: fill,
        fillColor: fill,
        fillOpacity: opacity,
        weight: 0.8,
        opacity: 0.3,
        dashArray: null,
      });
      layer.addLayer(hex);
    });

    layer.addTo(map);
    layerRef.current = layer;
    return () => layer.remove();
  }, [zones, map]);

  return null;
}

// Grid line overlay for NOC/GIS feel
function GridOverlay() {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    const layer = L.layerGroup();
    const bounds = map.getBounds();
    const step = 0.02; // ~2km grid
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

function MarkersLayer({ zones, selectedZoneId, onSelectZone }) {
  const map = useMap();
  const markersRef = useRef({});

  useEffect(() => {
    zones.forEach(zone => {
      const icon = createMarkerIcon(zone);
      const popup = buildPopup(zone);
      const existing = markersRef.current[zone.zoneId];
      if (existing) {
        existing.setIcon(icon);
        existing.getPopup()?.setContent(popup);
      } else {
        const m = L.marker([zone.lat, zone.lng], { icon })
          .addTo(map)
          .bindPopup(popup, { closeButton: false, offset: [0, -10], maxWidth: 220 });
        m.on('click', () => onSelectZone(zone.zoneId));
        markersRef.current[zone.zoneId] = m;
      }
    });
  }, [zones, map, onSelectZone]);

  useEffect(() => {
    const m = markersRef.current[selectedZoneId];
    if (m) m.openPopup();
  }, [selectedZoneId]);

  return null;
}

export default function CityMap({ zones, selectedZoneId, onSelectZone }) {
  return (
    <MapContainer
      center={[28.627, 77.215]}
      zoom={12}
      style={{ width: '100%', height: '100%' }}
      zoomControl
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
      <GridOverlay />
      <HeatOverlay zones={zones} />
      <MarkersLayer zones={zones} selectedZoneId={selectedZoneId} onSelectZone={onSelectZone} />
    </MapContainer>
  );
}
