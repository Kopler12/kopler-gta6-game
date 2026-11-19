// SAN VERANO world generation: city grid, buildings, props, pickups.
export const WORLD_W = 3600, WORLD_H = 2800;
export const ROAD = 130, BLOCK = 430;
export function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function isRoad(x, y) {
  const mx = ((x % BLOCK) + BLOCK) % BLOCK, my = ((y % BLOCK) + BLOCK) % BLOCK;
  return mx < ROAD || my < ROAD;
}
export function isWater(x, y) { return x > 3160; }
export function isBeach(x, y) { return x > 3000 && x <= 3160; }
const NAMES = ['Cafe Sol', 'Hotel Mar', 'Taco Luna', 'Club Neon', 'Banka Azul', 'Farmacia Vida', 'Taller Ruiz', 'Joyeria Oro', 'Pizza Costa', 'Bar Palma', 'Gym Titan', 'Libreria Sol', 'Floristeria', 'Mercado Central', 'Cine Verano', 'Dulce Bakery', 'Marina Store', 'Optica Luz', 'Barberia Leo', 'Lavanderia', 'Tienda Maya', 'Restaurante Ola', 'Zapateria', 'Dental Care', 'Vet Amigo', 'Foto Studio', 'Deli Fresh', 'Sushi Mar', 'Burger Bay', 'Heladeria'];
const COLORS = ['#e8b4b8', '#f4d35e', '#8ecae6', '#ffb703', '#90be6d', '#f28482', '#84a98c', '#e07a5f', '#81b29a', '#f2cc8f', '#cdb4db', '#ffc8dd'];
export function buildWorld(seed = 1) {
  const rnd = mulberry(seed * 7919 + 13);
  const buildings = [], props = [], pickups = [], parked = [];
  let ni = 0;
  for (let bx = 0; bx < 8; bx++) for (let by = 0; by < 6; by++) {
    const ox = bx * BLOCK + ROAD + 14, oy = by * BLOCK + ROAD + 14;
    if (ox > 2950) continue;
    const bw = BLOCK - ROAD - 28, bh = BLOCK - ROAD - 28;
    const special = (bx === 1 && by === 1) ? 'POLICE STATION' : (bx === 5 && by === 1) ? 'HOSPITAL' : (bx === 2 && by === 4) ? 'SAFEHOUSE' : (bx === 4 && by === 3) ? 'PARK' : null;
    if (special === 'PARK') { buildings.push({ x: ox, y: oy, w: bw, h: bh, park: true, name: 'Parque Central', color: '#3a7d44' }); continue; }
    if (special) { buildings.push({ x: ox, y: oy, w: bw, h: bh, name: special, color: special === 'POLICE STATION' ? '#5b7fa6' : special === 'HOSPITAL' ? '#eef2f5' : '#d9a05b', special: true }); continue; }
    const n = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const w = bw / n - 10, h = bh * (0.55 + rnd() * 0.4);
      buildings.push({ x: ox + i * (bw / n) + 5, y: oy + (bh - h) / 2, w, h, name: NAMES[ni++ % NAMES.length], color: COLORS[Math.floor(rnd() * COLORS.length)], floors: 2 + Math.floor(rnd() * 6) });
    }
  }
  for (let i = 0; i < 160; i++) {
    const x = 60 + rnd() * 2900, y = 40 + rnd() * 2700;
    if (!isRoad(x, y)) continue;
    props.push({ x, y, type: rnd() < 0.5 ? 'lamp' : 'palm' });
  }
  for (let i = 0; i < 40; i++) props.push({ x: 3050 + rnd() * 100, y: 60 + rnd() * 2600, type: 'palm' });
  for (let i = 0; i < 26; i++) props.push({ x: 200 + rnd() * 2700, y: 100 + rnd() * 2500, type: 'crate' });
  const pk = [['health', 12], ['ammo', 12], ['cash', 14], ['smg', 2]];
  for (const [type, count] of pk) for (let i = 0; i < count; i++) {
    let x, y, tries = 0;
    do { x = 120 + rnd() * 2800; y = 120 + rnd() * 2500; tries++; } while (tries < 20 && buildings.some(b => !b.park && x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 20 && y < b.y + b.h + 20));
    pickups.push({ x, y, type, taken: false, respawn: 0 });
  }
  const carColors = ['#e63946', '#457b9d', '#f1fa8c', '#2a9d8f', '#e9c46a', '#ffffff', '#22223b', '#9d4edd', '#ff7b00', '#4cc9f0'];
  for (let i = 0; i < 34; i++) {
    let x, y, tries = 0;
    do { x = 100 + rnd() * 2900; y = 80 + rnd() * 2600; tries++; } while (tries < 30 && !isRoad(x, y));
    const horiz = ((y % BLOCK) < ROAD);
    parked.push({ x, y, angle: horiz ? (rnd() < 0.5 ? 0 : Math.PI) : (rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2), color: carColors[i % carColors.length] });
  }
  return { buildings, props, pickups, parked, policeStation: { x: 760, y: 760 }, hospital: { x: 2320, y: 760 }, safehouse: { x: 1230, y: 2020 } };
}
export function collideRect(x, y, r, buildings) {
  for (const b of buildings) { if (b.park) continue; if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b; }
  return null;
}
export function drawWorld(ctx, cam, w, h, timeOfDay, world) {
  const x0 = cam.x - 60, y0 = cam.y - 60, x1 = cam.x + w + 60, y1 = cam.y + h + 60;
  ctx.fillStyle = '#7a9e7e'; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.translate(-cam.x, -cam.y);
  // water + beach
  ctx.fillStyle = '#f2d492'; ctx.fillRect(3000, 0, 160, WORLD_H);
  ctx.fillStyle = '#1d7fa8'; ctx.fillRect(3160, 0, WORLD_W - 3160, WORLD_H);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let y = 20; y < WORLD_H; y += 90) ctx.fillRect(3180 + Math.sin(y * 0.05) * 8, y, 380, 5);
  // blocks base
  ctx.fillStyle = '#b8b2a7';
  for (let bx = 0; bx < 9; bx++) for (let by = 0; by < 7; by++) ctx.fillRect(bx * BLOCK + ROAD, by * BLOCK + ROAD, BLOCK - ROAD, BLOCK - ROAD);
  // roads
  ctx.fillStyle = '#3d3d44';
  for (let i = 0; i < 9; i++) ctx.fillRect(i * BLOCK, 0, ROAD, WORLD_H);
  for (let i = 0; i < 7; i++) ctx.fillRect(0, i * BLOCK, WORLD_W, ROAD);
  ctx.strokeStyle = '#f7d154'; ctx.lineWidth = 3; ctx.setLineDash([24, 20]);
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(i * BLOCK + ROAD / 2, 0); ctx.lineTo(i * BLOCK + ROAD / 2, WORLD_H); ctx.stroke(); }
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(0, i * BLOCK + ROAD / 2); ctx.lineTo(3000, i * BLOCK + ROAD / 2); ctx.stroke(); }
  ctx.setLineDash([]);
  // crosswalks
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) { for (let s = 0; s < 4; s++) ctx.fillRect(i * BLOCK + 8 + s * 30, j * BLOCK + 4, 16, 6); }
  // buildings
  for (const b of world.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    if (b.park) {
      ctx.fillStyle = '#4a9e57'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#2f6b3a';
      for (let t = 0; t < 8; t++) { const tx = b.x + 30 + ((t * 97) % (b.w - 60)), ty = b.y + 30 + ((t * 61) % (b.h - 60)); ctx.beginPath(); ctx.arc(tx, ty, 16, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2);
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const cols = Math.max(2, Math.floor(b.w / 34)), rows = Math.max(2, Math.floor(b.h / 30));
    for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) { if ((cx * 7 + cy * 13) % 3 !== 0) ctx.fillRect(b.x + 10 + cx * 30, b.y + 12 + cy * 26, 14, 12); }
    ctx.fillStyle = '#1b1b22'; ctx.fillRect(b.x, b.y + b.h - 26, b.w, 26);
    ctx.fillStyle = '#ffd166'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h - 8);
  }
  // props
  for (const p of world.props) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    if (p.type === 'lamp') { ctx.fillStyle = '#333'; ctx.fillRect(p.x - 2, p.y - 12, 4, 14); ctx.fillStyle = timeOfDay > 0.72 || timeOfDay < 0.22 ? '#ffe97a' : '#cfd8dc'; ctx.beginPath(); ctx.arc(p.x, p.y - 15, 5, 0, 7); ctx.fill(); }
    else if (p.type === 'palm') { ctx.strokeStyle = '#6d4c2f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 3, p.y - 22); ctx.stroke(); ctx.strokeStyle = '#2e9e4f'; ctx.lineWidth = 3; for (let k = 0; k < 5; k++) { const a = k * 1.25; ctx.beginPath(); ctx.moveTo(p.x + 3, p.y - 22); ctx.lineTo(p.x + 3 + Math.cos(a) * 18, p.y - 22 + Math.sin(a) * 10 - 6); ctx.stroke(); } }
    else { ctx.fillStyle = '#a67c52'; ctx.fillRect(p.x - 10, p.y - 10, 20, 20); ctx.strokeStyle = '#6d4c2f'; ctx.strokeRect(p.x - 10, p.y - 10, 20, 20); }
  }
  // pickups
  for (const p of world.pickups) {
    if (p.taken || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    const bob = Math.sin(performance.now() / 300 + p.x) * 3;
    ctx.fillStyle = p.type === 'health' ? '#e63946' : p.type === 'cash' ? '#2ecc71' : p.type === 'smg' ? '#9d4edd' : '#f4a261';
    ctx.beginPath(); ctx.arc(p.x, p.y + bob, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(p.type === 'health' ? '+' : p.type === 'cash' ? '$' : p.type === 'smg' ? 'S' : 'A', p.x, p.y + bob + 4);
  }
  ctx.restore();
}
