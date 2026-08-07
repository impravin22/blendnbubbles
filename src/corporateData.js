// ─── BlendNBubbles corporate & campus event data ─────────────
// Drives the corporate section on the /events page, which pitches a live
// bubble tea counter to HR, admin and facilities teams at offices, campuses
// and tech parks.
//
// Kept separate from the consumer event-request form above it because the
// audience and the wording are different: a facilities head asking about
// vendor onboarding needs different reassurance from someone booking a
// birthday.
//
// OCCASIONS is deliberately festival-agnostic where possible. Festivals that
// have already passed for the current year should be removed so the list never
// advertises a date that is behind us.

export const BOOKING_OPTIONS = [
  {
    id: 'guests-pay',
    tag: 'Option A · Zero budget',
    name: 'Guests pay, you pay nothing',
    cost: '₹0 to host',
    body:
      'We set up the counter and bill each guest directly. No budget approval, no purchase order, no invoice to process.',
    note: 'The easy yes when the engagement budget is already spent.',
    highlight: true,
  },
  {
    id: 'sponsored',
    tag: 'Option B · Fully hosted',
    name: 'You sponsor, drinks are free',
    cost: 'Per-cup or package',
    body:
      'You pick the headcount and flavours, we serve your people free at the counter. One clean invoice at the end.',
    note: 'The crowd-pleaser for festivals and annual days.',
    highlight: false,
  },
];

export const OCCASIONS = [
  'Durga Puja',
  'Diwali',
  'Christmas & New Year',
  'Annual Day',
  'Town Halls',
  'Family Day',
  'Sports Day',
  'Product Launches',
  'Induction Days',
  'Employee Appreciation',
  'Wellness Weeks',
];

export const PACKAGES = [
  {
    id: 'small',
    cups: '50',
    unit: 'cups · 250 ml',
    fits: 'Small team or floor',
    detail: '2 flavours · 2-hour counter',
  },
  {
    id: 'medium',
    cups: '100',
    unit: 'cups · 250 ml',
    fits: 'Department or town hall',
    detail: '3 flavours · 3-hour counter',
  },
  {
    id: 'large',
    cups: '200+',
    unit: 'cups · 250 ml',
    fits: 'Campus-wide festival',
    detail: '5 flavours · 4-hour counter',
  },
];

export const TRUST_MARKERS = [
  { id: 'fssai', label: 'FSSAI licensed', detail: '12825999000080' },
  { id: 'menu', label: '42 drinks', detail: 'on the menu' },
  { id: 'veg', label: '100% vegetarian', detail: 'no alcohol' },
  { id: 'reply', label: 'Reply in 24 hours', detail: 'with menu and quote' },
];
