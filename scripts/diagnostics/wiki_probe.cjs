/**
 * Wikipedia Diagnostic Probe (Robust Version)
 * This script tests the Wikipedia Featured Feed API directly.
 */

async function testWikipediaAPI() {
    console.log('--- Wikipedia API Direct Diagnostic Probe ---');
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');
    const url = `https://en.wikipedia.org/api/rest_v1/feed/featured/${today}`;

    console.log(`Fetching: ${url}`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const mostRead = data.mostread?.articles || [];

        console.log(`[PASS] Received ${mostRead.length} most-read articles.`);

        if (mostRead.length > 0) {
            const first = mostRead[0];
            console.log('Sample Data Structure:');
            console.log(` - Title: ${first.titles?.normalized || first.title}`);
            console.log(` - Views: ${first.views}`);
            console.log(` - Desktop URL: ${first.content_urls?.desktop?.page}`);
        }
    } catch (error) {
        console.error(`[FAIL] Probe failed: ${error.message}`);
    }
    console.log('--- Probe Complete ---');
}

testWikipediaAPI();
