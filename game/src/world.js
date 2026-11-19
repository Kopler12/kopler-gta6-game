// SAN VERANO world generation — deterministic city layout.
// World is 3200 x 2400. Roads on a grid, beach along the south edge.
export const WORLD_W = 3200, WORLD_H = 2400;
export const ROAD_XS = [200, 700, 1200, 1700, 2200, 2700];
export const ROAD_YS = [200, 650, 1100, 1550, 1950];
export const ROAD_W = 110;
export const BEACH_Y = 2120;

export function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUILDING_NAMES = [
  ['Hotel Solmar', '#e8b4d8'], ['Neon Palms Hotel', '#7ee8fa'], ['Banco Verano', '#ffd166'],
  ['Cafe Ola', '#f4a261'], ['Taco Costa', '#e76f51'], ['Gym Titan', '#a8dadc'],
  ['Clinica Vida', '#ffffff'], ['Farmacia Sol', '#b7e4c7'], ['Club Marea', '#c77dff'],
  ['Bar El Faro', '#ffb703'], ['Oficinas Coral', '#90e0ef'], ['Apartamentos Brisa', '#f9c6d3'],
  ['Taller Ruedas', '#adb5bd'], ['Joyeria Perla', '#ffe5ec'], ['Libreria Mar', '#a2d2ff'],
  ['Pizzeria Napoli', '#ffafcc'], ['Mercado Central', '#ffc8dd'], ['Cine Verano', '#bdb2ff'],
  ['Tatuajes Ink', '#caffbf'], ['Floristeria Rosa', '#ffadad'], ['Panaderia Luna', '#fdffb6'],
  ['Hotel Coral Bay', '#9bf6ff'], ['Casino Arena', '#ffbe0b'], ['Discoteca Ola', '#fb5607'],
  ['Restaurante Mar', '#3a86ff'], ['Tienda Surf', '#8338ec'], ['Oficina Portuaria', '#ff006e'],
  ['Condos Altamar', '#06d6a0'], ['Barberia Cortez', '#118ab2'], ['Lavanderia Azul', '#073b4c'],
  ['Escuela Verano', '#ef476f'], ['Biblioteca Publica', '#ffd166'], ['Museo del Mar', '#06d6a0'],
  ['Estacion Radio', '#118ab2'], ['Hotel Vista', '#e0aaff'], ['Cafe Neon', '#10002b'],
  ['Galeria Arte', '#5a189a'], ['Supermercado Dia', '#3a0ca3'], ['Torre Mirador', '#4361ee'],
  ['Residencial Palmera', '#4cc9f0'], ['Clinica Dental', '#f72585'], ['Taller Naval', '#7209b7'],
  ['Pension Marisol', '#560bad'], ['Rooftop Bar Nube', '#480ca8'], ['Tienda Licores', '#b5179e'],
];

