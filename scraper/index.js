const Parser = require('rss-parser');
const https = require('https');

const INJECT_URL = process.env.TRENDPULSE_INJECT_URL || 'https://trendpulse-backend.danthedub.workers.dev/api/pulse/inject';
const API_SECRET = process.env.TRENDPULSE_API_SECRET || 'local-dev-secret';

async function fetchGoogleTrends() {
    const results = [];
    console.log('[Scraper] Fetching Google Trends via RSS...');
    
    try {
        const parser = new Parser({
            customFields: { item: ['ht:approx_traffic'] }
        });
        
        // This is extremely reliable from GitHub server IPs (unlike Cloudflare IPs)
        const feed = await parser.parseURL('https://trends.google.com/trending/rss?geo=US');
        
        feed.items.forEach((item, index) => {
            const title = item.title?.replace('<![CDATA[', '')?.replace(']]>', '') || '';
            const traffic = item['ht:approx_traffic'] || '';
            
            let baseScore = 90;
            if (traffic.includes('5M')) baseScore = 150;
            else if (traffic.includes('2M')) baseScore = 140;
            else if (traffic.includes('1M')) baseScore = 130;
            else if (traffic.includes('500K')) baseScore = 110;
            else if (traffic.includes('200K')) baseScore = 100;

            if (title) {
                results.push({
                    id: `google_${title.toLowerCase().replace(/\s+/g, '_')}`,
                    display_name: title,
                    canonical_topic: title,
                    source: 'google',
                    score: baseScore + (20 - index) * 0.1,
                    primary_url: `https://www.google.com/search?q=${encodeURIComponent(title)}`,
                    last_seen_at: new Date().toISOString(),
                    metadata: { traffic, rank: index + 1 }
                });
            }
        });
    } catch (e) {
        console.error('[Scraper] Google fetch failed:', e.message);
    }
    return results;
}

async function fetchBingTrends() {
    const results = [];
    console.log('[Scraper] Fetching Bing Homepage Trends...');
    
    try {
        const carouselRes = await fetch('https://www.bing.com/hp/api/v1/carousel?format=json', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        
        if (carouselRes.ok) {
            const carouselData = await carouselRes.json();
            const trendingBlock = carouselData?.data?.find(d => d.typeName === 'TrendingNow');
            const items = trendingBlock?.items || [];
            
            items.forEach((item, i) => {
                const title = item.title;
                if (title) {
                    results.push({
                        id: `bing_news_${title.toLowerCase().replace(/\s+/g, '_')}`,
                        canonical_topic: title,
                        display_name: title,
                        source: 'bing',
                        score: 130 - (i * 2),
                        primary_url: item.url || `https://www.bing.com/news/search?q=${encodeURIComponent(title)}`,
                        last_seen_at: new Date().toISOString()
                    });
                }
            });
        }
    } catch (e) {
        console.error('[Scraper] Bing fetch failed:', e.message);
    }
    return results;
}

async function run() {
    try {
        const allTrends = [];
        
        const googleTrends = await fetchGoogleTrends();
        console.log(`[Scraper] Gathered ${googleTrends.length} Google Trends.`);
        allTrends.push(...googleTrends);

        const bingTrends = await fetchBingTrends();
        console.log(`[Scraper] Gathered ${bingTrends.length} Bing Trends.`);
        allTrends.push(...bingTrends);

        if (allTrends.length > 0) {
            console.log(`[Scraper] Successfully gathered ${allTrends.length} total trends. Injecting to Cloudflare Worker (${INJECT_URL})...`);
            
            const payload = JSON.stringify({
                secret: API_SECRET,
                trends: allTrends
            });

            const parsedUrl = new URL(INJECT_URL);
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            };

            const req = https.request(options, (res) => {
                let responseBody = '';
                res.on('data', chunk => responseBody += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        console.log('✅ Injection Successful:', responseBody);
                    } else {
                        console.error(`❌ Injection Failed (${res.statusCode}):`, responseBody);
                    }
                });
            });

            req.on('error', (e) => {
                console.error('❌ Request error:', e.message);
            });

            req.write(payload);
            req.end();
            
        } else {
            console.warn('⚠️ No trends gathered. Exiting without injection.');
        }

    } catch (err) {
        console.error('❌ Scraper failed:', err);
    }
}

run();
