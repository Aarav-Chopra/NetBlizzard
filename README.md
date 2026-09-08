# NetBlizzard
**Theme 7 — 5G/6G-Enabled Smart City Communication and Monitoring**
**Prototype 4 — Environmental & Pollution Monitoring Network over 5G/6G**

A city-wide simulated network of air-quality and noise sensors that stream
readings over a mock 5G/6G uplink. When pollution or noise in a zone crosses
a danger threshold, the network automatically boosts that zone's update
frequency and moves it onto a reserved low-latency priority slice.

No build step, no backend, no dependencies. Open [`index.html`](index.html)
in a browser and it runs.

```bash
# from this folder
start index.html      # Windows
```

---

## How to demo it (60–90 seconds)

1. Open `index.html`. 24 zones are streaming quietly — pins pulse slowly,
   mostly green/yellow.
2. Click **⚡ Inject Incident** — a zone spikes red, its pin pulses fast,
   a `PRIORITY` badge appears, a line to the tower thickens, and the ticker
   logs the threshold crossing with the interval change (`6s → 1s`).
3. Watch the packet dots: gold dots (priority slice) travel to the tower
   noticeably faster than the blue dots (normal slice) — same shared uplink,
   different QoS treatment.
4. Toggle **5G → 6G** to show the latency profile drop (stats strip updates
   live).
5. Point at **Channel Utilization** / **Dropped Readings** — trigger several
   incidents at once (or 4x speed) to show the uplink congest and normal-slice
   readings queue/drop while the priority slice stays clean.
6. Let it recover: after a few clean ticks, the zone's badge disappears and
   the ticker logs "priority released."

---

## Problem breakdown

The brief asks for three linked mechanisms, not just a live dashboard:

1. **Simulated sensor network** — air-quality (AQI) + noise (dB) sensors per
   zone, streaming over a **mock** 5G/6G link (explicitly simulated, no real
   hardware/radio required for a one-day build).
2. **Adaptive network behaviour** — when a zone's reading crosses a danger
   threshold, the network must *react*: report more often, and get network
   priority. This is the core "communication/networking" requirement, and
   it maps directly onto a real concept:
   - **Network slicing / QoS prioritization.** Real 5G/6G core networks can
     carve a shared radio channel into slices with different guarantees —
     e.g. an eMBB slice (best-effort, high-throughput) and a URLLC slice
     (reserved capacity, low, bounded latency) for safety/critical IoT
     traffic. A zone in "danger" is analogous to a critical-IoT device: it
     gets moved to the low-latency reserved slice.
   - **Adaptive sampling.** Edge/IoT systems commonly reduce reporting
     interval under normal conditions to save power/bandwidth, and increase
     it when an anomaly is detected — exactly the 6s→1s behaviour here.
3. **Visualization** — the brief explicitly specifies a green→red heat-map,
   pins that pulse faster as readings worsen, and a live alert ticker. That
   is the primary demo surface, built as specified.

## What is actually simulated (and how)

| Concept | Real-world analogue | Implementation |
|---|---|---|
| Shared uplink with finite capacity | Cell sector's finite PRBs/bandwidth | `CHANNEL_CAPACITY` = readings/tick the link can carry ([app.js](app.js)) |
| Network slicing / QoS | 5G network slicing (eMBB vs URLLC) | Priority-slice packets are served first every tick; normal-slice packets share what's left |
| Congestion → queuing/drop | Best-effort traffic degrades under load | Excess normal-slice packets are counted as dropped; priority slice is protected |
| Adaptive sampling | Edge-triggered reporting | `updateInterval` flips `6 ticks → 1 tick` the instant a zone crosses threshold |
| Latency by slice & RAT generation | 5G vs 6G target latencies | Priority ≈4–10 ms (5G) / 0.5–2 ms (6G); Normal ≈15–40 ms (5G) / 5–15 ms (6G), inflated further under congestion |
| Hysteresis / cooldown | Avoids alert flapping at the threshold edge | Zone must stay under threshold for `COOLDOWN_TICKS` before priority is released |
| AQI colour scale | US EPA AQI bands | 0–50 good → 400+ hazardous, interpolated green→purple |
| Noise threshold | Community/occupational exposure guidance (~85 dB) | Zones with noise > 85 dB also trigger danger state |

All data is **synthetic** (random-walk + injected incidents) — this is a
simulation/model demo, clearly labelled as such in the UI, not a claim of
real sensor data.

## Architecture

```
index.html   structure: topbar, stats strip, arena (map + tower + link
             lines + packet layer), alert ticker
style.css    dark "network ops center" theme, pulse/packet animations,
             AQI colour tokens
app.js       simulation loop (1 tick/sec, adjustable 1x/2x/4x):
               1. per-zone: random-walk + incident decay -> new reading
               2. threshold check -> enter/exit danger (with cooldown)
               3. network tick: partition packets into priority/normal,
                  apply capacity limit, compute latency, spawn packet
                  animations, log congestion
               4. render: pin colour/pulse speed, ticker, stats, sparkline
```

Everything runs client-side; `tick()` in [app.js](app.js) is the single
place that ties sensor state, network QoS logic, and rendering together.

## Rubric alignment

- **Technical depth (10):** real network-slicing/QoS reasoning drives the
  priority mechanism, not just a colour change — capacity, congestion, and
  latency-by-slice are all modelled and visible in the stats strip.
- **Feasibility & completeness (5):** zero-setup, zero-dependency, runs by
  opening a file — reliable for a one-day build and live judging.
- **Communication/networking integration (5):** shared-channel capacity,
  slicing, adaptive sampling, RAT-generation latency profile (5G/6G toggle).
- **Presentation & visual clarity (5):** matches the poster's tip directly —
  green→red heat-map, pins pulsing faster as readings worsen, live alert
  ticker — plus a manual incident trigger for a controllable live demo.

## Possible extensions (if time allows)

- Per-zone historical sparkline on hover/click.
- A second "6G network slicing" mode with more than 2 slices (e.g. add a
  mid-tier for "Moderate" zones).
- Export ticker log as a CSV "incident report."
- Replace the synthetic random walk with a real open AQI/noise dataset for
  a "hybrid" demo (simulated network behaviour, real historical readings).
