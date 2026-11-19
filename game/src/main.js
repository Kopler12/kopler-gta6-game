// SAN VERANO: Neon Coast — main loop, entities, AI, combat, HUD, minimap, save.
// Original top-down open-world crime game. Canvas art + WebAudio synth only.
import { buildWorld, mulberry, WORLD_W, WORLD_H, TILE } from './world.js';
import { AudioSys } from './audio.js';
import { MISSIONS, CHARACTERS, SIDE_INFO } from './missions.js';

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || '7', 10) || 7;

let W = 1280, H = 720;
function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
addEventListener('resize', resize); resize();

const world = buildWorld(SEED);
const audio = new AudioSys();
const keys = {};
let mouse = { x: 0, y: 0, down: false };
addEventListener('keydown', e => {
  keys[e.code] = true; audio.ensure();
  if (e.code === 'KeyM') audio.muted = !audio.muted;
  if ((e.code === 'Escape' || e.code === 'KeyP') && (state.mode === 'play' || state.mode === 'pause')) state.mode = state.mode === 'play' ? 'pause' : 'play';
  if (e.code === 'Enter' && state.dialogue) advanceDialogue();
});
addEventListener('keyup', e => keys[e.code] = false);
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('mousedown', e => { mouse.down = true; audio.ensure(); });
addEventListener('mouseup', () => mouse.down = false);
cv.addEventListener('click', e => handleClick(e.clientX, e.clientY));

const CAR_COLORS = ['#e63946','#457b9d','#f4a261','#2a9d8f','#e9c46a','#9b5de5','#f15bb5','#00bbf9','#adb5bd','#264653','#ff6b35','#6a994e'];
const rng = mulberry(SEED * 31 + 5);

function gridPos(gx, gy) { return { x: 160 + gx * TILE + 80, y: 160 + gy * TILE + 80 }; }
function nearestRoadPt(x, y) {
  let best = null, bd = 1e18;
  for (const rx of world.vRoads) { const d = Math.abs(x - rx); if (d < bd) { bd = d; best = { x: rx, y }; } }
  for (const ry of world.hRoads) { const d = Math.abs(y - ry); if (d < bd) { bd = d; best = { x, y: ry }; } }
  return best;
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// ---------- State ----------
const SAVE_KEY = 'sanverano-save-v1';
let state;
function freshState() {
  const sp = gridPos(1, 8);
  return {
    mode: SHOT ? 'play' : 'title', time: 17.4, day: 1, cash: 120, mode2: '',
    px: sp.x, py: sp.y, pa: -Math.PI / 2, php: 100, armor: 0,
    weapon: 'pistol', ammo: { pistol: 48, smg: 0 }, hasSMG: false,
    wanted: 0, wantedHeat: 0, hiddenTimer: 0, missionIdx: 0,
    mission: null, taxi: null, shake: 0, msg: '', msgT: 0,
    dialogue: null, dlgIdx: 0, dead: null, stats: { stolen: 0, fares: 0, kills: 0 },
  };
}
state = freshState();

function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: state.cash, missionIdx: state.missionIdx, px: state.px, py: state.py, day: state.day, hasSMG: state.hasSMG, ammo: state.ammo, stats: state.stats })); } catch (e) {}
}
function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (!s) return false;
    state.cash = s.cash; state.missionIdx = s.missionIdx; state.px = s.px; state.py = s.py; state.day = s.day || 1;
    state.hasSMG = !!s.hasSMG; state.ammo = s.ammo || state.ammo; state.stats = s.stats || state.stats;
    player.x = state.px; player.y = state.py; return true;
  } catch (e) { return false; }
}

// ---------- Entities ----------
const player = { x: state.px, y: state.py, angle: -Math.PI / 2, speed: 0, health: 100, car: null, fireCd: 0, punchCd: 0, walkPhase: 0 };
let cars = [], peds = [], cops = [], bullets = [], particles = [], pickups = [], skids = [], floaters = [];

function makeCar(x, y, opts = {}) {
  const onV = world.vRoads.some(rx => Math.abs(x - rx) < 30);
  return {
    x, y, angle: opts.angle ?? (onV ? (rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() > 0.5 ? 0 : Math.PI)),
    speed: 0, color: opts.color || CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)],
    health: 100, driver: opts.driver ?? true, parked: !!opts.parked, police: !!opts.police,
    ai: opts.parked ? 'parked' : 'traffic', targetSpeed: 110 + rng() * 70, turnCd: 0, stuck: 0, wob: rng() * 10,
    scarlet: !!opts.scarlet, dead: false,
  };
}
function spawnTraffic(n) {
  for (let i = 0; i < n; i++) {
    const vert = rng() > 0.5;
    const road = vert ? world.vRoads[1 + Math.floor(rng() * (world.vRoads.length - 2))] : world.hRoads[1 + Math.floor(rng() * (world.hRoads.length - 2))];
    const t = 200 + rng() * (WORLD_W - 500);
    const c = vert ? makeCar(road + 14, t) : makeCar(t, road + 14);
    if (dist(c, player) > 260) cars.push(c);
  }
}
function spawnParked(n) {
  for (let i = 0; i < n; i++) {
    const b = world.buildings[Math.floor(rng() * world.buildings.length)];
    const c = makeCar(b.x + b.w / 2, b.y - 14, { parked: true, driver: false, angle: 0 });
    c.y = Math.max(60, c.y); cars.push(c);
  }
}
function makePed(x, y) {
  return { x, y, angle: rng() * 6.28, speed: 26 + rng() * 22, health: 40, state: 'walk', scared: 0, cop: false, dead: false, color: CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)], skin: ['#f1c27d', '#e0ac69', '#8d5524', '#ffdbac'][Math.floor(rng() * 4)], tx: x, ty: y, retarget: 0 };
}
function spawnPeds(n) {
  for (let i = 0; i < n; i++) {
    const p = nearestRoadPt(200 + rng() * (WORLD_W - 400), 200 + rng() * (WORLD_H - 400));
    peds.push(makePed(p.x + (rng() > 0.5 ? 38 : -38), p.y + (rng() > 0.5 ? 38 : -38)));
  }
}
function spawnPickups() {
  const spots = [[3, 2], [6, 5], [10, 8], [2, 6], [8, 2], [11, 4], [5, 9], [12, 7]];
  for (const [gx, gy] of spots) { const p = gridPos(gx, gy); pickups.push({ x: p.x + 30, y: p.y, type: rng() > 0.5 ? 'ammo' : 'health', bob: rng() * 6 }); }
  const smg = gridPos(9, 6); pickups.push({ x: smg.x, y: smg.y, type: 'smg', bob: 0 });
  for (let i = 0; i < 6; i++) { const p = gridPos(1 + Math.floor(rng() * 12), 1 + Math.floor(rng() * 9)); pickups.push({ x: p.x, y: p.y, type: 'crate', bob: rng() * 6, val: 60 + Math.floor(rng() * 80) }); }
}
spawnTraffic(26); spawnParked(16); spawnPeds(34); spawnPickups();

// ---------- Wanted / crime ----------
function crime(amount, seen = true) {
  if (!seen && state.wanted === 0) return;
  state.wantedHeat = Math.min(5, state.wantedHeat + amount);
  state.wanted = Math.max(state.wanted, Math.min(5, Math.ceil(state.wantedHeat)));
}
function addFloater(x, y, text, color = '#ffd166') { floaters.push({ x, y, text, color, t: 1.6 }); }
function addCash(n, x, y) { state.cash += n; if (x) addFloater(x, y - 20, '+$' + n); audio.cash(); }

