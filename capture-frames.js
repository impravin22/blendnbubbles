const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set a reasonable viewport
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });

  const filePath = 'file://' + path.resolve(__dirname, 'WINTER/blenNbubbles_winter_static.html');
  console.log(`Loading ${filePath}...`);
  await page.goto(filePath, { waitUntil: 'networkidle2' });

  // Wait for videos to play/load
  console.log('Waiting for videos to render...');
  await new Promise(r => setTimeout(r, 5000));

  // Define the elements to capture and their output filenames
  const captures = [
    { selector: '#vc1', filename: 'WINTER/winter_leaflet_hot_chocolate.jpg' },
    { selector: '#vc2', filename: 'WINTER/winter_leaflet_cafe_mocha.jpg' },
    { selector: '#vc3', filename: 'WINTER/winter_leaflet_milk_tea.jpg' }
  ];

  for (const cap of captures) {
    const element = await page.$(cap.selector);
    if (element) {
      const outputPath = path.resolve(__dirname, cap.filename);
      await element.screenshot({ path: outputPath, type: 'jpeg', quality: 90 });
      console.log(`Captured ${cap.selector} to ${cap.filename}`);
    } else {
      console.error(`Element ${cap.selector} not found!`);
    }
  }

  await browser.close();
})();
