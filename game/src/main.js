// SAN VERANO: Neon Coast — main game. Top-down open-world crime game.
// Plain canvas, ES modules, no network, all art drawn, all sound synthesized.
import { WORLD_W, WORLD_H, BEACH_Y, VX, HY, ROAD_HALF, buildWorld, isRoad, isWater, isSand, collideBuildings, clampWorld, mulberry } from './world.js';
import { Sfx } from './audio.js';
import { STORY, missionByIndex } from './missions.js';

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const mm = document.getElementById('minimap');
const mctx = mm.getContext('2d');
let W = 1280, H = 720;
function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
addEventListener('resize', resize); resize();

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || '1', 10) || 1;
const rnd = mulberry(SEED * 331 + 7);
const sfx = new Sfx();

const world = buildWorld(SEED);
const keys = {};
let mouse = { x: 0, y: 0, down: false };
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; keys[e.code] = true; onKey(e); if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; keys[e.code] = false; });
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('mousedown', () => { mouse.down = true; sfx.ensure(); });
addEventListener('mouseup', () => { mouse.down = false; });

// ---------- state ----------
const SAVE_KEY = 'sanverano-save-v1';
let save = null;
try { save = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { save = null; }

const G = {
  mode: SHOT ? 'play' : 'title', // title | play | pause | dead | dialogue
  deadKind: '', time: 8.2, dayLen: 240, cash: 120, storyIdx: 0,
  mission: null, missionStage: 0, missionTimer: 0, missionKills: 0,
  taxi: null, shake: 0, msg: '', msgT: 0, dialogue: null, dlgIdx: 0,
  heat: 0, // wanted 0..5 float
  lastCrimeT: -99, seenT: 0, elapsed: 0, shotMode: !!SHOT,
};
const player = {
  x: 1690, y: 1120, a: 0, hp: 100, speed: 0, inCar: null,
  weapon: 'pistol', ammoPistol: 48, ammoSmg: 0, hasSmg: false, fireCd: 0, punchCd: 0,
};
if (save && SHOT !== 'cover') { /* shots use fresh staged state */ }

function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: G.cash, storyIdx: G.storyIdx, x: player.x, y: player.y, hp: player.hp })); } catch (e) {}
}
function loadSave() {
  if (!save) return false;
  G.cash = save.cash ?? 120; G.storyIdx = save.storyIdx ?? 0;
  player.x = save.x ?? 1690; player.y = save.y ?? 1120; player.hp = save.hp ?? 100;
  return true;
}

// ---------- entities ----------
const CAR_COLS = ['#d94f4f', '#4f7fd9', '#f2c14e', '#57b26a', '#e8e8e8', '#ff8c42', '#b45fd9', '#39c2c9'];
function makeCar(x, y, a, color, kind) {
  return { x, y, a: a || 0, v: 0, color: color || CAR_COLS[Math.floor(rnd() * CAR_COLS.length)], hp: 100, kind: kind || 'traffic', lane: 0, targetA: a || 0, stuck: 0, driver: true, dead: false, sirenPh: rnd() * 6 };
}
const cars = [];
for (const p of world.parked) cars.push({ ...makeCar(p.x, p.y, p.a, p.color, 'parked'), driver: false });
for (let i = 0; i < 16; i++) {
  const vx = VX[Math.floor(rnd() * VX.length)], hy = HY[Math.floor(rnd() * HY.length)];
  const vert = rnd() < 0.5;
  const c = makeCar(vert ? vx + (rnd() < 0.5 ? -26 : 26) : 200 + rnd() * 3200, vert ? 200 + rnd() * 2000 : hy + (rnd() < 0.5 ? -26 : 26), vert ? (rnd() < 0.5 ? -Math.PI / 2 : Math.PI / 2) : (rnd() < 0.5 ? 0 : Math.PI), null, 'traffic');
  c.v = 90 + rnd() * 60; cars.push(c);
}
const peds = [];
const PED_COLS = ['#f2c14e', '#57b26a', '#4f7fd9', '#e88ca0', '#e8e8e8', '#ff8c42'];
for (let i = 0; i < 46; i++) {
  peds.push({ x: 150 + rnd() * 3300, y: 150 + rnd() * 2000, a: rnd() * 6.28, hp: 30, color: PED_COLS[i % PED_COLS.length], state: 'walk', t: rnd() * 4, dead: false, kind: 'civil' });
}
const cops = []; // {car} or foot cops in peds with kind 'cop'
const bullets = [], parts = [], skids = [];
let rivalCar = null, thugs = [];

function crime(amount) {
  G.heat = Math.min(5, G.heat + amount); G.lastCrimeT = G.elapsed;
}
function stars() { return Math.floor(G.heat + 0.0001); }
function toast(t) { G.msg = t; G.msgT = 3.2; }

