// SAN VERANO world generation: road grid, buildings, beach, parks, props.
// All procedural, seeded so screenshot scenes are deterministic.

export const TILE = 160; // block size
export const COLS = 14, ROWS = 11;
export const WORLD_W = COLS * TILE + 320;
export const WORLD_H = ROWS * TILE + 320;
export const ROAD_W = 56;

export function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  'HOTEL CORAL','PALM COURT','NEON DINER','VERANO BANK','SURF SHACK','CLUB AZUL',
  'MARINA LOFTS','TACO SOL','CINEMA RIO','PAWN & GOLD','AUTO REYES','LAUNDR-O-MAT',
  'FISH MARKET','HOTEL LUNA','BAR EL FARO','GYM TITAN','PHARMACY','BOOK NOOK',
  'PIZZA VERDE','CASINO SOL','ART DECO APTS','HARBOUR OFFICE','DENTIST','BAKERY MIA',
  'LIQUOR LAGOON','TATTOO INK','MUSEUM','LIBRARY','POST OFFICE','FLORIST'
];
const PALETTE = ['#e8b4a0','#a8d8d8','#f2d492','#d98cb3','#9ec49a','#b8a8d8','#f0a868','#8fc1c9','#e6e0d0','#c97b5a','#7fb3a8','#d4c5a9'];

export function buildWorld(seed = 7) {
  const rnd = mulberry(seed);
  const buildings = [], parks = [], props = [], solids = [];
  // Vertical roads at x = 160 + i*TILE, horizontal at y = 160 + j*TILE
  const vRoads = [], hRoads = [];
  for (let i = 0; i <= COLS; i++) vRoads.push(160 + i * TILE);
  for (let j = 0; j <= ROWS; j++) hRoads.push(160 + j * TILE);

  let ni = 0;
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      const bx = 160 + i * TILE + ROAD_W / 2 + 6;
      const by = 160 + j * TILE + ROAD_W / 2 + 6;
      const bw = TILE - ROAD_W - 12, bh = TILE - ROAD_W - 12;
      // Beach strip on east edge columns, park in middle
      if (i >= COLS - 1) continue; // waterfront handled separately
      if ((i === 4 && j === 5) || (i === 9 && j === 3)) {
        parks.push({ x: bx, y: by, w: bw, h: bh });
        for (let k = 0; k < 5; k++) props.push({ type: 'palm', x: bx + 12 + rnd() * (bw - 24), y: by + 12 + rnd() * (bh - 24) });
        continue;
      }
      // Split block into 1-2 buildings
      const two = rnd() > 0.45;
      const mk = (x, y, w, h) => {
        const b = { x, y, w, h, color: PALETTE[Math.floor(rnd() * PALETTE.length)], name: NAMES[ni++ % NAMES.length], floors: 2 + Math.floor(rnd() * 5), roof: rnd() > 0.5 ? '#5a4a42' : '#6b5d54' };
        buildings.push(b); solids.push(b);
      };
      if (two && bw > 80) { mk(bx, by, bw * 0.48, bh); mk(bx + bw * 0.52, by, bw * 0.48, bh); }
      else mk(bx, by, bw, bh);
      // sidewalk props
      if (rnd() > 0.4) props.push({ type: 'lamp', x: bx - 4, y: by - 4 });
      if (rnd() > 0.5) props.push({ type: 'crate', x: bx + bw - 10, y: by + bh - 4 });
      if (rnd() > 0.55) props.push({ type: 'palm', x: bx + bw + 2, y: by + bh * rnd() });
    }
  }
  // Beach: east strip
  const beachX = 160 + COLS * TILE + ROAD_W / 2;
  for (let k = 0; k < 26; k++) props.push({ type: 'palm', x: beachX + 20 + rnd() * 90, y: 140 + rnd() * (WORLD_H - 280) });
  // Key locations
  const hospital = { x: 160 + 2 * TILE + 40, y: 160 + 2 * TILE - 70, label: 'HOSPITAL' };
  const policeSt = { x: 160 + 7 * TILE + 40, y: 160 + 7 * TILE - 70, label: 'POLICE' };
  const safehouse = { x: 160 + 1 * TILE + 40, y: 160 + 8 * TILE - 70, label: 'SAFEHOUSE' };

  function isRoad(x, y) {
    for (const rx of vRoads) if (Math.abs(x - rx) < ROAD_W / 2) return true;
    for (const ry of hRoads) if (Math.abs(y - ry) < ROAD_W / 2) return true;
    return false;
  }
  function isWater(x, y) { return x > beachX + 130; }
  function isSand(x, y) { return x > beachX && !isWater(x, y); }
  function collideCircle(x, y, r) {
    // returns corrected position pushed out of solids
    let nx = x, ny = y;
    for (const s of solids) {
      const cx = Math.max(s.x, Math.min(nx, s.x + s.w)), cy = Math.max(s.y, Math.min(ny, s.y + s.h));
      const dx = nx - cx, dy = ny - cy, d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 < 0.01) { ny = s.y - r; continue; }
        const d = Math.sqrt(d2); nx = cx + (dx / d) * r; ny = cy + (dy / d) * r;
      }
    }
    nx = Math.max(r, Math.min(nx, WORLD_W - r));
    ny = Math.max(r, Math.min(ny, WORLD_H - r));
    return { x: nx, y: ny, hit: nx !== x || ny !== y };
  }
  return { buildings, parks, props, solids, vRoads, hRoads, beachX, hospital, policeSt, safehouse, isRoad, isWater, isSand, collideCircle, rnd };
}

// Lane helpers for traffic: cars drive on right side.
export function lanePoint(world, axis, fixed, t) {
  return axis === 'v' ? { x: fixed + 14, y: t } : { x: t, y: fixed + 14 };
}
