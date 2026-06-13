const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const MM_TO_PX = 3.7795275591; // CSS px at 96 DPI
  const A5_WIDTH_MM = 148;
  const A5_HEIGHT_MM = 210;
  const VIEWPORT_WIDTH = Math.round(A5_WIDTH_MM * MM_TO_PX);
  const VIEWPORT_HEIGHT = Math.round(A5_HEIGHT_MM * MM_TO_PX);

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Set viewport to match A5 page size
  await page.setViewport({
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor: 2,
  });

  const filePath = 'file://' + path.resolve(__dirname, 'WINTER/blenNbubbles_winter_static.html');
  await page.goto(filePath, { waitUntil: 'networkidle2', timeout: 60000 });

  // Wait briefly to allow media to settle
  await new Promise((r) => setTimeout(r, 3000));

  // Scale the leaflet to fit within A5 without clipping and center it
  await page.evaluate((vw, vh) => {
    const leaflet = document.querySelector('.leaflet');
    if (!leaflet) return;
    // Remove outer body padding to avoid extra margins
    document.body.style.padding = '0';
    document.body.style.margin = '0';

    const rect = leaflet.getBoundingClientRect();
    const scaleW = vw / rect.width;
    const scaleH = vh / rect.height;
    const scale = Math.min(scaleW, scaleH);

    // Wrap leaflet in a container for centering
    let wrapper = document.getElementById('pdf-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'pdf-wrapper';
      document.body.innerHTML = '';
      document.body.appendChild(wrapper);
    }
    wrapper.style.width = vw + 'px';
    wrapper.style.height = vh + 'px';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.background = getComputedStyle(document.body).backgroundColor;

    // Apply scaling
    leaflet.style.transformOrigin = 'top left';
    leaflet.style.transform = `scale(${scale})`;

    // Ensure no outer shadows are cut off visually (optional)
    leaflet.style.margin = '0';

    // Place inside wrapper
    wrapper.appendChild(leaflet);
  }, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  // Generate A5 PDF
  await page.pdf({
    path: 'winter_leaflet_A5.pdf',
    format: 'A5',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    pageRanges: '1',
  });

  console.log('PDF generated: winter_leaflet_A5.pdf');
  await browser.close();
})();