// ---------- input actions ----------
function onKey(e) {
  const k = e.key.toLowerCase();
  if (k === 'm') { sfx.muted = !sfx.muted; toast(sfx.muted ? 'Sound muted' : 'Sound on'); }
  if (G.mode === 'title') { if (k === 'enter') startGame(false); return; }
  if (k === 'escape' || k === 'p') { if (G.mode === 'play') G.mode = 'pause'; else if (G.mode === 'pause') G.mode = 'play'; return; }
  if (G.mode === 'dialogue' && (k === ' ' || k === 'enter' || k === 'e')) { advanceDialogue(); return; }
  if (G.mode !== 'play') return;
  if (k === 'e') tryEnterExit();
  if (k === 'f') punch();
  if (k === '1') player.weapon = 'pistol';
  if (k === '2' && player.hasSmg) player.weapon = 'smg';
  if (k === 't' && !G.mission) startTaxi();
}
function tryEnterExit() {
  if (player.inCar) {
    const c = player.inCar; player.x = c.x + Math.cos(c.a + Math.PI / 2) * 26; player.y = c.y + Math.sin(c.a + Math.PI / 2) * 26;
    player.inCar = null; c.driver = false; return;
  }
  let best = null, bd = 52;
  for (const c of cars) { if (c.dead) continue; const d = Math.hypot(c.x - player.x, c.y - player.y); if (d < bd) { bd = d; best = c; } }
  if (best) {
    if (best.kind === 'parked' || Math.abs(best.v) < 30) {
      if (best.kind !== 'player') { crime(best.kind === 'cop' ? 1.2 : 0.7); toast('Vehicle stolen!'); }
      player.inCar = best; best.driver = true; best.kind = best.kind === 'cop' ? 'cop' : 'player';
      sfx.ensure();
    }
  }
}
function punch() {
  if (player.punchCd > 0 || player.inCar) return;
  player.punchCd = 0.35; sfx.punch();
  const tx = player.x + Math.cos(player.a) * 30, ty = player.y + Math.sin(player.a) * 30;
  for (const p of peds) { if (!p.dead && Math.hypot(p.x - tx, p.y - ty) < 26) { hurtPed(p, 12, player.a); crime(p.kind === 'cop' ? 1 : 0.5); } }
  spawnParts(tx, ty, '#fff', 3);
}
function hurtPed(p, dmg, ang) {
  p.hp -= dmg; p.state = 'flee'; p.a = ang;
  spawnParts(p.x, p.y, '#c0392b', 4);
  if (p.hp <= 0 && !p.dead) { p.dead = true; G.cash += 5 + Math.floor(rnd() * 20); if (G.mission && G.mission.kind === 'shootout' && p.kind === 'thug') { G.missionKills++; } crime(p.kind === 'cop' ? 1.5 : 0.6); }
}
function shoot() {
  const rate = player.weapon === 'smg' ? 0.09 : 0.24;
  if (player.fireCd > 0) return;
  const ammo = player.weapon === 'smg' ? player.ammoSmg : player.ammoPistol;
  if (ammo <= 0) { toast('Out of ammo — find ammo pickups'); player.fireCd = 0.3; return; }
  if (player.weapon === 'smg') player.ammoSmg--; else player.ammoPistol--;
  player.fireCd = rate; sfx.shot(); G.shake = Math.max(G.shake, 2);
  const wx = player.x + (mouse.x - W / 2), wy = player.y + (mouse.y - H / 2);
  const a = Math.atan2(wy - player.y, wx - player.x) + (rnd() - 0.5) * (player.weapon === 'smg' ? 0.09 : 0.03);
  player.a = a;
  bullets.push({ x: player.x + Math.cos(a) * 18, y: player.y + Math.sin(a) * 18, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.55, from: 'player' });
  spawnParts(player.x + Math.cos(a) * 22, player.y + Math.sin(a) * 22, '#ffd94f', 3);
  crime(0.35);
}

// ---------- missions ----------
function startDialogue(m, after) {
  G.dialogue = { lines: m.lines, after }; G.dlgIdx = 0; G.mode = 'dialogue';
}
function advanceDialogue() {
  G.dlgIdx++;
  if (G.dialogue && G.dlgIdx >= G.dialogue.lines.length) { const f = G.dialogue.after; G.dialogue = null; G.mode = 'play'; if (f) f(); }
}
function beginMission(idx) {
  const m = missionByIndex(idx); if (!m) { toast('Story complete — free roam! Taxi jobs: press T'); return; }
  startDialogue(m, () => {
    G.mission = m; G.missionStage = 0; G.missionKills = 0;
    if (m.kind === 'timed') G.missionTimer = m.time;
    if (m.kind === 'chase') { rivalCar = makeCar(m.target.x, m.target.y, 0, '#e02020', 'rival'); rivalCar.hp = 60; rivalCar.v = 120; cars.push(rivalCar); }
    if (m.kind === 'shootout') {
      thugs = [];
      for (let i = 0; i < m.count; i++) { const p = { x: m.target.x + (rnd() - 0.5) * 160, y: m.target.y + (rnd() - 0.5) * 120, a: 0, hp: 40, color: '#7a2a2a', state: 'fight', t: 0, dead: false, kind: 'thug', fireCd: rnd() }; peds.push(p); thugs.push(p); }
    }
    if (m.kind === 'finale') { /* heat applied at van */ }
    toast('Mission: ' + m.title);
  });
}
function missionTarget() {
  const m = G.mission; if (!m) return null;
  if (m.kind === 'pickup') return G.missionStage === 0 ? m.target : m.target2;
  if (m.kind === 'chase') return rivalCar;
  if (m.kind === 'finale') return G.missionStage === 0 ? m.target : m.target2;
  return m.target;
}
function completeMission() {
  const m = G.mission; G.cash += m.reward; sfx.cash();
  toast('Mission complete! +$' + m.reward);
  G.storyIdx++; G.mission = null; rivalCar = null; thugs = [];
  persist();
}
function failMission(why) { toast('Mission failed: ' + why + ' — return to the marker to retry'); G.mission = null; if (rivalCar) { rivalCar.dead = true; rivalCar = null; } }
function startTaxi() {
  const spots = [{ x: 500, y: 500 }, { x: 2600, y: 600 }, { x: 900, y: 1600 }, { x: 2900, y: 1700 }, { x: 1800, y: 2250 }, { x: 400, y: 2100 }];
  const s = spots[Math.floor(rnd() * spots.length)];
  G.taxi = { x: s.x, y: s.y, stage: 0, dest: spots[Math.floor(rnd() * spots.length)] };
  toast('Taxi fare: pick up the passenger (get in a car)');
}
function currentObjective() {
  if (G.mission) {
    if (G.mission.kind === 'timed') return G.mission.objective + ' — ' + Math.ceil(G.missionTimer) + 's';
    if (G.mission.kind === 'shootout') return G.mission.objective + ' (' + G.missionKills + '/' + G.mission.count + ')';
    return G.mission.objective;
  }
  if (G.taxi) return G.taxi.stage === 0 ? 'Taxi: pick up passenger at the yellow marker' : 'Taxi: drive passenger to the green marker';
  const m = missionByIndex(G.storyIdx);
  return m ? 'Go to the pink marker: talk to ' + m.giver + ' — ' + m.title : 'Free roam — press T for taxi fares';
}

// ---------- particles / skids ----------
function spawnParts(x, y, color, n) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: (rnd() - 0.5) * 160, vy: (rnd() - 0.5) * 160, life: 0.4 + rnd() * 0.3, color, r: 2 + rnd() * 2 }); }
function smoke(x, y) { parts.push({ x, y, vx: (rnd() - 0.5) * 20, vy: -30 - rnd() * 30, life: 0.9, color: 'rgba(90,90,90,0.6)', r: 5 + rnd() * 5 }); }

