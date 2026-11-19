// SAN VERANO: Neon Coast — main game loop, entities, AI, combat, HUD.
import { WORLD_W, WORLD_H, ROAD, BLOCK, buildWorld, drawWorld, isRoad, isWater, collideRect, mulberry } from './world.js';
import { Sound } from './audio.js';
import { MISSIONS, CHARACTERS, TAXI_SPOTS } from './missions.js';
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const mm = document.getElementById('minimap'), mmx = mm.getContext('2d');
const W = () => cv.width, H = () => cv.height;
function resize() { cv.width = innerWidth; cv.height = innerHeight; } addEventListener('resize', resize); resize();
const params = new URLSearchParams(location.search);
const shot = params.get('shot'), seed = parseInt(params.get('seed') || '1');
const rnd = mulberry(seed * 331 + 7);
const snd = new Sound();
const keys = {}; let mouse = { x: 0, y: 0, down: false };
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault(); onKey(e.key); });
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('mousedown', () => { mouse.down = true; snd.ensure(); });
addEventListener('mouseup', () => mouse.down = false);
const world = buildWorld(seed);
const CAR_COLORS = ['#e63946','#457b9d','#f1fa8c','#2a9d8f','#e9c46a','#ffffff','#9d4edd','#ff7b00','#4cc9f0','#ef476f'];
function mkCar(x, y, angle, color, opts = {}) { return { x, y, angle, speed: 0, color, health: 100, driver: opts.driver || null, police: !!opts.police, traffic: !!opts.traffic, stopped: 0, aiT: Math.random() * 2, skid: 0, dead: false }; }
let cars = [], peds = [], bullets = [], particles = [], skids = [], cops = [];
let player, G;
function newPlayer(x, y) { return { x, y, angle: -Math.PI / 2, health: 100, cash: G ? G.cash : 150, weapon: 'pistol', ammo: { pistol: 48, smg: 0 }, hasSmg: false, car: null, punchCd: 0, fireCd: 0, dead: false }; }
function freshState() { return { cash: 150, missionIdx: 0, stepIdx: 0, missionActive: false, taxi: null, time: 0.32, day: 1, wanted: 0, hideTimer: 0, state: 'title', dialogue: null, dlgIdx: 0, objective: 'Explore San Verano', timer: 0, shake: 0, msg: '', msgT: 0, chaseCar: null, shootLeft: 0, paused: false, over: null, taxiCount: 0 }; }
function spawnTraffic() { cars = []; world.parked.forEach(p => cars.push(mkCar(p.x, p.y, p.angle, p.color, {}))); for (let i = 0; i < 16; i++) { let x, y, t = 0; do { x = 80 + rnd() * 2900; y = 80 + rnd() * 2600; t++; } while (t < 30 && !isRoad(x, y)); const c = mkCar(x, y, Math.floor(rnd() * 4) * Math.PI / 2, CAR_COLORS[i % 10], { traffic: true, driver: 'npc' }); c.speed = 60; cars.push(c); } }
function spawnPeds(n, cx, cy) { for (let i = 0; i < n; i++) { let x = cx + (rnd() - 0.5) * 900, y = cy + (rnd() - 0.5) * 900; x = Math.max(30, Math.min(2980, x)); y = Math.max(30, Math.min(2750, y)); if (collideRect(x, y, 10, world.buildings) || isWater(x, y)) continue; peds.push({ x, y, angle: rnd() * 6.28, health: 30, speed: 26 + rnd() * 22, color: CAR_COLORS[Math.floor(rnd() * 10)], flee: 0, cop: false, hostile: false, fireCd: rnd() * 2, walkT: rnd() * 4, dead: false }); } }
function save() { try { localStorage.setItem('sanverano-save', JSON.stringify({ cash: player.cash, missionIdx: G.missionIdx, x: player.x, y: player.y, ammo: player.ammo, hasSmg: player.hasSmg })); } catch (e) {} }
function loadSave() { try { return JSON.parse(localStorage.getItem('sanverano-save')); } catch (e) { return null; } }
function crime(amount) { G.wanted = Math.min(5, G.wanted + amount); G.hideTimer = 0; }
function startGame(fromSave) {
  G = freshState(); spawnTraffic(); peds = []; bullets = []; particles = []; skids = []; cops = [];
  player = newPlayer(world.safehouse.x, world.safehouse.y + 90);
  if (fromSave) { const s = loadSave(); if (s) { player.cash = s.cash; G.cash = s.cash; G.missionIdx = s.missionIdx || 0; player.x = s.x; player.y = s.y; player.ammo = s.ammo || player.ammo; player.hasSmg = !!s.hasSmg; } }
  spawnPeds(46, player.x, player.y); G.state = 'play';
  if (G.missionIdx < MISSIONS.length) offerMission(); else G.objective = 'Free roam — do taxi fares (T) for cash';
  showMsg('Welcome to San Verano');
}
function offerMission() { const m = MISSIONS[G.missionIdx]; G.dialogue = m.intro; G.dlgIdx = 0; G.state = 'dialogue'; G.objective = m.title; }
function beginMission() { const m = MISSIONS[G.missionIdx]; G.missionActive = true; G.stepIdx = 0; setupStep(); G.state = 'play'; }
function setupStep() {
  const m = MISSIONS[G.missionIdx], s = m.steps[G.stepIdx]; if (!s) return;
  G.objective = s.label; if (s.time) G.timer = s.time; else G.timer = 0;
  if (s.type === 'chase') { const c = mkCar(s.x, s.y, 0, '#ffd166', { driver: 'thief', traffic: true }); c.speed = 120; cars.push(c); G.chaseCar = c; }
  if (s.type === 'shootout') { G.shootLeft = s.count; for (let i = 0; i < s.count; i++) peds.push({ x: s.x + (rnd() - 0.5) * 260, y: s.y + (rnd() - 0.5) * 260, angle: rnd() * 6.28, health: 40, speed: 30, color: '#111', flee: 0, cop: false, hostile: true, fireCd: 1 + rnd(), walkT: 0, dead: false }); }
  if (s.finale) crime(5);
}
function completeStep() {
  const m = MISSIONS[G.missionIdx]; snd.cash(); G.stepIdx++;
  if (G.stepIdx >= m.steps.length) { player.cash += m.reward; G.cash = player.cash; showMsg('Mission complete! +$' + m.reward); G.missionActive = false; G.missionIdx++; save(); if (G.missionIdx < MISSIONS.length) setTimeout(() => { if (G.state === 'play') offerMission(); }, 2500); else G.objective = 'Story complete! Free roam — taxi fares (T)'; }
  else setupStep();
}
function failMission(reason) { showMsg('Mission failed: ' + reason + ' — retrying'); G.missionActive = false; G.wanted = Math.max(0, G.wanted - 1); setTimeout(() => { if (G.missionIdx < MISSIONS.length) { G.missionActive = true; G.stepIdx = 0; setupStep(); } }, 1500); }
function showMsg(t) { G.msg = t; G.msgT = 3.5; }
function burst(x, y, color, n, spd = 90) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = Math.random() * spd; particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.4, color, r: 2 + Math.random() * 3 }); } }
function onKey(k) {
  snd.ensure();
  if (k === 'm' || k === 'M') snd.muted = !snd.muted;
  if (!G) return;
  if (G.state === 'dialogue' && (k === ' ' || k === 'Enter')) { G.dlgIdx++; if (G.dlgIdx >= G.dialogue.length) { G.dialogue = null; beginMission(); } }
  if ((k === 'Escape' || k.toLowerCase() === 'p') && G.state === 'play') G.paused = !G.paused;
  if (k.toLowerCase() === 'e' && G.state === 'play' && !G.paused) tryEnterExit();
  if (k === '1') player.weapon = 'pistol';
  if (k === '2' && player.hasSmg) player.weapon = 'smg';
  if (k.toLowerCase() === 't' && G.state === 'play') startTaxi();
  if (k.toLowerCase() === 'f' && G.state === 'play') punch();
}
function startTaxi() { if (G.taxi) { G.taxi = null; G.objective = 'Taxi cancelled'; return; } const s = TAXI_SPOTS[Math.floor(Math.random() * TAXI_SPOTS.length)]; G.taxi = { x: s.x, y: s.y, phase: 'pickup' }; G.objective = 'Taxi: pick up fare (enter any car)'; showMsg('Taxi fare started'); }
function tryEnterExit() {
  if (player.car) { const c = player.car; player.x = c.x + Math.cos(c.angle + Math.PI / 2) * 26; player.y = c.y + Math.sin(c.angle + Math.PI / 2) * 26; c.driver = null; if (c.speed !== 0) c.speed = 0; player.car = null; return; }
  let best = null, bd = 52;
  for (const c of cars) { if (c.dead) continue; const d = Math.hypot(c.x - player.x, c.y - player.y); if (d < bd) { bd = d; best = c; } }
  if (best) { if (best.driver === 'npc' || best.traffic) { crime(1); showMsg('Vehicle stolen!'); burst(best.x, best.y, '#ffd166', 6); } best.driver = 'player'; best.traffic = false; player.car = best; snd.ensure(); }
}
function punch() { if (player.car || player.punchCd > 0) return; player.punchCd = 0.35; snd.punch(); for (const p of peds) { if (!p.dead && Math.hypot(p.x - player.x, p.y - player.y) < 34) { hurtPed(p, 15, player.angle); crime(0.5); } } }
function hurtPed(p, dmg, ang) { p.health -= dmg; p.flee = 4; burst(p.x, p.y, '#e63946', 5, 60); snd.hit(); if (p.health <= 0 && !p.dead) { p.dead = true; player.cash += 5 + Math.floor(Math.random() * 20); if (p.cop) crime(1.5); else crime(0.7); if (p.hostile && G.missionActive) { G.shootLeft--; if (G.shootLeft <= 0) completeStep(); } } }
function shoot() {
  if (player.car || player.fireCd > 0) return; const w = player.weapon;
  if (player.ammo[w] <= 0) { showMsg('No ammo — find ammo pickups'); player.fireCd = 0.3; return; }
  player.ammo[w]--; player.fireCd = w === 'smg' ? 0.11 : 0.28;
  const a = Math.atan2(mouse.y - H() / 2, mouse.x - W() / 2);
  bullets.push({ x: player.x + Math.cos(a) * 16, y: player.y + Math.sin(a) * 16, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, life: 0.55, from: 'player' });
  burst(player.x + Math.cos(a) * 18, player.y + Math.sin(a) * 18, '#ffd166', 3, 50); G.shake = Math.max(G.shake, 2); snd.shoot(w === 'smg');
  for (const p of peds) if (Math.hypot(p.x - player.x, p.y - player.y) < 260) p.flee = Math.max(p.flee, 2);
  if (G.wanted > 0 || cops.length) crime(0.15);
}
function respawn(kind) {
  const fee = Math.min(player.cash, 100 + G.missionIdx * 25); player.cash -= fee;
  player.health = 100; G.wanted = 0; cops.forEach(c => { c.dead = true; }); cops = [];
  if (player.car) { player.car.driver = null; player.car = null; }
  const at = kind === 'busted' ? world.policeStation : world.hospital;
  player.x = at.x; player.y = at.y + 120; G.state = 'play'; G.over = null;
  if (G.missionActive) failMission(kind); showMsg((kind === 'busted' ? 'BUSTED! ' : 'WASTED! ') + 'Fee -$' + fee); save();
}
function update(dt) {
  if (G.state !== 'play' || G.paused) return;
  G.time += dt / 240; if (G.time >= 1) { G.time -= 1; G.day++; }
  if (G.msgT > 0) G.msgT -= dt;
  player.punchCd = Math.max(0, player.punchCd - dt); player.fireCd = Math.max(0, player.fireCd - dt);
  if (mouse.down) shoot();
  const px = player.car ? player.car.x : player.x, py = player.car ? player.car.y : player.y;
  // wanted decay
  const seen = cops.some(c => Math.hypot(c.x - px, c.y - py) < 420);
  if (!seen && G.wanted > 0) { G.hideTimer += dt; if (G.hideTimer > 9) { G.wanted = Math.max(0, G.wanted - 0.5); G.hideTimer = 4; } } else G.hideTimer = 0;
  // player movement
  if (player.car) drivePlayer(dt); else walkPlayer(dt);
  updateCars(dt); updatePeds(dt); updateBullets(dt); updatePolice(dt);
  particles = particles.filter(p => (p.life -= dt) > 0); particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; });
  skids = skids.filter(s => (s.life -= dt) > 0);
  // pickups
  for (const p of world.pickups) { if (p.taken) { p.respawn -= dt; if (p.respawn <= 0) p.taken = false; continue; } if (Math.hypot(p.x - px, p.y - py) < 30) { p.taken = true; p.respawn = 45; snd.pickup(); if (p.type === 'health') player.health = Math.min(100, player.health + 40); if (p.type === 'ammo') { player.ammo.pistol += 24; if (player.hasSmg) player.ammo.smg += 40; } if (p.type === 'cash') { player.cash += 50; snd.cash(); } if (p.type === 'smg') { player.hasSmg = true; player.ammo.smg += 60; player.weapon = 'smg'; showMsg('SMG acquired! Press 2'); } } }
  // mission step check
  if (G.missionActive) { const s = MISSIONS[G.missionIdx].steps[G.stepIdx]; if (s) {
    if (s.type === 'timerun') { G.timer -= dt; if (G.timer <= 0) failMission('out of time'); }
    if ((s.type === 'goto' || s.type === 'deliver' || s.type === 'pickup' || s.type === 'timerun') && Math.hypot(s.x - px, s.y - py) < 55) completeStep();
    if (s.type === 'chase' && G.chaseCar && (G.chaseCar.dead || Math.abs(G.chaseCar.speed) < 4 && Math.hypot(G.chaseCar.x - px, G.chaseCar.y - py) < 90)) { G.chaseCar = null; completeStep(); }
  } }
  if (G.taxi) { const t = G.taxi; if (Math.hypot(t.x - px, t.y - py) < 55) { if (t.phase === 'pickup') { const d = TAXI_SPOTS[Math.floor(Math.random() * TAXI_SPOTS.length)]; t.x = d.x; t.y = d.y; t.phase = 'drop'; G.objective = 'Taxi: drop off passenger'; showMsg('Passenger in — go!'); } else { const fare = 60 + Math.floor(Math.random() * 90); player.cash += fare; G.taxiCount++; showMsg('Fare paid +$' + fare); snd.cash(); G.taxi = null; G.objective = 'Free roam — T for another fare'; save(); } } }
  if (player.health <= 0) { G.state = 'over'; G.over = 'wasted'; }
  if (peds.length < 40) spawnPeds(6, px, py);
  snd.music(dt);
}
function walkPlayer(dt) {
  let dx = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
  let dy = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);
  const sp = (keys['shift'] ? 215 : 125);
  if (dx || dy) { const l = Math.hypot(dx, dy); dx /= l; dy /= l; player.angle = Math.atan2(dy, dx); const nx = player.x + dx * sp * dt, ny = player.y + dy * sp * dt; if (!collideRect(nx, player.y, 11, world.buildings) && !isWater(nx, player.y)) player.x = nx; if (!collideRect(player.x, ny, 11, world.buildings) && !isWater(player.x, ny)) player.y = ny; }
  player.x = Math.max(16, Math.min(3140, player.x)); player.y = Math.max(16, Math.min(WORLD_H - 16, player.y));
  player.angle = Math.atan2(mouse.y - H() / 2, mouse.x - W() / 2);
}
function drivePlayer(dt) {
  const c = player.car; const up = keys['w'] || keys['arrowup'], down = keys['s'] || keys['arrowdown'];
  const left = keys['a'] || keys['arrowleft'], right = keys['d'] || keys['arrowright'];
  if (up) c.speed += 260 * dt; if (down) c.speed -= (c.speed > 5 ? 320 : 150) * dt;
  c.speed -= c.speed * 0.55 * dt; if (!up && !down) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 40 * dt);
  c.speed = Math.max(-130, Math.min(330, c.speed));
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  if (Math.abs(c.speed) > 4) c.angle += steer * 1.9 * dt * Math.sign(c.speed) * Math.min(1, Math.abs(c.speed) / 120);
  if (keys[' '] && Math.abs(c.speed) > 60) { skids.push({ x: c.x, y: c.y, life: 6 }); c.speed *= (1 - 1.4 * dt); }
  if (Math.abs(c.speed) > 190 && (left || right)) skids.push({ x: c.x, y: c.y, life: 5 });
  moveCar(c, dt, true); snd.engine(c.speed / 330);
}
function moveCar(c, dt, isPlayer) {
  const nx = c.x + Math.cos(c.angle) * c.speed * dt, ny = c.y + Math.sin(c.angle) * c.speed * dt;
  const hit = collideRect(nx, ny, 17, world.buildings);
  if (hit || isWater(nx, ny) || nx < 20 || nx > 3145 || ny < 20 || ny > WORLD_H - 20) {
    if (Math.abs(c.speed) > 90) { c.health -= 14; burst(c.x, c.y, '#ffb703', 8); snd.crash(); if (isPlayer) G.shake = Math.max(G.shake, 6); if (c.health <= 0 && !c.dead) { c.dead = true; burst(c.x, c.y, '#e63946', 22, 140); if (isPlayer && player.car === c) { player.health -= 25; player.car = null; player.x = c.x + 30; player.y = c.y; } } }
    c.speed *= -0.3; return;
  }
  c.x = nx; c.y = ny;
  for (const o of cars) { if (o !== c && !o.dead && Math.hypot(o.x - c.x, o.y - c.y) < 32) { if (Math.abs(c.speed) > 70) { o.health -= 9; c.health -= 6; burst(c.x, c.y, '#ccc', 6); snd.crash(); if (isPlayer) { crime(0.4); G.shake = Math.max(G.shake, 4); } } c.speed *= 0.55; o.speed *= 0.6; } }
}
function updateCars(dt) {
  for (const c of cars) {
    if (c.dead || c.driver === 'player') continue;
    if (c.police) continue;
    if (!c.traffic) { c.speed *= (1 - 2 * dt); continue; }
    c.aiT -= dt;
    // stop near player car / other cars ahead
    const fx = c.x + Math.cos(c.angle) * 52, fy = c.y + Math.sin(c.angle) * 52;
    let blocked = cars.some(o => o !== c && Math.hypot(o.x - fx, o.y - fy) < 34) || (player.car && Math.hypot(player.car.x - fx, player.car.y - fy) < 34) || (!player.car && Math.hypot(player.x - fx, player.y - fy) < 26);
    const atCross = isRoad(c.x, c.y) && ((c.x % BLOCK) < ROAD) && ((c.y % BLOCK) < ROAD);
    if (blocked) c.speed = Math.max(0, c.speed - 200 * dt);
    else c.speed += (105 - c.speed) * dt * 0.8;
    if (c.aiT <= 0) { c.aiT = 0.6 + Math.random(); if (atCross && Math.random() < 0.45) { const turn = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2; c.angle = Math.round((c.angle + turn) / (Math.PI / 2)) * (Math.PI / 2); } }
    if (G.chaseCar === c) { c.speed = 165; if (Math.random() < dt * 0.2) c.angle += (Math.random() - 0.5); }
    moveCar(c, dt, false);
  }
}
function updatePeds(dt) {
  const px = player.car ? player.car.x : player.x, py = player.car ? player.car.y : player.y;
  for (const p of peds) {
    if (p.dead) continue;
    p.walkT -= dt; p.fireCd -= dt; if (p.flee > 0) p.flee -= dt;
    const d = Math.hypot(px - p.x, py - p.y);
    let mvx = 0, mvy = 0, sp = p.speed;
    if (p.hostile) { if (d > 150) { mvx = (px - p.x) / d; mvy = (py - p.y) / d; sp = 65; } else if (p.fireCd <= 0) { p.fireCd = 1.1 + Math.random(); npcShoot(p); } }
    else if (p.cop) { if (d > 60) { mvx = (px - p.x) / d; mvy = (py - p.y) / d; sp = 105; } else if (G.wanted >= 2 && p.fireCd <= 0) { p.fireCd = 1.4 + Math.random(); npcShoot(p); } else if (d < 30 && !player.car) { G.state = 'over'; G.over = 'busted'; } }
    else if (p.flee > 0 || (player.car && Math.abs(player.car.speed) > 120 && d < 110)) { if (d > 1) { mvx = (p.x - px) / d; mvy = (p.y - py) / d; sp = 120; } }
    else { if (p.walkT <= 0) { p.walkT = 2 + Math.random() * 3; p.angle = Math.floor(Math.random() * 4) * Math.PI / 2; } mvx = Math.cos(p.angle); mvy = Math.sin(p.angle); }
    if (mvx || mvy) { const nx = p.x + mvx * sp * dt, ny = p.y + mvy * sp * dt; if (!collideRect(nx, ny, 9, world.buildings) && !isWater(nx, ny)) { p.x = nx; p.y = ny; } else p.angle += Math.PI / 2; p.angle = Math.atan2(mvy, mvx); }
    if (player.car && Math.abs(player.car.speed) > 40 && Math.hypot(player.car.x - p.x, player.car.y - p.y) < 24) { hurtPed(p, 60, player.car.angle); crime(1); player.car.speed *= 0.7; }
  }
  peds = peds.filter(p => !p.dead || Math.random() < 0.999);
  peds = peds.filter(p => Math.hypot(p.x - px, p.y - py) < 1500);
}
function npcShoot(p) { const tx = player.car ? player.car.x : player.x, ty = player.car ? player.car.y : player.y; const a = Math.atan2(ty - p.y, tx - p.x) + (Math.random() - 0.5) * 0.16; bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, life: 0.6, from: 'npc' }); snd.shoot(false); }
function updateBullets(dt) {
  for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (collideRect(b.x, b.y, 2, world.buildings)) b.life = 0;
    if (b.from === 'player') { for (const p of peds) { if (!p.dead && Math.hypot(p.x - b.x, p.y - b.y) < 13) { hurtPed(p, 34, Math.atan2(b.vy, b.vx)); b.life = 0; break; } } if (b.life > 0) for (const c of cars) { if (!c.dead && c.driver !== 'player' && Math.hypot(c.x - b.x, c.y - b.y) < 20) { c.health -= 16; burst(b.x, b.y, '#ffb703', 4); if (c.police) crime(0.8); b.life = 0; if (c.health <= 0) { c.dead = true; burst(c.x, c.y, '#e63946', 18, 130); } break; } } }
    else { const t = player.car || player; if (Math.hypot(t.x - b.x, t.y - b.y) < (player.car ? 21 : 12)) { if (player.car) { player.car.health -= 5; if (player.car.health <= 0 && !player.car.dead) { player.car.dead = true; player.health -= 20; player.x = player.car.x + 30; player.y = player.car.y; player.car = null; } } else player.health -= 7; burst(b.x, b.y, '#e63946', 4); b.life = 0; } }
  }
  bullets = bullets.filter(b => b.life > 0);
}
function updatePolice(dt) {
  const px = player.car ? player.car.x : player.x, py = player.car ? player.car.y : player.y;
  const wantCars = G.wanted >= 1 ? Math.min(1 + Math.floor(G.wanted), 6) : 0;
  if (cops.filter(c => c.police && !c.dead).length < wantCars && Math.random() < dt * 0.8) {
    const a = Math.random() * 6.28, c = mkCar(px + Math.cos(a) * 520, py + Math.sin(a) * 520, a, '#dfe6ee', { police: true, driver: 'cop' });
    if (!collideRect(c.x, c.y, 17, world.buildings) && !isWater(c.x, c.y)) { cars.push(c); cops.push(c); }
  }
  if (G.wanted >= 2 && peds.filter(p => p.cop && !p.dead).length < Math.floor(G.wanted) && Math.random() < dt * 0.5) {
    const a = Math.random() * 6.28; const p = { x: px + Math.cos(a) * 380, y: py + Math.sin(a) * 380, angle: 0, health: 45, speed: 105, color: '#22406b', flee: 0, cop: true, hostile: false, fireCd: 1, walkT: 0, dead: false };
    if (!collideRect(p.x, p.y, 9, world.buildings)) peds.push(p);
  }
  if (Math.random() < dt * 2 && (G.wanted >= 1)) snd.sirenTick(performance.now() / 1000);
  for (const c of cops) {
    if (c.dead || c.driver === 'player') continue;
    const d = Math.hypot(px - c.x, py - c.y), ta = Math.atan2(py - c.y, px - c.x);
    let diff = ta - c.angle; while (diff > Math.PI) diff -= 6.283; while (diff < -Math.PI) diff += 6.283;
    c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 2.2 * dt * 3));
    c.speed += ((d > 55 ? 235 : -60) - c.speed) * dt * 1.4;
    moveCar(c, dt, false);
    if (!player.car && d < 30) { G.state = 'over'; G.over = 'busted'; }
    if (player.car && d < 34 && Math.abs(player.car.speed) < 12) { G.bustT = (G.bustT || 0) + dt; if (G.bustT > 1.6) { G.state = 'over'; G.over = 'busted'; } } else G.bustT = 0;
  }
  cops = cops.filter(c => !c.dead);
}
// ---------- drawing ----------
function drawCar(c, cam) {
  ctx.save(); ctx.translate(c.x - cam.x, c.y - cam.y); ctx.rotate(c.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-19, -9, 42, 22);
  ctx.fillStyle = c.dead ? '#333' : c.color; ctx.beginPath(); ctx.roundRect(-20, -11, 40, 22, 6); ctx.fill();
  ctx.fillStyle = '#bfe9ff'; ctx.fillRect(-4, -8, 12, 16); ctx.fillRect(-14, -7, 6, 14);
  ctx.fillStyle = '#111'; [[-13, -12], [11, -12], [-13, 9], [11, 9]].forEach(w => ctx.fillRect(w[0], w[1], 8, 4));
  if (c.police) { ctx.fillStyle = '#22406b'; ctx.fillRect(-8, -11, 18, 22); ctx.fillStyle = (Math.floor(performance.now() / 300) % 2 ? '#ff2e2e' : '#2e7bff'); ctx.fillRect(-3, -6, 8, 12); ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SVPD', 1, 3); }
  // headlights at night
  const tod = G.time; if (tod > 0.7 || tod < 0.25) { const g = ctx.createRadialGradient(26, 0, 4, 60, 0, 70); g.addColorStop(0, 'rgba(255,240,170,0.5)'); g.addColorStop(1, 'rgba(255,240,170,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(20, -8); ctx.lineTo(85, -20); ctx.lineTo(85, 20); ctx.lineTo(20, 8); ctx.fill(); ctx.fillStyle = '#fff7ae'; ctx.fillRect(18, -9, 3, 5); ctx.fillRect(18, 4, 3, 5); }
  ctx.restore();
  if (c.health < 45 && !c.dead) { ctx.fillStyle = 'rgba(60,60,60,0.55)'; ctx.beginPath(); ctx.arc(c.x - cam.x + Math.random() * 8 - 4, c.y - cam.y - 14 - Math.random() * 8, 6 + Math.random() * 5, 0, 7); ctx.fill(); }
}
function draw() {
  const w = W(), h = H(); if (!G) return;
  const px = player ? (player.car ? player.car.x : player.x) : 600, py = player ? (player.car ? player.car.y : player.y) : 600;
  const shx = (Math.random() - 0.5) * G.shake, shy = (Math.random() - 0.5) * G.shake; G.shake *= 0.88;
  const cam = { x: Math.max(0, Math.min(WORLD_W - w, px - w / 2 + shx)), y: Math.max(0, Math.min(WORLD_H - h, py - h / 2 + shy)) };
  drawWorld(ctx, cam, w, h, G.time, world);
  ctx.fillStyle = 'rgba(90,60,30,0.5)'; for (const s of skids) ctx.fillRect(s.x - cam.x - 2, s.y - cam.y - 2, 4, 4);
  // mission marker
  let marker = null;
  if (G.missionActive) { const s = MISSIONS[G.missionIdx].steps[G.stepIdx]; if (s && s.type !== 'shootout') marker = s; if (s && s.type === 'chase' && G.chaseCar) marker = G.chaseCar; if (s && s.type === 'shootout') marker = s; }
  if (G.taxi) marker = G.taxi;
  if (marker && G.state !== 'title') { const bob = Math.sin(performance.now() / 250) * 6; ctx.fillStyle = 'rgba(255,209,102,0.3)'; ctx.beginPath(); ctx.arc(marker.x - cam.x, marker.y - cam.y, 34, 0, 7); ctx.fill(); ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.moveTo(marker.x - cam.x, marker.y - cam.y - 34 + bob); ctx.lineTo(marker.x - cam.x - 11, marker.y - cam.y - 54 + bob); ctx.lineTo(marker.x - cam.x + 11, marker.y - cam.y - 54 + bob); ctx.fill(); }
  for (const c of cars) { if (c.x < cam.x - 60 || c.x > cam.x + w + 60 || c.y < cam.y - 60 || c.y > cam.y + h + 60) continue; drawCar(c, cam); }
  for (const p of peds) { if (p.dead) { ctx.fillStyle = '#7a1f1f'; ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y, 9, 0, 7); ctx.fill(); continue; } if (p.x < cam.x - 40 || p.x > cam.x + w + 40 || p.y < cam.y - 40 || p.y > cam.y + h + 40) continue; ctx.save(); ctx.translate(p.x - cam.x, p.y - cam.y); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(1, 3, 8, 0, 7); ctx.fill(); ctx.fillStyle = p.cop ? '#22406b' : p.hostile ? '#111' : p.color; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#f2c89b'; ctx.beginPath(); ctx.arc(0, -2, 4.5, 0, 7); ctx.fill(); ctx.restore(); }
  ctx.fillStyle = '#ffe97a'; for (const b of bullets) ctx.fillRect(b.x - cam.x - 2, b.y - cam.y - 2, 4, 4);
  for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life * 1.6); ctx.fillStyle = p.color; ctx.fillRect(p.x - cam.x - p.r / 2, p.y - cam.y - p.r / 2, p.r, p.r); } ctx.globalAlpha = 1;
  if (player && !player.car && G.state !== 'title') { ctx.save(); ctx.translate(player.x - cam.x, player.y - cam.y); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(1, 3, 9, 0, 7); ctx.fill(); ctx.fillStyle = '#ff5964'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); ctx.fillStyle = '#f2c89b'; ctx.beginPath(); ctx.arc(0, -2, 5, 0, 7); ctx.fill(); ctx.rotate(player.angle); ctx.fillStyle = '#222'; ctx.fillRect(6, -2, 13, 4); ctx.restore(); }
  // day tint
  const t = G.time; let tint = 'rgba(0,0,0,0)';
  if (t > 0.68 && t < 0.8) tint = 'rgba(255,110,40,0.20)'; else if (t >= 0.8 || t < 0.2) tint = 'rgba(8,10,50,0.42)'; else if (t >= 0.2 && t < 0.3) tint = 'rgba(255,170,80,0.10)';
  ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h);
  if (G.state === 'title') { drawMinimap(cam); return drawTitle(w, h); }
  drawHUD(w, h); drawMinimap(cam);
  if (G.state === 'dialogue') drawDialogue(w, h);
  if (G.paused) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', w / 2, h / 2); ctx.font = '20px sans-serif'; ctx.fillText('Esc / P to resume — M mute, E enter car, F punch, T taxi', w / 2, h / 2 + 40); }
  if (G.state === 'over') { ctx.fillStyle = G.over === 'busted' ? 'rgba(20,40,90,0.72)' : 'rgba(90,0,0,0.72)'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fff'; ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(G.over === 'busted' ? 'BUSTED' : 'WASTED', w / 2, h / 2); ctx.font = '20px sans-serif'; ctx.fillText('Click to continue', w / 2, h / 2 + 44); }
}
function drawTitle(w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(20,8,40,0.25)'); g.addColorStop(1, 'rgba(10,10,30,0.75)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ff2e88'; ctx.font = 'bold 84px sans-serif'; ctx.fillText('SAN VERANO', w / 2, h * 0.32);
  ctx.fillStyle = '#4cc9f0'; ctx.font = 'bold 40px sans-serif'; ctx.fillText('NEON COAST', w / 2, h * 0.32 + 52);
  ctx.fillStyle = '#fff'; ctx.font = '19px sans-serif'; ctx.fillText('An original open-world crime adventure — steal rides, run jobs, outrun the SVPD.', w / 2, h * 0.32 + 88);
  button(w / 2 - 130, h * 0.55, 260, 54, 'NEW GAME', 'new');
  if (loadSave()) button(w / 2 - 130, h * 0.55 + 70, 260, 54, 'CONTINUE', 'continue');
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '15px sans-serif'; ctx.fillText('WASD drive/walk · Shift sprint · E enter car · Mouse aim, click shoot · F punch · 1/2 weapons · T taxi · M mute', w / 2, h - 36);
}
const btns = [];
function button(x, y, bw, bh, label, id) { btns.push({ x, y, w: bw, h: bh, id }); ctx.fillStyle = 'rgba(10,10,25,0.85)'; ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 10); ctx.fill(); ctx.strokeStyle = '#4cc9f0'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, x + bw / 2, y + bh / 2 + 8); }
cv.addEventListener('click', e => {
  snd.ensure();
  if (!G) return;
  if (G.state === 'title') { for (const b of btns) if (e.clientX >= b.x && e.clientX <= b.x + b.w && e.clientY >= b.y && e.clientY <= b.y + b.h) { startGame(b.id === 'continue'); } return; }
  if (G.state === 'over') { respawn(G.over); return; }
  if (G.state === 'dialogue') { G.dlgIdx++; if (G.dlgIdx >= G.dialogue.length) { G.dialogue = null; beginMission(); } }
});
function drawDialogue(w, h) {
  const d = G.dialogue[G.dlgIdx]; if (!d) return; const ch = CHARACTERS[d.who];
  ctx.fillStyle = 'rgba(5,5,18,0.88)'; ctx.fillRect(w * 0.14, h - 168, w * 0.72, 128);
  ctx.strokeStyle = ch.color; ctx.lineWidth = 3; ctx.strokeRect(w * 0.14, h - 168, w * 0.72, 128);
  ctx.fillStyle = ch.color; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(ch.name, w * 0.14 + 22, h - 132);
  ctx.fillStyle = '#fff'; ctx.font = '19px sans-serif'; wrapText(d.text, w * 0.14 + 22, h - 100, w * 0.72 - 44, 26);
  ctx.fillStyle = '#ffd166'; ctx.font = '14px sans-serif'; ctx.fillText('Click / Space to continue ▸', w * 0.14 + 22, h - 54);
}
function wrapText(text, x, y, maxW, lh) { const words = text.split(' '); let line = '', yy = y; for (const word of words) { const test = line ? line + ' ' + word : word; if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); yy += lh; line = word; } else line = test; } ctx.fillText(line, x, yy); }
function drawHUD(w, h) {
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(5,5,18,0.65)'; ctx.fillRect(14, 14, 300, 108);
  ctx.fillStyle = '#333'; ctx.fillRect(24, 24, 200, 16); ctx.fillStyle = player.health > 30 ? '#2ecc71' : '#e63946'; ctx.fillRect(24, 24, 200 * Math.max(0, player.health) / 100, 16);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('HEALTH ' + Math.ceil(player.health), 24, 58);
  if (player.car) { ctx.fillStyle = '#ffd166'; ctx.fillText('CAR ' + Math.ceil(player.car.health) + '%', 150, 58); }
  ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('$' + player.cash, 24, 84);
  ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; const hh = Math.floor(G.time * 24), mnt = Math.floor((G.time * 24 % 1) * 60);
  ctx.fillText('Day ' + G.day + '  ' + String(hh).padStart(2, '0') + ':' + String(mnt).padStart(2, '0'), 130, 84);
  ctx.fillStyle = '#ffd166'; ctx.font = '16px sans-serif'; ctx.fillText((player.weapon === 'smg' ? 'SMG' : 'PISTOL') + '  ammo ' + player.ammo[player.weapon], 24, 108);
  // stars
  ctx.font = '26px sans-serif'; for (let i = 0; i < 5; i++) { ctx.fillStyle = i < Math.ceil(G.wanted) ? '#ffd166' : 'rgba(255,255,255,0.25)'; ctx.fillText('★', w - 190 + i * 34, 42); }
  // objective
  ctx.fillStyle = 'rgba(5,5,18,0.65)'; const ow = Math.min(560, 30 + ctx.measureText(G.objective).width + 60); ctx.fillRect(w / 2 - ow / 2, 14, ow, 40);
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▸ ' + G.objective + (G.timer > 0 ? '  (' + Math.ceil(G.timer) + 's)' : ''), w / 2, 40); ctx.textAlign = 'left';
  if (G.msgT > 0) { ctx.fillStyle = 'rgba(5,5,18,0.7)'; ctx.fillRect(w / 2 - 220, 62, 440, 34); ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(G.msg, w / 2, 84); ctx.textAlign = 'left'; }
}
function drawMinimap() {
  const mw = mm.width, mh = mm.height, sx = mw / WORLD_W, sy = mh / WORLD_H;
  mmx.fillStyle = '#2b3a2e'; mmx.fillRect(0, 0, mw, mh);
  mmx.fillStyle = '#1d7fa8'; mmx.fillRect(3160 * sx, 0, mw - 3160 * sx, mh);
  mmx.strokeStyle = '#666'; mmx.lineWidth = 3;
  for (let i = 0; i < 9; i++) { mmx.beginPath(); mmx.moveTo((i * BLOCK + ROAD / 2) * sx, 0); mmx.lineTo((i * BLOCK + ROAD / 2) * sx, mh); mmx.stroke(); }
  for (let i = 0; i < 7; i++) { mmx.beginPath(); mmx.moveTo(0, (i * BLOCK + ROAD / 2) * sy); mmx.lineTo(mw, (i * BLOCK + ROAD / 2) * sy); mmx.stroke(); }
  mmx.fillStyle = '#5b7fa6'; mmx.fillRect(world.policeStation.x * sx - 3, world.policeStation.y * sy - 3, 6, 6);
  mmx.fillStyle = '#e63946'; mmx.fillRect(world.hospital.x * sx - 3, world.hospital.y * sy - 3, 6, 6);
  let marker = null; if (G.missionActive) { const s = MISSIONS[G.missionIdx].steps[G.stepIdx]; marker = (s && s.type === 'chase' && G.chaseCar) ? G.chaseCar : s; } if (G.taxi) marker = G.taxi;
  if (marker) { mmx.fillStyle = '#ffd166'; mmx.beginPath(); mmx.arc(marker.x * sx, marker.y * sy, 5 + Math.sin(performance.now() / 200) * 1.5, 0, 7); mmx.fill(); }
  mmx.fillStyle = '#2e7bff'; for (const c of cops) if (!c.dead) mmx.fillRect(c.x * sx - 2, c.y * sy - 2, 4, 4);
  const px = player.car ? player.car.x : player.x, py = player.car ? player.car.y : player.y, pa = player.car ? player.car.angle : player.angle;
  mmx.save(); mmx.translate(px * sx, py * sy); mmx.rotate(pa); mmx.fillStyle = '#fff'; mmx.beginPath(); mmx.moveTo(7, 0); mmx.lineTo(-5, -4); mmx.lineTo(-5, 4); mmx.fill(); mmx.restore();
}
// ---------- shot scenes ----------
function setupShot(name) {
  G = freshState(); spawnTraffic(); peds = []; bullets = []; particles = []; skids = []; cops = [];
  player = newPlayer(700, 700); G.cash = 850; player.cash = 850;
  if (name === 'cover') { G.state = 'title'; G.time = 0.74; player.x = 900; player.y = 900; spawnPeds(40, 900, 900); }
  if (name === 'drive') { G.state = 'play'; G.time = 0.45; const c = cars.find(x => !x.police) || cars[0]; c.x = 1150; c.y = 925; c.angle = 0; c.health = 100; c.driver = 'player'; player.car = c; player.x = c.x; player.y = c.y; c.speed = 150; G.objective = 'Cruise downtown — deliver Rosa to the Hospital'; spawnPeds(30, c.x, c.y); }
  if (name === 'chase') { G.state = 'play'; G.time = 0.55; G.wanted = 3.5; const c = cars.find(x => !x.police) || cars[0]; c.x = 1560; c.y = 925; c.angle = 0; c.health = 100; c.driver = 'player'; player.car = c; c.speed = 200; for (let i = 0; i < 3; i++) { const pc = mkCar(c.x - 140 - i * 95, c.y + (i - 1) * 30, 0, '#dfe6ee', { police: true, driver: 'cop' }); pc.health = 100; cars.push(pc); cops.push(pc); } G.objective = 'Lose the SVPD!'; spawnPeds(24, c.x, c.y); }
  if (name === 'mission') { G.state = 'play'; G.time = 0.4; player.x = 740; player.y = 880; G.missionIdx = 0; offerMission(); spawnPeds(26, player.x, player.y); }
  if (player.car) player.car.health = 100; player.health = 100;
}
let last = performance.now();
function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; btns.length = 0; if (G && G.state === 'play') update(dt); draw(); requestAnimationFrame(loop); }
if (shot) setupShot(shot); else { G = freshState(); spawnTraffic(); player = newPlayer(900, 900); spawnPeds(40, 900, 900); G.state = 'title'; }
requestAnimationFrame(loop);
window.__game = { get G() { return G; }, get player() { return player; }, startGame };
