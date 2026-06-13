const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set viewport to leaflet size
  await page.setViewport({
    width: 420,
    height: 2000,
    deviceScaleFactor: 2
  });
  
  // Load the static HTML file
  const filePath = 'file://' + path.resolve(__dirname, 'build/winter_leaflet_static.html');
  await page.goto(filePath, { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Wait for videos to load and play
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  // Get the exact dimensions of the leaflet content (removing body padding)
  const dimensions = await page.evaluate(() => {
    const leaflet = document.querySelector('.leaflet');
    const rect = leaflet.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left
    };
  });
  
  // Generate PDF with exact content dimensions, no whitespace
  await page.pdf({
    path: 'winter_leaflet.pdf',
    width: `${dimensions.width}px`,
    height: `${dimensions.height}px`,
    printBackground: true,
    pageRanges: '1',
    margin: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    }
  });
  
  console.log('PDF generated: winter_leaflet.pdf');
  await browser.close();
})();
