// SAN VERANO: Neon Coast — original top-down open-world crime game.
// Canvas 2D, ES modules, no network, all art drawn, all sound synthesized.
import { WORLD_W, WORLD_H, ROAD_XS, ROAD_YS, ROAD_W, BEACH_Y, buildWorld, isRoad, collideBuildings, mulberry } from './world.js';
import { AudioEngine } from './audio.js';
import { MISSIONS, CHARACTERS, missionGiverPos } from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 1280, H = 720;
function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

const params = new URLSearchParams(location.search);
const shotMode = params.get('shot');
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const rnd = mulberry(seed * 7919 + 13);
const audio = new AudioEngine();

const world = buildWorld(seed);
const SAVE_KEY = 'sanverano_save_v1';

const keys = {};
let mouseX = 0, mouseY = 0, mouseDown = false;
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault();
  audio.ensure();
  if (e.key.toLowerCase() === 'm') { audio.setMuted(!audio.muted); toast(audio.muted ? 'Sound OFF (M)' : 'Sound ON (M)'); }
  if (e.key === 'Escape' || e.key.toLowerCase() === 'p') { if (state.screen === 'play') state.screen = 'pause'; else if (state.screen === 'pause') state.screen = 'play'; }
  if (e.key.toLowerCase() === 'e') tryEnterExit();
  if (e.key === '1') setWeapon('pistol');
  if (e.key === '2') setWeapon('smg');
  if (e.key.toLowerCase() === 'f') doPunch();
  if (e.key.toLowerCase() === 'enter' && state.dialogue) advanceDialogue();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
canvas.addEventListener('mousedown', e => { mouseDown = true; audio.ensure(); if (state.dialogue) advanceDialogue(); else if (state.screen === 'play') playerShoot(); });
window.addEventListener('mouseup', () => { mouseDown = false; });
canvas.addEventListener('click', e => { handleMenuClick(e.clientX, e.clientY); });

function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && typeof s.cash === 'number') return s; } catch (e) {}
  return null;
}
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: state.cash, mission: state.missionIdx, x: player.x, y: player.y, hp: player.hp })); } catch (e) {}
}

const CAR_COLORS = ['#e63946','#457b9d','#f4d35e','#2a9d8f','#9d4edd','#ffffff','#fb8500','#06d6a0','#ef476f','#4361ee'];
function makeCar(x, y, angle, color, kind) {
  return { x, y, angle: angle || 0, speed: 0, color: color || CAR_COLORS[(rnd() * CAR_COLORS.length) | 0], kind: kind || 'civil', hp: 100, w: 44, h: 22, driver: true, aiTimer: rnd() * 2, targetSpeed: 120 + rnd() * 80, smokeT: 0, dead: false, isTarget: false, stopped: 0 };
}
function makePed(x, y, kind) {
  const shirts = ['#ffd166','#06d6a0','#ef476f','#4cc9f0','#f72585','#ffffff','#ff9f1c','#2ec4b6'];
  return { x, y, angle: rnd() * Math.PI * 2, speed: 0, kind: kind || 'civil', hp: kind === 'cop' ? 60 : (kind === 'thug' ? 50 : 30), color: shirts[(rnd() * shirts.length) | 0], state: 'walk', timer: rnd() * 3, shootCd: 0, dead: false, fleeT: 0, punchCd: 0 };
}

const player = { x: 900, y: 1470, angle: -Math.PI / 2, hp: 100, maxHp: 100, car: null, speed: 0, weapon: 'pistol', ammo: { pistol: 60, smg: 0 }, hasSmg: false, shootCd: 0, punchCd: 0, radius: 11 };
const state = {
  screen: 'title', cash: 100, wanted: 0, wantedHeat: 0, hideTimer: 0, time: 17.2, day: 1,
  missionIdx: 0, missionStep: -1, missionActive: false, dialogue: null, dialogueCb: null,
  objective: 'Talk to Rosa at Casa Rosa (follow the yellow marker)', timer: 0, timerOn: false,
  shake: 0, bustedT: 0, taxi: null, taxiCd: 5, kills: 0, gameWon: false, msg: '', msgT: 0,
  chaseCar: null, thugsLeft: 0, fadeMsg: '',
};
let cars = [], peds = [], bullets = [], particles = [], skids = [], cops = [];
let camX = player.x, camY = player.y, elapsed = 0;

function toast(t) { state.msg = t; state.msgT = 3.2; }
function addWanted(n) {
  state.wantedHeat += n;
  const ns = Math.min(5, Math.floor(state.wantedHeat / 3));
  if (ns > state.wanted) { state.wanted = ns; }
  state.hideTimer = 0;
}
function setWeapon(w) { if (w === 'smg' && !player.hasSmg) { toast('Find the SMG at the Ammo shop first'); return; } player.weapon = w; }

