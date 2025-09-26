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
const COLOR_GOLD = '#BB8750'; // secondary

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

  // Common base to composite on
  const base = sharp(pngPath);
  const { width, height } = await base.metadata();

  async function createOverlayed(overlaySourcePath, suffix) {
    const qrBase = sharp(pngPath);
    const minDim = Math.min(width, height);
    const boxSize = Math.round(minDim * 0.28); // badge size
    const cornerRadius = Math.round(boxSize * 0.22);
    const padding = Math.round(boxSize * 0.14); // inner padding

    // Badge background with gold border
    const badgeSvg = Buffer.from(
      `<svg width="${boxSize}" height="${boxSize}" xmlns="http://www.w3.org/2000/svg">
         <rect x="0.5" y="0.5" width="${boxSize - 1}" height="${boxSize - 1}"
               rx="${cornerRadius}" ry="${cornerRadius}"
               fill="${COLOR_LIGHT}" stroke="${COLOR_GOLD}" stroke-width="2"/>
       </svg>`
    );

    // Prepare logo (supports SVG or PNG)
    let logoSharp = sharp(overlaySourcePath);
    // Convert to PNG buffer at target size
    const logoSize = boxSize - padding * 2;
    const logoPngBuffer = await logoSharp
      .resize(logoSize, logoSize, { fit: 'contain', withoutEnlargement: false })
      .png()
      .toBuffer();

    // Compose logo onto badge background
    const badgeWithLogo = await sharp(badgeSvg)
      .composite([
        {
          input: logoPngBuffer,
          top: padding,
          left: padding
        }
      ])
      .png()
      .toBuffer();

    // Center composite on QR
    const outPath = path.join(OUTPUT_DIR, `durga-puja-2025-with-${suffix}.png`);
    await qrBase
      .composite([
        {
          input: badgeWithLogo,
          top: Math.round((height - boxSize) / 2),
          left: Math.round((width - boxSize) / 2)
        }
      ])
      .png()
      .toFile(outPath);
    return outPath;
  }

  const svgLogoPath = path.resolve(__dirname, '..', 'logo.svg');
  const cupPngPath = path.resolve(__dirname, '..', 'logo for cup 2.png');
  const outSvg = await createOverlayed(svgLogoPath, 'logo-svg');
  const outCup = await createOverlayed(cupPngPath, 'logo-cup');

  console.log('QRs created at:', pngPath, 'and', svgPath, 'and', outSvg, 'and', outCup);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});