// ---------- Missions ----------
const MISSION_SPOTS = {
  m1: { giver: [1, 8], target: [11, 2] }, m2: { giver: [5, 4], target: [8, 7], back: [5, 4] },
  m3: { giver: [6, 6] }, m4: { giver: [12, 5], target: [12, 5] },
  m5: { giver: [3, 3], target: [12, 1] }, m6: { giver: [5, 4], target: [10, 9] },
};
function missionMarker() {
  const m = state.mission; if (!m) {
    if (state.missionIdx >= MISSIONS.length) return null;
    const def = MISSIONS[state.missionIdx]; const s = MISSION_SPOTS[def.id];
    const g = gridPos(s.giver[0], s.giver[1]); return { x: g.x, y: g.y - 60, label: def.giver.toUpperCase(), kind: 'giver' };
  }
  return m.marker;
}
function startDialogue(lines, onDone) { state.dialogue = { lines, idx: 0, onDone }; }
function advanceDialogue() {
  const d = state.dialogue; if (!d) return;
  d.idx++;
  if (d.idx >= d.lines.length) { const cb = d.onDone; state.dialogue = null; if (cb) cb(); }
}
function beginMission() {
  const def = MISSIONS[state.missionIdx]; if (!def) return;
  startDialogue(def.intro, () => activateMission(def));
}
function activateMission(def) {
  const s = MISSION_SPOTS[def.id];
  const m = { def, phase: 0, timer: 0, kills: 0, targetCar: null };
  if (def.type === 'drive' || def.type === 'timed') { const t = gridPos(s.target[0], s.target[1]); m.marker = { x: t.x, y: t.y, label: 'DESTINATION', kind: 'goal' }; if (def.type === 'timed') m.timer = 90; }
  if (def.type === 'pickup') { const t = gridPos(s.target[0], s.target[1]); m.marker = { x: t.x, y: t.y, label: 'THE CRATE', kind: 'goal' }; }
  if (def.type === 'chase') {
    const p = gridPos(9, 3); const c = makeCar(p.x, p.y, { color: '#d90429', scarlet: true }); c.ai = 'flee'; cars.push(c); m.targetCar = c;
    m.marker = { x: c.x, y: c.y, label: 'STOP THE ROADSTER', kind: 'goal' };
  }
  if (def.type === 'shootout') {
    const t = gridPos(s.target[0], s.target[1]);
    for (let i = 0; i < 4; i++) { const e = makePed(t.x + (rng() - 0.5) * 160, t.y + (rng() - 0.5) * 160); e.state = 'hostile'; e.health = 60; peds.push(e); }
    m.marker = { x: t.x, y: t.y, label: 'CLEAR THE BEACH', kind: 'goal' };
  }
  if (def.type === 'finale') { const t = gridPos(s.target[0], s.target[1]); m.marker = { x: t.x, y: t.y, label: 'VAULT DROP', kind: 'goal' }; crime(2); }
  state.mission = m;
  state.msg = 'MISSION: ' + def.title; state.msgT = 4;
}
function completeMission() {
  const m = state.mission; if (!m) return;
  addCash(m.def.reward, player.x, player.y);
  startDialogue([m.def.outro], null);
  state.mission = null; state.missionIdx++;
  saveGame();
}
function failMission(reason) {
  state.msg = 'MISSION FAILED — ' + reason + ' (return to the marker to retry)'; state.msgT = 5;
  if (state.mission && state.mission.targetCar) { state.mission.targetCar.dead = true; }
  state.mission = null;
}
function objectiveText() {
  const m = state.mission;
  if (state.dialogue) return 'Press ENTER to continue…';
  if (!m) {
    if (state.taxi) return state.taxi.phase === 0 ? 'TAXI: reach the passenger' : 'TAXI: drive the passenger to the gold ring';
    if (state.missionIdx >= MISSIONS.length) return 'Story complete! Free roam — run taxi fares & crates.';
    const def = MISSIONS[state.missionIdx];
    return 'Go to ' + CHARACTERS[def.giver].name + ' — "' + def.title + '"';
  }
  const d = m.def;
  if (d.type === 'drive') return d.title + ': reach the destination ring';
  if (d.type === 'timed') return d.title + ': reach Hotel Luna gate in ' + Math.ceil(m.timer) + 's';
  if (d.type === 'pickup') return m.phase === 0 ? d.title + ': grab the crate (walk over it)' : d.title + ': return the crate to El Faro';
  if (d.type === 'chase') return d.title + ': stop the scarlet roadster (ram or shoot it)';
  if (d.type === 'shootout') return d.title + ': clear the dealers (' + m.kills + '/4)';
  if (d.type === 'finale') return m.phase === 0 ? d.title + ': reach the vault drop' : d.title + ': lose the wanted heat!';
  return d.title;
}
function updateMission(dt) {
  const m = state.mission; if (!m) return;
  const d = m.def, mk = m.marker;
  if (d.type === 'chase' && m.targetCar) { mk.x = m.targetCar.x; mk.y = m.targetCar.y; if (m.targetCar.health <= 0 || m.targetCar.dead) completeMission(); return; }
  if (d.type === 'timed') { m.timer -= dt; if (m.timer <= 0) { failMission('out of time'); return; } }
  if (mk && dist(player, mk) < 55) {
    if (d.type === 'drive' || d.type === 'timed') completeMission();
    else if (d.type === 'pickup') {
      if (m.phase === 0) { m.phase = 1; const b = gridPos(MISSION_SPOTS.m2.back[0], MISSION_SPOTS.m2.back[1]); m.marker = { x: b.x, y: b.y - 60, label: 'EL FARO', kind: 'goal' }; state.msg = 'Crate secured — bring it back!'; state.msgT = 3; }
      else completeMission();
    } else if (d.type === 'finale') {
      if (m.phase === 0) { m.phase = 1; crime(2.2); state.msg = 'Ledger dropped! Now lose the heat!'; state.msgT = 3; }
    }
  }
  if (d.type === 'finale' && m.phase === 1 && state.wanted === 0) completeMission();
  if (d.type === 'shootout' && m.kills >= 4) completeMission();
}

// ---------- Taxi side activity ----------
function updateTaxi(dt) {
  if (!state.taxi && rng() < dt * 0.02 && !state.mission) {
    const p = gridPos(1 + Math.floor(rng() * 12), 1 + Math.floor(rng() * 9));
    state.taxi = { phase: 0, px: p.x, py: p.y, dx: 0, dy: 0, fare: 80 + Math.floor(rng() * 120) };
  }
  const t = state.taxi; if (!t) return;
  if (t.phase === 0 && dist(player, t) < 60) {
    t.phase = 1; const dpt = gridPos(1 + Math.floor(rng() * 12), 1 + Math.floor(rng() * 9)); t.dx = dpt.x; t.dy = dpt.y;
    state.msg = 'Passenger aboard — go go go!'; state.msgT = 2.5;
  } else if (t.phase === 1 && Math.hypot(player.x - t.dx, player.y - t.dy) < 65) {
    addCash(t.fare, player.x, player.y); state.stats.fares++; state.taxi = null;
    state.msg = 'Fare complete!'; state.msgT = 2.5; saveGame();
  }
}

// ---------- Combat ----------
function shoot(from, angle, kind, hostile) {
  const sp = kind === 'smg' ? 620 : 540;
  bullets.push({ x: from.x + Math.cos(angle) * 16, y: from.y + Math.sin(angle) * 16, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, life: 0.55, hostile: !!hostile, dmg: kind === 'smg' ? 12 : 22 });
  for (let i = 0; i < 3; i++) particles.push({ x: from.x + Math.cos(angle) * 18, y: from.y + Math.sin(angle) * 18, vx: Math.cos(angle) * 60 + (rng() - 0.5) * 60, vy: Math.sin(angle) * 60 + (rng() - 0.5) * 60, life: 0.12, color: '#ffd60a', size: 3 });
  audio.shoot(kind);
}
function hurtPlayer(dmg) {
  player.health -= dmg; state.shake = Math.min(10, state.shake + 3);
  if (player.health <= 0 && !state.dead) { state.dead = 'wasted'; state.mode = 'over'; }
}
function burst(x, y, color, n = 8, speed = 120) {
  for (let i = 0; i < n; i++) { const a = rng() * 6.28; particles.push({ x, y, vx: Math.cos(a) * speed * rng(), vy: Math.sin(a) * speed * rng(), life: 0.3 + rng() * 0.4, color, size: 2 + rng() * 3 }); }
}

