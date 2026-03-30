import { TrendSourceAdapter, NormalizedTrendItem } from './base';

export class BingAdapter implements TrendSourceAdapter {
    readonly sourceName = 'bing' as const;

    async fetchTrends(env?: any): Promise<NormalizedTrendItem[]> {
        const results: NormalizedTrendItem[] = [];
        
        // 1. Fetch Trending Search Suggestions
        try {
            const asUrl = 'https://www.bing.com/AS/Suggestions?pt=page.home&qry=&csr=1&pths=1&zis=1&pf=1';
            const res = await fetch(asUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(5000)
            });
            
            if (res.ok) {
                const data: any = await res.json().catch(() => null);
                if (data) {
                    const terms: string[] = (data?.ig?.s || [])
                        .map((s: any) => s.q)
                        .filter((q: any) => typeof q === 'string');
                    
                    terms.forEach((term, index) => {
                        if (term && term.length < 50 && !term.toLowerCase().includes('search ') && !term.toLowerCase().includes('bing ')) {
                            results.push({
                                id: `bing_${term.toLowerCase().replace(/\s+/g, '_')}`,
                                canonical_topic: term,
                                display_name: term,
                                source: 'bing',
                                score: 150 - (index * 2),
                                primary_url: `https://www.bing.com/search?q=${encodeURIComponent(term)}`,
                                last_seen_at: new Date().toISOString()
                            });
                        }
                    });
                }
            }
        } catch (e) {
            console.error('[BingAdapter] Suggestions failed:', e);
        }

        // 2. Fetch Homepage Carousel
        try {
            const carouselUrl = 'https://www.bing.com/hp/api/v1/carousel?format=json';
            const carouselRes = await fetch(carouselUrl, { signal: AbortSignal.timeout(5000) });
            if (carouselRes.ok) {
                const carouselData: any = await carouselRes.json().catch(() => null);
                const carouselItems = carouselData?.items || [];
                carouselItems.forEach((item: any, i: number) => {
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
            console.error('[BingAdapter] Carousel failed:', e);
        }

        return results;
    }
}
