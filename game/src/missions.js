// Story chain for SAN VERANO. Each mission: giver, intro dialogue, objective type,
// target location (grid coords resolved by main), reward, and outro line.
// Types: goto | drive | pickup | escape | shootout | timed | finale | taxi handled in main.

export const CHARACTERS = {
  rosa: { name: 'ROSA DEL MAR', color: '#ff7eb6' },
  diego: { name: 'DIEGO "EL FARO" RUIZ', color: '#ffd166' },
  vera: { name: 'VERA KANE', color: '#8ecae6' },
  marco: { name: 'MARCO SOL', color: '#95d5b2' },
};

export const MISSIONS = [
  {
    id: 'm1', giver: 'rosa', title: 'First Light in San Verano',
    intro: [
      'ROSA: You made it, cousin. San Verano eats the slow — so drive fast.',
      'ROSA: Take my coupe outside and bring it to the Marina Lofts. No scratches.',
    ],
    type: 'drive', reward: 250, outro: 'ROSA: Clean work. The coast already likes you. +$250',
  },
  {
    id: 'm2', giver: 'diego', title: 'Package for El Faro',
    intro: [
      'DIEGO: A crate fell off a boat near the Fish Market. It is mine now. Fetch it.',
      'DIEGO: Bring it back to Bar El Faro before anyone asks questions.',
    ],
    type: 'pickup', reward: 400, outro: 'DIEGO: The lighthouse provides. +$400',
  },
  {
    id: 'm3', giver: 'vera', title: 'Hot Wheels, Cold Trail',
    intro: [
      'VERA: Rival crew just lifted a scarlet roadster downtown. They are running east.',
      'VERA: Catch the thief, stop the car, and bring the heat down. Go!',
    ],
    type: 'chase', reward: 650, outro: 'VERA: Consider that debt collected. +$650',
  },
  {
    id: 'm4', giver: 'marco', title: 'Beachfront Static',
    intro: [
      'MARCO: Dealers are muscling my surf shack on the beach road. Clear them out.',
      'MARCO: Four of them. You have the tools — use them, then get clear.',
    ],
    type: 'shootout', reward: 900, outro: 'MARCO: The beach breathes again. +$900',
  },
  {
    id: 'm5', giver: 'rosa', title: 'Ninety Seconds to Luna',
    intro: [
      'ROSA: A guest at Hotel Luna needs a ride to the airport gate — ninety seconds.',
      'ROSA: The clock starts when you roll. Do not be gentle with the corners.',
    ],
    type: 'timed', reward: 1100, outro: 'ROSA: Right on the tide line. +$1,100',
  },
  {
    id: 'm6', giver: 'diego', title: 'Neon Coast Finale',
    intro: [
      'DIEGO: Tonight we move the whole ledger across the city, with every cop awake.',
      'DIEGO: Reach the Casino Sol vault drop, survive the response, lose the heat.',
    ],
    type: 'finale', reward: 2500, outro: 'DIEGO: San Verano is ours tonight. FINALE COMPLETE +$2,500',
  },
];

export const SIDE_INFO = {
  taxi: 'TAXI: pick up the glowing passenger (walk or drive to them), then drive them to the gold drop-off. Fares pay cash and never raise your wanted level.',
  delivery: 'DELIVERY: gold crates around the city pay $60–$140 when driven over in a car.',
};