function spawnTraffic() {
  cars = [];
  for (const p of world.parked) { const c = makeCar(p.x, p.y, p.angle, p.color, 'parked'); c.driver = false; cars.push(c); }
  for (let i = 0; i < 16; i++) {
    const vertical = rnd() > 0.5;
    let x, y, a;
    if (vertical) { const rx = ROAD_XS[(rnd() * ROAD_XS.length) | 0]; const dir = rnd() > 0.5 ? 1 : -1; x = rx + (dir > 0 ? 26 : -26); y = 200 + rnd() * 1800; a = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { const ry = ROAD_YS[(rnd() * ROAD_YS.length) | 0]; const dir = rnd() > 0.5 ? 1 : -1; y = ry + (dir > 0 ? -26 : 26); x = 200 + rnd() * 2800; a = dir > 0 ? 0 : Math.PI; }
    const c = makeCar(x, y, a, null, 'traffic'); c.speed = 100; cars.push(c);
  }
  // Rosa's coupe for mission 1
  const coupe = makeCar(950, 1550, 0, '#06d6a0', 'civil'); coupe.isCoupe = true; cars.push(coupe);
}
function spawnPeds() {
  peds = [];
  for (let i = 0; i < 42; i++) {
    let x = 150 + rnd() * (WORLD_W - 300), y = 150 + rnd() * 1800;
    if (collideBuildings(world.buildings, x, y, 12)) { i--; continue; }
    peds.push(makePed(x, y, 'civil'));
  }
}
function spawnCopCar() {
  const a = rnd() * Math.PI * 2, d = 620;
  const x = Math.max(60, Math.min(WORLD_W - 60, player.x + Math.cos(a) * d));
  const y = Math.max(60, Math.min(BEACH_Y - 40, player.y + Math.sin(a) * d));
  const c = makeCar(x, y, 0, '#dfe6ee', 'cop'); c.isCop = true; cops.push(c); cars.push(c);
}
function spawnFootCop() {
  const a = rnd() * Math.PI * 2;
  const p = makePed(player.x + Math.cos(a) * 340, player.y + Math.sin(a) * 340, 'cop');
  p.color = '#274472'; peds.push(p);
}

// ---------- dialogue / missions ----------
function showDialogue(lines, cb) { state.dialogue = { lines, idx: 0 }; state.dialogueCb = cb || null; }
function advanceDialogue() {
  if (!state.dialogue) return;
  state.dialogue.idx++;
  audio.blip(700, 0.05, 'square', 0.05);
  if (state.dialogue.idx >= state.dialogue.lines.length) { const cb = state.dialogueCb; state.dialogue = null; state.dialogueCb = null; if (cb) cb(); }
}
function currentStep() {
  if (state.missionIdx >= MISSIONS.length || state.missionStep < 0) return null;
  return MISSIONS[state.missionIdx].steps[state.missionStep];
}
function startMission(idx) {
  const m = MISSIONS[idx]; if (!m) return;
  state.missionActive = true; state.missionStep = 0;
  showDialogue(m.intro, () => { applyStep(); toast('Mission: ' + m.title); });
  applyStepObjective();
}
function applyStepObjective() {
  const s = currentStep(); if (!s) { state.objective = state.missionIdx >= MISSIONS.length ? 'Free roam — taxi fares and deliveries pay cash' : 'Talk to the marked contact'; return; }
  state.objective = s.text;
  if (s.timer) { state.timer = s.timer; state.timerOn = true; } else state.timerOn = false;
  if (s.wanted) { state.wantedHeat = Math.max(state.wantedHeat, s.wanted * 3 + 1); state.wanted = Math.max(state.wanted, s.wanted); }
}
function applyStep() {
  const s = currentStep(); if (!s) return;
  if (s.type === 'chase' && !state.chaseCar) {
    const c = makeCar(s.x, s.y, Math.PI, '#ffbe0b', 'traffic'); c.isTarget = true; c.hp = 55; c.speed = 150; cars.push(c); state.chaseCar = c;
  }
  if (s.type === 'shootout') {
    state.thugsLeft = s.count;
    for (let i = 0; i < s.count; i++) { const p = makePed(s.x + (rnd() - 0.5) * 220, s.y + (rnd() - 0.5) * 220, 'thug'); p.color = '#7f1d2d'; peds.push(p); }
  }
  applyStepObjective();
}
function completeStep() {
  const m = MISSIONS[state.missionIdx];
  state.missionStep++;
  if (state.missionStep >= m.steps.length) {
    state.cash += m.reward; audio.mission(); state.missionActive = false; state.missionStep = -1;
    showDialogue(m.outro, () => {});
    toast('Mission complete! +$' + m.reward);
    state.missionIdx++;
    if (state.missionIdx >= MISSIONS.length) { state.gameWon = true; state.objective = 'Story complete! Free roam — taxi fares pay cash'; }
    else state.objective = 'Talk to ' + MISSIONS[state.missionIdx].giver + ' (yellow marker)';
    saveGame();
  } else { applyStep(); toast('Objective updated'); }
}
function failMission(reason) {
  audio.fail(); state.missionActive = false; state.missionStep = -1; state.timerOn = false;
  if (state.chaseCar) { state.chaseCar.isTarget = false; state.chaseCar = null; }
  toast('Mission failed: ' + reason + ' — talk to the contact to retry');
  state.objective = 'Mission failed — return to the contact to retry';
}
function checkMission() {
  const s = currentStep(); if (!s || state.dialogue) return;
  const px = player.car ? player.car.x : player.x, py = player.car ? player.car.y : player.y;
  const d = Math.hypot(px - s.x, py - s.y);
  if (s.type === 'enter_car') { if (player.car && player.car.isCoupe) completeStep(); return; }
  if (s.type === 'goto') {
    if (s.needCar && !player.car) return;
    if (d < 70) completeStep(); return;
  }
  if (s.type === 'chase') {
    if (state.chaseCar) {
      if (state.chaseCar.dead || state.chaseCar.hp <= 12) { state.chaseCar.speed = 0; toast('Stolen car stopped! Get in it'); if (player.car === state.chaseCar) { state.chaseCar = null; completeStep(); } }
    }
    return;
  }
  if (s.type === 'shootout') { if (state.thugsLeft <= 0) completeStep(); return; }
  if (s.type === 'escape') { if (state.wanted === 0) completeStep(); return; }
}
function tryTalk() {
  if (state.dialogue || state.missionActive) return false;
  const g = missionGiverPos(state.missionIdx); if (!g) return false;
  if (Math.hypot(player.x - g.x, player.y - g.y) < 60 && !player.car) { startMission(state.missionIdx); return true; }
  return false;
}

// ---------- combat / interaction ----------
function burst(x, y, color, n, spd) {
  for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, s = (spd || 120) * (0.3 + rnd()); particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + rnd() * 0.4, max: 0.8, color, size: 2 + rnd() * 3 }); }
}
function playerShoot() {
  if (player.car || player.shootCd > 0 || state.dialogue) return;
  const w = player.weapon;
  if (player.ammo[w] <= 0) { audio.blip(200, 0.06, 'square', 0.08); toast('No ammo — find ammo pickups'); return; }
  player.ammo[w]--; player.shootCd = w === 'smg' ? 0.09 : 0.28;
  const wx = camX + mouseX, wy = camY + mouseY;
  const a = Math.atan2(wy - player.y, wx - player.x) + (rnd() - 0.5) * (w === 'smg' ? 0.09 : 0.03);
  player.angle = a;
  bullets.push({ x: player.x + Math.cos(a) * 16, y: player.y + Math.sin(a) * 16, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.6, from: 'player', dmg: w === 'smg' ? 16 : 26 });
  burst(player.x + Math.cos(a) * 20, player.y + Math.sin(a) * 20, '#ffd166', 3, 60);
  audio.shoot(w === 'smg');
  addWanted(1.2);
  for (const p of peds) if (!p.dead && Math.hypot(p.x - player.x, p.y - player.y) < 260) { p.state = 'flee'; p.fleeT = 3; }
}
function doPunch() {
  if (player.car || player.punchCd > 0 || state.screen !== 'play') return;
  player.punchCd = 0.35; audio.punch();
  burst(player.x + Math.cos(player.angle) * 18, player.y + Math.sin(player.angle) * 18, '#ffffff', 3, 50);
  for (const p of peds) {
    if (p.dead) continue;
    if (Math.hypot(p.x - player.x, p.y - player.y) < 34) { hurtPed(p, 18, true); }
  }
  for (const c of cars) { if (c !== player.car && Math.hypot(c.x - player.x, c.y - player.y) < 42) { damageCar(c, 6); } }
}
function hurtPed(p, dmg, melee) {
  p.hp -= dmg; p.state = 'flee'; p.fleeT = 3; burst(p.x, p.y, '#e63946', 5, 90);
  if (p.kind === 'cop') addWanted(2.5); else if (p.kind === 'civil') addWanted(melee ? 1 : 2);
  if (p.hp <= 0 && !p.dead) {
    p.dead = true; state.kills++;
    if (p.kind === 'thug') { state.thugsLeft = Math.max(0, state.thugsLeft - 1); state.cash += 40; toast('Thug down +$40'); }
    if (p.kind === 'cop') addWanted(3);
    burst(p.x, p.y, '#e63946', 14, 140);
  }
}
function damageCar(c, dmg) {
  c.hp -= dmg;
  if (c.hp <= 0 && !c.dead) { c.dead = true; c.speed = 0; burst(c.x, c.y, '#ff8500', 22, 200); burst(c.x, c.y, '#333333', 12, 80); audio.crash(); state.shake = Math.max(state.shake, 8); if (c.isCop) addWanted(3); }
}
function tryEnterExit() {
  if (state.screen !== 'play' || state.dialogue) return;
  if (player.car) {
    const c = player.car; player.x = c.x + Math.cos(c.angle + Math.PI / 2) * 30; player.y = c.y + Math.sin(c.angle + Math.PI / 2) * 30;
    player.car = null; audio.setEngine(false, 0); return;
  }
  let best = null, bd = 52;
  for (const c of cars) { if (c.dead) continue; const d = Math.hypot(c.x - player.x, c.y - player.y); if (d < bd) { bd = d; best = c; } }
  if (best) {
    player.car = best; best.driver = true;
    if (best.kind === 'parked' || best.kind === 'traffic') { if (!best.isCoupe) { addWanted(2); toast('Vehicle stolen!'); } }
    if (best.kind === 'traffic') best.kind = 'civil';
    audio.ensure();
  }
}
function hurtPlayer(dmg) {
  player.hp -= dmg; state.shake = Math.max(state.shake, 3);
  if (player.hp <= 0 && state.screen === 'play') { state.screen = 'wasted'; onDeath(false); }
}
function onDeath(busted) {
  const penalty = Math.min(state.cash, busted ? 150 : 200);
  state.cash -= penalty; state.wanted = 0; state.wantedHeat = 0;
  if (state.missionActive) failMission(busted ? 'busted' : 'wasted');
  audio.setEngine(false, 0); audio.setSiren(false);
  setTimeout(() => {
    player.hp = 100; player.car = null;
    if (busted) { player.x = 950; player.y = 985; } else { player.x = 1950; player.y = 545; }
    state.screen = 'play'; saveGame();
  }, 2600);
}