// ---------- Police ----------
let copTimer = 0, sirenT = 0;
function updatePolice(dt) {
  sirenT += dt;
  const wantCops = state.wanted >= 1 ? Math.min(6, state.wanted + 1) : 0;
  copTimer -= dt;
  const aliveCops = cops.filter(c => !c.dead);
  if (aliveCops.length < wantCops && copTimer <= 0) {
    copTimer = 2.2;
    const a = rng() * 6.28, d = 520;
    const p = nearestRoadPt(player.x + Math.cos(a) * d, player.y + Math.sin(a) * d);
    if (state.wanted >= 3 || rng() > 0.4) {
      const c = makeCar(p.x, p.y, { police: true, color: '#1d3557' }); c.ai = 'cop'; cars.push(c); cops.push(c);
    } else {
      const cp = makePed(p.x, p.y); cp.cop = true; cp.state = 'chase'; cp.health = 70; peds.push(cp); cops.push(cp);
    }
  }
  if (state.wanted > 0 && sirenT > 0.45) { sirenT = 0; if (cops.some(c => !c.dead && dist(c, player) < 700)) audio.sirenTick(performance.now() / 1000); }
  // decay when unseen
  const seen = cops.some(c => !c.dead && dist(c, player) < 330) || cars.some(c => c.police && !c.dead && dist(c, player) < 330);
  if (!seen && state.wanted > 0) { state.hiddenTimer += dt; if (state.hiddenTimer > 6) { state.wantedHeat = Math.max(0, state.wantedHeat - dt * 0.25); state.wanted = Math.floor(state.wantedHeat); if (state.wanted === 0) state.wantedHeat = 0; } }
  else state.hiddenTimer = 0;
  // busted check: cop close while on foot & slow
  if (!player.car && state.wanted > 0) {
    for (const c of cops) if (!c.dead && c.cop && dist(c, player) < 26) { state.dead = 'busted'; state.mode = 'over'; }
  }
}
function respawn() {
  const at = state.dead === 'busted' ? world.policeSt : world.hospital;
  const pen = Math.min(state.cash, 150 + state.wanted * 100);
  state.cash -= pen; state.wanted = 0; state.wantedHeat = 0;
  player.health = 100; player.car = null; player.x = at.x; player.y = at.y + 40;
  for (const c of cops) c.dead = true; cops = [];
  cars = cars.filter(c => !c.police);
  state.dead = null; state.mode = 'play'; saveGame();
}

