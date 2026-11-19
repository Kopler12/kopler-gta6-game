# SAN VERANO: Neon Coast

An original top-down open-world crime game for desktop Chrome. You arrive in
San Verano — a sun-baked, neon-lit coastal city of palm avenues, beach kiosks
and back-alley deals — with $120, a borrowed pistol, and a cousin named Rosa
who always has one more job.

## Story pitch

Rosa, Diego, Vera and Marco pull you through six story missions: a first
drive to the beach, a crate delivery, a courier chase, a dockside shootout, a
90-second medicine run, and a five-star finale — steal the downtown cash van
and make it back to Rosa's safehouse. Between missions, run repeatable taxi
fares for cash, hunt cash crates, and try to keep the SVPD off your tail.

## Features

- Dense explorable city: road grid with intersections, sidewalks, ~90 named
  buildings, waterfront and beach, parks, lamps, palms and crates, parked
  cars, hospital, police HQ and safehouse; smooth follow camera over a world
  far bigger than one screen
- On foot: WASD / arrows, Shift sprint, building and water collision
- Driving: enter/exit any car with E (stealing raises wanted), arcade physics,
  Space handbrake, skid marks, damage with smoke at low health, headlights
  at night
- Traffic AI that follows the road network, stops at intersections and avoids
  obstacles; pedestrians who stroll the sidewalks and flee gunfire
- Wanted system 0–5 stars for theft, assault, shooting and collisions; stars
  decay out of sight. Police cars pursue, foot cops chase and shoot at 2+
  stars; BUSTED / WASTED respawns at the police station / hospital with a
  cash penalty
- Combat: punch (F), pistol with limited ammo (mouse aim + click), muzzle
  flash and particles, plus a findable SMG (key 2); health, ammo and cash
  pickups across the city
- Six-mission story chain with dialogue boxes, world + minimap markers,
  objective text, rewards, fail/retry and autosave; repeatable taxi fares
- HUD: health (and car health), cash, wanted stars, weapon + ammo, objective,
  day clock with day–dusk–night tint cycle, live minimap with streets, player
  arrow, mission marker and police blips
- Animated title screen with New Game / Continue, pause menu, wasted/busted
  screens, localStorage saves, WebAudio synthesized engine, sirens, gunshots
  and a music loop (M to mute), screen shake and a delta-time 60 fps loop

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Walk / drive |
| Shift | Sprint |
| E | Enter / exit car, advance dialogue |
| F or mouse click | Punch (F) / shoot (click, on foot) |
| Space | Handbrake (in car), advance dialogue |
| 1 / 2 | Pistol / SMG |
| T | Start a taxi fare (when free roaming) |
| Esc / P | Pause |
| M | Mute |

## How to run

Requires Node 22 (standard library only, nothing to install):

```
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. The game is plain static
files under `game/` and makes no network requests at runtime.

To build the hand-in dossier:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Tech notes

- Plain canvas 2D + ES modules (`game/src/world.js`, `audio.js`,
  `missions.js`, `main.js`); all art is drawn with canvas calls and all sound
  is synthesized with WebAudio — no external assets
- Deterministic screenshot scenes: `?shot=cover|drive|chase|mission&seed=1`
- Saves live in localStorage under `sanverano-save-v1`

## License

MIT — see `LICENSE`.
[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Kopler12/kopler-gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Kopler12/kopler-gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
