// Story chain for SAN VERANO: Neon Coast. Six missions + taxi side activity.
export const CHARACTERS = {
  rosa: { name: 'Rosa Delgado', color: '#e63946' },
  diego: { name: 'Diego Fuentes', color: '#457b9d' },
  vera: { name: 'Vera Kaine', color: '#9d4edd' },
  marco: { name: 'Marco Solano', color: '#e9c46a' },
};
// Each mission: steps of {type: goto|pickup|deliver|chase|shootout|timerun, x,y, label, dialogue:[{who,text}], reward}
export const MISSIONS = [
  { title: 'Welcome to San Verano', giver: 'rosa', intro: [{ who: 'rosa', text: 'You must be the new driver. I am Rosa. This coast rewards the bold and buries the careless.' }, { who: 'rosa', text: 'Take my coupe and get me to the Hospital. Slowly is not in my vocabulary.' }], steps: [{ type: 'goto', x: 2320, y: 900, label: 'Drive Rosa to the Hospital' }], reward: 250 },
  { title: 'Package for Diego', giver: 'diego', intro: [{ who: 'diego', text: 'Diego Fuentes. Rosa says you can drive. Prove it: grab the crate by the Marina Store.' }, { who: 'diego', text: 'Then bring it to my garage near the safehouse. Do not open it. Seriously.' }], steps: [{ type: 'pickup', x: 2650, y: 1500, label: 'Pick up the crate at the marina' }, { type: 'deliver', x: 1230, y: 1900, label: 'Deliver the crate to Diego' }], reward: 400 },
  { title: 'Runaway Wheels', giver: 'vera', intro: [{ who: 'vera', text: 'Vera Kaine. A thief just stole my ride. Get it back — ram it or chase it until it stops.' }, { who: 'vera', text: 'You have wheels, yes? Then go. Clock is ticking, darling.' }], steps: [{ type: 'chase', x: 900, y: 500, label: 'Stop the stolen car' }], reward: 600 },
  { title: 'Neon Shootout', giver: 'marco', intro: [{ who: 'marco', text: 'Marco Solano. Rival crew is muscling into Parque Central tonight.' }, { who: 'marco', text: 'Clear them out. There is an SMG stashed around the city — key 2 once you find it. Stay alive.' }], steps: [{ type: 'shootout', x: 1980, y: 1520, label: 'Clear the rival crew at Parque Central', count: 5 }], reward: 900 },
  { title: 'Against the Clock', giver: 'rosa', intro: [{ who: 'rosa', text: 'Medicine run. The clinic needs supplies across town and the clock does not negotiate.' }, { who: 'rosa', text: 'Reach the waterfront marker before time runs out. Cut corners, not people. Mostly.' }], steps: [{ type: 'timerun', x: 2950, y: 2300, label: 'Reach the waterfront drop fast!', time: 75 }], reward: 1200 },
  { title: 'Five Star Finale', giver: 'vera', intro: [{ who: 'vera', text: 'Last job, legend. Grab the gold case downtown, survive everything the city throws at you...' }, { who: 'vera', text: '...and reach the safehouse. Five stars will burn. Do not get busted. Do not get wasted.' }], steps: [{ type: 'pickup', x: 700, y: 1150, label: 'Grab the gold case downtown' }, { type: 'deliver', x: 1230, y: 2020, label: 'Escape to the safehouse!', finale: true }], reward: 2500 },
];
export const TAXI_SPOTS = [
  { x: 400, y: 400 }, { x: 1500, y: 300 }, { x: 2500, y: 900 }, { x: 600, y: 1500 },
  { x: 2000, y: 2000 }, { x: 2900, y: 400 }, { x: 900, y: 2500 }, { x: 2700, y: 2500 },
];