// ---------- Update ----------
let cam = { x: player.x, y: player.y };
function update(dt) {
  if (state.mode !== 'play') return;
  state.time += dt * 0.012; if (state.time >= 24) { state.time -= 24; state.day++; }
  if (state.msgT > 0) state.msgT -= dt;
  audio.update(dt, !!player.car);
  const sprint = keys.ShiftLeft || keys.ShiftRight;

  // --- player on foot / in car ---
  if (player.car) {
    const c = player.car;
    const up = keys.KeyW || keys.ArrowUp, down = keys.KeyS || keys.ArrowDown;
    const left = keys.KeyA || keys.ArrowLeft, right = keys.KeyD || keys.ArrowRight;
    const hb = keys.Space;
    if (up) c.speed += 260 * dt; if (down) c.speed -= (c.speed > 10 ? 320 : 140) * dt;
    c.speed -= c.speed * (hb ? 2.2 : 0.7) * dt;
    c.speed = Math.max(-110, Math.min(300, c.speed));
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    if (Math.abs(c.speed) > 4) c.angle += steer * 1.9 * dt * Math.sign(c.speed) * Math.min(1, Math.abs(c.speed) / 120);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt, ny = c.y + Math.sin(c.angle) * c.speed * dt;
    const col = world.collideCircle(nx, ny, 15);
    if (col.hit && Math.abs(c.speed) > 90) { c.health -= 9; state.shake = 8; audio.crash(); burst(c.x, c.y, '#faa307', 10); crime(0.15); }
    else if (col.hit) c.speed *= 0.4;
    c.x = col.x; c.y = col.y;
    if (world.isWater(c.x, c.y)) { c.health -= 40 * dt; c.speed *= 0.92; }
    if (hb && Math.abs(c.speed) > 60 && rng() > 0.4) skids.push({ x: c.x, y: c.y, a: c.angle, life: 6 });
    if (Math.abs(c.speed) > 30) audio.engine(c.speed);
    player.x = c.x; player.y = c.y; player.angle = c.angle;
    if (c.health < 35 && rng() > 0.6) particles.push({ x: c.x, y: c.y - 8, vx: (rng() - 0.5) * 20, vy: -40, life: 0.8, color: '#555', size: 5 });
    if (keys.KeyE) { keys.KeyE = false; player.car = null; c.driver = false; c.ai = 'parked'; c.parked = true; player.x = c.x + 26; player.y = c.y; }
  } else {
    let mx = 0, my = 0;
    if (keys.KeyW || keys.ArrowUp) my -= 1; if (keys.KeyS || keys.ArrowDown) my += 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
    const len = Math.hypot(mx, my) || 1;
    const sp = sprint ? 205 : 118;
    if (mx || my) { player.angle = Math.atan2(my, mx); player.walkPhase += dt * (sprint ? 13 : 9); }
    const nx = player.x + (mx / len) * sp * dt * (mx || my ? 1 : 0), ny = player.y + (my / len) * sp * dt * (mx || my ? 1 : 0);
    if (!world.isWater(nx, ny)) { const col = world.collideCircle(nx, ny, 10); player.x = col.x; player.y = col.y; }
    // enter car
    if (keys.KeyE) {
      keys.KeyE = false;
      let best = null, bd = 52;
      for (const c of cars) if (!c.dead && dist(c, player) < bd) { bd = dist(c, player); best = c; }
      if (best) {
        if (best.driver || best.ai === 'traffic') { crime(0.8); state.msg = 'Vehicle stolen!'; state.msgT = 2; }
        else if (best.parked && best.wasOwned !== true && rng() > 0.3) crime(0.45);
        best.driver = true; best.parked = false; best.ai = 'player'; player.car = best; state.stats.stolen++;
        audio.tone(180, 0.15, 'sawtooth', 0.06, 120);
      }
    }
    // punch
    player.punchCd -= dt;
    if ((keys.KeyF || mouse.down) && player.punchCd <= 0 && !mouse.down) { doPunch(); }
    if (keys.KeyF && player.punchCd <= 0) doPunch();
    // shooting
    player.fireCd -= dt;
    const wantFire = mouse.down;
    const rate = state.weapon === 'smg' ? 0.11 : 0.26;
    if (wantFire && player.fireCd <= 0) {
      if (state.ammo[state.weapon] > 0 || state.weapon === 'pistol' && state.ammo.pistol > 0) {
        if (state.ammo[state.weapon] > 0) {
          state.ammo[state.weapon]--;
          const wx = player.x + (cam.x ? 0 : 0), aim = Math.atan2((mouse.y + cam.y - H / 2) - player.y, (mouse.x + cam.x - W / 2) - player.x);
          shoot(player, aim + (state.weapon === 'smg' ? (rng() - 0.5) * 0.09 : 0), state.weapon, false);
          player.fireCd = rate; crime(0.35);
          for (const p of peds) if (dist(p, player) < 220) { p.scared = 3; p.state = 'flee'; }
        }
      }
    }
    if (keys.Digit1) state.weapon = 'pistol';
    if (keys.Digit2 && state.hasSMG) state.weapon = 'smg';
  }

  // giver interaction
  const mk0 = !state.mission ? missionMarker() : null;
  if (mk0 && mk0.kind === 'giver' && dist(player, mk0) < 46 && keys.KeyE) { keys.KeyE = false; beginMission(); }
  if (mk0 && mk0.kind === 'giver' && dist(player, mk0) < 46 && state.mode === 'play' && !player.car) {
    // auto-start dialogue when walking into marker with E handled above; also allow proximity prompt flag
  }

  updateMission(dt); updateTaxi(dt); updatePolice(dt);

  // --- traffic AI ---
  for (const c of cars) {
    if (c.dead || c === player.car) continue;
    if (c.ai === 'parked') continue;
    if (c.ai === 'cop') { updateCopCar(c, dt); continue; }
    if (c.ai === 'flee') { updateFleeCar(c, dt); continue; }
    // traffic: follow lane direction, slow near intersections & cars ahead
    let sp = c.targetSpeed;
    const aheadX = c.x + Math.cos(c.angle) * 46, aheadY = c.y + Math.sin(c.angle) * 46;
    for (const o of cars) if (o !== c && !o.dead && Math.hypot(o.x - aheadX, o.y - aheadY) < 30) sp = 0;
    if (player.car && Math.hypot(player.x - aheadX, player.y - aheadY) < 30) sp = 0;
    // intersection stop chance
    const nearCross = world.vRoads.some(rx => Math.abs(c.x - rx) < 34) && world.hRoads.some(ry => Math.abs(c.y - ry) < 34);
    c.turnCd -= dt;
    if (nearCross && c.turnCd <= 0 && rng() > 0.55) {
      c.turnCd = 3 + rng() * 3;
      const turn = rng();
      if (turn > 0.5) c.angle += (turn > 0.75 ? Math.PI / 2 : -Math.PI / 2);
      // snap to road
      const p = nearestRoadPt(c.x, c.y); if (Math.abs(p.x - c.x) < Math.abs(p.y - c.y)) c.x = p.x + (Math.cos(c.angle) > 0 || Math.sin(c.angle) !== 0 ? 14 * Math.sign(Math.sin(c.angle)) : 0); else c.y = p.y + 14 * Math.sign(Math.cos(c.angle) || 1);
    }
    c.speed += (sp - c.speed) * Math.min(1, dt * 2);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt, ny = c.y + Math.sin(c.angle) * c.speed * dt;
    const col = world.collideCircle(nx, ny, 14);
    if (col.hit) { c.speed = 0; c.angle += Math.PI / 2 * (rng() > 0.5 ? 1 : -1) * dt * 4; const p = nearestRoadPt(c.x, c.y); c.x += (p.x - c.x) * 0.1; c.y += (p.y - c.y) * 0.1; }
    else { c.x = col.x; c.y = col.y; }
    if (c.x < 40 || c.y < 40 || c.x > WORLD_W - 40 || c.y > WORLD_H - 40) { c.angle += Math.PI; }
  }
  cars = cars.filter(c => !c.dead);

  // --- peds ---
  for (const p of peds) {
    if (p.dead) continue;
    p.retarget -= dt;
    if (p.cop) { updateCopFoot(p, dt); continue; }
    if (p.state === 'hostile') {
      const d = dist(p, player);
      if (d > 130) { movePed(p, player.x, player.y, dt, 95); }
      else if (d < 60) movePed(p, p.x - (player.x - p.x), p.y - (player.y - p.y), dt, 60);
      p.fireCd = (p.fireCd || 0) - dt;
      if (d < 260 && p.fireCd <= 0) { p.fireCd = 0.9 + rng() * 0.5; shoot(p, Math.atan2(player.y - p.y, player.x - p.x) + (rng() - 0.5) * 0.15, 'pistol', true); }
      continue;
    }
    if (p.scared > 0) p.scared -= dt;
    if (p.state === 'flee' || p.scared > 0) {
      const away = Math.atan2(p.y - player.y, p.x - player.x);
      movePed(p, p.x + Math.cos(away) * 100, p.y + Math.sin(away) * 100, dt, 165);
      if (p.scared <= 0 && dist(p, player) > 260) p.state = 'walk';
      continue;
    }
    if (p.retarget <= 0) { p.retarget = 3 + rng() * 4; const rp = nearestRoadPt(p.x + (rng() - 0.5) * 300, p.y + (rng() - 0.5) * 300); p.tx = rp.x + (rng() > 0.5 ? 40 : -40); p.ty = rp.y + (rng() > 0.5 ? 40 : -40); }
    movePed(p, p.tx, p.ty, dt, p.speed);
    // run over check
    if (player.car && Math.abs(player.car.speed) > 40 && dist(p, player.car) < 17) { killPed(p, true); }
  }
  peds = peds.filter(p => !p.dead || p.deadT > -2);
  for (const p of peds) if (p.dead) p.deadT = (p.deadT || 0) - dt;

  // --- bullets ---
  for (const b of bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let hitWall = false;
    for (const s of world.solids) if (b.x > s.x && b.x < s.x + s.w && b.y > s.y && b.y < s.y + s.h) { hitWall = true; break; }
    if (hitWall) { b.life = 0; burst(b.x, b.y, '#ffd60a', 3, 60); continue; }
    if (b.hostile) {
      const tgt = player.car || player;
      if (Math.hypot(b.x - tgt.x, b.y - tgt.y) < (player.car ? 18 : 11)) { b.life = 0; if (player.car) { player.car.health -= 5; } else hurtPlayer(b.dmg * 0.55); burst(b.x, b.y, '#e63946', 4, 80); }
    } else {
      for (const p of peds) if (!p.dead && Math.hypot(b.x - p.x, b.y - p.y) < 11) {
        b.life = 0; p.health -= b.dmg; p.scared = 3;
        burst(b.x, b.y, '#e63946', 5, 90);
        if (p.health <= 0) killPed(p, false); else if (p.cop) crime(0.6); else crime(0.4);
        break;
      }
      if (b.life > 0) for (const c of cars) if (c !== player.car && !c.dead && Math.hypot(b.x - c.x, b.y - c.y) < 18) {
        b.life = 0; c.health -= b.dmg; burst(b.x, b.y, '#faa307', 5, 90);
        if (c.driver && c.ai === 'traffic') { c.ai = 'flee'; }
        if (c.police) crime(0.7); else crime(0.2);
        if (c.health <= 0) { c.dead = true; burst(c.x, c.y, '#333', 22, 160); audio.crash(); if (state.mission && state.mission.targetCar === c) { /* handled in mission update */ } }
        break;
      }
    }
  }
  bullets = bullets.filter(b => b.life > 0);

  // --- pickups ---
  for (const pk of pickups) {
    if (pk.taken) continue;
    const d = dist(pk, player);
    if (pk.type === 'crate') { if (player.car && d < 30) { pk.taken = true; addCash(pk.val, pk.x, pk.y); } continue; }
    if (d < 24) {
      pk.taken = true; audio.pickup();
      if (pk.type === 'health') { player.health = Math.min(100, player.health + 40); addFloater(pk.x, pk.y, '+HEALTH', '#95d5b2'); }
      if (pk.type === 'ammo') { state.ammo.pistol += 24; state.ammo.smg += 30; addFloater(pk.x, pk.y, '+AMMO', '#ffd166'); }
      if (pk.type === 'smg') { state.hasSMG = true; state.weapon = 'smg'; state.ammo.smg += 90; addFloater(pk.x, pk.y, 'SMG ACQUIRED!', '#ff7eb6'); state.msg = 'You picked up the SMG — press 2 to equip'; state.msgT = 3.5; }
    }
  }

  // particles / floaters / skids
  for (const pt of particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; }
  particles = particles.filter(p => p.life > 0);
  for (const f of floaters) { f.y -= 30 * dt; f.t -= dt; }
  floaters = floaters.filter(f => f.t > 0);
  for (const s of skids) s.life -= dt; skids = skids.filter(s => s.life > 0);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);

  // camera
  cam.x += (player.x - cam.x) * Math.min(1, dt * 5);
  cam.y += (player.y - cam.y) * Math.min(1, dt * 5);
}
function doPunch() {
  player.punchCd = 0.34; audio.punch();
  const tx = player.x + Math.cos(player.angle) * 24, ty = player.y + Math.sin(player.angle) * 24;
  for (const p of peds) if (!p.dead && Math.hypot(p.x - tx, p.y - ty) < 20) {
    p.health -= 18; p.scared = 3; p.state = 'flee'; burst(p.x, p.y, '#fff', 4, 70);
    if (p.health <= 0) killPed(p, false); else crime(0.3);
  }
}
function killPed(p, byCar) {
  if (p.dead) return;
  p.dead = true; p.deadT = 0; state.stats.kills++;
  burst(p.x, p.y, '#e63946', 12, 110);
  crime(p.cop ? 1.2 : 0.7);
  if (state.mission && state.mission.def.type === 'shootout' && p.state === 'hostile') state.mission.kills++;
  if (p.cop) { const i = cops.indexOf(p); if (i >= 0) cops.splice(i, 1); }
}
function movePed(p, tx, ty, dt, sp) {
  const a = Math.atan2(ty - p.y, tx - p.x);
  if (Math.hypot(tx - p.x, ty - p.y) < 6) return;
  p.angle = a;
  const nx = p.x + Math.cos(a) * sp * dt, ny = p.y + Math.sin(a) * sp * dt;
  if (!world.isWater(nx, ny)) { const c = world.collideCircle(nx, ny, 8); p.x = c.x; p.y = c.y; }
}
function updateCopCar(c, dt) {
  const d = dist(c, player);
  const tgtA = Math.atan2(player.y - c.y, player.x - c.x);
  let da = tgtA - c.angle; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
  c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, da * 2.4 * dt * 3));
  const want = d > 60 ? 265 : 60;
  c.speed += (want - c.speed) * Math.min(1, dt * 1.6);
  const nx = c.x + Math.cos(c.angle) * c.speed * dt, ny = c.y + Math.sin(c.angle) * c.speed * dt;
  const col = world.collideCircle(nx, ny, 15);
  if (col.hit) { c.speed = -60; const p = nearestRoadPt(c.x, c.y); c.x += (p.x - c.x) * 0.06; c.y += (p.y - c.y) * 0.06; }
  else { c.x = col.x; c.y = col.y; }
  if (player.car && Math.hypot(c.x - player.x, c.y - player.y) < 30 && Math.abs(c.speed) > 80) { player.car.health -= 6; state.shake = 7; audio.crash(); }
  if (!player.car && Math.hypot(c.x - player.x, c.y - player.y) < 22 && Math.abs(c.speed) > 60) hurtPlayer(14);
}
function updateCopFoot(p, dt) {
  const d = dist(p, player);
  if (d > 170) movePed(p, player.x, player.y, dt, 150);
  else if (d < 90) movePed(p, p.x - (player.x - p.x), p.y - (player.y - p.y), dt, 70);
  p.fireCd = (p.fireCd || 0) - dt;
  if (d < 300 && state.wanted >= 2 && p.fireCd <= 0) { p.fireCd = 1 + rng() * 0.6; shoot(p, Math.atan2(player.y - p.y, player.x - p.x) + (rng() - 0.5) * 0.18, 'pistol', true); }
}
function updateFleeCar(c, dt) {
  const away = Math.atan2(c.y - player.y, c.x - player.x);
  let da = away - c.angle; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
  c.angle += Math.max(-2 * dt, Math.min(2 * dt, da));
  c.speed += (240 - c.speed) * Math.min(1, dt * 1.5);
  const nx = c.x + Math.cos(c.angle) * c.speed * dt, ny = c.y + Math.sin(c.angle) * c.speed * dt;
  const col = world.collideCircle(nx, ny, 14);
  if (col.hit) { c.speed *= 0.3; c.angle += 1.2 * dt * 3; } else { c.x = col.x; c.y = col.y; }
  if (c.health <= 25) { c.speed *= 0.94; if (rng() > 0.7) particles.push({ x: c.x, y: c.y - 6, vx: 0, vy: -30, life: 0.6, color: '#666', size: 5 }); }
}