// ---------- update ----------
function moveEntity(e, nx, ny, r) {
  if (!collideBuildings(world.buildings, nx, e.y, r)) e.x = nx;
  if (!collideBuildings(world.buildings, e.x, ny, r)) e.y = ny;
  e.x = Math.max(20, Math.min(WORLD_W - 20, e.x));
  e.y = Math.max(20, Math.min(WORLD_H - 20, e.y));
}
function updatePlayer(dt) {
  player.shootCd = Math.max(0, player.shootCd - dt); player.punchCd = Math.max(0, player.punchCd - dt);
  if (state.dialogue) { audio.setEngine(false, 0); return; }
  if (tryTalk()) return;
  if (player.car) {
    const c = player.car;
    const fwd = (keys['w'] || keys['arrowup']) ? 1 : 0, back = (keys['s'] || keys['arrowdown']) ? 1 : 0;
    const left = (keys['a'] || keys['arrowleft']) ? 1 : 0, right = (keys['d'] || keys['arrowright']) ? 1 : 0;
    const accel = c.hp <= 0 ? 0 : 340;
    if (fwd) c.speed += accel * dt;
    if (back) c.speed -= (c.speed > 10 ? 420 : 200) * dt;
    if (!fwd && !back) c.speed -= c.speed * 0.7 * dt;
    if (keys[' ']) { c.speed -= c.speed * 3.2 * dt; if (Math.abs(c.speed) > 60 && rnd() > 0.4) skids.push({ x: c.x - Math.cos(c.angle) * 14, y: c.y - Math.sin(c.angle) * 14, life: 6 }); }
    const maxSp = c.isCop ? 430 : 390;
    c.speed = Math.max(-150, Math.min(maxSp, c.speed));
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    if (Math.abs(c.speed) > 4) { c.angle += steer * 1.9 * dt * Math.sign(c.speed) * Math.min(1, Math.abs(c.speed) / 120); if (Math.abs(c.speed) > 140 && steer !== 0 && rnd() > 0.5) skids.push({ x: c.x, y: c.y, life: 5 }); }
    const nx = c.x + Math.cos(c.angle) * c.speed * dt, ny = c.y + Math.sin(c.angle) * c.speed * dt;
    const hitB = collideBuildings(world.buildings, nx, ny, 20);
    if (hitB) { if (Math.abs(c.speed) > 130) { damageCar(c, Math.abs(c.speed) * 0.05); hurtPlayer(3); audio.crash(); state.shake = 6; burst(c.x, c.y, '#ffe066', 8, 130); } c.speed *= -0.25; }
    else { c.x = Math.max(30, Math.min(WORLD_W - 30, nx)); c.y = Math.max(30, Math.min(BEACH_Y + 60, ny)); }
    if (c.y > BEACH_Y + 90) c.speed *= 0.92;
    player.x = c.x; player.y = c.y; player.angle = c.angle;
    // collisions with other cars / peds
    for (const o of cars) {
      if (o === c) continue;
      const d = Math.hypot(o.x - c.x, o.y - c.y);
      if (d < 40 && d > 0.01) {
        const push = (40 - d) / 2, ux = (o.x - c.x) / d, uy = (o.y - c.y) / d;
        o.x += ux * push; o.y += uy * push;
        if (Math.abs(c.speed) > 90) { damageCar(o, 9); damageCar(c, 5); audio.crash(); burst(o.x, o.y, '#ffe066', 7, 120); addWanted(1.4); if (o.isCop) addWanted(1.5); o.speed = c.speed * 0.4; }
        c.speed *= 0.82;
      }
    }
    for (const p of peds) {
      if (p.dead) continue;
      if (Math.hypot(p.x - c.x, p.y - c.y) < 26 && Math.abs(c.speed) > 40) { hurtPed(p, 60, false); audio.crash(); state.shake = 5; c.speed *= 0.7; }
      else if (Math.hypot(p.x - c.x, p.y - c.y) < 70 && Math.abs(c.speed) > 120) { p.state = 'flee'; p.fleeT = 2; }
    }
    audio.setEngine(true, Math.abs(c.speed) / 390);
    if (c.hp < 35 && c.hp > 0) { c.smokeT -= dt; if (c.smokeT <= 0) { c.smokeT = 0.09; particles.push({ x: c.x, y: c.y - 6, vx: (rnd() - 0.5) * 20, vy: -30 - rnd() * 20, life: 0.8, max: 0.8, color: '#555555', size: 5 + rnd() * 5 }); } }
    if (c.hp <= 0) { hurtPlayer(14 * dt); }
  } else {
    audio.setEngine(false, 0);
    let mx = 0, my = 0;
    if (keys['w'] || keys['arrowup']) my -= 1;
    if (keys['s'] || keys['arrowdown']) my += 1;
    if (keys['a'] || keys['arrowleft']) mx -= 1;
    if (keys['d'] || keys['arrowright']) mx += 1;
    const sprint = (keys['shift']) ? 1.55 : 1;
    const spd = 165 * sprint;
    if (mx || my) {
      const l = Math.hypot(mx, my); mx /= l; my /= l;
      player.angle = Math.atan2(my, mx);
      const nx = player.x + mx * spd * dt, ny = player.y + my * spd * dt;
      if (ny < BEACH_Y + 130) moveEntity(player, nx, ny, player.radius);
      else { if (!collideBuildings(world.buildings, nx, player.y, player.radius)) player.x = nx; toastOnceWater(); }
    } else {
      const wx = camX + mouseX, wy = camY + mouseY;
      if (mouseDown) player.angle = Math.atan2(wy - player.y, wx - player.x);
    }
    if (mouseDown) playerShoot();
    if (keys['f']) doPunch();
  }
  // pickups
  for (const pk of world.pickups) {
    if (pk.taken) { pk.respawn -= dt; if (pk.respawn <= 0) pk.taken = false; continue; }
    if (Math.hypot(pk.x - player.x, pk.y - player.y) < 30) {
      pk.taken = true; pk.respawn = 45; audio.pickup();
      if (pk.type === 'health') { player.hp = Math.min(100, player.hp + 40); toast('+ Health'); if (player.car) player.car.hp = Math.min(100, player.car.hp + 30); }
      if (pk.type === 'ammo') { player.ammo.pistol += 30; player.ammo.smg += 40; toast('+ Ammo'); }
      if (pk.type === 'cash') { state.cash += 75; audio.cash(); toast('Cash crate +$75'); }
      if (pk.type === 'smg') { player.hasSmg = true; player.ammo.smg += 90; player.weapon = 'smg'; toast('SMG acquired! Press 1 / 2 to switch'); }
    }
  }
}
let waterToastT = 0;
function toastOnceWater() { if (elapsed - waterToastT > 4) { waterToastT = elapsed; toast('The water is too deep — stay on the beach'); } }

