const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.setViewport({width:1180, height:1500, deviceScaleFactor:1});
  await page.goto('http://localhost:8099/reports', {waitUntil:'networkidle2', timeout:30000});
  await new Promise(r=>setTimeout(r,600));
  // PIN gate
  await page.type('.rp-gate-input','boba2026',{delay:10});
  await page.click('.rp-gate-btn');
  await page.waitForSelector('.rp-grid',{timeout:15000});
  await new Promise(r=>setTimeout(r,900));
  await page.screenshot({path:'/tmp/reports_preview.png', fullPage:true});
  await browser.close();
  console.log('screenshot done');
})().catch(e=>{console.error('ERR',e.message); process.exit(1)});
