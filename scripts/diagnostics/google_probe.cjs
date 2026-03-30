/**
 * Google Trends RSS Diagnostic Probe
 */

async function testGoogleTrendsAPI() {
    console.log('--- Google Trends RSS Direct Diagnostic Probe ---');
    const url = 'https://trends.google.com/trending/rss?geo=US';

    console.log(`Fetching: ${url}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const xml = await response.text();

        // Check for basic structure
        const hasChannel = xml.includes('<channel>');
        const itemCount = (xml.match(/<item>/g) || []).length;

        console.log(`[PASS] Received XML payload.`);
        console.log(` - Has channel: ${hasChannel}`);
        console.log(` - Item count: ${itemCount}`);

        if (itemCount > 0) {
            const firstItemMatch = xml.match(/<item>([\s\S]*?)<\/item>/);
            if (firstItemMatch) {
                const content = firstItemMatch[1];
                const title = content.match(/<title>(.*?)<\/title>/)?.[1];
                const traffic = content.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/)?.[1];
                console.log('Sample Data Structure:');
                console.log(` - Title: ${title}`);
                console.log(` - Approx Traffic: ${traffic}`);
            }
        }
    } catch (error) {
        console.error(`[FAIL] Probe failed: ${error.message}`);
    }
    console.log('--- Probe Complete ---');
}

testGoogleTrendsAPI();
