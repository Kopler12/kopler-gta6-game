// SAN VERANO story missions — original characters and story.
// Player is Nico Alvarez, a newcomer driver in the coastal city of San Verano.
export const CHARACTERS = {
  Rosa: { color: '#ff6b9d', role: 'Owner of Casa Rosa' },
  Diego: { color: '#ffd166', role: 'Mechanic and fixer' },
  Vera: { color: '#7ee8fa', role: 'Harbor smuggler' },
  Marco: { color: '#c77dff', role: 'Club owner' },
};

export const MISSIONS = [
  {
    id: 'm1', title: 'Welcome to San Verano', giver: 'Rosa', reward: 250,
    intro: [
      ['Rosa', 'Nico! You made it. I am Rosa — Casa Rosa is home now.'],
      ['Rosa', 'Take my turquoise coupe outside and drive Diego to his workshop. He owes me a favour.'],
      ['Nico', 'On it. Streets first, trouble later.'],
    ],
    steps: [
      { type: 'enter_car', text: 'Get in the turquoise coupe outside Casa Rosa', x: 950, y: 1550 },
      { type: 'goto', text: 'Drive Diego to the workshop (Taller Ruedas)', x: 1700, y: 720, needCar: true },
      { type: 'goto', text: 'Return to Casa Rosa', x: 950, y: 1420 },
    ],
    outro: [['Rosa', 'Smooth driving. Diego says you have real hands. Here is $250.']],
  },
  {
    id: 'm2', title: 'Harbor Run', giver: 'Vera', reward: 400,
    intro: [
      ['Vera', 'Rosa vouched for you. I am Vera — I move cargo through the harbour.'],
      ['Vera', 'Pick up the crates at the south beach road and bring them to my warehouse by the docks. Fast and quiet.'],
    ],
    steps: [
      { type: 'goto', text: 'Pick up the cargo crates at the beach road', x: 1200, y: 2050 },
      { type: 'goto', text: 'Deliver the cargo to Vera at the harbour warehouse', x: 2700, y: 1550 },
    ],
    outro: [['Vera', 'Clean work, Nico. $400. The coast remembers favours.']],
  },
  {
    id: 'm3', title: 'Hot Pursuit', giver: 'Diego', reward: 550,
    intro: [
      ['Diego', 'Nico, a rival crew stole my custom ride! They are fleeing north.'],
      ['Diego', 'Ram them, stop that car, and bring my ride back to the workshop. Do not total it!'],
    ],
    steps: [
      { type: 'chase', text: 'Chase down and stop the stolen car', x: 2200, y: 300 },
      { type: 'goto', text: 'Bring the recovered car to the workshop', x: 1700, y: 720, needCar: true },
    ],
    outro: [['Diego', 'My baby is back! $550, amigo. You drive like the tide — unstoppable.']],
  },
  {
    id: 'm4', title: 'Neon Trouble', giver: 'Marco', reward: 800,
    intro: [
      ['Marco', 'I run Club Marea. A gang is shaking down my street tonight.'],
      ['Marco', 'Clear them out from the plaza. Take the gear near my club if you need it. Stay alive, Nico.'],
    ],
    steps: [
      { type: 'shootout', text: 'Clear the gang from Plaza Palmeras (defeat 4 thugs)', x: 950, y: 1350, count: 4 },
      { type: 'goto', text: 'Report back to Marco at Club Marea', x: 2200, y: 1100 },
    ],
    outro: [['Marco', 'The street breathes again. $800. You are family now.']],
  },
  {
    id: 'm5', title: 'Against the Clock', giver: 'Vera', reward: 1000,
    intro: [
      ['Vera', 'A buyer leaves on the last ferry in 90 seconds.'],
      ['Vera', 'Grab the package at the hospital and reach the beach pier before time runs out. Drive like you mean it!'],
    ],
    steps: [
      { type: 'goto', text: 'Collect the package at the Hospital', x: 1950, y: 545, timer: 90 },
      { type: 'goto', text: 'Reach the beach pier — hurry!', x: 1700, y: 2080, timer: 75 },
    ],
    outro: [['Vera', 'With seconds to spare! $1000. The ferry sails happy tonight.']],
  },
  {
    id: 'm6', title: 'Neon Coast Finale', giver: 'Rosa', reward: 2500,
    intro: [
      ['Rosa', 'The whole crew trusts you now, Nico. One last job — the big one.'],
      ['Marco', 'Carry the cash case across town. Every cop in San Verano will come for you.'],
      ['Rosa', 'Survive the heat, lose the law, and reach Casa Rosa. Then this coast is yours.'],
    ],
    steps: [
      { type: 'goto', text: 'Pick up the cash case at Casino Arena', x: 1200, y: 400, wanted: 3 },
      { type: 'goto', text: 'Reach Casa Rosa with the case — survive the heat!', x: 950, y: 1420, wanted: 5 },
      { type: 'escape', text: 'Lose the police (drop to 0 stars out of sight)', x: 950, y: 1420 },
    ],
    outro: [
      ['Rosa', 'You did it, Nico. $2500 — and San Verano is home for good.'],
      ['Rosa', 'Free roam is yours now. Taxi fares and deliveries still pay around the city.'],
    ],
  },
];

export function missionGiverPos(idx) {
  const givers = { Rosa: { x: 950, y: 1420 }, Vera: { x: 2700, y: 1550 }, Diego: { x: 1700, y: 720 }, Marco: { x: 2200, y: 1100 } };
  if (idx >= MISSIONS.length) return null;
  return givers[MISSIONS[idx].giver];
}
