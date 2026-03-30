import { TrendSourceAdapter, NormalizedTrendItem } from './base';

export class RedditAdapter implements TrendSourceAdapter {
    readonly sourceName = 'reddit' as const;
    private apiUrl = 'https://www.reddit.com/r/all/top.json?t=day&limit=15';

    async fetchTrends(env?: any): Promise<NormalizedTrendItem[]> {
        const response = await fetch(this.apiUrl, {
            headers: { 'User-Agent': 'web:trendpulse.danthedub:v1.0.0 (by /u/danthedub)' },
            signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) {
            throw new Error(`Reddit API failed: ${response.statusText}`);
        }

        const data: any = await response.json();
        const posts = data.data?.children || [];

        return posts.map((child: any, index: number) => {
            const post = child.data;
            const upvotes = post.score || 0;

            let baseScore = 30;
            if (upvotes >= 100000) baseScore = 100;
            else if (upvotes >= 75000) baseScore = 90;
            else if (upvotes >= 50000) baseScore = 80;
            else if (upvotes >= 25000) baseScore = 70;
            else if (upvotes >= 10000) baseScore = 60;
            else baseScore = 50;

            const score = baseScore + ((15 - index) * 0.1);

            return {
                id: `trend_reddit_${post.id}`,
                display_name: post.title.substring(0, 100),
                canonical_topic: post.title,
                source: 'reddit',
                rank: index + 1,
                score: score,
                primary_url: `https://www.reddit.com${post.permalink}`,
                secondary_url: `https://www.google.com/search?q=${encodeURIComponent(post.title)}`,
                metadata: {
                    upvotes,
                    subreddit: post.subreddit,
                    thumbnail: post.thumbnail?.startsWith('http') ? post.thumbnail : undefined
                },
                description: post.selftext ? post.selftext.substring(0, 200) : `Top post today in r/${post.subreddit}`
            };
        });
    }
}
