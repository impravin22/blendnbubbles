// ─── BlendNBubbles private & celebration catering data ───────
// Drives the "Celebrations" tab on the /events page: birthdays, weddings,
// college fests and house parties.
//
// Kept separate from corporateData.js because the two tabs sell to different
// people. A parent booking a birthday wants to know it will be fun; a
// facilities head wants to know you can invoice them.

export const CATERING_STEPS = [
  {
    id: 'tell-us',
    title: 'Tell us about your event',
    body: 'Fill the form below — it takes under two minutes.',
  },
  {
    id: 'we-reply',
    title: 'We call you back',
    body: 'Within 24 hours, with a menu and a quote for your headcount.',
  },
  {
    id: 'we-pour',
    title: 'We pour, you party',
    body: 'Freshly shaken at your venue or ours. Every bubble tells a story.',
  },
];

export const CATERING_PACKAGES = [
  {
    id: 'mini-fest',
    name: 'The Mini Fest',
    guests: 'Up to 50 guests',
    cups: '50',
    unit: 'cups · 250 ml',
    includes: ['2 signature flavours', '2 toppings of your choice', '2-hour live counter'],
    fits: 'Sized for house parties and birthdays',
    popular: false,
  },
  {
    id: 'crowd-pleaser',
    name: 'The Crowd Pleaser',
    guests: '80–120 guests',
    cups: '100',
    unit: 'cups · 250 ml',
    includes: ['3 signature flavours', '3 toppings of your choice', '3-hour live counter and crew'],
    fits: 'Built for offices and college fests',
    popular: true,
  },
  {
    id: 'grand-affair',
    name: 'The Grand Affair',
    guests: '150+ guests',
    cups: '200',
    unit: 'cups · 250 ml',
    includes: [
      '5 signature flavours',
      '4 toppings of your choice',
      '4-hour live counter and full crew',
      'Bespoke flavour for your event',
    ],
    fits: 'Made for weddings and receptions',
    popular: false,
  },
];

export const CATERING_OCCASIONS = [
  'Birthdays',
  'Weddings & receptions',
  'College fests',
  'House parties',
  'Anniversaries',
  'Baby showers',
];