// ---------- police ----------
function spawnCopCar() {
  const a = rnd() * 6.28, d = 620;
  const c = makeCar(player.x + Math.cos(a) * d, player.y + Math.sin(a) * d, 0, '#eef2f7', 'cop');
  c.hp = 120; cops.push(c); cars.push(c);
}
function spawnFootCop() {
  const a = rnd() * 6.28;
  peds.push({ x: player.x + Math.cos(a) * 380, y: player.y + Math.sin(a) * 380, a: 0, hp: 50, color: '#2a3a6a', state: 'chase', t: 0, dead: false, kind: 'cop', fireCd: 1 });
}

// ---------- update ----------
function update(dt) {
  G.elapsed += dt;
  G.time = (G.time + dt / G.dayLen * 24) % 24;
  if (G.msgT > 0) G.msgT -= dt;
  player.fireCd -= dt; player.punchCd -= dt;
  sfx.music(dt, G.mode === 'play');
  if (G.mode !== 'play') return;

  // wanted decay when unseen
  const anyCopNear = cops.length > 0 || peds.some(p => p.kind === 'cop' && !p.dead);
  if (G.elapsed - G.lastCrimeT > 14 && !anyCopNear) G.heat = Math.max(0, G.heat - dt * 0.06);
  else if (G.elapsed - G.lastCrimeT > 22) G.heat = Math.max(0, G.heat - dt * 0.05);
  const st = stars();
  // police pressure
  const wantCars = st >= 1 ? Math.min(1 + st, 5) : 0;
  if (cops.length < wantCars && rnd() < dt * 0.7) spawnCopCar();
  if (st >= 2 && peds.filter(p => p.kind === 'cop' && !p.dead).length < st - 1 && rnd() < dt * 0.4) spawnFootCop();
  if (st >= 2 && Math.floor(G.elapsed * 2) !== Math.floor((G.elapsed - dt) * 2)) sfx.sirenTick();

  updatePlayer(dt);
  updateCars(dt); updatePeds(dt); updateBullets(dt);
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) parts.splice(i, 1); }
  for (let i = skids.length - 1; i >= 0; i--) { skids[i].life -= dt; if (skids[i].life <= 0) skids.splice(i, 1); }
  updateMission(dt);
  // pickups
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    const px = player.inCar ? player.inCar.x : player.x, py = player.inCar ? player.inCar.y : player.y;
    if (Math.hypot(pk.x - px, pk.y - py) < 30) {
      pk.taken = true; setTimeout(() => { pk.taken = false; }, 45000);
      if (pk.t === 'health') { player.hp = Math.min(100, player.hp + 40); toast('+ Health'); }
      if (pk.t === 'ammo') { player.ammoPistol += 24; player.ammoSmg += 30; toast('+ Ammo'); }
      if (pk.t === 'cash') { G.cash += 40; sfx.cash(); toast('+$40 cash crate'); }
      if (pk.t === 'smg') { player.hasSmg = true; player.ammoSmg += 60; player.weapon = 'smg'; toast('SMG acquired! Press 2'); }
    }
  }
  if (player.hp <= 0) die('WASTED', 'hospital', 150);
}

function updatePlayer(dt) {
  if (player.inCar) {
    const c = player.inCar;
    const up = keys['w'] || keys['ArrowUp'], dn = keys['s'] || keys['ArrowDown'];
    const lf = keys['a'] || keys['ArrowLeft'], rt = keys['d'] || keys['ArrowRight'];
    const hb = keys['Space'];
    if (up) c.v += 260 * dt; if (dn) c.v -= (c.v > 10 ? 320 : 140) * dt;
    c.v *= hb ? 0.94 : 0.985;
    if (Math.abs(c.v) > 4) { const steer = (lf ? -1 : 0) + (rt ? 1 : 0); c.a += steer * dt * 2.1 * Math.sign(c.v) * Math.min(1, Math.abs(c.v) / 120); if (hb && Math.abs(c.v) > 90 && steer) { skids.push({ x: c.x, y: c.y, life: 4 }); if (rnd() < 0.4) spawnParts(c.x, c.y, '#dddddd', 1); } }
    moveCar(c, dt, true);
    player.x = c.x; player.y = c.y; player.a = c.a;
    if (Math.abs(c.v) > 40) sfx.engine(Math.abs(c.v) / 320);
    if (c.hp < 35 && rnd() < dt * 8) smoke(c.x, c.y);
    return;
  }
  let dx = (keys['d'] || keys['ArrowRight'] ? 1 : 0) - (keys['a'] || keys['ArrowLeft'] ? 1 : 0);
  let dy = (keys['s'] || keys['ArrowDown'] ? 1 : 0) - (keys['w'] || keys['ArrowUp'] ? 1 : 0);
  const sp = (keys['Shift'] ? 215 : 125);
  if (dx || dy) { const l = Math.hypot(dx, dy); dx /= l; dy /= l; player.a = Math.atan2(dy, dx); }
  const nx = player.x + dx * sp * dt, ny = player.y + dy * sp * dt;
  if (!collideBuildings(nx, player.y, 11, world.buildings) && !isWater(nx, player.y)) player.x = nx;
  if (!collideBuildings(player.x, ny, 11, world.buildings) && !isWater(player.x, ny)) player.y = ny;
  clampWorld(player);
  if (mouse.down) shoot();
  // mission giver proximity
  const m = missionByIndex(G.storyIdx);
  if (m && !G.mission && Math.hypot(player.x - m.where.x, player.y - m.where.y) < 44) { beginMission(G.storyIdx); }
}