export function buildWorld(seed) {
  const rnd = mulberry(seed || 1);
  const buildings = [], props = [], pickups = [], parked = [];
  const specials = [
    { x: 950, y: 875, w: 260, h: 170, name: 'POLICE STATION', color: '#3a5a8c', kind: 'police' },
    { x: 1950, y: 425, w: 260, h: 170, name: 'HOSPITAL', color: '#e8e8e8', kind: 'hospital' },
    { x: 950, y: 1325, w: 180, h: 140, name: 'SAFEHOUSE - CASA ROSA', color: '#e07a5f', kind: 'safehouse' },
    { x: 2450, y: 1325, w: 240, h: 160, name: 'AMMO & GEAR', color: '#606c38', kind: 'shop' },
  ];
  for (const s of specials) buildings.push(s);
  let bi = 0;
  for (let gx = 0; gx < ROAD_XS.length - 1; gx++) {
    for (let gy = 0; gy < ROAD_YS.length - 1; gy++) {
      const bx = ROAD_XS[gx] + ROAD_W / 2, by = ROAD_YS[gy] + ROAD_W / 2;
      const bw = ROAD_XS[gx + 1] - ROAD_XS[gx] - ROAD_W, bh = ROAD_YS[gy + 1] - ROAD_YS[gy] - ROAD_W;
      // park in one block
      if (gx === 3 && gy === 1) { buildings.push({ x: bx + bw / 2, y: by + bh / 2, w: bw, h: bh, name: 'PARQUE CENTRAL', color: '#2d6a4f', kind: 'park', cx: bx + bw / 2, cy: by + bh / 2 }); continue; }
      if (gx === 1 && gy === 2) { buildings.push({ x: bx + bw / 2, y: by + bh / 2, w: bw, h: bh, name: 'PLAZA PALMERAS', color: '#40916c', kind: 'park', cx: bx + bw / 2, cy: by + bh / 2 }); continue; }
      const cols = 2, rows = 2;
      for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
        const w = bw / cols - 26, h = bh / rows - 26;
        const x = bx + (cx + 0.5) * (bw / cols), y = by + (cy + 0.5) * (bh / rows);
        const overlaps = specials.some(s => Math.abs(x - s.x) < (w + s.w) / 2 + 8 && Math.abs(y - s.y) < (h + s.h) / 2 + 8);
        if (overlaps) continue;
        const nm = BUILDING_NAMES[bi % BUILDING_NAMES.length]; bi++;
        buildings.push({ x, y, w, h, name: nm[0], color: nm[1], kind: 'building', floors: 2 + ((rnd() * 6) | 0), shade: 0.85 + rnd() * 0.3 });
      }
    }
  }
  // props: lamps at intersections, palms on beach + parks, crates in alleys
  for (const rx of ROAD_XS) for (const ry of ROAD_YS) {
    props.push({ type: 'lamp', x: rx - ROAD_W / 2 - 10, y: ry - ROAD_W / 2 - 10 });
    props.push({ type: 'lamp', x: rx + ROAD_W / 2 + 10, y: ry + ROAD_W / 2 + 10 });
  }
  for (let x = 80; x < WORLD_W - 60; x += 90 + rnd() * 80) props.push({ type: 'palm', x, y: BEACH_Y + 40 + rnd() * 60, s: 0.8 + rnd() * 0.5 });
  for (let i = 0; i < 26; i++) props.push({ type: 'palm', x: 200 + rnd() * (WORLD_W - 400), y: 200 + rnd() * 1600, s: 0.8 + rnd() * 0.5 });
  for (let i = 0; i < 30; i++) props.push({ type: 'crate', x: 150 + rnd() * (WORLD_W - 300), y: 150 + rnd() * 1800 });
  // pickups: health, ammo, cash crates, SMG
  const spots = [[760, 720], [1260, 1160], [1760, 720], [2260, 1620], [760, 1620], [2760, 1620], [1260, 260], [2260, 260], [1760, 1620], [500, 1100]];
  spots.forEach((s, i) => pickups.push({ type: i % 3 === 0 ? 'health' : (i % 3 === 1 ? 'ammo' : 'cash'), x: s[0], y: s[1], taken: false, respawn: 0 }));
  pickups.push({ type: 'smg', x: 2450, y: 1445, taken: false, respawn: 0 });
  pickups.push({ type: 'health', x: 1950, y: 545, taken: false, respawn: 0 });
  pickups.push({ type: 'cash', x: 830, y: 1620, taken: false, respawn: 0 });
  // parked cars along roads
  const carColors = ['#e63946', '#457b9d', '#f1fa8c', '#2a9d8f', '#e9c46a', '#9d4edd', '#ffffff', '#22223b', '#fb8500', '#06d6a0'];
  for (let i = 0; i < 34; i++) {
    const vertical = rnd() > 0.5;
    if (vertical) {
      const rx = ROAD_XS[(rnd() * ROAD_XS.length) | 0];
      parked.push({ x: rx + (rnd() > 0.5 ? -ROAD_W / 2 + 18 : ROAD_W / 2 - 18), y: 150 + rnd() * 1850, angle: Math.PI / 2, color: carColors[(rnd() * carColors.length) | 0] });
    } else {
      const ry = ROAD_YS[(rnd() * ROAD_YS.length) | 0];
      parked.push({ x: 150 + rnd() * 2900, y: ry + (rnd() > 0.5 ? -ROAD_W / 2 + 18 : ROAD_W / 2 - 18), angle: 0, color: carColors[(rnd() * carColors.length) | 0] });
    }
  }
  return { buildings, props, pickups, parked, specials };
}

export function isRoad(x, y) {
  if (y > BEACH_Y) return false;
  for (const rx of ROAD_XS) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}
export function nearestRoadPoint(x, y) {
  let best = null, bd = 1e18;
  for (const rx of ROAD_XS) { const d = Math.abs(x - rx); if (d < bd) { bd = d; best = { x: rx, y, vertical: true }; } }
  for (const ry of ROAD_YS) { const d = Math.abs(y - ry); if (d < bd) { bd = d; best = { x, y: ry, vertical: false }; } }
  return best;
}
export function collideBuildings(buildings, x, y, r) {
  for (const b of buildings) {
    if (b.kind === 'park') continue;
    if (x + r > b.x - b.w / 2 && x - r < b.x + b.w / 2 && y + r > b.y - b.h / 2 && y - r < b.y + b.h / 2) return b;
  }
  return null;
}
