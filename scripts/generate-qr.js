/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const sharp = require('sharp');

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

  // Overlay center logo onto PNG
  const logoPath = path.resolve(__dirname, '..', 'public', 'logo512.png');
  const base = sharp(pngPath);
  const { width, height } = await base.metadata();
  const overlaySize = Math.round(Math.min(width, height) * 0.22); // ~22% of QR size
  const roundedCorner = Buffer.from(
    `<svg><rect x="0" y="0" width="${overlaySize}" height="${overlaySize}" rx="${Math.round(overlaySize*0.2)}" ry="${Math.round(overlaySize*0.2)}" /></svg>`
  );
  const resizedLogo = await sharp(logoPath)
    .resize(overlaySize, overlaySize, { fit: 'cover' })
    .composite([{ input: roundedCorner, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const qrWithLogoPath = path.join(OUTPUT_DIR, 'durga-puja-2025-with-logo.png');
  await base
    .composite([
      {
        input: resizedLogo,
        top: Math.round((height - overlaySize) / 2),
        left: Math.round((width - overlaySize) / 2)
      }
    ])
    .png()
    .toFile(qrWithLogoPath);

  console.log('QRs created at:', pngPath, 'and', svgPath, 'and', qrWithLogoPath);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});


