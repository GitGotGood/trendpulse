import { TrendItem } from '../../../shared/trends';
import { TrendSourceAdapter } from './base';

/**
 * Yahoo Trends Adapter
 * Fetches real-time search suggestions/trending terms from Yahoo.
 * These are high-velocity "Search Queries" rather than "News Entities".
 */
export class YahooAdapter implements TrendSourceAdapter {
    readonly sourceName = 'yahoo' as const;
    private apiUrl = 'https://search.yahoo.com/sugg/trending?output=json&n=20&region=us';

    async fetchTrends(): Promise<Partial<TrendItem>[]> {
        const res = await fetch(this.apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (!res.ok) return [];

        const data: any = await res.json();
        const suggestions = data?.unfiltered?.suggestion || [];
        
        return suggestions.map((s: any, index: number) => {
            const title = s.value;
            
            // Yahoo provides a ranked list (n=20) but no raw volume data.
            // We use a Boosted Rank-to-Gravity mapping: Rank #1 = 135, Rank #20 = 105.
            const baseScore = 135 - (index * (30 / 19));
            
            return {
                display_name: title,
                canonical_topic: title,
                score: baseScore,
                primary_url: `https://search.yahoo.com/search?p=${encodeURIComponent(title)}`,
                secondary_url: `https://www.google.com/search?q=${encodeURIComponent(title)}&tbm=nws`,
                source: 'yahoo',
                last_seen_at: new Date().toISOString(),
                metadata: {
                    rank: index + 1
                }
            } as Partial<TrendItem>;
        });
    }
}
