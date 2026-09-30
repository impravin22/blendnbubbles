#!/usr/bin/env node
// Publishes one static copy of the app shell per partner, at
// build/p/<slug>/index.html, so GitHub Pages answers each printed partner QR
// with a real 200 page (the same reason postbuild copies /menu, /offers...).
// Partners come from src/partnerOffers.json, the file the pages render from,
// so a new partner cannot ship without its URL. Run after `react-scripts build`.

const fs = require('fs');
const path = require('path');

const partners = require('../src/partnerOffers.json');

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const buildDir = path.join(__dirname, '..', 'build');
const shell = path.join(buildDir, 'index.html');

if (!fs.existsSync(shell)) {
  console.error(`partner-pages: ${shell} not found; run the build first.`);
  process.exit(1);
}

for (const { slug } of partners) {
  // Slugs become folder names; refuse anything that could escape build/p.
  if (!SLUG_PATTERN.test(slug)) {
    console.error(`partner-pages: refusing unsafe slug ${JSON.stringify(slug)}`);
    process.exit(1);
  }
  const dir = path.join(buildDir, 'p', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(shell, path.join(dir, 'index.html'));
}

console.log(`partner-pages: published ${partners.length} partner pages`);