function updateTraffic(dt) {
  for (const c of cars) {
    if (c === player.car || c.dead || c.kind === 'parked' || c.isCop) continue;
    c.aiTimer -= dt;
    // stop near player car crossing / near other stopped cars
    let blocked = false;
    for (const o of cars) { if (o !== c && Math.hypot(o.x - (c.x + Math.cos(c.angle) * 52), o.y - (c.y + Math.sin(c.angle) * 52)) < 30) blocked = true; }
    if (player.car && Math.hypot(player.car.x - (c.x + Math.cos(c.angle) * 55), player.car.y - (c.y + Math.sin(c.angle) * 55)) < 32) blocked = true;
    // intersection stop: brief pause when entering a crossing on a timer cycle
    const nearCross = ROAD_XS.some(rx => Math.abs(c.x - rx) < 60) && ROAD_YS.some(ry => Math.abs(c.y - ry) < 60);
    const target = (blocked || (nearCross && ((elapsed + c.x * 0.01) % 7) < 0.7)) ? 0 : c.targetSpeed;
    c.speed += Math.sign(target - c.speed) * Math.min(Math.abs(target - c.speed), 200 * dt);
    // follow road: steer toward lane ahead; at intersections sometimes turn
    const aheadX = c.x + Math.cos(c.angle) * 90, aheadY = c.y + Math.sin(c.angle) * 90;
    if (!isRoad(aheadX, aheadY) || aheadY > BEACH_Y - 30) {
      // find a road direction
      let bestA = c.angle, bestScore = -1;
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const tx = c.x + Math.cos(a) * 110, ty = c.y + Math.sin(a) * 110;
        let score = isRoad(tx, ty) ? 1 : 0; if (Math.abs(a - c.angle) < 0.1) score += 0.4; if (ty > BEACH_Y - 20) score = -1;
        if (score > bestScore) { bestScore = score; bestA = a; }
      }
      let diff = bestA - c.angle; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      c.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    } else if (c.aiTimer <= 0) {
      c.aiTimer = 1 + rnd() * 2;
      // at intersection, chance to turn
      const atCross = ROAD_XS.some(rx => Math.abs(c.x - rx) < 34) && ROAD_YS.some(ry => Math.abs(c.y - ry) < 34);
      if (atCross && rnd() > 0.55) { const turn = rnd() > 0.5 ? Math.PI / 2 : -Math.PI / 2; c.angle += turn; c.angle = Math.round(c.angle / (Math.PI / 2)) * (Math.PI / 2); }
    }
    // lane offset keep: nudge toward lane centre
    c.x += Math.cos(c.angle) * c.speed * dt; c.y += Math.sin(c.angle) * c.speed * dt;
    if (collideBuildings(world.buildings, c.x, c.y, 20)) { c.x -= Math.cos(c.angle) * c.speed * dt * 1.4; c.y -= Math.sin(c.angle) * c.speed * dt * 1.4; c.angle += Math.PI / 2; c.speed = 40; }
    c.x = Math.max(30, Math.min(WORLD_W - 30, c.x)); c.y = Math.max(30, Math.min(BEACH_Y - 10, c.y));
  }
  // police cars pursue
  for (const c of cops) {
    if (c.dead || c === player.car) continue;
    const tx = player.x, ty = player.y;
    const d = Math.hypot(tx - c.x, ty - c.y);
    const want = Math.atan2(ty - c.y, tx - c.x);
    let diff = want - c.angle; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 2));
    const top = player.car ? 400 : 300;
    c.speed += Math.sign((d > 55 ? top : 0) - c.speed) * 260 * dt;
    c.x += Math.cos(c.angle) * c.speed * dt; c.y += Math.sin(c.angle) * c.speed * dt;
    if (collideBuildings(world.buildings, c.x, c.y, 20)) { c.speed *= -0.4; c.x += Math.cos(c.angle + Math.PI) * 8; }
    if (d < 44 && player.car && Math.abs(c.speed) > 60) { damageCar(player.car, 10 * dt * 3); }
    if (d < 40 && !player.car) { state.bustedT += dt; if (state.bustedT > 2.2) { state.bustedT = 0; state.screen = 'busted'; onDeath(true); } }
    else if (!player.car) state.bustedT = Math.max(0, state.bustedT - dt);
  }
}
function updatePeds(dt) {
  for (const p of peds) {
    if (p.dead) continue;
    p.timer -= dt; p.shootCd = Math.max(0, p.shootCd - dt);
    const dPlayer = Math.hypot(player.x - p.x, player.y - p.y);
    if (p.kind === 'cop') {
      if (state.wanted >= 1 && dPlayer < 420) {
        // chase
        const want = Math.atan2(player.y - p.y, player.x - p.x); p.angle = want;
        if (dPlayer > 130) moveEntity(p, p.x + Math.cos(want) * 150 * dt, p.y + Math.sin(want) * 150 * dt, 10);
        if (state.wanted >= 2 && dPlayer < 300 && p.shootCd <= 0 && !player.car) {
          p.shootCd = 0.9 + rnd() * 0.5;
          bullets.push({ x: p.x, y: p.y, vx: Math.cos(want) * 700, vy: Math.sin(want) * 700, life: 0.5, from: 'cop', dmg: 7 });
          audio.shoot(false);
        }
        if (dPlayer < 30 && !player.car) { state.bustedT += dt; if (state.bustedT > 2.2) { state.bustedT = 0; state.screen = 'busted'; onDeath(true); } }
        continue;
      }
    }
    if (p.kind === 'thug') {
      const want = Math.atan2(player.y - p.y, player.x - p.x); p.angle = want;
      if (dPlayer < 320) {
        if (dPlayer > 120) moveEntity(p, p.x + Math.cos(want) * 130 * dt, p.y + Math.sin(want) * 130 * dt, 10);
        if (p.shootCd <= 0 && dPlayer < 280) { p.shootCd = 1 + rnd() * 0.6; bullets.push({ x: p.x, y: p.y, vx: Math.cos(want) * 650, vy: Math.sin(want) * 650, life: 0.5, from: 'thug', dmg: 8 }); audio.shoot(false); }
        continue;
      }
    }
    if (p.state === 'flee' || p.fleeT > 0) {
      p.fleeT -= dt;
      const away = Math.atan2(p.y - player.y, p.x - player.x);
      moveEntity(p, p.x + Math.cos(away) * 200 * dt, p.y + Math.sin(away) * 200 * dt, 10);
      if (p.fleeT <= 0) p.state = 'walk';
      continue;
    }
    // sidewalk wander: prefer non-road, drift
    if (p.timer <= 0) { p.timer = 2 + rnd() * 3; p.angle = rnd() * Math.PI * 2; }
    const nx = p.x + Math.cos(p.angle) * 55 * dt, ny = p.y + Math.sin(p.angle) * 55 * dt;
    if (ny < BEACH_Y + 100) moveEntity(p, nx, ny, 10); else p.angle = -Math.PI / 2;
  }
}
function updateBullets(dt) {
  for (const b of bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (collideBuildings(world.buildings, b.x, b.y, 3)) { b.life = 0; burst(b.x, b.y, '#ffe066', 2, 60); continue; }
    if (b.from === 'player') {
      for (const p of peds) { if (!p.dead && Math.hypot(p.x - b.x, p.y - b.y) < 13) { hurtPed(p, b.dmg, false); b.life = 0; break; } }
      if (b.life > 0) for (const c of cars) { if (c !== player.car && !c.dead && Math.abs(c.x - b.x) < 26 && Math.abs(c.y - b.y) < 16) { damageCar(c, b.dmg); if (c.isCop) addWanted(2); b.life = 0; break; } }
    } else {
      if (!player.car && Math.hypot(player.x - b.x, player.y - b.y) < 12) { hurtPlayer(b.dmg); b.life = 0; }
      else if (player.car && Math.abs(player.car.x - b.x) < 26 && Math.abs(player.car.y - b.y) < 16) { damageCar(player.car, b.dmg * 0.5); b.life = 0; }
    }
  }
  bullets = bullets.filter(b => b.life > 0);
  for (const pt of particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.92; pt.vy *= 0.92; pt.life -= dt; }
  particles = particles.filter(p => p.life > 0);
  for (const s of skids) s.life -= dt;
  skids = skids.filter(s => s.life > 0);
  if (skids.length > 500) skids.splice(0, skids.length - 500);
}
function updateWanted(dt) {
  // decay when unseen
  let seen = false;
  for (const c of cops) if (!c.dead && Math.hypot(c.x - player.x, c.y - player.y) < 430) seen = true;
  for (const p of peds) if (p.kind === 'cop' && !p.dead && Math.hypot(p.x - player.x, p.y - player.y) < 320) seen = true;
  if (!seen && state.wanted > 0) {
    state.hideTimer += dt;
    if (state.hideTimer > 6) { state.wantedHeat = Math.max(0, state.wantedHeat - 3); state.wanted = Math.min(state.wanted, Math.floor(state.wantedHeat / 3)); state.hideTimer = 3; if (state.wanted === 0) { state.wantedHeat = 0; toast('You lost the police'); } }
  } else state.hideTimer = 0;
  const wantCops = state.wanted === 0 ? 0 : (state.wanted <= 2 ? state.wanted : state.wanted + 1);
  const aliveCops = cops.filter(c => !c.dead && c !== player.car);
  if (aliveCops.length < wantCops) { state.copSpawnT = (state.copSpawnT || 0) - dt; if (state.copSpawnT <= 0) { spawnCopCar(); state.copSpawnT = 2.5; } }
  if (state.wanted >= 2) { const foot = peds.filter(p => p.kind === 'cop' && !p.dead).length; if (foot < state.wanted - 1 && rnd() > 0.995) spawnFootCop(); }
  if (state.wanted === 0 && cops.length) { for (const c of cops) { c.dead = true; } cops = []; cars = cars.filter(c => !c.isCop || c === player.car); }
  audio.setSiren(state.wanted > 0 && state.screen === 'play');
  audio.updateSiren(elapsed);
}
function updateTaxi(dt) {
  state.taxiCd -= dt;
  if (!state.taxi && state.taxiCd <= 0 && !state.missionActive) {
    const spots = [[1200, 300], [2200, 1620], [500, 700], [2760, 700], [1700, 1620], [950, 400]];
    const s = spots[(rnd() * spots.length) | 0];
    state.taxi = { phase: 'pickup', x: s[0], y: s[1], dx: 400 + rnd() * 2400, dy: 300 + rnd() * 1600, pay: 120 + ((rnd() * 160) | 0) };
    toast('Taxi fare available — reach the blue marker, then drive the passenger');
  }
  if (state.taxi) {
    const t = state.taxi;
    const px = player.car ? player.car.x : player.x, py = player.car ? player.car.y : player.y;
    if (t.phase === 'pickup' && player.car && Math.hypot(px - t.x, py - t.y) < 60) { t.phase = 'drop'; toast('Passenger in! Drive to the green drop-off'); audio.cash(); }
    else if (t.phase === 'drop' && player.car && Math.hypot(px - t.dx, py - t.dy) < 65) { state.cash += t.pay; toast('Fare complete +$' + t.pay); audio.mission(); state.taxi = null; state.taxiCd = 14; saveGame(); }
  }
}
function update(dt) {
  elapsed += dt;
  if (shotMode) { player.hp = 100; if (player.car) player.car.hp = 100; }
  state.time += dt / 60; if (state.time >= 24) { state.time -= 24; state.day++; }
  if (state.msgT > 0) state.msgT -= dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);
  if (state.screen !== 'play') { audio.setEngine(false, 0); return; }
  updatePlayer(dt);
  updateTraffic(dt); updatePeds(dt); updateBullets(dt); updateWanted(dt); updateTaxi(dt);
  checkMission();
  if (state.timerOn) { state.timer -= dt; if (state.timer <= 0) { state.timerOn = false; failMission('out of time'); } }
  const px = player.car ? player.car.x : player.x, py = player.car ? player.car.y : player.y;
  camX += ((px - W / 2) - camX) * Math.min(1, dt * 6);
  camY += ((py - H / 2) - camY) * Math.min(1, dt * 6);
  camX = Math.max(0, Math.min(WORLD_W - W, camX)); camY = Math.max(0, Math.min(WORLD_H - H, camY));
  audio.updateMusic(dt, true);
}

