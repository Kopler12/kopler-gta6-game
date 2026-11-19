// SAN VERANO world data: city layout, buildings, roads, props, pickups.
// Everything is generated deterministically from a seed so screenshot
// scenes and normal play share the same city.

export const WORLD_W = 3600;
export const WORLD_H = 2800;
export const BEACH_Y = 2380; // water starts here (south edge)

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
  'Hotel Marisol', 'Cafe Azul', 'Neon Records', 'Taco Luna', 'Palm Gym',
  'Verano Bank', 'Casa Rosa', 'Bar Coral', 'Surf Shop', 'La Perla Club',
  'Diner Sol', 'Pharmacy Vida', 'Book Nook', 'Gallery Mar', 'Pizza Ola',
  'Jewelry Luna', 'Barber Rey', 'Flower Shop', 'Tech Point', 'Sushi Mar',
  'Bakery Dulce', 'Tattoo Sol', 'Cinema Rio', 'Market Central', 'Gym Titan',
  'Cafe Brisa', 'Hotel Palma', 'Bar Noche', 'Deli Verde', 'Shoe Loft',
];
const COLORS = ['#e8b4a0', '#a8c8d8', '#f0d9a0', '#c9b8e0', '#a8d8b0', '#e8a8b8', '#b8d0e8', '#f0c8a0', '#d8e0a8', '#c0c8d0'];

// Road centre lines: vertical x positions and horizontal y positions.
export const VX = [300, 800, 1300, 1800, 2300, 2800, 3300];
export const HY = [300, 800, 1300, 1800, 2200];
export const ROAD_HALF = 55; // half width of a road

export function onRoadX(x) { return VX.some(v => Math.abs(x - v) < ROAD_HALF); }
export function onRoadY(y) { return HY.some(h => Math.abs(y - h) < ROAD_HALF); }
export function isRoad(x, y) { return onRoadX(x) || onRoadY(y); }
export function isWater(x, y) { return y > BEACH_Y + 90; }
export function isSand(x, y) { return y > BEACH_Y - 40 && y <= BEACH_Y + 90; }

export function buildWorld(seed) {
  const rnd = mulberry(seed * 7919 + 13);
  const buildings = [];
  const props = [];
  const parked = [];
  const pickups = [];
  let ni = 0;
  // City blocks between roads.
  for (let bi = 0; bi < VX.length - 1; bi++) {
    for (let bj = 0; bj < HY.length; bj++) {
      const x0 = VX[bi] + ROAD_HALF + 26, x1 = VX[bi + 1] - ROAD_HALF - 26;
      const y0 = (bj === 0 ? 60 : HY[bj - 1] + ROAD_HALF + 26);
      const y1 = HY[bj] - ROAD_HALF - 26;
      if (y1 - y0 < 120 || x1 - x0 < 120) continue;
      // 2x2 buildings per block
      for (let sx = 0; sx < 2; sx++) for (let sy = 0; sy < 2; sy++) {
        if (rnd() < 0.12) continue; // gap = small plaza / park patch
        const bw = (x1 - x0) / 2 - 22, bh = (y1 - y0) / 2 - 22;
        const bx = x0 + sx * ((x1 - x0) / 2) + 10, by = y0 + sy * ((y1 - y0) / 2) + 10;
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: COLORS[Math.floor(rnd() * COLORS.length)],
          roof: ['#8a6f5c', '#6f7f8a', '#9a7f6f', '#5f6f7a'][Math.floor(rnd() * 4)],
          name: NAMES[ni++ % NAMES.length],
          floors: 2 + Math.floor(rnd() * 6),
        });
      }
    }
  }
  // Landmark buildings with fixed roles.
  const landmarks = [
    { x: 380, y: 360, w: 300, h: 170, color: '#dfe8ee', roof: '#b03a3a', name: 'SAN VERANO HOSPITAL', role: 'hospital' },
    { x: 2920, y: 360, w: 300, h: 170, color: '#c8d4e8', roof: '#2a3a6a', name: 'POLICE HQ — SVPD', role: 'police' },
    { x: 1560, y: 860, w: 260, h: 150, color: '#f0d9a0', roof: '#7a4a2a', name: 'SAFEHOUSE — Rosa’s', role: 'safehouse' },
    { x: 880, y: 1860, w: 280, h: 150, color: '#e8a8b8', roof: '#6a2a4a', name: 'CLUB NEON PALMS', role: 'club' },
    { x: 2380, y: 1360, w: 280, h: 150, color: '#a8d8b0', roof: '#2a5a3a', name: 'VERANO MALL', role: 'mall' },
  ];
  for (const L of landmarks) buildings.push(L);
  // Parks: green rectangles (drawn, no collision) with palms.
  const parks = [
    { x: 900, y: 900, w: 300, h: 300 }, { x: 2400, y: 900, w: 300, h: 300 },
    { x: 400, y: 1400, w: 300, h: 300 }, { x: 2900, y: 1400, w: 300, h: 300 },
  ];
  // Props: lamps along roads, palms in parks/beach, crates in alleys.
  for (const v of VX) for (let y = 120; y < BEACH_Y; y += 220) props.push({ t: 'lamp', x: v - ROAD_HALF - 10, y });
  for (const h of HY) for (let x = 160; x < WORLD_W - 100; x += 260) props.push({ t: 'lamp', x, y: h - ROAD_HALF - 10 });
  for (const p of parks) for (let i = 0; i < 10; i++) props.push({ t: 'palm', x: p.x + 20 + rnd() * (p.w - 40), y: p.y + 20 + rnd() * (p.h - 40) });
  for (let x = 120; x < WORLD_W - 80; x += 150) props.push({ t: 'palm', x: x + rnd() * 40, y: BEACH_Y + 10 + rnd() * 40 });
  for (let i = 0; i < 26; i++) props.push({ t: 'crate', x: 140 + rnd() * (WORLD_W - 280), y: 140 + rnd() * 1900 });
  // Parked cars along vertical roads.
  const carCols = ['#d94f4f', '#4f7fd9', '#f2c14e', '#57b26a', '#e8e8e8', '#333a44', '#b45fd9', '#ff8c42'];
  for (let i = 0; i < 42; i++) {
    const vx = VX[Math.floor(rnd() * VX.length)];
    const y = 140 + rnd() * 2000;
    parked.push({ x: vx + (rnd() < 0.5 ? -34 : 34), y, a: Math.PI / 2, color: carCols[Math.floor(rnd() * carCols.length)], hp: 100 });
  }
  // Pickups scattered: health, ammo, cash crates, SMG.
  for (let i = 0; i < 14; i++) pickups.push({ t: 'health', x: 160 + rnd() * (WORLD_W - 320), y: 160 + rnd() * 1900, taken: false });
  for (let i = 0; i < 14; i++) pickups.push({ t: 'ammo', x: 160 + rnd() * (WORLD_W - 320), y: 160 + rnd() * 1900, taken: false });
  for (let i = 0; i < 18; i++) pickups.push({ t: 'cash', x: 160 + rnd() * (WORLD_W - 320), y: 160 + rnd() * 1900, taken: false });
  pickups.push({ t: 'smg', x: 1700, y: 1080, taken: false });
  pickups.push({ t: 'smg', x: 3050, y: 1560, taken: false });
  return { buildings, props, parked, pickups, parks, landmarks };
}

export function collideBuildings(x, y, r, buildings) {
  for (const b of buildings) {
    if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return true;
  }
  return false;
}
export function clampWorld(e) {
  e.x = Math.max(24, Math.min(WORLD_W - 24, e.x));
  e.y = Math.max(24, Math.min(WORLD_H - 24, e.y));
}
