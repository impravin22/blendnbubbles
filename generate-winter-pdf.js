const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    console.log('Starting PDF generation...');
    
    // Launch with security features disabled to allow local video access on canvas
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--allow-file-access-from-files',
            '--disable-web-security'
        ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport to A5 dimensions (approx)
    // A5 is 148mm x 210mm. At 96 DPI: ~560px x ~794px.
    // We set a slightly larger viewport to ensure responsive layouts trigger correctly if needed, but scale down for PDF
    await page.setViewport({
        width: 595, 
        height: 842,
        deviceScaleFactor: 2
    });
    
    const htmlPath = 'file://' + path.resolve(__dirname, 'WINTER/blenNbubbles_winter_static.html');
    console.log('Loading page:', htmlPath);
    
    await page.goto(htmlPath, {
        waitUntil: 'networkidle0',
        timeout: 60000
    });
    
    console.log('Page loaded. Processing videos...');
    
    // 1. Force videos to load and seek to end
    // 2. Capture video frames to images (so they print correctly)
    // 3. Swap <video> tags with <img> tags containing the frame
    await page.evaluate(async () => {
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const videos = Array.from(document.querySelectorAll('video'));
        
        if (videos.length === 0) return;

        console.log(`Found ${videos.length} videos. Loading...`);

        // Helper to load a single video
        const prepareVideo = async (video) => {
            // Force display so it can render
            video.style.display = 'block';
            video.muted = true;
            video.autoplay = false; // We control playback
            
            // Wait for metadata if needed
            if (video.readyState < 1) {
                await new Promise(resolve => {
                    video.addEventListener('loadedmetadata', resolve, { once: true });
                    // Timeout fallback
                    setTimeout(resolve, 5000); 
                });
            }

            // Seek to near end
            const targetTime = Math.max(0, video.duration - 0.1);
            video.currentTime = targetTime;
            
            // Wait for seek
            await new Promise(resolve => {
                const onSeeked = () => {
                    video.removeEventListener('seeked', onSeeked);
                    resolve();
                };
                video.addEventListener('seeked', onSeeked);
                // Also check if already there
                if (Math.abs(video.currentTime - targetTime) < 0.1) resolve();
                // Timeout fallback
                setTimeout(resolve, 2000);
            });
            
            // Brief play/pause to ensure frame is rendered in buffer (sometimes needed)
            try {
                await video.play();
                video.pause();
                video.currentTime = targetTime;
            } catch (e) {
                console.warn('Play/pause toggle failed', e);
            }
        };

        // Prepare all videos in parallel
        await Promise.all(videos.map(prepareVideo));
        
        // Wait a moment for rendering
        await sleep(1000);

        console.log('Converting videos to images...');

        // Convert to images
        for (const video of videos) {
            const width = video.videoWidth || video.clientWidth;
            const height = video.videoHeight || video.clientHeight;
            
            if (width === 0 || height === 0) continue;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            // Set 'crossOrigin' to anonymous if needed, though for local files this is tricky. 
            // The browser args --allow-file-access-from-files should handle this.
            
            ctx.drawImage(video, 0, 0, width, height);
            
            try {
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                const img = document.createElement('img');
                img.src = dataUrl;
                
                // Copy attributes to preserve styling (classes, id, inline styles)
                img.className = video.className;
                img.id = video.id;
                img.style.cssText = video.style.cssText;
                
                img.classList.add('video-frame-capture');
                
                video.parentNode.insertBefore(img, video);
                video.remove();
            } catch (err) {
                console.error('Canvas export failed:', err);
            }
        }
    });

    // Inject CSS to fix printing
    // 1. Hide the print fallback images (since we now have captured frames)
    // 2. Ensure our captured images are visible
    // 3. Ensure background colors print
    await page.addStyleTag({
        content: `
            @media print {
                /* Hide the fallback images that normally show up in print */
                .print-fallback { display: none !important; }
                
                /* Ensure our captured images are visible */
                .video-frame-capture, img.video-top, img.video-bottom { 
                    display: block !important; 
                    object-fit: cover !important;
                }
                
                /* Ensure styling matches */
                .video-top { flex: 45 !important; object-position: center -10% !important; transform: scale(1.15) !important; }
                .video-bottom { flex: 55 !important; object-position: center 40% !important; transform: scale(1.2) !important; }
                
                body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            }
        `
    });

    console.log('Generating PDF...');
    
    await page.pdf({
        path: 'WINTER/blend_n_bubbles_winter_menu_A5.pdf',
        format: 'A5',
        printBackground: true,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' } // Full bleed
    });
    
    console.log('PDF generated: WINTER/blend_n_bubbles_winter_menu_A5.pdf');
    
    await browser.close();
})();