// ---------- Drawing ----------
function dayTint() {
  const t = state.time;
  if (t > 6 && t < 17) return null;
  if (t >= 17 && t < 19.5) return 'rgba(255,120,60,0.16)';
  if (t >= 19.5 || t < 5) return 'rgba(8,10,50,0.42)';
  return 'rgba(255,170,90,0.10)';
}
function drawCar(c, sx, sy) {
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(c.angle);
  if (c === player.car || c.ai !== 'parked') { /* headlights at dusk/night */ }
  const night = state.time > 18.5 || state.time < 5.5;
  if (night && !c.dead) { const g = ctx.createRadialGradient(26, 0, 4, 60, 0, 60); g.addColorStop(0, 'rgba(255,240,180,0.35)'); g.addColorStop(1, 'rgba(255,240,180,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(16, -7); ctx.lineTo(80, -20); ctx.lineTo(80, 20); ctx.lineTo(16, 7); ctx.fill(); }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(-17, -8, 36, 19, 5); ctx.fill();
  ctx.fillStyle = c.dead ? '#333' : c.color; roundRect(-17, -9, 36, 18, 5); ctx.fill();
  ctx.fillStyle = c.police ? '#f1faee' : 'rgba(20,30,40,0.85)'; roundRect(-5, -7, 13, 14, 3); ctx.fill();
  if (c.police) { ctx.fillStyle = (Math.floor(performance.now() / 300) % 2) ? '#e63946' : '#4361ee'; ctx.fillRect(-2, -3, 6, 6); ctx.fillStyle = '#fff'; ctx.font = 'bold 6px sans-serif'; ctx.fillText('SVPD', -15, 2); }
  if (c.scarlet) { ctx.fillStyle = '#fff'; ctx.fillRect(-14, -2, 30, 4); }
  ctx.fillStyle = '#111'; ctx.fillRect(-13, -11, 7, 4); ctx.fillRect(8, -11, 7, 4); ctx.fillRect(-13, 7, 7, 4); ctx.fillRect(8, 7, 7, 4);
  if (c.health < 60 && !c.dead) { ctx.fillStyle = 'rgba(200,200,200,0.5)'; ctx.beginPath(); ctx.arc(14, 0, 4 + (60 - c.health) * 0.08, 0, 7); ctx.fill(); }
  ctx.restore();
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function drawPed(p, sx, sy) {
  ctx.save(); ctx.translate(sx, sy);
  if (p.dead) { ctx.rotate(Math.PI / 2); ctx.fillStyle = '#7a1f1f'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, 7); ctx.fill(); ctx.restore(); return; }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 3, 7, 4, 0, 0, 7); ctx.fill();
  const bob = Math.sin(performance.now() / 120 + p.x) * 1.2;
  ctx.fillStyle = p.cop ? '#1d3557' : p.color; roundRect(-5, -4 + bob * 0.3, 10, 11, 3); ctx.fill();
  ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(0, -7 + bob * 0.3, 4.6, 0, 7); ctx.fill();
  if (p.cop) { ctx.fillStyle = '#ffd60a'; ctx.fillRect(-4, -10 + bob * 0.3, 8, 3); }
  if (p.state === 'hostile') { ctx.fillStyle = '#e63946'; ctx.fillRect(-2, -14, 4, 4); }
  if (p.scared > 0) { ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('!', -1, -14); }
  ctx.restore();
}
function drawWorld() {
  const ox = W / 2 - cam.x + (rng() - 0.5) * state.shake, oy = H / 2 - cam.y + (rng() - 0.5) * state.shake;
  ctx.fillStyle = '#3f7d4e'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(ox, oy);
  // sand + water
  ctx.fillStyle = '#e8d8a0'; ctx.fillRect(world.beachX, 0, 150, WORLD_H);
  ctx.fillStyle = '#1d7ea8'; ctx.fillRect(world.beachX + 130, 0, WORLD_W - world.beachX, WORLD_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 8; i++) { const y = ((performance.now() / 40 + i * 260) % WORLD_H); ctx.beginPath(); ctx.moveTo(world.beachX + 134, y); ctx.lineTo(world.beachX + 190, y + 8); ctx.stroke(); }
  // parks
  for (const pk of world.parks) { ctx.fillStyle = '#57a05e'; ctx.fillRect(pk.x, pk.y, pk.w, pk.h); }
  // roads
  ctx.fillStyle = '#3a3f47';
  for (const rx of world.vRoads) ctx.fillRect(rx - 28, 0, 56, WORLD_H);
  for (const ry of world.hRoads) ctx.fillRect(0, ry - 28, WORLD_W, 56);
  // sidewalks
  ctx.fillStyle = '#9aa0a6';
  for (const rx of world.vRoads) { ctx.fillRect(rx - 34, 0, 6, WORLD_H); ctx.fillRect(rx + 28, 0, 6, WORLD_H); }
  for (const ry of world.hRoads) { ctx.fillRect(0, ry - 34, WORLD_W, 6); ctx.fillRect(0, ry + 28, WORLD_W, 6); }
  // lane dashes
  ctx.fillStyle = '#e8c547';
  for (const rx of world.vRoads) for (let y = 10; y < WORLD_H; y += 44) ctx.fillRect(rx - 1, y, 2, 22);
  for (const ry of world.hRoads) for (let x = 10; x < WORLD_W; x += 44) ctx.fillRect(x, ry - 1, 22, 2);
  // skids
  for (const s of skids) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a); ctx.fillStyle = 'rgba(20,20,20,' + Math.min(0.5, s.life * 0.1) + ')'; ctx.fillRect(-8, -7, 16, 3); ctx.fillRect(-8, 4, 16, 3); ctx.restore(); }
  // buildings
  for (const b of world.buildings) {
    if (b.x + b.w < cam.x - W / 2 - 60 || b.x > cam.x + W / 2 + 60 || b.y + b.h < cam.y - H / 2 - 60 || b.y > cam.y + H / 2 + 60) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.roof; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
    ctx.fillStyle = 'rgba(255,255,200,0.5)';
    const cols = Math.floor(b.w / 16), rows = Math.floor(b.h / 16);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if ((i * 7 + j * 13 + b.floors) % 3) ctx.fillRect(b.x + 7 + i * 16, b.y + 7 + j * 16, 7, 7);
    ctx.fillStyle = '#14213d'; ctx.fillRect(b.x, b.y + b.h - 13, Math.min(b.w, b.name.length * 5.4 + 8), 12);
    ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 8px sans-serif'; ctx.fillText(b.name, b.x + 4, b.y + b.h - 4);
  }
  // props
  for (const pr of world.props) {
    if (Math.abs(pr.x - cam.x) > W / 2 + 40 || Math.abs(pr.y - cam.y) > H / 2 + 40) continue;
    if (pr.type === 'palm') { ctx.strokeStyle = '#6a4c2f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x + 3, pr.y - 12); ctx.stroke(); ctx.strokeStyle = '#2e8b57'; ctx.lineWidth = 2; for (let k = 0; k < 5; k++) { const a = k * 1.25; ctx.beginPath(); ctx.moveTo(pr.x + 3, pr.y - 12); ctx.lineTo(pr.x + 3 + Math.cos(a) * 11, pr.y - 12 + Math.sin(a) * 6 - 3); ctx.stroke(); } }
    if (pr.type === 'lamp') { ctx.fillStyle = '#333'; ctx.fillRect(pr.x - 1, pr.y - 10, 2, 12); ctx.fillStyle = '#ffe66d'; ctx.beginPath(); ctx.arc(pr.x, pr.y - 11, 3, 0, 7); ctx.fill(); }
    if (pr.type === 'crate') { ctx.fillStyle = '#a67c52'; ctx.fillRect(pr.x - 6, pr.y - 6, 12, 12); ctx.strokeStyle = '#6a4c2f'; ctx.strokeRect(pr.x - 6, pr.y - 6, 12, 12); }
  }
  // key location labels
  for (const loc of [world.hospital, world.policeSt, world.safehouse]) {
    ctx.fillStyle = 'rgba(10,10,30,0.7)'; ctx.fillRect(loc.x - 34, loc.y - 10, 86, 16);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.fillText(loc.label, loc.x - 30, loc.y + 2);
  }
  // pickups
  for (const pk of pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(performance.now() / 300 + pk.bob) * 3;
    ctx.save(); ctx.translate(pk.x, pk.y + bob);
    if (pk.type === 'health') { ctx.fillStyle = '#fff'; roundRect(-9, -9, 18, 18, 3); ctx.fill(); ctx.fillStyle = '#e63946'; ctx.fillRect(-2, -6, 4, 12); ctx.fillRect(-6, -2, 12, 4); }
    else if (pk.type === 'ammo') { ctx.fillStyle = '#ffd60a'; roundRect(-8, -6, 16, 12, 2); ctx.fill(); ctx.fillStyle = '#333'; ctx.font = 'bold 7px sans-serif'; ctx.fillText('AMMO', -7, 2); }
    else if (pk.type === 'smg') { ctx.fillStyle = '#ff7eb6'; roundRect(-13, -5, 26, 10, 3); ctx.fill(); ctx.fillStyle = '#111'; ctx.font = 'bold 8px sans-serif'; ctx.fillText('SMG', -9, 3); }
    else { ctx.fillStyle = '#ffb703'; roundRect(-10, -10, 20, 20, 2); ctx.fill(); ctx.fillStyle = '#7a4b00'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('$', -3, 4); }
    ctx.restore();
  }
  // mission / taxi markers
  const mk = missionMarker();
  if (mk) drawMarker(mk.x, mk.y, mk.kind === 'giver' ? '#ff7eb6' : '#ffd60a', mk.label);
  if (state.taxi) {
    if (state.taxi.phase === 0) drawMarker(state.taxi.px, state.taxi.py, '#00e5ff', 'FARE');
    else drawMarker(state.taxi.dx, state.taxi.dy, '#ffd60a', 'DROP-OFF');
  }
  // entities
  for (const c of cars) if (Math.abs(c.x - cam.x) < W / 2 + 60 && Math.abs(c.y - cam.y) < H / 2 + 60) drawCar(c, c.x, c.y);
  for (const p of peds) if (Math.abs(p.x - cam.x) < W / 2 + 40 && Math.abs(p.y - cam.y) < H / 2 + 40) drawPed(p, p.x, p.y);
  for (const b of bullets) { ctx.fillStyle = '#ffe66d'; ctx.fillRect(b.x - 2, b.y - 2, 4, 4); }
  for (const pt of particles) { ctx.globalAlpha = Math.min(1, pt.life * 2.4); ctx.fillStyle = pt.color; ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size); ctx.globalAlpha = 1; }
  // player
  if (!player.car) {
    ctx.save(); ctx.translate(player.x, player.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 4, 8, 5, 0, 0, 7); ctx.fill();
    const bob = (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD) ? Math.sin(player.walkPhase) * 1.4 : 0;
    ctx.rotate(player.angle + Math.PI / 2);
    ctx.fillStyle = '#e63946'; roundRect(-6, -5 + bob * 0.2, 12, 13, 4); ctx.fill();
    ctx.fillStyle = '#ffdbac'; ctx.beginPath(); ctx.arc(0, -8, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#14213d'; ctx.fillRect(-5, -13, 10, 4);
    if (player.punchCd > 0.2) { ctx.fillStyle = '#ffdbac'; ctx.fillRect(6, -4, 8, 4); }
    ctx.restore();
    // aim line
    if (mouse.down || true) { /* subtle reticle drawn in screen space later */ }
  }
  for (const f of floaters) { ctx.globalAlpha = Math.min(1, f.t); ctx.fillStyle = f.color; ctx.font = 'bold 14px sans-serif'; ctx.fillText(f.text, f.x - 14, f.y); ctx.globalAlpha = 1; }
  ctx.restore();
  // day tint
  const tint = dayTint(); if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); }
  // reticle
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 8, 0, 7); ctx.stroke();
  ctx.fillStyle = '#e63946'; ctx.fillRect(mouse.x - 1, mouse.y - 1, 2, 2);
}
function drawMarker(x, y, color, label) {
  const bob = Math.sin(performance.now() / 280) * 5;
  ctx.save(); ctx.translate(x, y + bob);
  ctx.fillStyle = color; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(0, 30 - bob, 34, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.moveTo(0, 26 - bob); ctx.lineTo(-11, 2 - bob); ctx.lineTo(11, 2 - bob); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -6 - bob, 12, 0, 7); ctx.fill();
  ctx.fillStyle = '#111'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('!', -2, -2 - bob);
  ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3;
  ctx.strokeText(label, -ctx.measureText(label).width / 2, -26 - bob); ctx.fillText(label, -ctx.measureText(label).width / 2, -26 - bob);
  ctx.restore();
}