function moveCar(c, dt, isPlayerCar) {
  const nx = c.x + Math.cos(c.a) * c.v * dt, ny = c.y + Math.sin(c.a) * c.v * dt;
  let blocked = collideBuildings(nx, ny, 17, world.buildings) || isWater(nx, ny);
  if (!blocked) for (const o of cars) { if (o !== c && !o.dead && Math.hypot(o.x - nx, o.y - ny) < 30) { blocked = true; if (isPlayerCar && Math.abs(c.v) > 120) { damageCar(o, 12); damageCar(c, 8); crime(0.4); G.shake = 5; sfx.noise(0.15, 0.15); } break; } }
  if (blocked) { if (isPlayerCar && Math.abs(c.v) > 100) { damageCar(c, 6); G.shake = 4; } c.v *= -0.25; }
  else { c.x = nx; c.y = ny; }
  clampWorld(c);
  // running over peds
  if (Math.abs(c.v) > 60) for (const p of peds) { if (!p.dead && Math.hypot(p.x - c.x, p.y - c.y) < 20) { hurtPed(p, 40, c.a); if (isPlayerCar || c.kind === 'player') crime(p.kind === 'cop' ? 1.4 : 0.7); } }
}
function damageCar(c, d) { c.hp -= d; spawnParts(c.x, c.y, '#ffb347', 4); if (c.hp <= 0 && !c.dead) { c.dead = true; c.v = 0; for (let i = 0; i < 14; i++) spawnParts(c.x, c.y, i % 2 ? '#ff7f2a' : '#555', 1); if (player.inCar === c) { player.hp -= 25; player.inCar = null; toast('Your car is wrecked!'); } if (c === rivalCar) { /* handled in mission */ } } }

function updateCars(dt) {
  for (const c of cars) {
    if (c.dead) continue;
    if (c === player.inCar) continue;
    if (c.kind === 'parked') continue;
    if (c.kind === 'cop') {
      const tp = player.inCar || player;
      const d = Math.hypot(tp.x - c.x, tp.y - c.y);
      const want = Math.atan2(tp.y - c.y, tp.x - c.x);
      let diff = want - c.a; while (diff > Math.PI) diff -= 6.283; while (diff < -Math.PI) diff += 6.283;
      c.a += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 3 * dt * 3));
      c.v += ((d > 55 ? 300 : 40) - c.v) * dt * 1.4;
      moveCar(c, dt, false);
      if (d < 40 && stars() >= 3) { player.hp -= dt * 4; } // ramming pressure / arrest attempt
      if (d < 34 && !player.inCar && stars() >= 1) { G.bustT = (G.bustT || 0) + dt; if (G.bustT > 1.6) die('BUSTED', 'police', 200); } else if (!player.inCar) G.bustT = Math.max(0, (G.bustT || 0) - dt);
      continue;
    }
    if (c.kind === 'rival') {
      // flee from player along roads
      const away = Math.atan2(c.y - player.y, c.x - player.x);
      let diff = away - c.a; while (diff > Math.PI) diff -= 6.283; while (diff < -Math.PI) diff += 6.283;
      c.a += Math.max(-1.8 * dt, Math.min(1.8 * dt, diff));
      c.v += (230 - c.v) * dt;
      moveCar(c, dt, false);
      if (c.hp <= 45) { c.dead = true; }
      continue;
    }
    // traffic: follow road direction, stop near intersections & obstacles
    const vert = Math.abs(Math.sin(c.a)) > 0.7;
    let stop = false;
    for (const o of cars) { if (o !== c && !o.dead && Math.hypot(o.x - (c.x + Math.cos(c.a) * 46), o.y - (c.y + Math.sin(c.a) * 46)) < 26) stop = true; }
    if (Math.hypot(player.x - (c.x + Math.cos(c.a) * 46), player.y - (c.y + Math.sin(c.a) * 46)) < 24 && !player.inCar) stop = true;
    const nearCross = (vert ? HY : VX).some(v => Math.abs((vert ? c.y : c.x) - v) < 62);
    if (nearCross && Math.floor(G.elapsed / 4) % 2 === 0) stop = true;
    c.v += ((stop ? 0 : 120) - c.v) * dt * 2;
    // turn at world edges / random intersections
    if ((vert && (c.y < 140 || c.y > BEACH_Y - 60)) || (!vert && (c.x < 140 || c.x > WORLD_W - 140))) c.a += Math.PI;
    if (nearCross && rnd() < dt * 0.25) c.a += (rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    // snap back toward nearest road lane
    moveCar(c, dt, false);
    if (!isRoad(c.x, c.y)) { // nudge back
      let bx = 1e9, by = 1e9;
      for (const v of VX) if (Math.abs(v - c.x) < Math.abs(bx - c.x)) bx = v;
      for (const h of HY) if (Math.abs(h - c.y) < Math.abs(by - c.y)) by = h;
      if (Math.abs(bx - c.x) < Math.abs(by - c.y)) c.x += Math.sign(bx - c.x) * 30 * dt; else c.y += Math.sign(by - c.y) * 30 * dt;
    }
  }
  // remove wrecked cop cars far away, despawn cops when heat 0
  for (let i = cops.length - 1; i >= 0; i--) { if (cops[i].dead || (stars() === 0 && Math.hypot(cops[i].x - player.x, cops[i].y - player.y) > 800)) { const ix = cars.indexOf(cops[i]); if (ix >= 0 && cops[i] !== player.inCar) cars.splice(ix, 1); cops.splice(i, 1); } }
}

