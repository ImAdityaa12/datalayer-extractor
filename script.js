const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const XLSX = require('xlsx');
puppeteer.use(StealthPlugin());

const urls = [
    'https://online.regiscollege.edu/',
    'https://online.regiscollege.edu/online-masters-degrees/',
    // Add more URLs here
];

const CONCURRENCY = 3;
const results = [];

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const extractDataLayerFromURL = async (url) => {
        const page = await browser.newPage();

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        );

        console.log(`🔗 Processing: ${url}`);

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

            const frames = page.frames();
            let found = null;

            for (const frame of frames) {
                try {
                    const dl = await frame.evaluate(async () => {
                        return new Promise((resolve) => {
                            const start = Date.now();
                            const poll = () => {
                                if (
                                    window.dataLayer &&
                                    window.dataLayer.length > 0
                                ) {
                                    resolve(window.dataLayer[0]);
                                } else if (Date.now() - start > 10000) {
                                    resolve(null);
                                } else {
                                    setTimeout(poll, 250);
                                }
                            };
                            poll();
                        });
                    });

                    if (dl) {
                        found = dl;
                        break;
                    }
                } catch (_) { }
            }

            if (found) {
                console.log(JSON.stringify(found, null, 2));
                results.push({ url, ...found });
            } else {
                console.log(`⚠️ No dataLayer[0] found`);
                results.push({ url, error: 'No dataLayer[0] found' });
            }
        } catch (err) {
            console.error(`❌ Error on ${url}:`, err.message);
            results.push({ url, error: err.message });
        }

        await page.close();
    };

    const parallelBatches = async () => {
        for (let i = 0; i < urls.length; i += CONCURRENCY) {
            const batch = urls.slice(i, i + CONCURRENCY);
            await Promise.all(batch.map(extractDataLayerFromURL));
        }
    };

    await parallelBatches();
    await browser.close();

    // Export to Excel
    const ws = XLSX.utils.json_to_sheet(results);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DataLayer');

    XLSX.writeFile(wb, 'output.xlsx');
    console.log(`✅ Excel exported to output.xlsx`);
})();
