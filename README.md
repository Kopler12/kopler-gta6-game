# SAN VERANO: Neon Coast

An original top-down 2D open-world crime game that runs entirely in the browser.
No assets, no network requests at runtime — every building, car and palm tree is
drawn with Canvas 2D and every sound is synthesized live with WebAudio.

## The story

You are **Nico Alvarez**, a newcomer driver who washes up in **San Verano**, a
sun-baked neon coast city of hotels, clubs, workshops and a working harbour.
**Rosa** (owner of Casa Rosa) gives you a roof and your first wheel. **Diego**
the mechanic, **Vera** the harbour smuggler and **Marco** the club owner pull
you deeper: a harbour pickup, a stolen-car chase, a plaza shootout, a race
against the last ferry, and a five-star finale run across town with a case full
of cash. Finish the story, then keep earning with taxi fares in free roam.

## Features

- Dense explorable city (3200×2400 world): road grid with intersections,
  crosswalks and sidewalks, ~90 named buildings with signs, a beach and sea
  edge, two parks, lamps, palms, crates, parked cars, plus a police station,
  hospital, safehouse and ammo shop — with a smooth follow camera.
- On foot: WASD/arrows movement, Shift sprint, building and water collision.
- Driving: enter/exit any car with E (stealing raises your wanted level),
  arcade physics, Space handbrake, skid marks, car damage with smoke and fire
  risk, headlights and street-lamp glow at night.
- Living traffic: AI cars follow the road network, keep lanes, turn at
  intersections, stop for crossings and each other; pedestrians stroll the
  sidewalks and flee from speed, crashes and gunfire.
- Wanted system: 0–5 stars for stealing, assault, shooting, hit-and-runs and
  attacking police; stars decay while you stay out of sight. Police cars spawn
  and pursue on foot and by car; foot officers chase and shoot at 2+ stars.
  Get **BUSTED** or **WASTED** and you respawn at the police station or
  hospital minus a cash penalty.
- Combat: F/click punch, mouse-aimed pistol, a findable SMG (key 2, at the
  Ammo & Gear shop), muzzle flashes, sparks, hit reactions, deaths, and
  health/ammo/cash pickups scattered around the city.
- Six story missions with named characters and dialogue boxes, world and
  minimap markers, on-HUD objectives, cash rewards, fail/retry and autosave —
  plus repeatable taxi fares for money in free roam.
- Full HUD: health (and car health), cash, wanted stars, weapon and ammo,
  objective text, a day clock with day–dusk–night tinting, and a live minimap
  with streets, police blips, mission markers and your heading arrow.
- Flow: animated start screen (New Game / Continue), pause menu, wasted and
  busted screens, mission dialogue; progress persists in `localStorage`.
- Polish: day cycle, particles, screen shake, synthesized engine, sirens,
  gunshots and a bass music loop (M mutes), 60 fps delta-time loop.

## Controls

| Input | Action |
| --- | --- |
| WASD / Arrows | Walk or drive |
| Shift | Sprint |
| E | Enter / exit car |
| Mouse + Click | Aim and shoot (on foot) |
| F | Punch |
| 1 / 2 | Pistol / SMG |
| Space | Handbrake |
| Esc / P | Pause |
| M | Mute |
| Enter / Click | Advance dialogue |

## How to run

```sh
node serve.ts            # then open http://localhost:8080
# or: node serve.ts --port 9000
```

Any static file server pointed at `game/` works too. Desktop Chrome with
keyboard and mouse is the target.

Deterministic screenshot scenes are available via URL parameters, e.g.
`?shot=cover|drive|chase|mission&seed=1`.

## Tech notes

- Plain static files under `game/`: `index.html` plus ES modules in
  `game/src/` (`main.js` engine/HUD/render, `world.js` city generation,
  `missions.js` story data, `audio.js` WebAudio synth). No dependencies,
  no build step, no external assets, no runtime network calls.
- The city is generated deterministically from a seed, so screenshot scenes
  are reproducible.

## License

MIT — see `LICENSE`.

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Kopler12/kopler-gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Kopler12/kopler-gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
