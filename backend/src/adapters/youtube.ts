import { TrendSourceAdapter, NormalizedTrendItem } from './base';

export class YouTubeAdapter implements TrendSourceAdapter {
    readonly sourceName = 'youtube' as const;

    async fetchTrends(env?: any): Promise<NormalizedTrendItem[]> {
        const apiKey = env?.YOUTUBE_API_KEY;
        if (!apiKey) {
            console.warn('[YouTubeAdapter] Missing YOUTUBE_API_KEY secret. Skipping.');
            return [];
        }

        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&maxResults=15&key=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`YouTube API failed: ${response.statusText}`);
        }

        const data: any = await response.json();
        const videos = data.items || [];

        return videos.map((video: any, index: number) => {
            const views = parseInt(video.statistics?.viewCount) || 0;

            let baseScore = 30;
            if (views >= 10000000) baseScore = 100;
            else if (views >= 5000000) baseScore = 90;
            else if (views >= 1000000) baseScore = 80;
            else if (views >= 500000) baseScore = 70;
            else if (views >= 100000) baseScore = 60;
            else baseScore = 50;

            const score = baseScore + ((15 - index) * 0.1);

            return {
                id: `trend_yt_${video.id}`,
                display_name: video.snippet.title,
                canonical_topic: video.snippet.title,
                source: 'youtube',
                rank: index + 1,
                score: score,
                primary_url: `https://www.youtube.com/watch?v=${video.id}`,
                secondary_url: `https://www.google.com/search?q=${encodeURIComponent(video.snippet.channelTitle)}`,
                metadata: {
                    views,
                    channel: video.snippet.channelTitle,
                    thumbnail: video.snippet.thumbnails?.default?.url
                },
                description: video.snippet.description ? video.snippet.description.substring(0, 200) : `Trending video by ${video.snippet.channelTitle}`
            };
        });
    }
}
