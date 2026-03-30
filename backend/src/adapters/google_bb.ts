import { TrendSourceAdapter, NormalizedTrendItem } from './base';

export class GoogleBlockbusterAdapter implements TrendSourceAdapter {
    readonly sourceName = 'google' as const;

    async fetchTrends(env?: any): Promise<NormalizedTrendItem[]> {
        const results: NormalizedTrendItem[] = [];
        
        try {
            // This is the Chrome Autocomplete endpoint. When q is empty, it returns current global trending searches.
            // It is generally more open than the main Trends RSS/HTML pages.
            const url = 'https://www.google.com/complete/search?client=chrome&q=';
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                },
                signal: AbortSignal.timeout(5000)
            });

            if (res.ok) {
                const data: any = await res.json().catch(() => null);
                // JSON structure: ["", ["trend1", "trend2", ...], ["desc1", "desc2", ...], ...]
                if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
                    data[1].forEach((term: string, index: number) => {
                        if (term && term.length < 60) {
                            results.push({
                                id: `google_bb_${term.toLowerCase().replace(/\s+/g, '_')}`,
                                canonical_topic: term,
                                display_name: term,
                                source: 'google',
                                score: 140 - (index * 2), // High Priority
                                primary_url: `https://www.google.com/search?q=${encodeURIComponent(term)}`,
                                last_seen_at: new Date().toISOString()
                            });
                        }
                    });
                }
            }
        } catch (e) {
            console.error('[GoogleBlockbusterAdapter] Failed:', e);
        }

        return results;
    }
}
