# NetBlizzard — Phase 2 Build Brief
### "From mock portal to a real product-feeling smart-city NOC"

You are picking up work on **NetBlizzard**, a submission for *ProtoWave — Theme 7: 5G/6G-Enabled Smart
City Communication and Monitoring, Prototype 4: Environmental & Pollution Monitoring Network*.

A working v1 already exists at the repo root (`index.html`, `style.css`, `app.js`): a single-file,
client-only simulation of 24 city zones with AQI + noise sensors, a mock priority/QoS mechanism, a
heat-map grid, and an alert ticker. **It works, but it looks and feels like a mock-up** — flat grid
tiles, no real charts, no history, no admin control, everything crammed into one JS file, one shared
global-random-walk loop. This brief is the spec for **v2**: a genuinely solid, demo-ready product with
a real client/server split, a defined streaming protocol, richer features, and a proper design system.

Read this whole document before writing code. It is written to be self-sufficient — you should not need
to ask the user clarifying questions to get started; every open decision below has already been made.
Where you must choose something not covered here, choose the option that is simplest to run, most
reliable for live judging, and most visually convincing — in that order.

---

## 1. Goals

1. **Feel like a real network operations dashboard**, not a toy — the kind of internal tool a city's
   smart-infrastructure team would actually use to watch pollution/noise sensors.
2. **Actually stream data over a socket connection**, server → client, so "the network" is a real,
   inspectable client/server boundary instead of one JS file pretending. This is also a stronger story
   for the "Communication/Networking Integration" rubric line.
3. **Model 5G/6G network-slicing/QoS more realistically**: multiple tiers, multiple base stations
   (edge nodes) with zone→station assignment and handover, a live view of slice utilization over time.
4. **Give judges things to click**: zone drill-down with history, scenario triggers, a live-tunable
   config panel, filterable alert log, CSV export — not just "watch it run."
5. **Look designed**, not default: a real design system (tokens, consistent components, motion,
   accessible color use), not ad hoc inline styles.
6. **Stay reliably demoable.** Any risk that the new stack fails to boot on a strange laptop at judging
   time is a real cost — see §8 (fallback plan) and §9 (run instructions) for how to protect against this.

## 2. Non-goals / constraints