function updatePeds(dt) {
  for (const p of peds) {
    if (p.dead) continue;
    p.t -= dt;
    const dP = Math.hypot(player.x - p.x, player.y - p.y);
    if (p.kind === 'cop') {
      const want = Math.atan2(player.y - p.y, player.x - p.x); p.a = want;
      if (dP > 46) { const nx = p.x + Math.cos(want) * 130 * dt, ny = p.y + Math.sin(want) * 130 * dt; if (!collideBuildings(nx, ny, 10, world.buildings)) { p.x = nx; p.y = ny; } }
      else if (!player.inCar) { G.bustT = (G.bustT || 0) + dt * 0.7; if (G.bustT > 1.8) die('BUSTED', 'police', 200); }
      p.fireCd = (p.fireCd || 1) - dt;
      if (stars() >= 2 && dP < 320 && p.fireCd <= 0 && !player.inCar) { p.fireCd = 0.9 + rnd() * 0.6; bullets.push({ x: p.x, y: p.y, vx: Math.cos(want) * 620, vy: Math.sin(want) * 620, life: 0.5, from: 'cop' }); sfx.shot(); }
      continue;
    }
    if (p.kind === 'thug') {
      const want = Math.atan2(player.y - p.y, player.x - p.x); p.a = want;
      if (dP > 150) { p.x += Math.cos(want) * 95 * dt; p.y += Math.sin(want) * 95 * dt; }
      p.fireCd = (p.fireCd || 1) - dt;
      if (dP < 300 && p.fireCd <= 0) { p.fireCd = 1.1 + rnd() * 0.7; bullets.push({ x: p.x, y: p.y, vx: Math.cos(want) * 560, vy: Math.sin(want) * 560, life: 0.5, from: 'thug' }); sfx.shot(); }
      continue;
    }
    if (p.state === 'flee' || dP < 90 && (player.fireCd > 0.15 || stars() > 0)) {
      p.state = 'flee';
      const away = Math.atan2(p.y - player.y, p.x - player.x); p.a = away;
      p.x += Math.cos(away) * 165 * dt; p.y += Math.sin(away) * 165 * dt;
      if (dP > 260) p.state = 'walk';
    } else {
      if (p.t <= 0) { p.t = 2 + rnd() * 3; p.a = Math.floor(rnd() * 4) * Math.PI / 2; }
      const nx = p.x + Math.cos(p.a) * 55 * dt, ny = p.y + Math.sin(p.a) * 55 * dt;
      if (!collideBuildings(nx, ny, 10, world.buildings) && !isWater(nx, ny)) { p.x = nx; p.y = ny; }
      else p.a += Math.PI / 2; // blocked: turn and try a new heading next tick
    }
    clampWorld(p);
  }
}
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let hit = b.life <= 0 || collideBuildings(b.x, b.y, 2, world.buildings);
    if (!hit && b.from === 'player') {
      for (const p of peds) { if (!p.dead && Math.hypot(p.x - b.x, p.y - b.y) < 13) { hurtPed(p, 22, Math.atan2(b.vy, b.vx)); hit = true; break; } }
      if (!hit) for (const c of cars) { if (!c.dead && c !== player.inCar && Math.hypot(c.x - b.x, c.y - b.y) < 22) { damageCar(c, 10); if (c.kind === 'cop') crime(0.8); hit = true; break; } }
    }
    if (!hit && b.from !== 'player' && !player.inCar && Math.hypot(player.x - b.x, player.y - b.y) < 12) { player.hp -= 9; G.shake = Math.max(G.shake, 3); sfx.hurt(); hit = true; }
    if (hit) bullets.splice(i, 1);
  }
}

function updateMission(dt) {
  // taxi
  if (G.taxi) {
    const t = G.taxi.stage === 0 ? G.taxi : G.taxi.dest;
    const px = player.inCar ? player.inCar.x : player.x, py = player.inCar ? player.inCar.y : player.y;
    if (Math.hypot(px - t.x, py - t.y) < 55 && player.inCar) {
      if (G.taxi.stage === 0) { G.taxi.stage = 1; toast('Passenger in! Drive to the green marker'); }
      else { G.cash += 120; sfx.cash(); toast('Taxi fare complete +$120'); G.taxi = null; persist(); }
    }
    return;
  }
  if (!G.mission) return;
  const m = G.mission, tgt = missionTarget();
  const px = player.inCar ? player.inCar.x : player.x, py = player.inCar ? player.inCar.y : player.y;
  if (m.kind === 'timed') { G.missionTimer -= dt; if (G.missionTimer <= 0) { failMission('out of time'); return; } }
  if (m.kind === 'shootout') { if (G.missionKills >= m.count) completeMission(); return; }
  if (m.kind === 'chase') { if (!rivalCar || rivalCar.dead || rivalCar.hp <= 45) { if (rivalCar) rivalCar.dead = true; completeMission(); } return; }
  if (tgt && Math.hypot(px - tgt.x, py - tgt.y) < 58) {
    if (m.kind === 'drive') completeMission();
    else if (m.kind === 'timed') completeMission();
    else if (m.kind === 'pickup') { if (G.missionStage === 0) { G.missionStage = 1; toast('Crate picked up — deliver it!'); } else completeMission(); }
    else if (m.kind === 'finale') { if (G.missionStage === 0) { G.missionStage = 1; G.heat = 5; G.lastCrimeT = G.elapsed; toast('You have the cash! Lose the heat — reach the safehouse!'); } else if (stars() <= 4) completeMission(); else toast('Too hot! Lose a star first'); }
  }
}

function die(kind, where, penalty) {
  if (G.mode === 'dead') return;
  G.deadKind = kind; G.mode = 'dead'; G.cash = Math.max(0, G.cash - penalty);
  setTimeout(() => {
    player.hp = 100; player.inCar = null; G.heat = 0; G.bustT = 0;
    for (const c of cops) { const ix = cars.indexOf(c); if (ix >= 0) cars.splice(ix, 1); } cops.length = 0;
    for (let i = peds.length - 1; i >= 0; i--) if (peds[i].kind === 'cop') peds.splice(i, 1);
    if (where === 'hospital') { player.x = 530; player.y = 580; } else { player.x = 3070; player.y = 580; }
    if (G.mission) failMission(kind.toLowerCase());
    G.mode = 'play'; persist();
  }, 2200);
}