// ---------- rendering ----------
function dayTint() {
  const t = state.time;
  if (t >= 6 && t < 17) return { a: 0, color: '0,0,0' };
  if (t >= 17 && t < 19.5) return { a: 0.22 * (1 - Math.abs(t - 18.2) / 1.4), color: '255,110,60', dusk: true };
  if (t >= 19.5 || t < 5) return { a: 0.42, color: '8,10,40' };
  return { a: 0.2, color: '40,40,90' };
}
function isNight() { return state.time >= 19 || state.time < 5.5; }
function drawWorld() {
  // ground
  ctx.fillStyle = '#5d8a4a'; ctx.fillRect(camX - 10, camY - 10, W + 20, H + 20);
  // beach + water
  ctx.fillStyle = '#e8cf8f'; ctx.fillRect(camX - 10, BEACH_Y, W + 20, WORLD_H - BEACH_Y + 10);
  ctx.fillStyle = '#1b7f9e';
  const wy = BEACH_Y + 180;
  ctx.fillRect(camX - 10, wy, W + 20, WORLD_H - wy + 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) { const yy = wy + 16 + i * 26 + Math.sin(elapsed * 1.4 + i) * 3; ctx.beginPath(); ctx.moveTo(camX, yy); ctx.lineTo(camX + W, yy); ctx.stroke(); }
  // sidewalks + roads
  ctx.fillStyle = '#9aa0a6';
  for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_W / 2 - 12, 0, ROAD_W + 24, BEACH_Y);
  for (const ry of ROAD_YS) ctx.fillRect(0, ry - ROAD_W / 2 - 12, WORLD_W, ROAD_W + 24);
  ctx.fillStyle = '#33363b';
  for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, BEACH_Y);
  for (const ry of ROAD_YS) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  // lane markings
  ctx.strokeStyle = 'rgba(255,209,102,0.75)'; ctx.lineWidth = 3; ctx.setLineDash([22, 18]);
  for (const rx of ROAD_XS) { ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, BEACH_Y); ctx.stroke(); }
  for (const ry of ROAD_YS) { ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD_W, ry); ctx.stroke(); }
  ctx.setLineDash([]);
  // crosswalks
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const rx of ROAD_XS) for (const ry of ROAD_YS) { for (let i = -2; i <= 2; i++) { ctx.fillRect(rx - ROAD_W / 2 - 4, ry + i * 20 - 5, 12, 10); ctx.fillRect(rx + i * 20 - 5, ry - ROAD_W / 2 - 4, 10, 12); } }
  // skid marks
  ctx.fillStyle = 'rgba(20,20,20,0.5)';
  for (const s of skids) ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
  // parks drawn as buildings kind park below; props
  for (const p of world.props) {
    if (p.x < camX - 60 || p.x > camX + W + 60 || p.y < camY - 60 || p.y > camY + H + 60) continue;
    if (p.type === 'lamp') {
      ctx.fillStyle = '#444'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      if (isNight()) { const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 46); g.addColorStop(0, 'rgba(255,220,130,0.5)'); g.addColorStop(1, 'rgba(255,220,130,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 46, 0, 7); ctx.fill(); ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill(); }
    } else if (p.type === 'palm') {
      ctx.strokeStyle = '#6b4f2a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 4, p.y - 16 * p.s); ctx.stroke();
      ctx.strokeStyle = '#2e9e5b'; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.4; ctx.beginPath(); ctx.moveTo(p.x + 4, p.y - 16 * p.s); ctx.quadraticCurveTo(p.x + 4 + Math.cos(a) * 14 * p.s, p.y - 16 * p.s + Math.sin(a) * 8 * p.s - 5, p.x + 4 + Math.cos(a) * 22 * p.s, p.y - 16 * p.s + Math.sin(a) * 12 * p.s + 4); ctx.stroke(); }
    } else if (p.type === 'crate') {
      ctx.fillStyle = '#a67c52'; ctx.fillRect(p.x - 9, p.y - 9, 18, 18); ctx.strokeStyle = '#6f4e2e'; ctx.strokeRect(p.x - 9, p.y - 9, 18, 18);
    }
  }
  // buildings
  for (const b of world.buildings) {
    if (b.x + b.w / 2 < camX - 40 || b.x - b.w / 2 > camX + W + 40 || b.y + b.h / 2 < camY - 40 || b.y - b.h / 2 > camY + H + 40) continue;
    if (b.kind === 'park') {
      ctx.fillStyle = '#2d6a4f'; ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      ctx.fillStyle = '#40916c'; for (let i = 0; i < 8; i++) ctx.fillRect(b.x - b.w / 2 + 20 + (i * 53) % (b.w - 40), b.y - b.h / 2 + 20 + (i * 37) % (b.h - 40), 26, 26);
      ctx.fillStyle = '#e9f5ec'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center'; ctx.fillText(b.name, b.x, b.y + 5);
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(b.x - b.w / 2 + 7, b.y - b.h / 2 + 9, b.w, b.h);
    ctx.fillStyle = b.color; ctx.globalAlpha = b.shade || 1; ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, 12);
    // windows
    ctx.fillStyle = isNight() ? 'rgba(255,225,140,0.9)' : 'rgba(40,60,90,0.55)';
    const cols = Math.max(2, (b.w / 26) | 0), rows = Math.max(2, (b.h / 26) | 0);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { if ((i * 7 + j * 13 + b.x) % 3 === 0 && !isNight()) continue; ctx.fillRect(b.x - b.w / 2 + 8 + i * ((b.w - 16) / cols), b.y - b.h / 2 + 18 + j * ((b.h - 26) / rows), 9, 7); }
    // sign
    ctx.fillStyle = 'rgba(10,10,20,0.82)'; const tw = Math.min(b.w - 8, b.name.length * 7.4 + 14);
    ctx.fillRect(b.x - tw / 2, b.y - b.h / 2 + 2, tw, 16);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.fillText(b.name, b.x, b.y - b.h / 2 + 14);
    if (b.kind === 'police') { ctx.fillStyle = '#7ee8fa'; ctx.font = 'bold 22px Arial'; ctx.fillText('★ POLICE ★', b.x, b.y + 30); }
    if (b.kind === 'hospital') { ctx.fillStyle = '#e63946'; ctx.font = 'bold 30px Arial'; ctx.fillText('+', b.x, b.y + 34); }
  }
  // pickups
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(elapsed * 3 + pk.x) * 3;
    ctx.save(); ctx.translate(pk.x, pk.y + bob);
    if (pk.type === 'health') { ctx.fillStyle = '#fff'; ctx.fillRect(-11, -11, 22, 22); ctx.fillStyle = '#e63946'; ctx.fillRect(-3, -8, 6, 16); ctx.fillRect(-8, -3, 16, 6); }
    else if (pk.type === 'ammo') { ctx.fillStyle = '#606c38'; ctx.fillRect(-11, -8, 22, 16); ctx.fillStyle = '#ffd166'; ctx.fillRect(-7, -4, 4, 8); ctx.fillRect(1, -4, 4, 8); }
    else if (pk.type === 'smg') { ctx.fillStyle = '#222'; ctx.fillRect(-16, -4, 32, 8); ctx.fillRect(2, 4, 6, 9); ctx.fillStyle = '#ffd166'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.fillText('SMG', 0, -10); }
    else { ctx.fillStyle = '#a67c52'; ctx.fillRect(-12, -10, 24, 20); ctx.fillStyle = '#2a9d8f'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.fillText('$', 0, 5); }
    ctx.restore();
  }
}
function drawCar(c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-c.w / 2 + 3, -c.h / 2 + 5, c.w, c.h);
  // headlights at night
  if (isNight() && !c.dead) { const g = ctx.createRadialGradient(c.w / 2, 0, 4, c.w / 2 + 70, 0, 80); g.addColorStop(0, 'rgba(255,240,180,0.35)'); g.addColorStop(1, 'rgba(255,240,180,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(c.w / 2, -8); ctx.lineTo(c.w / 2 + 85, -22); ctx.lineTo(c.w / 2 + 85, 22); ctx.lineTo(c.w / 2, 8); ctx.fill(); }
  ctx.fillStyle = c.dead ? '#3a3a3a' : c.color;
  ctx.beginPath(); ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 6); ctx.fill();
  ctx.fillStyle = 'rgba(20,30,45,0.9)'; ctx.fillRect(-4, -c.h / 2 + 3, 14, c.h - 6);
  ctx.fillStyle = 'rgba(160,210,240,0.85)'; ctx.fillRect(8, -c.h / 2 + 4, 5, c.h - 8); ctx.fillRect(-9, -c.h / 2 + 4, 4, c.h - 8);
  ctx.fillStyle = '#111'; ctx.fillRect(-c.w / 2 + 3, -c.h / 2 - 2, 9, 5); ctx.fillRect(-c.w / 2 + 3, c.h / 2 - 3, 9, 5); ctx.fillRect(c.w / 2 - 12, -c.h / 2 - 2, 9, 5); ctx.fillRect(c.w / 2 - 12, c.h / 2 - 3, 9, 5);
  if (c.isCop) { ctx.fillStyle = '#274472'; ctx.fillRect(-c.w / 2, -5, c.w, 10); ctx.fillStyle = '#fff'; ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center'; ctx.fillText('POLICE', 0, 3); const flash = Math.sin(elapsed * 14) > 0; ctx.fillStyle = flash ? '#ff2e4d' : '#2e7dff'; ctx.fillRect(-4, -4, 8, 8); }
  if (c.isTarget) { ctx.fillStyle = '#ffd166'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.fillText('TARGET', 0, -c.h / 2 - 8); }
  ctx.restore();
  if (c.hp < 60 && !c.dead) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(c.x + 8, c.y - 4, 6, 0, 7); ctx.fill(); }
  // car health in shot scenes / when damaged & near
  if (c === player.car) { /* HUD shows it */ }
}
function drawPed(p) {
  ctx.save(); ctx.translate(p.x, p.y);
  if (p.dead) { ctx.rotate(Math.PI / 2); ctx.fillStyle = '#5a1f24'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); ctx.fillStyle = p.color; ctx.fillRect(-4, -2, 16, 8); ctx.restore(); return; }
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(2, 3, 10, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = p.kind === 'cop' ? '#274472' : (p.kind === 'thug' ? '#7f1d2d' : p.color);
  ctx.beginPath(); ctx.roundRect(-7, -8, 15, 16, 5); ctx.fill();
  ctx.fillStyle = '#f2c79b'; ctx.beginPath(); ctx.arc(4, 0, 5.5, 0, 7); ctx.fill();
  if (p.kind === 'cop') { ctx.fillStyle = '#16283f'; ctx.fillRect(1, -5.5, 6, 11); ctx.fillStyle = '#ffd166'; ctx.fillRect(2, -1, 2, 2); }
  if (p.kind === 'thug' || p.kind === 'cop') { ctx.fillStyle = '#222'; ctx.fillRect(8, -2, 10, 3.5); }
  ctx.restore();
  if (p.kind === 'thug') { ctx.fillStyle = '#ff5d73'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.fillText('!', p.x, p.y - 16); }
}
function drawPlayer() {
  if (player.car) return;
  ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(2, 3, 11, 8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ff6b35'; ctx.beginPath(); ctx.roundRect(-8, -9, 17, 18, 6); ctx.fill();
  ctx.fillStyle = '#f2c79b'; ctx.beginPath(); ctx.arc(5, 0, 6, 0, 7); ctx.fill();
  ctx.fillStyle = '#1d3557'; ctx.fillRect(2, -6, 6, 12);
  ctx.fillStyle = '#191919'; ctx.fillRect(10, -2.5, player.weapon === 'smg' ? 15 : 11, 4);
  if (player.punchCd > 0.2) { ctx.fillStyle = '#f2c79b'; ctx.beginPath(); ctx.arc(16, 6, 4, 0, 7); ctx.fill(); }
  ctx.restore();
}
function drawMarker(x, y, color, label) {
  const bob = Math.sin(elapsed * 4) * 5;
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - 34 + bob); ctx.lineTo(x - 11, y - 56 + bob); ctx.lineTo(x + 11, y - 56 + bob); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, 20 + Math.sin(elapsed * 4) * 3, 0, 7); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  if (label) { ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.fillText(label, x, y - 64 + bob); }
}
function drawEntities() {
  for (const c of cars) if (c.x > camX - 80 && c.x < camX + W + 80 && c.y > camY - 80 && c.y < camY + H + 80) drawCar(c);
  for (const p of peds) if (p.x > camX - 60 && p.x < camX + W + 60 && p.y > camY - 60 && p.y < camY + H + 60) drawPed(p);
  drawPlayer();
  ctx.fillStyle = '#ffe066';
  for (const b of bullets) ctx.fillRect(b.x - 3, b.y - 1.5, 6, 3);
  for (const pt of particles) { ctx.globalAlpha = Math.max(0, pt.life / pt.max); ctx.fillStyle = pt.color; ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size); }
  ctx.globalAlpha = 1;
  // markers
  const s = currentStep();
  if (s && state.missionActive && !state.dialogue) drawMarker(s.x, s.y, '#ffd60a', 'OBJECTIVE');
  else if (!state.missionActive) { const g = missionGiverPos(state.missionIdx); if (g) drawMarker(g.x, g.y, '#ffd60a', MISSIONS[state.missionIdx] ? MISSIONS[state.missionIdx].giver.toUpperCase() : ''); }
  if (state.taxi) { if (state.taxi.phase === 'pickup') drawMarker(state.taxi.x, state.taxi.y, '#4cc9f0', 'TAXI'); else drawMarker(state.taxi.dx, state.taxi.dy, '#06d6a0', 'DROP-OFF'); }
}
function drawMinimap() {
  const mw = 218, mh = 164, mx = W - mw - 14, my = 14;
  ctx.fillStyle = 'rgba(8,12,24,0.85)'; ctx.beginPath(); ctx.roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, 6); ctx.clip();
  ctx.fillStyle = '#2f5233'; ctx.fillRect(mx, my, mw, mh);
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.fillStyle = '#173f5f'; ctx.fillRect(mx, my + BEACH_Y * sy, mw, (WORLD_H - BEACH_Y) * sy);
  ctx.strokeStyle = '#c9cdd4'; ctx.lineWidth = 3;
  for (const rx of ROAD_XS) { ctx.beginPath(); ctx.moveTo(mx + rx * sx, my); ctx.lineTo(mx + rx * sx, my + mh); ctx.stroke(); }
  for (const ry of ROAD_YS) { ctx.beginPath(); ctx.moveTo(mx, my + ry * sy); ctx.lineTo(mx + mw, my + ry * sy); ctx.stroke(); }
  ctx.fillStyle = '#ffd60a';
  for (const b of world.buildings) if (b.kind === 'police' || b.kind === 'hospital' || b.kind === 'safehouse') ctx.fillRect(mx + b.x * sx - 3, my + b.y * sy - 3, 6, 6);
  ctx.fillStyle = '#ff2e4d';
  for (const c of cops) if (!c.dead) ctx.fillRect(mx + c.x * sx - 2.5, my + c.y * sy - 2.5, 5, 5);
  const s = currentStep();
  const tgt = (state.missionActive && s) ? s : missionGiverPos(state.missionIdx);
  if (tgt) { ctx.fillStyle = '#ffd60a'; ctx.beginPath(); ctx.arc(mx + tgt.x * sx, my + tgt.y * sy, 5 + Math.sin(elapsed * 5) * 1.5, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.stroke(); }
  if (state.taxi) { ctx.fillStyle = '#4cc9f0'; ctx.beginPath(); ctx.arc(mx + (state.taxi.phase === 'pickup' ? state.taxi.x : state.taxi.dx) * sx, my + (state.taxi.phase === 'pickup' ? state.taxi.y : state.taxi.dy) * sy, 4, 0, 7); ctx.fill(); }
  // player arrow
  const px = mx + player.x * sx, py = my + player.y * sy, pa = player.car ? player.car.angle : player.angle;
  ctx.translate(px, py); ctx.rotate(pa); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.fill(); ctx.strokeStyle = '#ff6b35'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.rotate(-pa); ctx.translate(-px, -py);
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'left'; ctx.fillText('SAN VERANO', mx + 4, my + mh + 16);
}
function fmtTime() { const hh = Math.floor(state.time), mm = Math.floor((state.time - hh) * 60); return 'Day ' + state.day + '  ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }
function drawHUD() {
  // top-left panel
  ctx.fillStyle = 'rgba(8,12,24,0.78)'; ctx.beginPath(); ctx.roundRect(12, 12, 268, 118, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'left';
  ctx.fillText('SAN VERANO', 24, 36);
  ctx.fillStyle = '#8ecae6'; ctx.font = '12px Arial'; ctx.fillText(fmtTime() + (isNight() ? '  · Night' : ''), 150, 36);
  // health
  ctx.fillStyle = '#3a0d14'; ctx.fillRect(24, 48, 180, 15);
  ctx.fillStyle = player.hp > 30 ? '#2ec4b6' : '#e63946'; ctx.fillRect(24, 48, 180 * Math.max(0, player.hp) / 100, 15);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Arial'; ctx.fillText('HP ' + Math.max(0, Math.ceil(player.hp)), 28, 60);
  if (player.car) { ctx.fillStyle = '#222'; ctx.fillRect(24, 68, 180, 10); ctx.fillStyle = '#ffd166'; ctx.fillRect(24, 68, 180 * Math.max(0, player.car.hp) / 100, 10); ctx.fillStyle = '#fff'; ctx.font = '10px Arial'; ctx.fillText('CAR ' + Math.max(0, Math.ceil(player.car.hp)) + '%', 28, 77); }
  ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 19px Arial'; ctx.fillText('$' + state.cash, 24, 104);
  ctx.fillStyle = '#fff'; ctx.font = '12px Arial';
  const wname = player.weapon === 'smg' ? 'SMG' : 'PISTOL';
  ctx.fillText((player.car ? 'DRIVING' : wname + '  Ammo: ' + player.ammo[player.weapon]), 110, 104);
  ctx.fillText('KOs: ' + state.kills + '   Story: ' + Math.min(state.missionIdx + 1, MISSIONS.length) + '/' + MISSIONS.length, 24, 122);
  // wanted stars top centre
  ctx.font = '26px Arial'; ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i < state.wanted ? '#ffd60a' : 'rgba(255,255,255,0.25)'; ctx.fillText('★', W / 2 - 64 + i * 32, 40); }
  if (state.bustedT > 0.2 && !player.car) { ctx.fillStyle = '#ff2e4d'; ctx.font = 'bold 16px Arial'; ctx.fillText('BUSTED...', W / 2, 66); }
  // objective bottom-left
  ctx.fillStyle = 'rgba(8,12,24,0.8)'; ctx.beginPath(); ctx.roundRect(12, H - 74, Math.min(640, W - 24), 60, 10); ctx.fill();
  ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'left'; ctx.fillText('OBJECTIVE', 24, H - 52);
  ctx.fillStyle = '#fff'; ctx.font = '14px Arial'; ctx.fillText(state.objective, 24, H - 30);
  if (state.timerOn) { ctx.fillStyle = state.timer < 15 ? '#ff2e4d' : '#ffd60a'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'right'; ctx.fillText(Math.ceil(state.timer) + 's', W - 24, H - 30); ctx.textAlign = 'left'; }
  if (state.msgT > 0) { ctx.fillStyle = 'rgba(8,12,24,0.85)'; const tw = state.msg.length * 8.4 + 28; ctx.beginPath(); ctx.roundRect(W / 2 - tw / 2, 84, tw, 34, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.fillText(state.msg, W / 2, 106); ctx.textAlign = 'left'; }
  // controls hint
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = '11px Arial'; ctx.fillText('WASD move · E car · F/click punch · Click shoot · 1/2 weapons · Space brake · Esc pause · M mute', 14, H - 84);
  drawMinimap();
}
function drawDialogue() {
  if (!state.dialogue) return;
  const d = state.dialogue, line = d.lines[d.idx]; if (!line) return;
  const speaker = line[0], text = line[1];
  const col = (CHARACTERS[speaker] && CHARACTERS[speaker].color) || '#ff6b35';
  ctx.fillStyle = 'rgba(5,8,18,0.92)'; ctx.beginPath(); ctx.roundRect(90, H - 196, W - 180, 108, 12); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(140, H - 142, 30, 0, 7); ctx.fill();
  ctx.fillStyle = '#14213d'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center'; ctx.fillText(speaker[0], 140, H - 134);
  ctx.textAlign = 'left'; ctx.fillStyle = col; ctx.font = 'bold 17px Arial'; ctx.fillText(speaker + (CHARACTERS[speaker] ? ' — ' + CHARACTERS[speaker].role : ' — You'), 186, H - 168);
  ctx.fillStyle = '#fff'; ctx.font = '16px Arial';
  // wrap
  const words = text.split(' '); let ln = '', yy = H - 140;
  for (const wd of words) { if (ctx.measureText(ln + wd).width > W - 420) { ctx.fillText(ln, 186, yy); yy += 22; ln = ''; } ln += wd + ' '; }
  ctx.fillText(ln, 186, yy);
  ctx.fillStyle = '#ffd60a'; ctx.font = '12px Arial'; ctx.fillText('Click or Enter ▸  (' + (d.idx + 1) + '/' + d.lines.length + ')', 186, H - 100);
}
function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(20,8,50,0.55)'); g.addColorStop(0.55, 'rgba(120,20,90,0.35)'); g.addColorStop(1, 'rgba(6,40,70,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7ee8fa'; ctx.font = 'bold 24px Arial'; ctx.fillText('★  W E L C O M E   T O  ★', W / 2, H * 0.24);
  ctx.font = '900 84px Arial'; ctx.fillStyle = '#ff2e88'; ctx.fillText('SAN VERANO', W / 2 + 3, H * 0.24 + 86 + 3);
  ctx.fillStyle = '#ffd60a'; ctx.fillText('SAN VERANO', W / 2, H * 0.24 + 86);
  ctx.font = 'italic bold 30px Arial'; ctx.fillStyle = '#7ee8fa'; ctx.fillText('—  N E O N   C O A S T  —', W / 2, H * 0.24 + 128);
  ctx.fillStyle = '#fff'; ctx.font = '15px Arial'; ctx.fillText('An original open-world crime story · 6 story missions · police, traffic, taxi fares & the whole neon coast', W / 2, H * 0.24 + 162);
  drawButton(W / 2 - 130, H * 0.58, 260, 52, '▶  NEW GAME', '#e63946');
  const has = !!loadSave();
  drawButton(W / 2 - 130, H * 0.58 + 66, 260, 52, has ? '↻  CONTINUE' : '↻  CONTINUE (no save)', has ? '#2a9d8f' : '#555f6b');
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '12px Arial';
  ctx.fillText('WASD / Arrows · Shift sprint · E enter car · Mouse aim, click shoot · F punch · Space handbrake · M mute', W / 2, H * 0.58 + 150);
  ctx.textAlign = 'left';
}
let buttons = [];
function drawButton(x, y, w, h, label, color) {
  buttons.push({ x, y, w, h, label });
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 19px Arial'; ctx.textAlign = 'center'; ctx.fillText(label, x + w / 2, y + h / 2 + 7); ctx.textAlign = 'left';
}
function drawPause() {
  ctx.fillStyle = 'rgba(4,6,14,0.72)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd60a'; ctx.font = '900 46px Arial'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', W / 2, H * 0.36);
  ctx.fillStyle = '#fff'; ctx.font = '16px Arial';
  ctx.fillText('Cash $' + state.cash + ' · Story mission ' + Math.min(state.missionIdx + 1, MISSIONS.length) + ' of ' + MISSIONS.length + ' · Day ' + state.day, W / 2, H * 0.44);
  drawButton(W / 2 - 120, H * 0.5, 240, 48, 'RESUME', '#2a9d8f');
  drawButton(W / 2 - 120, H * 0.5 + 60, 240, 48, 'SAVE GAME', '#4361ee');
  drawButton(W / 2 - 120, H * 0.5 + 120, 240, 48, 'TITLE SCREEN', '#555f6b');
  ctx.textAlign = 'left';
}
function drawEnd(kind) {
  ctx.fillStyle = kind === 'wasted' ? 'rgba(90,4,10,0.78)' : 'rgba(6,20,60,0.8)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'wasted' ? '#ff2e4d' : '#7ee8fa'; ctx.font = '900 76px Arial';
  ctx.fillText(kind === 'wasted' ? 'WASTED' : 'BUSTED', W / 2, H * 0.44);
  ctx.fillStyle = '#fff'; ctx.font = '17px Arial';
  ctx.fillText(kind === 'wasted' ? 'You wake up at Hospital Verano. The city charged you for the bandages.' : 'The San Verano police book you at the station. Bail is not free.', W / 2, H * 0.52);
  ctx.fillText('Respawning…', W / 2, H * 0.58);
  ctx.textAlign = 'left';
}
function render() {
  buttons = [];
  ctx.save();
  const shx = state.shake ? (rnd() - 0.5) * state.shake : 0, shy = state.shake ? (rnd() - 0.5) * state.shake : 0;
  ctx.translate(-camX + shx, -camY + shy);
  drawWorld(); drawEntities();
  ctx.restore();
  const tint = dayTint();
  if (tint.a > 0) { ctx.fillStyle = 'rgba(' + tint.color + ',' + tint.a + ')'; ctx.fillRect(0, 0, W, H); }
  if (state.screen === 'title') { drawTitle(); return; }
  drawHUD();
  if (state.gameWon && state.missionIdx >= MISSIONS.length) { ctx.fillStyle = 'rgba(255,214,10,0.9)'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center'; ctx.fillText('★ STORY COMPLETE — free roam San Verano ★', W / 2, 74); ctx.textAlign = 'left'; }
  drawDialogue();
  if (state.screen === 'pause') drawPause();
  if (state.screen === 'wasted') drawEnd('wasted');
  if (state.screen === 'busted') drawEnd('busted');
}
function handleMenuClick(x, y) {
  audio.ensure();
  for (const b of buttons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      if (b.label.includes('NEW GAME')) newGame();
      else if (b.label.includes('CONTINUE')) continueGame();
      else if (b.label.includes('RESUME')) state.screen = 'play';
      else if (b.label.includes('SAVE')) { saveGame(); toast('Saved'); state.screen = 'play'; }
      else if (b.label.includes('TITLE')) state.screen = 'title';
    }
  }
}
function newGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  state.cash = 100; state.missionIdx = 0; state.missionStep = -1; state.missionActive = false; state.wanted = 0; state.wantedHeat = 0; state.gameWon = false; state.kills = 0;
  player.hp = 100; player.x = 900; player.y = 1470; player.car = null; player.ammo = { pistol: 60, smg: 0 }; player.hasSmg = false; player.weapon = 'pistol';
  state.time = 10; state.objective = 'Talk to Rosa at Casa Rosa (yellow marker)';
  spawnTraffic(); spawnPeds(); cops = [];
  state.screen = 'play';
  showDialogue([['Rosa', 'Welcome to San Verano, Nico. Sun, neon — and opportunity.'], ['Rosa', 'Walk to me at Casa Rosa any time to start work. Press E by a car to drive. Stay sharp!']], () => {});
  saveGame();
}
function continueGame() {
  const s = loadSave(); if (!s) { toast('No save yet — start a New Game'); return; }
  state.cash = s.cash; state.missionIdx = Math.min(s.mission, MISSIONS.length);
  player.x = s.x || 900; player.y = s.y || 1470; player.hp = s.hp || 100; player.car = null;
  state.objective = state.missionIdx >= MISSIONS.length ? 'Story complete! Free roam' : 'Talk to ' + MISSIONS[state.missionIdx].giver + ' (yellow marker)';
  spawnTraffic(); spawnPeds(); cops = [];
  state.screen = 'play'; toast('Save loaded');
}

// ---------- shot scenes (deterministic screenshots) ----------
function setupShot() {
  spawnTraffic(); spawnPeds();
  state.cash = 1450; player.hp = 100;
  if (shotMode === 'cover') {
    state.time = 18.4; player.x = 1200; player.y = 1180; player.car = null;
    camX = player.x - W / 2; camY = player.y - H / 2; state.screen = 'title';
  } else if (shotMode === 'drive') {
    state.time = 11; state.screen = 'play';
    const c = cars.find(v => v.kind === 'traffic') || cars[0];
    c.x = 1450; c.y = 1074; c.angle = 0; c.speed = 230; c.hp = 100; c.color = '#e63946';
    player.car = c; player.x = c.x; player.y = c.y; c.driver = true;
    state.objective = 'Drive Diego to the workshop (Taller Ruedas)';
    camX = c.x - W / 2; camY = c.y - H / 2;
  } else if (shotMode === 'chase') {
    state.time = 16; state.screen = 'play'; state.wanted = 4; state.wantedHeat = 13;
    const c = cars.find(v => v.kind === 'traffic') || cars[0];
    c.x = 1700; c.y = 1074; c.angle = 0; c.speed = 300; c.hp = 100; c.color = '#ffd60a';
    player.car = c; player.x = c.x; player.y = c.y;
    for (let i = 0; i < 3; i++) { const pc = makeCar(c.x - 130 - i * 95, c.y + (i % 2 ? 34 : -30), 0, '#dfe6ee', 'cop'); pc.isCop = true; pc.speed = 290; cops.push(pc); cars.push(pc); }
    spawnFootCop();
    state.objective = 'Escape the police pursuit!';
    burst(c.x - 40, c.y, '#ffe066', 10, 120);
    camX = c.x - W / 2; camY = c.y - H / 2;
  } else if (shotMode === 'mission') {
    state.time = 14.5; state.screen = 'play';
    player.x = 905; player.y = 1445; player.car = null;
    state.missionIdx = 0;
    showDialogue(MISSIONS[0].intro, () => {});
    state.objective = MISSIONS[0].steps[0].text;
    camX = player.x - W / 2; camY = player.y - H / 2;
  } else {
    state.screen = 'title'; state.time = 18.4; player.x = 1200; player.y = 1180; camX = player.x - W / 2; camY = player.y - H / 2;
  }
  camX = Math.max(0, Math.min(WORLD_W - W, camX)); camY = Math.max(0, Math.min(WORLD_H - H, camY));
}

// ---------- boot + loop ----------
spawnTraffic(); spawnPeds();
if (shotMode) setupShot();
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.05) dt = 0.05;
  if (state.screen === 'play' || state.screen === 'pause') update(state.screen === 'play' ? dt : 0);
  else { elapsed += dt; state.time += dt / 120; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
