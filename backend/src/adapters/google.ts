import { TrendSourceAdapter, NormalizedTrendItem } from './base';

/**
 * Google Trends Adapter (Durable RSS)
 * Reverts to the stable RSS feed as the primary server-side provider.
 * Optimized for autonomous Cloudflare Worker execution.
 */
export class GoogleAdapter implements TrendSourceAdapter {
    readonly sourceName = 'google' as const;
    private rssUrl = 'https://trends.google.com/trending/rss?geo=US';

    async fetchTrends(): Promise<NormalizedTrendItem[]> {
        console.log('[GOOGLE] Fetching Trending RSS...');
        try {
            const res = await fetch(this.rssUrl, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8'
                },
                signal: AbortSignal.timeout(5000)
            });
            
            if (!res.ok) throw new Error(`Status: ${res.status}`);
            const text = await res.text();

            const items: NormalizedTrendItem[] = [];
            // Regex match for title and traffic
            const matches = text.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<ht:approx_traffic>(.*?)<\/ht:approx_traffic>[\s\S]*?<\/item>/g);
            
            let index = 0;
            for (const match of matches) {
                const title = match[1].replace('<![CDATA[', '').replace(']]>', '');
                const traffic = match[2];
                
                // Score mapping (consistent with Bing/Wiki gravity)
                let baseScore = 90;
                if (traffic.includes('5M')) baseScore = 150;
                else if (traffic.includes('2M')) baseScore = 140;
                else if (traffic.includes('1M')) baseScore = 130;
                else if (traffic.includes('500K')) baseScore = 110;
                else if (traffic.includes('200K')) baseScore = 100;

                items.push({
                    id: `google_${title.toLowerCase().replace(/\s+/g, '_')}`,
                    display_name: title,
                    canonical_topic: title,
                    source: 'google',
                    score: baseScore + (20 - index) * 0.1,
                    primary_url: `https://www.google.com/search?q=${encodeURIComponent(title)}`,
                    last_seen_at: new Date().toISOString(),
                    metadata: { traffic, rank: index + 1 }
                });
                index++;
            }
            
            console.log(`[GOOGLE] Successfully captured ${items.length} trends via RSS.`);
            return items;
        } catch (e) {
            console.error('[GOOGLE RSS FAILED]', e);
            return [];
        }
    }
}