// ---------- rendering ----------
function dayTint() {
  const t = G.time;
  if (t >= 7 && t < 17) return null;
  if (t >= 17 && t < 19.5) return 'rgba(255,120,50,0.20)'; // dusk
  if (t >= 19.5 || t < 5.5) return 'rgba(8,12,50,0.42)'; // night
  return 'rgba(255,170,80,0.14)'; // dawn
}
function isNight() { return G.time >= 19 || G.time < 6; }
const cam = { x: 0, y: 0 };
function draw() {
  const focus = player.inCar || player;
  cam.x = Math.max(0, Math.min(WORLD_W - W, focus.x - W / 2)) + (G.shake ? (rnd() - 0.5) * G.shake : 0);
  cam.y = Math.max(0, Math.min(WORLD_H - H, focus.y - H / 2)) + (G.shake ? (rnd() - 0.5) * G.shake : 0);
  if (G.shake > 0) G.shake *= 0.88;
  ctx.fillStyle = '#79a86b'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(-cam.x, -cam.y);
  // sand + water
  ctx.fillStyle = '#e8d194'; ctx.fillRect(0, BEACH_Y - 40, WORLD_W, 130);
  ctx.fillStyle = '#2e7fc2'; ctx.fillRect(0, BEACH_Y + 90, WORLD_W, WORLD_H - BEACH_Y);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let x = 0; x < WORLD_W; x += 90) ctx.fillRect(x + Math.sin(G.elapsed + x) * 6, BEACH_Y + 120 + (x % 200), 44, 4);
  // parks
  for (const p of world.parks) { ctx.fillStyle = '#5f9e52'; ctx.fillRect(p.x, p.y, p.w, p.h); }
  // sidewalks + roads
  ctx.fillStyle = '#c9c2b4';
  for (const v of VX) ctx.fillRect(v - ROAD_HALF - 14, 0, (ROAD_HALF + 14) * 2, BEACH_Y);
  for (const h of HY) ctx.fillRect(0, h - ROAD_HALF - 14, WORLD_W, (ROAD_HALF + 14) * 2);
  ctx.fillStyle = '#3c4048';
  for (const v of VX) ctx.fillRect(v - ROAD_HALF, 0, ROAD_HALF * 2, BEACH_Y);
  for (const h of HY) ctx.fillRect(0, h - ROAD_HALF, WORLD_W, ROAD_HALF * 2);
  ctx.strokeStyle = '#f2d24f'; ctx.lineWidth = 3; ctx.setLineDash([22, 18]);
  ctx.beginPath();
  for (const v of VX) { ctx.moveTo(v, 0); ctx.lineTo(v, BEACH_Y); }
  for (const h of HY) { ctx.moveTo(0, h); ctx.lineTo(WORLD_W, h); }
  ctx.stroke(); ctx.setLineDash([]);
  // skids
  ctx.fillStyle = 'rgba(20,20,20,0.5)';
  for (const s of skids) ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
  // buildings
  for (const b of world.buildings) {
    if (b.x + b.w < cam.x - 60 || b.x > cam.x + W + 60 || b.y + b.h < cam.y - 60 || b.y > cam.y + H + 60) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.roof; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,220,0.75)';
    const cols = Math.floor(b.w / 26), rows = Math.floor(b.h / 26);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { if ((i * 7 + j * 13 + b.floors) % 3) ctx.fillRect(b.x + 12 + i * 26, b.y + 12 + j * 26, 10, 8); }
    ctx.fillStyle = '#1d2430'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 4);
  }
  // props
  for (const p of world.props) {
    if (p.x < cam.x - 40 || p.x > cam.x + W + 40 || p.y < cam.y - 40 || p.y > cam.y + H + 40) continue;
    if (p.t === 'lamp') { ctx.fillStyle = '#444'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); if (isNight()) { ctx.fillStyle = 'rgba(255,230,150,0.30)'; ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, 7); ctx.fill(); } ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill(); }
    if (p.t === 'palm') { ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 3, p.y - 12); ctx.stroke(); ctx.strokeStyle = '#2e8b3a'; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; ctx.beginPath(); ctx.moveTo(p.x + 3, p.y - 12); ctx.lineTo(p.x + 3 + Math.cos(a) * 15, p.y - 12 + Math.sin(a) * 8 - 4); ctx.stroke(); } }
    if (p.t === 'crate') { ctx.fillStyle = '#a87c4a'; ctx.fillRect(p.x - 8, p.y - 8, 16, 16); ctx.strokeStyle = '#6a4a2a'; ctx.strokeRect(p.x - 8, p.y - 8, 16, 16); }
  }
  // pickups
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(G.elapsed * 4 + pk.x) * 3;
    ctx.fillStyle = pk.t === 'health' ? '#fff' : pk.t === 'ammo' ? '#f2c14e' : pk.t === 'smg' ? '#b45fd9' : '#57b26a';
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#16202c'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(pk.t === 'health' ? '+' : pk.t === 'ammo' ? 'A' : pk.t === 'smg' ? 'S' : '$', pk.x, pk.y + bob + 4);
  }
  // mission / taxi markers
  drawMarker(missionByIndex(G.storyIdx) && !G.mission ? missionByIndex(G.storyIdx).where : null, '#ff4fd8');
  if (G.mission) drawMarker(missionTarget(), '#ffd94f');
  if (G.taxi) { const t = G.taxi.stage === 0 ? G.taxi : G.taxi.dest; drawMarker(t, G.taxi.stage === 0 ? '#ffd94f' : '#57ff7a'); }
  // cars
  for (const c of cars) drawCar(c);
  // peds
  for (const p of peds) drawPed(p);
  // bullets + particles
  ctx.fillStyle = '#ffe97a'; for (const b of bullets) ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
  for (const p of parts) { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  // player on foot
  if (!player.inCar) drawPed({ x: player.x, y: player.y, a: player.a, color: '#ff5964', kind: 'player', dead: false });
  ctx.restore();
  // day tint
  const tint = dayTint(); if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); }
  // headlights at night
  if (isNight() && player.inCar) { ctx.fillStyle = 'rgba(255,240,180,0.16)'; ctx.beginPath(); const sx = W / 2, sy = H / 2; ctx.moveTo(sx, sy); ctx.arc(sx, sy, 190, player.inCar.a - 0.32, player.inCar.a + 0.32); ctx.closePath(); ctx.fill(); }
  drawHUD();
  if (G.mode === 'title') drawTitle();
  if (G.mode === 'pause') drawCenterPanel('PAUSED', 'Esc / P to resume — M mute, E enter car, F punch, 1/2 weapons, T taxi');
  if (G.mode === 'dead') drawCenterPanel(G.deadKind, G.deadKind === 'BUSTED' ? 'The SVPD got you. Cash penalty applied.' : 'You flatlined. The hospital patched you up — for a fee.');
  if (G.mode === 'dialogue' && G.dialogue) drawDialogue();
}
function drawMarker(t, color) {
  if (!t) return;
  const bob = Math.sin(G.elapsed * 3) * 6;
  ctx.fillStyle = color; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.arc(t.x, t.y, 20 + bob * 0.3, 0, 7); ctx.fill();
  ctx.globalAlpha = 1; ctx.fillStyle = '#16202c'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', t.x, t.y + 6);
}
function drawCar(c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a);
  if (c.dead) { ctx.fillStyle = '#2b2b2b'; ctx.fillRect(-22, -12, 44, 24); ctx.restore(); return; }
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-20, -9, 46, 26);
  ctx.fillStyle = c.color; ctx.fillRect(-22, -12, 44, 24);
  ctx.fillStyle = c.kind === 'cop' ? '#16202c' : 'rgba(20,30,45,0.85)';
  ctx.fillRect(-6, -10, 16, 20);
  ctx.fillStyle = '#cfe8ff'; ctx.fillRect(8, -9, 5, 18);
  ctx.fillStyle = '#111'; ctx.fillRect(-20, -14, 10, 4); ctx.fillRect(-20, 10, 10, 4); ctx.fillRect(10, -14, 10, 4); ctx.fillRect(10, 10, 10, 4);
  if (c.kind === 'cop') { ctx.fillStyle = (Math.floor(G.elapsed * 4) % 2 ? '#ff4040' : '#4080ff'); ctx.fillRect(-4, -4, 10, 8); ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SVPD', 0, -15); }
  if (isNight()) { ctx.fillStyle = '#fff6bf'; ctx.fillRect(22, -9, 3, 5); ctx.fillRect(22, 4, 3, 5); }
  ctx.restore();
  if (c.hp < 100 && !c.dead) { ctx.fillStyle = '#222'; ctx.fillRect(c.x - 18, c.y - 24, 36, 4); ctx.fillStyle = c.hp > 40 ? '#57b26a' : '#e04040'; ctx.fillRect(c.x - 18, c.y - 24, 36 * Math.max(0, c.hp) / 100, 4); }
}
function drawPed(p) {
  ctx.save(); ctx.translate(p.x, p.y);
  if (p.dead) { ctx.fillStyle = '#7a2020'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); ctx.restore(); return; }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(2, 3, 8, 0, 7); ctx.fill();
  ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(Math.cos(p.a) * 3, Math.sin(p.a) * 3, 4.5, 0, 7); ctx.fill();
  if (p.kind === 'cop') { ctx.fillStyle = '#ffd94f'; ctx.fillRect(-6, -13, 12, 3); }
  if (p.kind === 'player') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.stroke(); }
  ctx.restore();
}
function drawHUD() {
  if (G.mode === 'title') { drawMinimap(); return; }
  ctx.fillStyle = 'rgba(10,16,26,0.72)'; ctx.fillRect(14, 14, 300, 96);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('SAN VERANO', 24, 36);
  ctx.fillStyle = '#3a4a5a'; ctx.fillRect(24, 46, 180, 12);
  ctx.fillStyle = player.hp > 30 ? '#57e07a' : '#e04040'; ctx.fillRect(24, 46, 180 * Math.max(0, player.hp) / 100, 12);
  ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
  ctx.fillText('HP ' + Math.ceil(player.hp) + (player.inCar ? '   CAR ' + Math.max(0, Math.ceil(player.inCar.hp)) + '%' : ''), 24, 76);
  ctx.fillStyle = '#ffd94f'; ctx.font = 'bold 16px sans-serif';
  ctx.fillText('$' + G.cash, 24, 98);
  const hh = Math.floor(G.time), mnt = Math.floor((G.time - hh) * 60);
  ctx.fillStyle = '#cfe8ff'; ctx.font = '13px sans-serif';
  ctx.fillText('Day clock ' + String(hh).padStart(2, '0') + ':' + String(mnt).padStart(2, '0'), 130, 98);
  // stars
  ctx.font = '22px sans-serif'; ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i < stars() ? '#ffd94f' : 'rgba(255,255,255,0.25)'; ctx.fillText('★', W - 24 - (4 - i) * 26, 40); }
  // weapon
  ctx.fillStyle = 'rgba(10,16,26,0.72)'; ctx.fillRect(W - 190, 52, 176, 44);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText((player.weapon === 'smg' ? 'SMG' : 'PISTOL') + '  ammo ' + (player.weapon === 'smg' ? player.ammoSmg : player.ammoPistol), W - 178, 72);
  ctx.font = '11px sans-serif'; ctx.fillStyle = '#9fb6c9'; ctx.fillText('F punch · E car · T taxi · M mute', W - 178, 89);
  // objective
  ctx.fillStyle = 'rgba(10,16,26,0.72)'; ctx.fillRect(14, H - 52, Math.min(760, W - 220), 38);
  ctx.fillStyle = '#ffe9a0'; ctx.font = '14px sans-serif'; ctx.fillText('▸ ' + currentObjective(), 24, H - 28);
  if (G.msgT > 0) { ctx.fillStyle = 'rgba(10,16,26,0.8)'; ctx.fillRect(W / 2 - 220, 70, 440, 36); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(G.msg, W / 2, 93); }
  if (G.bustT > 0.2 && !player.inCar) { ctx.fillStyle = '#ff5964'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BUST INCOMING — RUN!', W / 2, 140); }
  drawMinimap();
}
function drawMinimap() {
  const S = 168, ox = W - S - 14, oy = H - S - 62;
  mctx.clearRect(0, 0, S, S);
  mm.style.left = ox + 'px'; mm.style.top = oy + 'px';
  mctx.fillStyle = '#274435'; mctx.fillRect(0, 0, S, S);
  mctx.fillStyle = '#2e7fc2'; mctx.fillRect(0, (BEACH_Y + 90) / WORLD_H * S, S, S);
  mctx.strokeStyle = '#9aa3ad'; mctx.lineWidth = 3;
  for (const v of VX) { mctx.beginPath(); mctx.moveTo(v / WORLD_W * S, 0); mctx.lineTo(v / WORLD_W * S, S); mctx.stroke(); }
  for (const h of HY) { mctx.beginPath(); mctx.moveTo(0, h / WORLD_H * S); mctx.lineTo(S, h / WORLD_H * S); mctx.stroke(); }
  const dot = (x, y, c, r) => { mctx.fillStyle = c; mctx.beginPath(); mctx.arc(x / WORLD_W * S, y / WORLD_H * S, r || 3, 0, 7); mctx.fill(); };
  for (const c of cops) dot(c.x, c.y, '#4f9fff', 3);
  const tgt = G.mission ? missionTarget() : (missionByIndex(G.storyIdx) ? missionByIndex(G.storyIdx).where : null);
  if (tgt) dot(tgt.x, tgt.y, '#ff4fd8', 4);
  if (G.taxi) { const t = G.taxi.stage === 0 ? G.taxi : G.taxi.dest; dot(t.x, t.y, '#ffd94f', 4); }
  // player arrow
  mctx.save(); mctx.translate(player.x / WORLD_W * S, player.y / WORLD_H * S); mctx.rotate(player.a);
  mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.moveTo(7, 0); mctx.lineTo(-5, -4); mctx.lineTo(-5, 4); mctx.closePath(); mctx.fill(); mctx.restore();
  mctx.strokeStyle = 'rgba(255,255,255,0.6)'; mctx.lineWidth = 2; mctx.strokeRect(0, 0, S, S);
}
function drawTitle() {
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, 'rgba(30,8,50,0.55)'); gr.addColorStop(1, 'rgba(200,60,110,0.35)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94f'; ctx.font = 'bold 30px sans-serif'; ctx.fillText('★  N E O N   C O A S T  ★', W / 2, H * 0.26);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 84px sans-serif';
  ctx.shadowColor = '#ff4fd8'; ctx.shadowBlur = 34; ctx.fillText('SAN VERANO', W / 2, H * 0.42); ctx.shadowBlur = 0;
  ctx.fillStyle = '#cfe8ff'; ctx.font = '19px sans-serif';
  ctx.fillText('An original open-world crime story — six missions, one neon city, zero permission.', W / 2, H * 0.50);
  ctx.fillStyle = '#ff5964'; ctx.fillRect(W / 2 - 130, H * 0.58, 260, 48);
  ctx.fillStyle = '#ffd94f'; if (save) ctx.fillRect(W / 2 - 130, H * 0.58 + 60, 260, 48);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif';
  ctx.fillText('▶  NEW GAME', W / 2, H * 0.58 + 31);
  if (save) { ctx.fillStyle = '#16202c'; ctx.fillText('CONTINUE  ($' + (save.cash ?? 0) + ', mission ' + ((save.storyIdx ?? 0) + 1) + ')', W / 2, H * 0.58 + 91); }
  ctx.fillStyle = '#e8e8e8'; ctx.font = '14px sans-serif';
  ctx.fillText('Click a button or press Enter · WASD drive/walk · E enter car · mouse aim, click shoot · Esc pause', W / 2, H * 0.82);
}
function drawCenterPanel(title, sub) {
  ctx.fillStyle = 'rgba(8,10,20,0.78)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(title, W / 2, H / 2 - 10);
  ctx.font = '17px sans-serif'; ctx.fillStyle = '#cfe8ff'; ctx.fillText(sub, W / 2, H / 2 + 32);
}
function drawDialogue() {
  const line = G.dialogue.lines[G.dlgIdx];
  ctx.fillStyle = 'rgba(8,12,22,0.88)'; ctx.fillRect(W / 2 - 420, H - 190, 840, 120);
  ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - 420, H - 190, 840, 120);
  ctx.fillStyle = '#ffd94f'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(line[0], W / 2 - 396, H - 152);
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif'; ctx.fillText(line[1], W / 2 - 396, H - 118);
  ctx.fillStyle = '#9fb6c9'; ctx.font = '13px sans-serif'; ctx.fillText('Press E / Space / Enter to continue ▸', W / 2 - 396, H - 88);
}
cv.addEventListener('click', e => {
  if (G.mode === 'dialogue') { advanceDialogue(); return; }
  if (G.mode !== 'title') return;
  const bx = W / 2 - 130, bw = 260;
  if (e.clientX >= bx && e.clientX <= bx + bw) {
    if (e.clientY >= H * 0.58 && e.clientY <= H * 0.58 + 48) startGame(false);
    else if (save && e.clientY >= H * 0.58 + 60 && e.clientY <= H * 0.58 + 108) startGame(true);
  }
});
function startGame(cont) {
  sfx.ensure();
  if (cont && loadSave()) toast('Welcome back to San Verano');
  else { G.cash = 120; G.storyIdx = 0; player.x = 1690; player.y = 1120; player.hp = 100; }
  G.mode = 'play';
}

