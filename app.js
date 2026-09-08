/* ============================================================================
   NetBlizzard — Environmental & Pollution Monitoring Network over 5G/6G
   Client-side simulation. No backend, no external dependencies.

   NETWORKING CONCEPTS MODELLED (simplified, for demo purposes):
   - Network slicing / QoS prioritization: zones in "danger" state are moved
     onto a reserved low-latency PRIORITY slice (URLLC-like); everyone else
     shares a best-effort NORMAL slice (eMBB-like) on the same shared uplink.
   - Adaptive sampling: a sensor's reporting interval drops (reports more
     often) the moment its zone crosses a danger threshold, and is restored
     after a cooldown once readings recover.
   - Finite channel capacity with congestion: if total demand exceeds the
     uplink's capacity in a tick, normal-slice readings queue/drop first —
     the priority slice is protected.
   ========================================================================== */

(() => {
  "use strict";

  // ---------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------
  const COLS = 6, ROWS = 4;
  const ZONE_NAMES = [
    "Downtown","Riverside","Old Town","Tech Park","Harbor District","Industrial Zone",
    "Greenwood","University","Airport Rd","Central Station","Market Square","Civic Center",
    "Suburbia North","Suburbia South","Stadium District","Warehouse Row","Hillcrest","East End",
    "West End","Bay Area","Uptown","Highway Junction","Parkside","Lakeview"
  ];

  const AQI_DANGER = 150;      // US EPA "Unhealthy" band starts here
  const NOISE_DANGER = 85;     // dB — common occupational/community exposure limit
  const NORMAL_INTERVAL = 6;   // ticks between reports when zone is normal
  const PRIORITY_INTERVAL = 1; // ticks between reports when zone is in danger
  const COOLDOWN_TICKS = 4;    // consecutive OK ticks required before de-prioritizing

  const CHANNEL_CAPACITY = 16;   // total readings/tick the shared uplink can carry
  const PRIORITY_RESERVED = 8;   // slots effectively reserved for the priority slice
  const PACKET_KB = 2;           // simulated payload size per reading

  const TICK_MS = 1000;
  const EVENT_PROB = 0.07;       // per-tick chance of a spontaneous incident

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const state = {
    running: true,
    speed: 1,
    connMode: "5G",
    tick: 0,
    zones: [],
    dropped: 0,
    latP: 6, latN: 22,
    aqiHistory: [],
    timer: null,
    congestionCooldown: 0,
  };

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpRGB(c1, c2, t) {
    return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
  }

  const AQI_STOPS = [
    { v: 0,   c: [46, 204, 113] },   // good
    { v: 50,  c: [241, 196, 15] },   // moderate
    { v: 100, c: [230, 126, 34] },   // unhealthy for sensitive groups
    { v: 150, c: [231, 76, 60] },    // unhealthy (danger threshold)
    { v: 250, c: [142, 68, 173] },   // very unhealthy
    { v: 400, c: [90, 20, 20] },     // hazardous
  ];
  function aqiToRGB(aqi) {
    const v = clamp(aqi, 0, 400);
    for (let i = 0; i < AQI_STOPS.length - 1; i++) {
      const a = AQI_STOPS[i], b = AQI_STOPS[i + 1];
      if (v >= a.v && v <= b.v) {
        const t = (v - a.v) / (b.v - a.v);
        return lerpRGB(a.c, b.c, t);
      }
    }
    return AQI_STOPS[AQI_STOPS.length - 1].c;
  }
  function aqiCategory(aqi) {
    if (aqi <= 50) return "Good";
    if (aqi <= 100) return "Moderate";
    if (aqi <= 150) return "Unhealthy (Sensitive)";
    if (aqi <= 250) return "Unhealthy";
    return "Hazardous";
  }

  function severity(zone) {
    const aqiSev = clamp(zone.aqi / 250, 0, 1);
    const noiseSev = clamp((zone.noise - 30) / 100, 0, 1);
    return Math.max(aqiSev, noiseSev);
  }

  // ---------------------------------------------------------------------
  // Zone init
  // ---------------------------------------------------------------------
  function initZones() {
    state.zones = ZONE_NAMES.map((name, i) => ({
      id: i,
      name,
      col: i % COLS,
      row: Math.floor(i / COLS),
      aqi: rand(20, 70),
      noise: rand(35, 60),
      eventBoostAqi: 0,
      eventBoostNoise: 0,
      danger: false,
      ticksSinceUpdate: Math.floor(Math.random() * NORMAL_INTERVAL),
      updateInterval: NORMAL_INTERVAL,
      belowCooldown: 0,
      el: null, pinEl: null,
    }));
    state.dropped = 0;
    state.aqiHistory = [];
    state.tick = 0;
  }

  // ---------------------------------------------------------------------
  // DOM build (static tiles, built once)
  // ---------------------------------------------------------------------
  const grid = document.getElementById("zonesGrid");
  const tickerList = document.getElementById("tickerList");
  const arena = document.getElementById("arena");
  const linkLayer = document.getElementById("linkLayer");
  const packetLayer = document.getElementById("packetLayer");
  const baseStation = document.getElementById("baseStation");

  function buildZoneTiles() {
    grid.innerHTML = "";
    state.zones.forEach((zone) => {
      const tile = document.createElement("div");
      tile.className = "zone";
      tile.innerHTML = `
        <span class="zone-badge">PRIORITY</span>
        <div class="pin-wrap"><div class="pin"></div></div>
        <div class="zone-name">${zone.name}</div>
        <div class="zone-aqi-label">AQI</div>
        <div class="zone-aqi"></div>
        <div class="zone-noise"></div>
        <div class="zone-interval"></div>
      `;
      grid.appendChild(tile);
      zone.el = tile;
      zone.pinEl = tile.querySelector(".pin");
    });
  }

  // ---------------------------------------------------------------------
  // Static link lines (zone -> base station), recomputed on layout change
  // ---------------------------------------------------------------------
  function relCenter(el, containerEl) {
    const r = el.getBoundingClientRect();
    const c = containerEl.getBoundingClientRect();
    return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height / 2 };
  }

  function drawLinkLines() {
    const arenaRect = arena.getBoundingClientRect();
    linkLayer.setAttribute("width", arenaRect.width);
    linkLayer.setAttribute("height", arenaRect.height);
    linkLayer.setAttribute("viewBox", `0 0 ${arenaRect.width} ${arenaRect.height}`);
    linkLayer.innerHTML = "";
    const bsPos = relCenter(baseStation, arena);
    state.zones.forEach((zone) => {
      const zPos = relCenter(zone.el, arena);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", zPos.x);
      line.setAttribute("y1", zPos.y);
      line.setAttribute("x2", bsPos.x);
      line.setAttribute("y2", bsPos.y);
      line.setAttribute("stroke", zone.danger ? "#e74c3c55" : "#38bdf822");
      line.setAttribute("stroke-width", zone.danger ? 1.4 : 1);
      zone.lineEl = line;
      linkLayer.appendChild(line);
    });
  }

  // ---------------------------------------------------------------------
  // Packet animation (CSS transition driven)
  // ---------------------------------------------------------------------
  function spawnPacket(zone, isPriority) {
    const from = relCenter(zone.el, arena);
    const to = relCenter(baseStation, arena);
    const dot = document.createElement("div");
    dot.className = "packet " + (isPriority ? "priority" : "normal");
    dot.style.left = "0px";
    dot.style.top = "0px";
    dot.style.transform = `translate(${from.x}px, ${from.y}px)`;
    packetLayer.appendChild(dot);

    const duration = isPriority ? rand(280, 420) : rand(650, 1100);
    requestAnimationFrame(() => {
      dot.style.transition = `transform ${duration}ms linear, opacity ${duration}ms linear`;
      dot.style.transform = `translate(${to.x}px, ${to.y}px)`;
      dot.style.opacity = "0.15";
    });
    setTimeout(() => dot.remove(), duration + 60);
  }

  // ---------------------------------------------------------------------
  // Ticker
  // ---------------------------------------------------------------------
  function logAlert(kind, msg) {
    const li = document.createElement("li");
    li.className = kind;
    const time = new Date().toLocaleTimeString([], { hour12: false });
    li.innerHTML = `<span>${msg}</span><span class="t">${time}</span>`;
    tickerList.prepend(li);
    while (tickerList.children.length > 40) tickerList.lastChild.remove();
  }

  // ---------------------------------------------------------------------
  // Simulation tick
  // ---------------------------------------------------------------------
  function updateZoneReading(zone) {
    // decay any incident boost, then random-walk
    zone.eventBoostAqi *= 0.82;
    zone.eventBoostNoise *= 0.82;
    if (zone.eventBoostAqi < 1) zone.eventBoostAqi = 0;
    if (zone.eventBoostNoise < 1) zone.eventBoostNoise = 0;

    const targetAqi = clamp(zone.aqi + rand(-9, 9) + zone.eventBoostAqi * 0.35, 5, 400);
    const targetNoise = clamp(zone.noise + rand(-3, 3) + zone.eventBoostNoise * 0.35, 28, 130);
    zone.aqi = lerp(zone.aqi, targetAqi, 0.6);
    zone.noise = lerp(zone.noise, targetNoise, 0.6);
  }

  function maybeInjectSpontaneous() {
    if (Math.random() < EVENT_PROB * (state.speed >= 4 ? 0.6 : 1)) {
      injectIncident(pick(state.zones));
    }
  }

  function injectIncident(zone) {
    if (Math.random() < 0.55) {
      zone.eventBoostAqi = rand(120, 260);
      logAlert("warning", `🚨 Emissions spike detected near ${zone.name} — sensor reporting rising AQI`);
    } else {
      zone.eventBoostNoise = rand(35, 70);
      logAlert("warning", `🚨 Noise spike detected near ${zone.name} — construction/traffic surge`);
    }
  }

  function resolveNetworkTick(packets) {
    const priorityPkts = packets.filter((p) => p.isPriority);
    const normalPkts = packets.filter((p) => !p.isPriority);

    const remainingCapacity = Math.max(0, CHANNEL_CAPACITY - priorityPkts.length);
    const normalServed = normalPkts.slice(0, remainingCapacity);
    const normalDropped = normalPkts.length - normalServed.length;

    const congested = normalPkts.length > remainingCapacity;
    const congestionFactor = congested ? 1 + (normalPkts.length - remainingCapacity) / CHANNEL_CAPACITY : 1;

    const baseP = state.connMode === "6G" ? [0.5, 2] : [4, 10];
    const baseN = state.connMode === "6G" ? [5, 15] : [15, 40];

    let sumP = 0, sumN = 0;
    priorityPkts.forEach((p) => {
      const lat = rand(baseP[0], baseP[1]);
      sumP += lat;
      spawnPacket(p.zone, true);
    });
    normalServed.forEach((p) => {
      const lat = rand(baseN[0], baseN[1]) * congestionFactor;
      sumN += lat;
      spawnPacket(p.zone, false);
    });

    if (priorityPkts.length) state.latP = lerp(state.latP, sumP / priorityPkts.length, 0.4);
    if (normalServed.length) state.latN = lerp(state.latN, sumN / normalServed.length, 0.4);

    state.dropped += normalDropped;
    const served = priorityPkts.length + normalServed.length;
    const utilization = clamp(served / CHANNEL_CAPACITY, 0, 1);
    const throughputMbps = (served * PACKET_KB * 8) / 1000;

    if (normalDropped > 0 && state.congestionCooldown <= 0) {
      logAlert("net", `📡 Uplink congested — ${normalDropped} standard-priority reading(s) queued/dropped this cycle (priority slice unaffected)`);
      state.congestionCooldown = 5;
    }
    if (state.congestionCooldown > 0) state.congestionCooldown--;

    return { utilization, throughputMbps, priorityCount: priorityPkts.length, servedCount: served };
  }

  function updateZoneStatus(zone) {
    const wasDanger = zone.danger;
    const isDangerNow = zone.aqi > AQI_DANGER || zone.noise > NOISE_DANGER;

    if (isDangerNow) {
      zone.belowCooldown = 0;
      if (!wasDanger) {
        zone.danger = true;
        zone.updateInterval = PRIORITY_INTERVAL;
        logAlert(
          "critical",
          `⚠ ${zone.name} crossed danger threshold — AQI ${Math.round(zone.aqi)} / ${Math.round(zone.noise)} dB. Priority slice engaged (report interval ${NORMAL_INTERVAL}s → ${PRIORITY_INTERVAL}s)`
        );
      }
    } else if (wasDanger) {
      zone.belowCooldown++;
      if (zone.belowCooldown >= COOLDOWN_TICKS) {
        zone.danger = false;
        zone.updateInterval = NORMAL_INTERVAL;
        zone.belowCooldown = 0;
        logAlert("info", `✅ ${zone.name} back under thresholds — priority released, normal interval restored`);
      }
    }
  }

  function tick() {
    state.tick++;
    maybeInjectSpontaneous();

    const packets = [];
    state.zones.forEach((zone) => {
      zone.ticksSinceUpdate++;
      if (zone.ticksSinceUpdate >= zone.updateInterval) {
        zone.ticksSinceUpdate = 0;
        updateZoneReading(zone);
        packets.push({ zone, isPriority: zone.danger });
      }
    });

    state.zones.forEach(updateZoneStatus);

    const net = resolveNetworkTick(packets);

    const avgAqi = state.zones.reduce((s, z) => s + z.aqi, 0) / state.zones.length;
    state.aqiHistory.push(avgAqi);
    if (state.aqiHistory.length > 90) state.aqiHistory.shift();

    render(net);
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  function render(net) {
    state.zones.forEach((zone) => {
      const [r, g, b] = aqiToRGB(zone.aqi);
      const color = `rgb(${r | 0},${g | 0},${b | 0})`;
      zone.pinEl.style.color = color;
      zone.pinEl.style.background = color;
      const sev = severity(zone);
      zone.pinEl.style.setProperty("--pulse-dur", `${lerp(2.4, 0.35, sev).toFixed(2)}s`);

      zone.el.classList.toggle("danger", zone.danger);
      if (zone.lineEl) {
        zone.lineEl.setAttribute("stroke", zone.danger ? "#e74c3c66" : "#38bdf822");
        zone.lineEl.setAttribute("stroke-width", zone.danger ? 1.6 : 1);
      }

      const aqiEl = zone.el.querySelector(".zone-aqi");
      aqiEl.textContent = Math.round(zone.aqi);
      aqiEl.style.color = color;

      const noiseEl = zone.el.querySelector(".zone-noise");
      noiseEl.innerHTML = `<b style="color:${zone.noise > NOISE_DANGER ? "#e74c3c" : "#8a96ab"}">${Math.round(zone.noise)}</b> dB`;

      zone.el.querySelector(".zone-interval").textContent = `every ${zone.updateInterval}s`;
      zone.el.title =
        `${zone.name}\nAQI ${Math.round(zone.aqi)} (${aqiCategory(zone.aqi)})\nNoise ${Math.round(zone.noise)} dB\n` +
        `Report interval: ${zone.updateInterval}s\nStatus: ${zone.danger ? "PRIORITY / DANGER" : "Normal"}`;
    });

    // stats strip
    const activeSensors = state.zones.filter((z) => z.ticksSinceUpdate === 0).length;
    const priorityCount = state.zones.filter((z) => z.danger).length;
    document.getElementById("statSensors").textContent = `${activeSensors}/${state.zones.length}`;
    document.getElementById("statPriority").textContent = priorityCount;
    if (net) {
      document.getElementById("statUtil").textContent = `${Math.round(net.utilization * 100)}%`;
      document.getElementById("statThroughput").textContent = `${net.throughputMbps.toFixed(2)} Mbps`;
    }
    document.getElementById("statLatP").textContent = `${state.latP.toFixed(1)} ms`;
    document.getElementById("statLatN").textContent = `${state.latN.toFixed(1)} ms`;
    document.getElementById("statDropped").textContent = state.dropped;

    drawChart();
  }

  function drawChart() {
    const canvas = document.getElementById("aqiChart");
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const hist = state.aqiHistory;
    if (hist.length < 2) return;
    const max = Math.max(200, ...hist);
    const min = 0;
    ctx.beginPath();
    hist.forEach((v, i) => {
      const x = (i / (hist.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // danger threshold line
    const yThresh = h - (AQI_DANGER / max) * h;
    ctx.beginPath();
    ctx.moveTo(0, yThresh);
    ctx.lineTo(w, yThresh);
    ctx.strokeStyle = "#e74c3c88";
    ctx.setLineDash([3, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---------------------------------------------------------------------
  // Timer control
  // ---------------------------------------------------------------------
  function restartTimer() {
    if (state.timer) clearInterval(state.timer);
    if (state.running) {
      state.timer = setInterval(tick, TICK_MS / state.speed);
    }
  }

  // ---------------------------------------------------------------------
  // Controls wiring
  // ---------------------------------------------------------------------
  function wireControls() {
    document.getElementById("connToggle").addEventListener("click", (e) => {
      const btn = e.target.closest(".seg-btn");
      if (!btn) return;
      document.querySelectorAll("#connToggle .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.connMode = btn.dataset.mode;
      document.getElementById("bsMode").textContent = state.connMode;
      logAlert("net", `🔧 Radio access network switched to ${state.connMode} — base latency profile updated`);
    });

    document.getElementById("speedToggle").addEventListener("click", (e) => {
      const btn = e.target.closest(".seg-btn");
      if (!btn) return;
      document.querySelectorAll("#speedToggle .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.speed = Number(btn.dataset.speed);
      restartTimer();
    });

    document.getElementById("injectBtn").addEventListener("click", () => {
      injectIncident(pick(state.zones));
    });

    document.getElementById("pauseBtn").addEventListener("click", (e) => {
      state.running = !state.running;
      e.target.textContent = state.running ? "⏸ Pause" : "▶ Resume";
      restartTimer();
    });

    document.getElementById("resetBtn").addEventListener("click", () => {
      tickerList.innerHTML = "";
      initZones();
      buildZoneTiles();
      requestAnimationFrame(drawLinkLines);
      logAlert("info", "🔄 Simulation reset");
      render();
    });

    window.addEventListener("resize", () => requestAnimationFrame(drawLinkLines));
  }

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------
  function boot() {
    initZones();
    buildZoneTiles();
    wireControls();
    requestAnimationFrame(() => {
      drawLinkLines();
      render();
      logAlert("info", "✅ Network online — 24 zones streaming over mock 5G uplink");
    });
    restartTimer();
  }

  boot();
})();
