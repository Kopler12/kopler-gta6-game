// Story chain for SAN VERANO: Neon Coast. Six missions + taxi side job.
// Each mission: giver, intro dialogue lines, objective builder, reward.
// Stage kinds: goto, drive, pickup, chase, shootout, timed, finale.

export const STORY = [
  {
    id: 'm1', title: 'Welcome to San Verano', giver: 'Rosa',
    where: { x: 1690, y: 1060 },
    lines: [
      ['Rosa', 'You made it, cousin! San Verano — sun, neon, and trouble.'],
      ['You', 'Trouble I can handle. Where do we start?'],
      ['Rosa', 'Take my coupe. Drive to the beach kiosk and meet Diego.'],
    ],
    objective: 'Drive to the beach kiosk and meet Diego',
    target: { x: 1900, y: 2330 }, kind: 'drive', reward: 150,
  },
  {
    id: 'm2', title: 'The Package', giver: 'Diego',
    where: { x: 1900, y: 2330 },
    lines: [
      ['Diego', 'Rosa sent you? Good. Grab the crate by the mall, bring it to Club Neon Palms.'],
      ['You', 'No questions asked. On it.'],
    ],
    objective: 'Pick up the crate at Verano Mall, deliver to Club Neon Palms',
    target: { x: 2520, y: 1440 }, target2: { x: 1020, y: 1950 }, kind: 'pickup', reward: 300,
  },
  {
    id: 'm3', title: 'Hot Pursuit', giver: 'Vera',
    where: { x: 1020, y: 1950 },
    lines: [
      ['Vera', 'A rival courier just stole our ledger. Chase that red car down!'],
      ['You', 'Consider it recovered.'],
    ],
    objective: 'Ram the rival courier car until it stops',
    target: { x: 1300, y: 800 }, kind: 'chase', reward: 450,
  },
  {
    id: 'm4', title: 'Dockside Trouble', giver: 'Marco',
    where: { x: 700, y: 2250 },
    lines: [
      ['Marco', 'Dock crew shook down my shop. Clear the pier — carefully.'],
      ['You', 'Careful is my middle name. Mostly.'],
    ],
    objective: 'Defeat 4 dock thugs at the pier',
    target: { x: 700, y: 2250 }, kind: 'shootout', reward: 600, count: 4,
  },
  {
    id: 'm5', title: 'Against the Clock', giver: 'Rosa',
    where: { x: 1690, y: 1060 },
    lines: [
      ['Rosa', 'Medicine for the clinic — the hospital needs it in 90 seconds!'],
      ['You', 'Ninety seconds? I only need sixty.'],
    ],
    objective: 'Deliver the medicine to the Hospital in 90 seconds',
    target: { x: 530, y: 560 }, kind: 'timed', reward: 800, time: 90,
  },
  {
    id: 'm6', title: 'Neon Finale', giver: 'Vera',
    where: { x: 1020, y: 1950 },
    lines: [
      ['Vera', 'Final job. Grab the cash van downtown and lose the heat — all five stars of it.'],
      ['Marco', 'Survive, reach the safehouse, and San Verano is ours.'],
      ['You', 'Let’s light up the coast.'],
    ],
    objective: 'Reach the downtown van, then escape to Rosa’s safehouse with 5 stars',
    target: { x: 1800, y: 1300 }, target2: { x: 1690, y: 1060 }, kind: 'finale', reward: 2000,
  },
];

export function missionByIndex(i) { return STORY[i] || null; }