// ---------- staged screenshot scenes ----------
function stageShot() {
  if (!SHOT) return;
  player.hp = 100;
  if (SHOT === 'cover') { G.time = 18.6; G.mode = 'title'; player.x = 1800; player.y = 1300; }
  if (SHOT === 'drive') {
    G.time = 11; G.mode = 'play';
    const c = cars.find(x => x.kind === 'parked') || cars[0];
    c.x = 1800; c.y = 1300; c.a = 0; c.hp = 100; c.v = 190; player.inCar = c; c.kind = 'player'; player.x = c.x; player.y = c.y;
    toast('Downtown San Verano');
  }
  if (SHOT === 'chase') {
    G.time = 15; G.mode = 'play'; G.heat = 3.4; G.lastCrimeT = 1e9;
    const c = cars.find(x => x.kind === 'parked') || cars[0];
    c.x = 1800; c.y = 1300; c.a = 0; c.hp = 100; c.v = 220; player.inCar = c; c.kind = 'player'; player.x = c.x; player.y = c.y;
    for (let i = 0; i < 3; i++) { const pc = makeCar(1800 - 120 - i * 90, 1300 + (i % 2 ? 34 : -34), 0, '#eef2f7', 'cop'); pc.hp = 120; pc.v = 200; cops.push(pc); cars.push(pc); }
  }
  if (SHOT === 'mission') {
    G.time = 10; G.mode = 'play'; player.x = 1652; player.y = 1060; player.hp = 100;
    const m = STORY[0];
    G.dialogue = { lines: m.lines, after: null }; G.dlgIdx = 0; G.mode = 'dialogue';
  }
}
stageShot();

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.mode === 'play' || G.mode === 'dialogue') update(dt);
  else { G.elapsed += dt; }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
