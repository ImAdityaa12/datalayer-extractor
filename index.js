const { JSDOM } = require('jsdom');
const vm = require('vm');

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const urls = [
    'https://distance-learning.northumbria.ac.uk/',
    'https://distance-learning.northumbria.ac.uk/online-courses/cmp/psychology-msc/',
    // Add more URLs here
];

async function extractDataLayerFromPage(url) {
    try {
        const response = await fetch(url);
        const html = await response.text();
        const dom = new JSDOM(html);
        const scripts = dom.window.document.querySelectorAll('script[type="rocketlazyloadscript"]');

        for (const script of scripts) {
            const content = script.textContent.trim();

            if (content.includes('dataLayer.push({')) {
                try {
                    const sandbox = { dataLayer: [] };
                    vm.createContext(sandbox); // Contextify

                    // Run the script safely
                    vm.runInContext(content, sandbox);

                    const lastPushed = sandbox.dataLayer.at(-1);
                    return { url, data: lastPushed };
                } catch (e) {
                    console.error(`❌ Failed to evaluate script at ${url}:`, e.message);
                }
            }
        }

        return { url, data: null };
    } catch (err) {
        console.error(`❌ Error fetching ${url}:`, err.message);
        return { url, data: null };
    }
}

(async () => {
    const results = [];

    for (const url of urls) {
        const result = await extractDataLayerFromPage(url);
        results.push(result);
    }

    console.log(JSON.stringify(results, null, 2));
})();
