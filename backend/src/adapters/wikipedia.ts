import { TrendSourceAdapter, NormalizedTrendItem } from './base';

export class WikipediaAdapter implements TrendSourceAdapter {
    readonly sourceName = 'wikipedia' as const;
    private apiUrl = 'https://en.wikipedia.org/api/rest_v1/feed/featured';

    private async fetchForDate(date: Date): Promise<any | null> {
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '/');
        const url = `${this.apiUrl}/${dateStr}`;

        const response = await fetch(url, {
            headers: { 'User-Agent': 'TrendPulse/1.0 (contact: dan@example.com)' }
        });
        if (!response.ok) return null;

        const data: any = await response.json();
        return (data.mostread && data.mostread.articles) ? data : null;
    }

    async fetchTrends(env?: any): Promise<NormalizedTrendItem[]> {
        let data = await this.fetchForDate(new Date());

        if (!data) {
            console.warn('Wikipedia pulse missing for today, falling back to yesterday...');
            data = await this.fetchForDate(new Date(Date.now() - 86400000));
        }

        if (!data) {
            throw new Error(`Wikipedia API failed for both today and yesterday.`);
        }

        const mostRead = data.mostread.articles || [];

        const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '');

        return mostRead.slice(0, 15).map((article: any, index: number) => {
            const topicName = article.normalizedtitle || article.titles?.normalized || article.title;
            let displayName = article.titles?.display || article.displaytitle || topicName;
            displayName = stripHtml(displayName);

            const views = article.views || 0;
            let baseScore = 30;
            if (views >= 1000000) baseScore = 100;
            else if (views >= 500000) baseScore = 90;
            else if (views >= 250000) baseScore = 80;
            else if (views >= 100000) baseScore = 70;
            else if (views >= 50000) baseScore = 60;
            else baseScore = 50;

            // Tie-breaker based on daily rank
            const score = baseScore + ((50 - index) * 0.05);

            return {
                id: `trend_${topicName.replace(/\s+/g, '_')}`,
                display_name: displayName,
                canonical_topic: topicName,
                source: 'wikipedia',
                rank: index + 1,
                score: score,
                primary_url: article.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${article.titles?.canonical || topicName}`,
                secondary_url: `https://www.google.com/search?q=${encodeURIComponent(topicName)}&tbm=nws`,
                metadata: {
                    views: article.views,
                    thumbnail: article.thumbnail?.source
                },
                description: article.extract || article.description || ''
            };
        });
    }

}