- **Data stays synthetic.** This is a simulation/demo, exactly as the brief specifies ("simulation/model/
  demo" is explicitly acceptable per the rubric). Do not wire up a real air-quality API. Do not claim
  real sensor data anywhere in the UI copy — keep a "SIMULATED" indicator visible, as v1 does.
- **No paid services, no cloud accounts, no auth providers.** Everything must run on `localhost` with
  `npm install && npm run dev` and nothing else.
- **No real 5G/6G radio hardware or protocol stacks.** "5G/6G" stays a modeled abstraction (latency
  profile + slicing + capacity), clearly labeled as simulated, same spirit as v1.
- Don't scope-creep into unrelated smart-city domains (traffic lights, water, energy grid). Stay inside
  environmental + noise monitoring, exactly as Prototype 4 specifies. Temperature/humidity as *optional*
  secondary sensors are fine (see §5.2) but AQI + noise remain the two sensors the whole story is built
  around.

## 3. Architecture (decided — do not re-litigate)

Two packages in an npm workspace, one root command to run both:

```
NetBlizzard/
  legacy/                  <- v1 moved here verbatim, untouched, as an offline zero-setup fallback demo
    index.html style.css app.js
  server/                  <- "network simulation service" (Node + TypeScript)
  client/                  <- the dashboard (Vite + React + TypeScript)
  docs/
    PHASE2_SPEC.md         <- this file
    PROTOCOL.md            <- WebSocket + REST contract (you will author this, see §10)
    DESIGN.md              <- design tokens + component inventory (you will author this, see §7)
  package.json             <- npm workspaces root; `npm run dev` starts both via `concurrently`
  README.md                <- update with v2 architecture + run instructions; keep v1 instructions
                               under a "Legacy static demo" heading
```

**Move, don't delete.** `git mv index.html style.css app.js legacy/` before starting server/client work.
The legacy static demo must keep working by opening `legacy/index.html` directly — it is the fallback if
the new stack has any environment problem in front of judges.

### 3.1 Backend — `server/`

- **Node.js + TypeScript**, `ws` for the WebSocket server, `express` for REST endpoints, `better-sqlite3`
  (or `lowdb` if you want to avoid native bindings) for persistence of readings/alerts history.
- Owns **all simulation state and all simulation logic**: zones, sensors, thresholds, the slicing/QoS
  engine, base stations, scenarios. The client owns **zero** simulation logic — it only renders what the
  server sends and sends control messages back (trigger scenario, change config). This is the important
  architectural shift from v1, where the browser tab was both "network" and "viewer."
- Ticks the simulation on a server-side interval (default 1000ms / speed multiplier), exactly like v1's
  `tick()`, but the resulting state is **pushed to every connected client over WebSocket** instead of
  being rendered directly.
- On each client connection: send a `snapshot` message (full current state) immediately, then stream
  incremental updates (`reading`, `alert`, `network_stats`, `handover`, `scenario_started`,
  `config_changed`) as they occur. See §10 for exact schemas.
- Persists every reading and every alert to SQLite so the client can request history (`GET
  /api/zones/:id/history?minutes=30`) for real charts, and so a page refresh doesn't lose the ticker/
  history (client can also just re-request on reconnect; persistence is what makes history survive a
  server restart too).
- Config (thresholds, channel capacity, reserved slots per tier, connection mode) lives server-side and
  is mutable at runtime via `POST /api/config`; broadcast a `config_changed` message to all clients when
  it changes so every open dashboard stays in sync.

### 3.2 Frontend — `client/`

- **Vite + React + TypeScript.**
- **Tailwind CSS** for styling, driven by the design tokens in §7 (`tailwind.config.ts` `theme.extend`
  should literally encode those tokens — don't hardcode hex values in components).
- **Recharts** for time-series line charts, area charts (slice utilization over time), and the citywide
  AQI trend chart. (Reason: zero-config, SVG-based, easy to theme, well documented — an implementing
  agent will have the least trouble here.)
- **Zustand** for client state (one small store, sliced by domain: `zones`, `alerts`, `networkStats`,
  `topology`, `config`, `ui`). Do not reach for Redux; this app does not need it.
- A single hook, `useNetworkSocket()`, owns the WebSocket connection: connects on mount, handles
  reconnect-with-exponential-backoff (cap at ~10s), dispatches incoming messages into the Zustand store
  by `type`, exposes a `send()` for outgoing control messages, and exposes a `connectionStatus`
  (`"connecting" | "live" | "reconnecting" | "offline"`) that the UI surfaces (see §5.1, top bar).
- Routing: this is a single dashboard, not a multi-page app — use in-page view switching (tabs), not
  a router library, unless you also build the Reports view as a distinct route for deep-linking (nice
  to have, not required).

### 3.3 Why this split (context for your decisions, not to be repeated to the user)

The v1 grading rubric line "Communication/Networking Integration" is best served by an architecture
where there is an actual wire protocol between two processes carrying the simulated telemetry — it lets
you legitimately show a Network tab in devtools with real WebSocket frames going by, which is a far more
convincing live demo moment than a single HTML file. It also happens to be the natural way to add
history, multi-client support, and a config panel that doesn't fight the render loop.

---

## 4. The simulation engine (server/src/engine) — carry forward v1's model, then extend it

Port the logic from `legacy/app.js` (`tick()`, `updateZoneReading`, `updateZoneStatus`,
`resolveNetworkTick`, the AQI color/severity math) into TypeScript modules, then extend as follows.
Keep every constant/threshold from v1 unless a change is specified below — they were chosen deliberately
(see v1's `README.md` "What is actually simulated" table) and should not be casually altered.

### 4.1 Zones

- Keep the 24 named zones from v1 (`ZONE_NAMES` in `legacy/app.js`) as the default city.
- Give each zone **stable lat/lng-style coordinates** (just arbitrary 0–1000 x/y is fine, doesn't need
  to be real geography) so the client can render them as a real spatial map instead of a CSS grid — see
  §5.2. Keep the coordinates roughly clustered so a couple of "districts" naturally emerge visually.
- Each zone gets a **home base station** assignment (see §4.3).

### 4.2 Multi-tier network slicing (upgrade from v1's 2-tier priority/normal)

Replace v1's binary priority/normal split with **three tiers**, closer to real 5G slice categories:

| Tier | Trigger | Analogue | Reserved capacity | Report interval |
|---|---|---|---|---|
| `critical` | AQI > 200 or noise > 100 dB | URLLC (ultra-reliable low-latency) | guaranteed first | 1s |
| `elevated` | AQI 150–200 or noise 85–100 dB | mid-priority slice | reserved pool, served after critical | 3s |
| `standard` | below both | eMBB (best-effort) | shares remaining capacity | 6s |

A zone's tier is recomputed every tick exactly like v1's danger check, with the same hysteresis/cooldown
principle (require N consecutive ticks back under threshold before downgrading a tier, to avoid flapping
— reuse v1's `COOLDOWN_TICKS` idea per tier).

Channel resolution each tick: serve `critical` fully first (this tier must never be starved — if it
ever would be, that's worth surfacing as its own alert, e.g. "critical slice overloaded"), then
`elevated` up to its reserved allocation, then `standard` with whatever capacity remains; anything left
over queues for one tick or is dropped and counted, exactly like v1's `resolveNetworkTick`, just with
three buckets instead of two.

### 4.3 Base stations / edge nodes + handover

Add **3–4 base stations** ("gNodeBs") positioned across the zone map, each covering a cluster of nearby
zones. Every zone has a `currentStation`. On each tick, if the simulated signal quality to a
non-home station would be meaningfully better (you can model this crudely — e.g. a random small drift
in per-zone signal quality per station, or simply: if a station is at >90% utilization, zones at its
edge probabilistically hand over to a neighboring station with spare capacity), flip `currentStation`
and emit a `handover` event. This gives you a legitimate second networking concept to narrate in the
demo ("watch this zone hand over to the harbor tower when the downtown tower gets congested") and a
second thing to visualize (see §5.4).

### 4.4 Scenarios (replaces / extends v1's single "Inject Incident" button)

Keep organic random incidents (v1's `maybeInjectSpontaneous`), but add **named, scripted scenarios**
the presenter can trigger on demand, each affecting a specific set of zones over a defined time course
(not an instant spike — ramp up, hold, decay, so it's watchable):

- **"Factory Leak — Industrial Zone"**: AQI in Industrial Zone + neighbors ramps to ~280 over 10s, holds
  ~20s, decays over 30s.
- **"Rush Hour"**: noise rises across all zones tagged `district: downtown-cluster` for ~45s, a few
  crossing 85 dB.
- **"Storm Front"**: AQI briefly *drops* citywide (rain clears particulates) — good for showing the
  system also correctly de-escalates and releases priority slices.
- **"Stadium Event"**: one zone gets a sustained noise spike (concert/game) for a long hold period —
  good for demonstrating a zone staying in a tier for a while, not just flashing once.

Expose these as `POST /api/scenarios/:id/trigger`; the client's Scenario panel (§5.5) is just buttons
calling this endpoint. Log a `scenario_started` ticker/alert entry when one fires.

### 4.5 Runtime-tunable config

Move these from hardcoded constants (v1) to a mutable config object, editable via `POST /api/config`
and the client's Settings/Admin panel (§5.6):

`aqiDangerThreshold`, `aqiCriticalThreshold`, `noiseDangerThreshold`, `noiseCriticalThreshold`,
`channelCapacity`, `criticalReserve`, `elevatedReserve`, `connectionMode (5G|6G)`, `simulationSpeed (1|2|4)`.

Changing config should take effect on the next tick and broadcast to all clients so multiple open
dashboards (e.g. presenter's laptop + a projector tab) stay in sync.

---

## 5. Frontend features & layout

Top-level layout: a fixed top bar, a left-hand primary nav (icons: Dashboard, Topology, Alerts &
Reports, Settings), and a main content area per view. This is a real IA, not one long scrolling page
like v1.

### 5.1 Top bar (present on every view)

- Product mark + "SIMULATED DEMO" badge (carry forward from v1 — keep being explicit that this is
  synthetic data).
- **Connection status pill**: live dot + label reflecting `useNetworkSocket()`'s `connectionStatus`
  (green "Live" / amber "Reconnecting…" / red "Offline"). This alone is worth a lot visually — it proves
  to a judge this is a real socket, not a canned animation.
- Global KPI chips: total sensors, zones in `critical`/`elevated`, citywide avg AQI with trend arrow.

### 5.2 Dashboard view (primary/default view)

- **Spatial city map**, not a CSS grid: an SVG canvas that places each zone at its `(x, y)` coordinate
  (§4.1), draws faint connective lines from each zone to its `currentStation` (§4.3), and renders each
  zone as a pin whose fill is the same AQI green→red interpolation as v1 (`aqiToRGB`, port it as-is —
  it's already correct) and whose pulse animation speed is driven by severity, also ported from v1.
  Add a **noise indicator** distinct from the AQI fill — v1 buried this as tiny text; give it a small
  secondary ring or bar so noise-only crossings are visually legible without opening the drawer.
  **Accessibility requirement**: don't rely on hue alone — vary pin *size* or add a small icon (e.g. a
  warning triangle) at `elevated`/`critical` tiers so colorblind viewers and grayscale printouts of a
  poster can still read zone status.
  Base stations are drawn as tower icons with a small utilization ring around them.
- Clicking a zone opens the **Zone Drawer** (slide-over panel): live AQI + noise with trend arrows,
  a real Recharts line chart of the last N minutes (pull from `GET /api/zones/:id/history`), current
  tier + report interval + assigned base station, and the zone's own recent alerts.
- **Network Health panel** (right side or below map): per-tier utilization (small gauges/donuts for
  critical/elevated/standard), a live area chart of throughput (Mbps) over time, average latency per
  tier (numeric, colored), dropped-reading counter. This is the direct, richer replacement for v1's
  stats strip.
- **Alert ticker**, redesigned: a real feed (not just a `<ul>`) with severity-colored left border (reuse
  v1's critical/warning/info/net taxonomy, add a 4th for `handover`/network events if useful),
  timestamp, zone name, a small icon per kind, and a filter row (All / Critical / Elevated / Network).
  Auto-scrolls on new entries but pauses auto-scroll while the user's mouse is over it (don't fight the
  user reading something).

### 5.3 Topology view

A dedicated view showing: base stations as nodes, zones as leaves connected to their current station,
a stacked area chart of slice allocation (critical/elevated/standard) over the last few minutes per
station, and a scrolling handover event log. This is where "network slicing" and "handover" — the two
networking concepts this spec adds beyond v1 — get their own dedicated, explainable screen.

### 5.4 Alerts & Reports view

A filterable, sortable table of all alerts (zone, tier, metric, value, timestamp, resolved/active),
backed by `GET /api/alerts`. Include a **CSV export** button (`GET /api/export/incidents.csv`, triggers
a browser download) — this satisfies "reporting" as a feature without needing a PDF library. Include a
small summary chart: incident count per zone (bar chart), so a judge can ask "which zone is worst" and
you can answer instantly.

### 5.5 Scenario / Incident Control panel

Accessible from the Dashboard view (a collapsible side panel or a button in the top bar that opens a
drawer) — buttons for each named scenario in §4.4, plus the existing free-form "Inject Incident" for a
random zone, plus a toggle for organic random incidents (off while presenting a scripted scenario, so
it doesn't compete for attention; on for the "look, it runs itself" moment).

### 5.6 Settings / Admin panel

5G/6G toggle, simulation speed, and the runtime config sliders from §4.5 (threshold values, channel
capacity, reserved slots) with live numeric readouts — changing a slider should visibly change behavior
within a couple of ticks, which is itself a good demo beat ("watch what happens if I shrink the
channel capacity while three zones are critical").

---

## 6. What must be materially better than v1 (do not ship a reskin)

If you find yourself just recoloring v1's grid tiles and calling it done, you have not met this spec.
Concretely, v2 must add all of the following, each independently checkable:

1. Real client/server WebSocket streaming (inspectable in browser devtools Network tab).
2. Persisted history with real per-zone time-series charts (not just the one citywide sparkline v1 had).
3. Three-tier slicing + at least 2 base stations with visible handover — not just priority/normal.
4. At least 3 named, scripted scenarios with a ramp/hold/decay time course — not just instant spikes.
5. A zone drill-down (drawer/modal) with its own chart and history.
6. A runtime-editable config panel that visibly changes simulation behavior without a restart.
7. A filterable alert log + CSV export.
8. A written design system (`docs/DESIGN.md`) actually reflected in Tailwind tokens, not ad hoc styling.
9. `legacy/` still runs standalone as a fallback with zero setup.

---

## 7. Design system (author `docs/DESIGN.md`, then encode as Tailwind tokens)

Keep v1's dark "network operations center" aesthetic — it was correct for this domain — but formalize
it instead of hardcoding hex values inline:

- **Palette**: base background near-black navy (`#080b13` family, as v1 used), panel surfaces one or two
  steps lighter, a single accent cyan (`#38bdf8`) for "network/live" affordances, a violet secondary
  accent for priority/critical network chrome (distinct from the AQI red, so "this is dangerous
  pollution" and "this is a network-priority indicator" read as different signals, not the same red).
  AQI scale stays green→yellow→orange→red→purple exactly as v1's `AQI_STOPS` (it's a recognizable,
  correct EPA-like scale — don't reinvent it).
- **Type**: a real type scale (e.g. 11/12/14/16/20/28px) with one sans for UI text and the existing
  monospace for all numeric/telemetry values (v1 already did this — keep it, it reads as "instrument
  panel" and is a nice detail worth preserving).
- **Motion**: consistent easing/duration tokens for pulse, packet-flow, drawer slide-in, ticker-item
  entry — reuse v1's pulse-speed-by-severity idea but define the min/max durations as tokens, not magic
  numbers scattered across components.
- **Components to formalize**: KPI chip, status pill (connection status), severity badge, gauge/donut,
  zone pin, ticker item, card/panel, drawer, button (primary/secondary/danger), segmented control (5G/6G,
  speed) — v1 already has visual versions of most of these; turn them into real reusable React
  components with props instead of one-off markup.
- Light theme is optional/nice-to-have; dark is the primary, judged theme — don't spend budget on light
  mode until everything above is done.

---

## 8. Risk / fallback plan

- Keep `legacy/` exactly as-is and never let it rot — if `npm install` fails on a judge's machine, or
  Wi-Fi/permissions cause a weird native-module problem with `better-sqlite3`, you can still open
  `legacy/index.html` directly with zero setup and still meet the brief. If you're worried about
  native bindings, use `lowdb` (pure JS/JSON file) instead of `better-sqlite3` — slightly less robust
  under concurrent writes, entirely fine for a single-presenter demo, and removes a whole class of
  "doesn't build on this laptop" risk. Prefer `lowdb` unless you have a specific reason not to.
- If the WebSocket reconnect logic has any edge cases left, make sure the **first** connection attempt
  on page load is rock solid — that's the one that happens in front of judges.

## 9. How this must run (document in README.md)

```bash
npm install        # installs root + workspaces (client, server)
npm run dev         # starts server (ws + REST) and client (Vite) together via concurrently
```

Update the root `README.md`: keep a "Legacy static demo" section pointing at `legacy/index.html` with
its original one-line run instructions, and add a new primary "Run the full dashboard" section with the
above. Update the rubric-alignment table to reflect the richer feature set (multi-tier slicing,
handover, history, scenarios, admin config, CSV export) — the existing table in the current
`README.md` is a good template, extend it rather than replacing its structure.

---

## 10. WebSocket / REST protocol — author `docs/PROTOCOL.md` with at least this content

Define every message as a discriminated union on a `type` field, e.g.:

```ts
type ServerMessage =
  | { type: "snapshot"; zones: Zone[]; stations: Station[]; config: Config; networkStats: NetworkStats }
  | { type: "reading"; zoneId: string; aqi: number; noise: number; tier: Tier; ts: number }
  | { type: "alert"; id: string; zoneId: string; kind: "threshold_up" | "threshold_down" | "congestion" | "scenario"; severity: "info" | "warning" | "critical"; message: string; ts: number }
  | { type: "handover"; zoneId: string; fromStation: string; toStation: string; ts: number }
  | { type: "network_stats"; utilizationByTier: Record<Tier, number>; latencyByTier: Record<Tier, number>; throughputMbps: number; dropped: number; ts: number }
  | { type: "scenario_started"; scenarioId: string; label: string; ts: number }
  | { type: "config_changed"; config: Config };

type ClientMessage =
  | { type: "set_speed"; speed: 1 | 2 | 4 }
  | { type: "set_connection_mode"; mode: "5G" | "6G" }
  | { type: "trigger_incident"; zoneId?: string };   // omit zoneId => random zone, matches v1 button
```

Document each REST endpoint from §3–5 (`GET /api/zones`, `GET /api/zones/:id/history`, `GET
/api/alerts`, `POST /api/scenarios/:id/trigger`, `GET/POST /api/config`, `GET
/api/export/incidents.csv`) with method, params, and example JSON response. An implementing agent
picking up work on the client alone should be able to build against `docs/PROTOCOL.md` without reading
server source.

---

## 11. Suggested build order (phases — commit at the end of each)

1. **Scaffold**: `git mv` v1 into `legacy/`, set up npm workspaces root, empty `server/` and `client/`
   apps that boot ("hello world" WebSocket echo + a blank Vite page), `npm run dev` works end to end.
2. **Engine port**: move v1's simulation logic into `server/src/engine`, typed, unit-testable, ticking
   server-side, printing to console — no client yet.
3. **Protocol + basic client**: implement `useNetworkSocket`, Zustand store, and a bare-bones
   dashboard that just lists zones with live-updating numbers — prove the wire end to end before
   investing in visuals.
4. **Map + heat-map + pulses + ticker**: port v1's visual language into React/Tailwind components on
   top of the real data (§5.2).
5. **History + Zone Drawer + charts** (§5.2, §10 history endpoint).
6. **Multi-tier slicing + base stations + handover + Topology view** (§4.2–4.3, §5.3).
7. **Scenarios + Scenario panel** (§4.4, §5.5).
8. **Runtime config + Settings panel** (§4.5, §5.6).
9. **Alerts & Reports view + CSV export** (§5.4).
10. **Design pass**: author `docs/DESIGN.md`, encode tokens in Tailwind, sweep every component for
    consistency, accessibility pass (§5.2's colorblind requirement), motion polish.
11. **README + protocol docs finalized, fallback (`legacy/`) re-verified working, full run-through of
    the demo script** (adapt v1 README's demo script to the new views).

Do not skip ahead to polish before §11.3 (wire proven end-to-end) — a beautiful UI with a broken socket
is a worse demo than v1.
