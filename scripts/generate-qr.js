/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'public', 'qr');
const TARGET_URL = 'https://blendnbubbles.com/DurgaPuja2025';

// Brand-aligned colors from src/index.css
const COLOR_DARK = '#003333'; // primary
const COLOR_LIGHT = '#F9F6F0'; // background

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function generate() {
  await ensureDir(OUTPUT_DIR);

  const options = {
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: COLOR_DARK,
      light: COLOR_LIGHT
    },
    width: 800
  };

  const pngPath = path.join(OUTPUT_DIR, 'durga-puja-2025.png');
  const svgPath = path.join(OUTPUT_DIR, 'durga-puja-2025.svg');

  await QRCode.toFile(pngPath, TARGET_URL, options);
  await QRCode.toFile(svgPath, TARGET_URL, { ...options, type: 'svg' });

  console.log('QRs created at:', pngPath, 'and', svgPath);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});


