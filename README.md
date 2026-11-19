# SAN VERANO: Neon Coast

An original top-down open-world crime game that runs entirely in the browser.
No assets, no network requests at runtime: every building, car, palm tree and
neon sign is drawn with Canvas 2D, and every engine growl, siren and gunshot is
synthesized live with WebAudio.

## The pitch

You arrive in **San Verano**, a sun-bleached coastal city of deco hotels, surf
shacks, casinos and one very awake police force — the SVPD. Your cousin Rosa
puts you to work. Diego "El Faro" Ruiz moves packages nobody asks about. Vera
Kane collects debts in scarlet roadsters. Marco Sol just wants his beach back.
Run their jobs, steal what you need, outrun five stars of heat, and by the
finale the whole neon coast knows your name.

## Features

- **A dense living city** — a 14×11 road grid with intersections, sidewalks,
  lane markings, ~150 named buildings (Hotel Coral, Casino Sol, Verano Bank,
  Club Azul…), parks, palm trees, street lamps, crates, parked cars, a sandy
  beach and open water on the east edge, plus a hospital, police station and
  safehouse.
- **On foot & driving** — walk, sprint, punch, shoot; press E to enter *any*
  car (stealing raises your wanted level). Arcade driving with acceleration,
  braking, reverse, handbrake drifts, skid marks, damage states with smoke,
  and headlights after dark.
- **Traffic & pedestrians** — AI cars cruise the road network, queue behind
  each other and turn at intersections; pedestrians stroll the sidewalks,
  panic and flee gunfire, and can be scared, punched or run over.
- **Wanted system & police** — 0–5 stars for theft, assault, gunfire and hits.
  SVPD patrol cars pursue and ram you; officers on foot chase and shoot at
  2+ stars. Break line of sight and the heat decays. Get **BUSTED** or
  **WASTED** and you respawn at the police station or hospital, poorer.
- **Combat** — fists (F), a pistol, and a findable SMG with rapid fire,
  muzzle flash, particles, screen shake, health/ammo pickups and delivery
  crates scattered across the city.
- **Story chain — 6 missions** with dialogue from four named characters:
  a first drive, a package pickup, a car chase, a beach shootout, a
  90-second timed run, and a five-star finale. Mission markers, HUD
  objectives, cash rewards, fail/retry, autosave after every mission.
- **Side money** — repeatable taxi fares and gold delivery crates.
- **Full HUD** — health, cash, wanted stars, weapon & ammo, objective line,
  day/clock with a full day-night tint cycle, and a live minimap with streets,
  police blips, mission markers and your heading arrow.
- **Screens & save** — animated title screen, New Game / Continue, pause menu
  (resume / save / restart / title), mission dialogue cards, wasted/busted
  screens, and a `localStorage` save of cash, story progress, position,
  weapons and stats.
- **Sound** — synthesized engine, sirens, shots, crashes, pickups and a
  looping bass-and-lead music groove. Press **M** to mute.

## Controls

| Action | Keys |
| --- | --- |
| Move / drive | WASD or arrow keys |
| Sprint | Shift |
| Enter / exit car, talk to mission giver | E |
| Punch | F |
| Shoot | Mouse aim + click (hold for SMG) |
| Switch weapon | 1 pistol · 2 SMG |
| Handbrake | Space |
| Pause | Esc or P |
| Advance dialogue | Enter |
| Mute | M |

## How to run

```sh
node serve.ts            # serves game/ on http://localhost:8080
# or: node serve.ts --port 9000
```

Then open the URL in desktop Chrome. Everything is plain static files under
`game/` (`index.html` + ES modules in `game/src/`), so any static file server
works too. Deterministic screenshot scenes are available via URL parameters,
e.g. `?shot=chase&seed=1` (scenes: `cover`, `drive`, `chase`, `mission`).

## Tech notes

- Canvas 2D rendering with a delta-time loop and a smooth follow camera.
- The city is procedurally generated from a seed (`game/src/world.js`):
  roads, collision solids, beach/water zones and named buildings.
- Traffic uses lane-following with intersection turns and simple
  look-ahead braking; police use pursuit steering; pedestrians use a small
  state machine (walk / flee / hostile / chase).
- Audio is 100% WebAudio synthesis (`game/src/audio.js`) — oscillators and
  filtered noise bursts, no audio files.
- Saves live in `localStorage` under `sanverano-save-v1`.

## License

MIT — see `LICENSE`. SAN VERANO: Neon Coast is an original work; all names,
places, characters and art in the game were created for this entry.
