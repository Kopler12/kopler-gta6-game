# SAN VERANO: Neon Coast

An original open-world crime game in a sun-soaked coastal city. Everything — city, characters, vehicles, story, art and sound — was created for this game. No third-party assets, no network requests at runtime.

## Story pitch

You arrive in San Verano with $150, a borrowed pistol, and a reputation you have not earned yet. Rosa Delgado gives you your first wheel work. Diego Fuentes needs a crate moved quietly. Vera Kaine wants her stolen ride back. Marco Solano is holding Parque Central against a rival crew. Six story jobs chain from a friendly hospital run to a five-star escape to the safehouse — and between jobs, the whole city is yours: steal cars, run taxi fares, chase pickups, and try to keep the SVPD off your tail.

## Features

- Dense explorable city (3600×2800 world): road grid with intersections and crosswalks, sidewalks and blocks, 90+ named buildings with signs (cafes, hotels, a bank, a cinema, shops), a beach and waterfront, Parque Central, props (lamps, palms, crates), parked cars, plus a Police Station, Hospital and Safehouse
- On foot: walk and sprint with building and water collision
- Driving: enter/exit any car with E (stealing raises your wanted level), arcade physics with acceleration, braking, reverse, steering and a handbrake, skid marks, damage states with smoke at low health, and headlights at night
- Traffic AI that drives the road network, turns at intersections and brakes for obstacles; pedestrians stroll the city and flee danger and gunfire
- Wanted system, 0–5 stars for stealing, assault, shooting, collisions and shooting police; stars decay while you stay out of sight. Police cars pursue on foot and by car, foot officers chase and shoot at 2+ stars. BUSTED / WASTED sends you back to the police station / hospital with a cash fee
- Combat: melee punch, a pistol with limited ammo and mouse aim, muzzle flash particles, hit reactions and NPC deaths, plus a findable SMG (key 2), and health / ammo / cash pickups scattered across the city
- Six-mission story chain with named givers (Rosa, Diego, Vera, Marco) and dialogue boxes: intro drive, pickup/delivery, a car chase, a shootout, a timed run, and a 5-star finale — with world and minimap markers, HUD objectives, cash rewards, fail/retry, and autosave after every mission
- Repeatable taxi side activity (press T) for extra cash
- Full HUD: health bar, car health, cash, wanted stars, weapon and ammo, objective line, day clock with a day–dusk–night tint cycle, and a live minimap (streets, player arrow, mission marker, police blips)
- Animated start screen with New Game / Continue, pause menu, wasted/busted screens, mission dialogue
- Polish: day-cycle tinting, skid marks, spark/smoke/muzzle particles, screen shake, and a fully synthesized WebAudio soundtrack — engine, sirens, gunshots and a bass music loop (M to mute)

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Walk or drive |
| Shift | Sprint on foot |
| Mouse | Aim |
| Click | Shoot |
| F | Punch |
| E | Enter / exit car |
| Space | Handbrake |
| 1 / 2 | Pistol / SMG |
| T | Taxi fare start / cancel |
| Esc / P | Pause |
| M | Mute |

## How to run

Requires Node 22 (standard library only, nothing to install):

```
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. To build the submission dossier:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Deterministic screenshot scenes are available via URL parameters, e.g. `?shot=cover&seed=1`, `?shot=drive&seed=1`, `?shot=chase&seed=1`, `?shot=mission&seed=1`.

## Tech notes

- Plain static files under `game/`: one HTML page and ES modules (`src/world.js` city generation and rendering, `src/audio.js` WebAudio synthesis, `src/missions.js` story data, `src/main.js` game loop, AI, combat and HUD)
- All art is drawn with the 2D canvas API; all sound is synthesized with WebAudio oscillators and filtered noise — zero external assets and zero runtime network requests
- Fixed-cap delta-time loop targeting 60 fps; progress (cash, story progress, position, ammo) is saved to `localStorage`

## License

MIT — see `LICENSE`.

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Kopler12/kopler-gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Kopler12/kopler-gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