// ---------- HUD ----------
function drawHUD() {
  // top-left: health + cash
  ctx.fillStyle = 'rgba(8,10,24,0.72)'; roundRect(14, 14, 250, 96, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('HEALTH', 24, 34);
  ctx.fillStyle = '#333'; ctx.fillRect(24, 40, 180, 13);
  ctx.fillStyle = player.health > 30 ? '#57cc5e' : '#e63946'; ctx.fillRect(24, 40, 180 * Math.max(0, player.health) / 100, 13);
  if (player.car) { ctx.fillStyle = '#ffd60a'; ctx.font = '11px sans-serif'; ctx.fillText('CAR ' + Math.max(0, Math.round(player.car.health)) + '%  SPEED ' + Math.abs(Math.round(player.car.speed)) , 24, 70); }
  else { ctx.fillStyle = '#ffd60a'; ctx.font = '11px sans-serif'; ctx.fillText((state.weapon === 'smg' ? 'SMG' : 'PISTOL') + '  AMMO ' + state.ammo[state.weapon] + (state.hasSMG ? '   [1] Pistol [2] SMG' : ''), 24, 70); }
  ctx.fillStyle = '#7CFC00'; ctx.font = 'bold 19px sans-serif'; ctx.fillText('$' + state.cash.toLocaleString(), 24, 88);
  // top-right: clock + stars
  const hh = Math.floor(state.time), mm = Math.floor((state.time - hh) * 60);
  ctx.fillStyle = 'rgba(8,10,24,0.72)'; roundRect(W - 216, 14, 202, 64, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.fillText('DAY ' + state.day + '  ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'), W - 200, 38);
  ctx.font = '21px sans-serif';
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i < state.wanted ? '#ffd60a' : 'rgba(255,255,255,0.22)'; ctx.fillText('★', W - 200 + i * 26, 68); }
  if (audio.muted) { ctx.fillStyle = '#ff7eb6'; ctx.font = '11px sans-serif'; ctx.fillText('MUTED (M)', W - 200, 92); }
  // objective
  ctx.fillStyle = 'rgba(8,10,24,0.72)'; roundRect(14, H - 108, Math.min(560, W - 220), 44, 8); ctx.fill();
  ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('OBJECTIVE', 24, H - 84);
  ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText(objectiveText().slice(0, 78), 24, H - 66);
  if (state.msgT > 0) { ctx.fillStyle = 'rgba(230,57,70,0.9)'; roundRect(W / 2 - 260, 96, 520, 34, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; const t = state.msg; ctx.fillText(t, W / 2 - ctx.measureText(t).width / 2, 119); }
  drawMinimap();
  // controls hint
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '11px sans-serif';
  ctx.fillText(player.car ? 'WASD drive · SPACE handbrake · E exit · ESC pause' : 'WASD move · SHIFT sprint · E enter car / talk · F punch · CLICK shoot · M mute', 14, H - 12);
}
function drawMinimap() {
  const mw = 168, mh = 132, mx = W - mw - 14, my = H - mh - 14;
  ctx.fillStyle = 'rgba(8,10,24,0.8)'; roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
  ctx.fillStyle = '#2c5f3a'; ctx.fillRect(mx, my, mw, mh);
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.fillStyle = '#e8d8a0'; ctx.fillRect(mx + world.beachX * sx, my, 12, mh);
  ctx.fillStyle = '#1d7ea8'; ctx.fillRect(mx + (world.beachX + 130) * sx, my, mw, mh);
  ctx.strokeStyle = '#565d66'; ctx.lineWidth = 2;
  for (const rx of world.vRoads) { ctx.beginPath(); ctx.moveTo(mx + rx * sx, my); ctx.lineTo(mx + rx * sx, my + mh); ctx.stroke(); }
  for (const ry of world.hRoads) { ctx.beginPath(); ctx.moveTo(mx, my + ry * sy); ctx.lineTo(mx + mw, my + ry * sy); ctx.stroke(); }
  for (const c of cars) if (c.police && !c.dead) { ctx.fillStyle = '#4cc9f0'; ctx.fillRect(mx + c.x * sx - 2, my + c.y * sy - 2, 4, 4); }
  for (const p of peds) if (p.cop && !p.dead) { ctx.fillStyle = '#4cc9f0'; ctx.fillRect(mx + p.x * sx - 2, my + p.y * sy - 2, 4, 4); }
  const mk = missionMarker();
  const tgt = mk || (state.taxi ? { x: state.taxi.phase === 0 ? state.taxi.px : state.taxi.dx, y: state.taxi.phase === 0 ? state.taxi.py : state.taxi.dy } : null);
  if (tgt) { ctx.fillStyle = '#ffd60a'; ctx.beginPath(); ctx.arc(mx + tgt.x * sx, my + tgt.y * sy, 4 + Math.sin(performance.now() / 200) * 1.2, 0, 7); ctx.fill(); }
  // player arrow
  ctx.save(); ctx.translate(mx + player.x * sx, my + player.y * sy); ctx.rotate(player.angle);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.fill(); ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('SAN VERANO', mx + 4, my + 12);
}

// ---------- Screens ----------
let buttons = [];
function drawButton(x, y, w, h, label, cb) {
  const hov = mouse.x > x && mouse.x < x + w && mouse.y > y && mouse.y < y + h;
  ctx.fillStyle = hov ? '#ffd60a' : 'rgba(20,20,40,0.9)'; roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = '#ff7eb6'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = hov ? '#111' : '#fff'; ctx.font = 'bold 17px sans-serif';
  ctx.fillText(label, x + w / 2 - ctx.measureText(label).width / 2, y + h / 2 + 6);
  buttons.push({ x, y, w, h, cb });
}
function handleClick(x, y) {
  for (const b of buttons) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) { audio.ensure(); b.cb(); return; }
}
function drawTitle() {
  drawWorld();
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(30,0,50,0.25)'); g.addColorStop(1, 'rgba(10,0,30,0.78)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  buttons = [];
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff7eb6'; ctx.font = 'bold 26px sans-serif'; ctx.fillText('W E L C O M E   T O', W / 2, H * 0.3);
  ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 84px sans-serif'; ctx.shadowColor = '#e63946'; ctx.shadowBlur = 26;
  ctx.fillText('SAN VERANO', W / 2, H * 0.3 + 78);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#7ef0e0'; ctx.font = 'bold 30px sans-serif'; ctx.fillText('— NEON COAST —', W / 2, H * 0.3 + 118);
  ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif';
  ctx.fillText('An original open-world crime story: steal rides, run jobs for Rosa, Diego, Vera & Marco,', W / 2, H * 0.3 + 152);
  ctx.fillText('outrun the SVPD, and own the neon coast.', W / 2, H * 0.3 + 174);
  ctx.textAlign = 'left';
  drawButton(W / 2 - 120, H * 0.62, 240, 50, 'NEW GAME', () => { Object.assign(state, freshState()); state.mode = 'play'; player.x = state.px; player.y = state.py; player.car = null; player.health = 100; cam.x = player.x; cam.y = player.y; saveGame(); });
  const has = !!localStorage.getItem(SAVE_KEY);
  drawButton(W / 2 - 120, H * 0.62 + 62, 240, 50, has ? 'CONTINUE' : 'CONTINUE (no save)', () => { if (loadGame()) { state.mode = 'play'; player.health = 100; player.car = null; cam.x = player.x; cam.y = player.y; } });
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('WASD move/drive · E enter car · F punch · Click shoot · Shift sprint · Space handbrake · M mute · Esc pause', W / 2, H - 26);
  ctx.textAlign = 'left';
}
function drawPause() {
  drawWorld(); drawHUD();
  ctx.fillStyle = 'rgba(5,5,20,0.72)'; ctx.fillRect(0, 0, W, H);
  buttons = [];
  ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', W / 2, H * 0.32); ctx.textAlign = 'left';
  drawButton(W / 2 - 110, H * 0.4, 220, 46, 'RESUME', () => state.mode = 'play');
  drawButton(W / 2 - 110, H * 0.4 + 58, 220, 46, 'SAVE GAME', () => { state.px = player.x; state.py = player.y; saveGame(); state.msg = 'Saved.'; state.msgT = 2; state.mode = 'play'; });
  drawButton(W / 2 - 110, H * 0.4 + 116, 220, 46, 'RESTART STORY', () => { Object.assign(state, freshState()); state.mode = 'play'; player.x = state.px; player.y = state.py; player.car = null; player.health = 100; });
  drawButton(W / 2 - 110, H * 0.4 + 174, 220, 46, 'TITLE SCREEN', () => state.mode = 'title');
}
function drawOver() {
  drawWorld();
  ctx.fillStyle = state.dead === 'busted' ? 'rgba(10,20,60,0.78)' : 'rgba(60,0,0,0.78)'; ctx.fillRect(0, 0, W, H);
  buttons = [];
  ctx.fillStyle = state.dead === 'busted' ? '#4cc9f0' : '#e63946'; ctx.font = 'bold 72px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(state.dead === 'busted' ? 'BUSTED' : 'WASTED', W / 2, H * 0.42);
  ctx.fillStyle = '#fff'; ctx.font = '17px sans-serif';
  ctx.fillText(state.dead === 'busted' ? 'The SVPD hauled you in. Bail & fines will sting.' : 'You flatlined on the neon coast. The hospital patches you up — for a price.', W / 2, H * 0.42 + 38);
  ctx.textAlign = 'left';
  drawButton(W / 2 - 130, H * 0.56, 260, 50, 'RESPAWN (-$)', () => respawn());
}
function drawDialogue() {
  const d = state.dialogue; if (!d) return;
  const line = d.lines[d.idx];
  const colon = line.indexOf(':');
  const who = colon > 0 ? line.slice(0, colon) : '';
  const ch = CHARACTERS[Object.keys(CHARACTERS).find(k => CHARACTERS[k].name.startsWith(who.split(' ')[0]))] || null;
  ctx.fillStyle = 'rgba(6,6,20,0.92)'; roundRect(W / 2 - 420, H - 190, 840, 76, 10); ctx.fill();
  ctx.strokeStyle = ch ? ch.color : '#ffd60a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = ch ? ch.color : '#ffd60a'; ctx.font = 'bold 13px sans-serif'; ctx.fillText(who || 'SAN VERANO', W / 2 - 400, H - 162);
  ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif';
  wrapText(colon > 0 ? line.slice(colon + 1).trim() : line, W / 2 - 400, H - 138, 800, 19);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '11px sans-serif'; ctx.fillText('ENTER ▸', W / 2 + 356, H - 122);
}
function wrapText(text, x, y, maxW, lh) {
  const words = text.split(' '); let line = '', yy = y;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
  ctx.fillText(line, x, yy);
}

