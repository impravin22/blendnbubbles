// ─── World Cup nations for the team picker ───────────────────
// One entry per nation in the 2026 tournament field (48 teams). Each holds:
//   code      FIFA 3-letter code (used on the scorebug and leaderboard)
//   name      display name
//   flag      emoji flag (decorative; name + code stay the reliable identity
//             in case a device cannot render a given flag glyph)
//   primary   home-kit jersey colour (the striker's shirt + socks)
//   secondary national accent colour (shoulder / sleeve trim)
//   featured  true for the handful surfaced first in the picker
//
// Kit legibility (the jersey number colour) is derived from the jersey
// luminance at draw time, so primary/secondary only need to be the
// recognisable national colours, not a guaranteed-contrasting pair.

export const TEAMS = [
  // Featured: the nations Kolkata fans most often back, in the order requested.
  { code: 'ARG', name: 'Argentina', flag: '🇦🇷', primary: '#6CACE4', secondary: '#0B3D91', featured: true },
  { code: 'BRA', name: 'Brazil', flag: '🇧🇷', primary: '#FCDD09', secondary: '#1E7A3E', featured: true },
  { code: 'ESP', name: 'Spain', flag: '🇪🇸', primary: '#C60B1E', secondary: '#F9C40A', featured: true },
  { code: 'GER', name: 'Germany', flag: '🇩🇪', primary: '#F4F4F4', secondary: '#1A1A1A', featured: true },
  { code: 'NED', name: 'Netherlands', flag: '🇳🇱', primary: '#EC6608', secondary: '#1A1A1A', featured: true },
  { code: 'POR', name: 'Portugal', flag: '🇵🇹', primary: '#DA291C', secondary: '#006847', featured: true },
  { code: 'FRA', name: 'France', flag: '🇫🇷', primary: '#1E2F97', secondary: '#FFFFFF', featured: true },
  { code: 'ENG', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', primary: '#F4F4F4', secondary: '#0A2342', featured: true },

  // The rest of the field, alphabetical.
  { code: 'ALG', name: 'Algeria', flag: '🇩🇿', primary: '#0A7E3A', secondary: '#FFFFFF' },
  { code: 'AUS', name: 'Australia', flag: '🇦🇺', primary: '#FFCD00', secondary: '#00843D' },
  { code: 'AUT', name: 'Austria', flag: '🇦🇹', primary: '#ED2939', secondary: '#FFFFFF' },
  { code: 'BEL', name: 'Belgium', flag: '🇧🇪', primary: '#C8102E', secondary: '#1A1A1A' },
  { code: 'BIH', name: 'Bosnia & Herzegovina', flag: '🇧🇦', primary: '#002395', secondary: '#FFD100' },
  { code: 'CAN', name: 'Canada', flag: '🇨🇦', primary: '#D52B1E', secondary: '#FFFFFF' },
  { code: 'CPV', name: 'Cape Verde', flag: '🇨🇻', primary: '#003893', secondary: '#FFFFFF' },
  { code: 'COL', name: 'Colombia', flag: '🇨🇴', primary: '#FCD116', secondary: '#003087' },
  { code: 'CRO', name: 'Croatia', flag: '🇭🇷', primary: '#D10000', secondary: '#FFFFFF' },
  { code: 'CUW', name: 'Curaçao', flag: '🇨🇼', primary: '#0038A8', secondary: '#FFFFFF' },
  { code: 'CZE', name: 'Czechia', flag: '🇨🇿', primary: '#D7141A', secondary: '#11457E' },
  { code: 'COD', name: 'DR Congo', flag: '🇨🇩', primary: '#007FFF', secondary: '#CE1021' },
  { code: 'ECU', name: 'Ecuador', flag: '🇪🇨', primary: '#FFD100', secondary: '#003893' },
  { code: 'EGY', name: 'Egypt', flag: '🇪🇬', primary: '#CE1126', secondary: '#FFFFFF' },
  { code: 'GHA', name: 'Ghana', flag: '🇬🇭', primary: '#F4F4F4', secondary: '#CE1126' },
  { code: 'HAI', name: 'Haiti', flag: '🇭🇹', primary: '#00209F', secondary: '#D21034' },
  { code: 'IRN', name: 'Iran', flag: '🇮🇷', primary: '#F4F4F4', secondary: '#DA0000' },
  { code: 'IRQ', name: 'Iraq', flag: '🇮🇶', primary: '#007A3D', secondary: '#FFFFFF' },
  { code: 'CIV', name: 'Ivory Coast', flag: '🇨🇮', primary: '#FF8200', secondary: '#009A44' },
  { code: 'JPN', name: 'Japan', flag: '🇯🇵', primary: '#000C7B', secondary: '#FFFFFF' },
  { code: 'JOR', name: 'Jordan', flag: '🇯🇴', primary: '#CE1126', secondary: '#1A1A1A' },
  { code: 'MEX', name: 'Mexico', flag: '🇲🇽', primary: '#006847', secondary: '#FFFFFF' },
  { code: 'MAR', name: 'Morocco', flag: '🇲🇦', primary: '#C1272D', secondary: '#006233' },
  { code: 'NZL', name: 'New Zealand', flag: '🇳🇿', primary: '#F4F4F4', secondary: '#1A1A1A' },
  { code: 'NOR', name: 'Norway', flag: '🇳🇴', primary: '#BA0C2F', secondary: '#00205B' },
  { code: 'PAN', name: 'Panama', flag: '🇵🇦', primary: '#D21034', secondary: '#005293' },
  { code: 'PAR', name: 'Paraguay', flag: '🇵🇾', primary: '#D52B1E', secondary: '#0038A8' },
  { code: 'QAT', name: 'Qatar', flag: '🇶🇦', primary: '#8A1538', secondary: '#FFFFFF' },
  { code: 'KSA', name: 'Saudi Arabia', flag: '🇸🇦', primary: '#006C35', secondary: '#FFFFFF' },
  { code: 'SCO', name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', primary: '#0A2342', secondary: '#FFFFFF' },
  { code: 'SEN', name: 'Senegal', flag: '🇸🇳', primary: '#F4F4F4', secondary: '#00853F' },
  { code: 'RSA', name: 'South Africa', flag: '🇿🇦', primary: '#007A4D', secondary: '#FFB81C' },
  { code: 'KOR', name: 'South Korea', flag: '🇰🇷', primary: '#CD2E3A', secondary: '#0A2342' },
  { code: 'SWE', name: 'Sweden', flag: '🇸🇪', primary: '#FECB00', secondary: '#006AA7' },
  { code: 'SUI', name: 'Switzerland', flag: '🇨🇭', primary: '#D52B1E', secondary: '#FFFFFF' },
  { code: 'TUN', name: 'Tunisia', flag: '🇹🇳', primary: '#E70013', secondary: '#FFFFFF' },
  { code: 'TUR', name: 'Turkey', flag: '🇹🇷', primary: '#E30A17', secondary: '#FFFFFF' },
  { code: 'USA', name: 'United States', flag: '🇺🇸', primary: '#F4F4F4', secondary: '#0A2342' },
  { code: 'URU', name: 'Uruguay', flag: '🇺🇾', primary: '#5CBFEB', secondary: '#0A2342' },
  { code: 'UZB', name: 'Uzbekistan', flag: '🇺🇿', primary: '#0099B5', secondary: '#FFFFFF' },
];

export const FEATURED_TEAMS = TEAMS.filter((t) => t.featured);

/** Look up a team by its FIFA code. Returns null when not found. */
export function getTeamByCode(code) {
  return TEAMS.find((t) => t.code === code) || null;
}

/**
 * Pick a legible jersey-number colour for a given jersey colour, using the
 * relative luminance of the hex value: dark text on light shirts, light text
 * on dark shirts.
 */
export function numberColourFor(hex) {
  const { r, g, b } = hexToRgb(hex);
  // Perceived luminance (sRGB weights), 0..1.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1A1A1A' : '#FFFFFF';
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const int = parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}