// ---------- Screenshot scenes ----------
function setupShot() {
  if (!SHOT) return;
  state.mode = 'play';
  if (SHOT === 'cover') {
    state.time = 18.6; const p = gridPos(6, 5); player.x = p.x; player.y = p.y; cam.x = p.x; cam.y = p.y;
    state.mode = 'title';
  }
  if (SHOT === 'drive') {
    state.time = 16.2; const p = { x: world.hRoads[5] ? gridPos(6, 5).x : 0, y: 0 };
    const roadY = 160 + 5 * TILE; const startX = 160 + 5 * TILE + 60;
    const c = makeCar(startX, roadY + 14, { color: '#e63946' }); c.ai = 'player'; c.driver = true; c.speed = 150; c.angle = 0; cars.unshift(c); player.car = c; player.x = c.x; player.y = c.y; cam.x = c.x; cam.y = c.y;
    state.cash = 1840; state.missionIdx = 2;
  }
  if (SHOT === 'chase') {
    state.time = 19.2; const roadY = 160 + 6 * TILE; const startX = 160 + 6 * TILE + 60;
    const p = { x: startX, y: roadY + 14 };
    const c = makeCar(p.x, p.y, { color: '#ffd60a' }); c.ai = 'player'; c.driver = true; c.speed = 190; c.angle = 0; cars.unshift(c); player.car = c; player.x = c.x; player.y = c.y; cam.x = c.x; cam.y = c.y;
    state.wanted = 4; state.wantedHeat = 4; state.cash = 3275; state.missionIdx = 3;
    for (let i = 0; i < 3; i++) { const cc = makeCar(p.x - 100 - i * 78, p.y + (i - 1) * 30, { police: true, color: '#1d3557' }); cc.ai = 'cop'; cc.angle = 0; cc.speed = 180; cars.push(cc); cops.push(cc); }
    const cp = makePed(p.x + 60, p.y - 50); cp.cop = true; cp.state = 'chase'; peds.push(cp); cops.push(cp);
  }
  if (SHOT === 'mission') {
    state.time = 15.4; state.missionIdx = 1;
    const g = gridPos(MISSION_SPOTS.m2.giver[0], MISSION_SPOTS.m2.giver[1]);
    player.x = g.x + 26; player.y = g.y - 34; cam.x = player.x; cam.y = player.y;
    const npc = makePed(g.x, g.y - 60); npc.state = 'stand'; peds.push(npc);
    state.cash = 640; state.ammo.pistol = 36;
    beginMission();
  }
}
setupShot();

// ---------- Main loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  buttons = state.mode === 'play' ? buttons : buttons;
  if (state.mode === 'play') { if (!state.dialogue) update(dt); else { cam.x += (player.x - cam.x) * 0.1; cam.y += (player.y - cam.y) * 0.1; } }
  if (state.mode === 'title') { state.time = SHOT === 'cover' ? 18.6 : 17.6 + Math.sin(now / 9000) * 0.4; cam.x = WORLD_W / 2 + Math.sin(now / 6000) * 300; cam.y = WORLD_H / 2 + Math.cos(now / 7000) * 200; if (SHOT === 'cover') { const p = gridPos(6, 5); cam.x = p.x; cam.y = p.y; } drawTitle(); }
  else if (state.mode === 'pause') drawPause();
  else if (state.mode === 'over') drawOver();
  else { drawWorld(); drawHUD(); drawDialogue(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
