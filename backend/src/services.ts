import { TrendsResponse, TrendItem } from '../../shared/trends';

export interface Database {
    prepare(query: string): {
        bind(...args: any[]): {
            all<T = any>(): Promise<{ results: T[] }>;
            run(): Promise<void>;
            first<T = any>(): Promise<T | null>;
        };
        all<T = any>(): Promise<{ results: T[] }>;
    };
}

export class TrendService {
    constructor(private db: Database, private ai: any = null, private vectorize: any = null) { }

    /**
     * Get the latest ranked trends from the database.
     */
    async getLatestTrends(region: string = 'US'): Promise<TrendsResponse> {
        try {
            const { results } = await this.db.prepare(
                `SELECT * FROM trends 
                 ORDER BY score DESC, last_seen_at DESC 
                 LIMIT 100`
            ).all<any>();

            const trends: TrendItem[] = results.map(row => ({
                ...row,
                is_new: !!row.is_new,
                metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata || {}),
                history: typeof row.history === 'string' ? JSON.parse(row.history || '[]') : (row.history || []),
                category: row.category || 'general',
                description: row.description || ''
            }));

            const latestTime = results.reduce((max, row) => (row.last_seen_at && row.last_seen_at > max) ? row.last_seen_at : max, '');

            return {
                generated_at: latestTime || new Date().toISOString(),
                region,
                trends
            };
        } catch (e) {
            console.error('[TrendService] Error getting trends:', e);
            return { generated_at: new Date().toISOString(), region, trends: [] };
        }
    }

    /**
     * Upsert trends into the database with deduplication and intelligence.
     */
    async upsertTrends(items: Partial<TrendItem>[]) {
        const now = new Date().toISOString();

        for (const item of items) {
            try {
                const analysis = await this.analyzeTrend(item);
                if (analysis.isSpam) {
                    console.log(`[SPAM FILTER] Rejected anomalous trend: ${item.display_name}`);
                    continue;
                }

                // Apply AI Intelligence
                item.description = analysis.summary;
                item.metadata = item.metadata || {};
                item.metadata.entities = analysis.entities;
                
                let finalCanonicalTopic = analysis.canonicalTopic;
                const searchId = item.id || `trend_${finalCanonicalTopic.toLowerCase().replace(/\s+/g, '_')}`;
                
                let existing = await this.db.prepare(
                    'SELECT * FROM trends WHERE id = ? OR canonical_topic = ? OR LOWER(display_name) = ?'
                ).bind(searchId, finalCanonicalTopic, item.display_name?.toLowerCase() || '').first<any>();

                // Vector DB Resolve (Fuzzy)
                const existingMeta = existing ? (typeof existing.metadata === 'string' ? JSON.parse(existing.metadata || '{}') : existing.metadata) : {};
                const needsVectorScan = !existing || !existingMeta.related_trends;

                if (needsVectorScan && this.vectorize && this.ai) {
                    try {
                        const embedText = item.description ? `${finalCanonicalTopic}: ${item.description}` : finalCanonicalTopic;
                        const embeddingResp = await this.ai.run('@cf/baai/bge-large-en-v1.5', { text: [embedText] });
                        
                        if (embeddingResp?.data?.[0]) {
                            const vector = embeddingResp.data[0];
                            const queryResp = await this.vectorize.query(vector, { topK: 4, returnMetadata: 'all' });
                            
                            if (queryResp.matches && queryResp.matches.length > 0) {
                                const topMatch = queryResp.matches[0];
                                if (!existing && topMatch.score > 0.75) {
                                    const canonicalMatch = topMatch.metadata?.canonical_topic || topMatch.id;
                                    finalCanonicalTopic = canonicalMatch;
                                    existing = await this.db.prepare(
                                        'SELECT * FROM trends WHERE canonical_topic = ?'
                                    ).bind(finalCanonicalTopic).first<any>();
                                }
                            }
                        }
                    } catch (e) { console.error('[VECTOR QUERY ERROR]', e); }
                }

                if (existing) {
                    const history = typeof existing.history === 'string' ? JSON.parse(existing.history || '[]') : (existing.history || []);
                    const lastSnapshot = history[history.length - 1] || { score: item.score, rank: item.rank };
                    const scoreDelta = (item.score || 0) - (lastSnapshot.score || 0);
                    const rankDelta = (lastSnapshot.rank || 99) - (item.rank || 99);

                    let momentum = 'sustained';
                    if (item.is_new || (scoreDelta > 0.5 && rankDelta > 5)) momentum = 'exploding';
                    else if (scoreDelta < -0.2 && rankDelta < -3) momentum = 'peaked';

                    history.push({ t: now, score: item.score, rank: item.rank });
                    if (history.length > 24) history.shift();

                    await this.db.prepare(`
                        UPDATE trends SET
                            rank = ?, score = ?, last_seen_at = ?, is_new = 0,
                            momentum = ?, velocity = ?, history = ?, source = ?,
                            primary_url = ?, secondary_url = COALESCE(?, secondary_url),
                            metadata = ?, display_name = ?, category = ?, description = ?
                        WHERE id = ?
                    `).bind(
                        item.rank, item.score, now, momentum, scoreDelta,
                        JSON.stringify(history), item.source, item.primary_url,
                        item.secondary_url, JSON.stringify({ ...existingMeta, ...(item.metadata || {}) }),
                        item.display_name, this.determineCategory(item),
                        item.description || existing.description, existing.id
                    ).run();
                } else {
                    const canonicalId = item.id || searchId;
                    await this.db.prepare(`
                        INSERT OR REPLACE INTO trends (
                            id, canonical_topic, display_name, source, 
                            rank, score, primary_url, secondary_url, 
                            metadata, last_seen_at, first_seen_at, is_new, momentum, velocity, history, category, description
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'new', 0, ?, ?, ?)
                    `).bind(
                        canonicalId, finalCanonicalTopic, item.display_name, item.source,
                        item.rank, item.score, item.primary_url, item.secondary_url,
                        JSON.stringify(item.metadata || {}), now, now, JSON.stringify(history),
                        this.determineCategory(item), item.description || ''
                    ).run();
                }
            } catch (err) {
                console.error(`[TrendService] Failed to upsert trend "${item.display_name}":`, err);
            }
        }

        // Decay Query & Top 10 Snapshot Logging
        try {
            await this.db.prepare(`UPDATE trends SET score = score * 0.8 WHERE last_seen_at < ?`).bind(now).run();
            
            // Take the daily snapshot for history
            const { results: top10 } = await this.db.prepare(
                `SELECT id, canonical_topic, display_name, source, rank, score, primary_url, is_new, momentum
                 FROM trends ORDER BY score DESC, last_seen_at DESC LIMIT 10`
            ).all<any>();
            
            if (top10 && top10.length > 0) {
                const today = new Date().toISOString().split('T')[0];
                await this.db.prepare(
                    `INSERT OR REPLACE INTO daily_snapshots (date, top_10_json) VALUES (?, ?)`
                ).bind(today, JSON.stringify(top10)).run();
            }
        } catch (e) {
            console.error('[TrendService] Decay/Snapshot failed:', e);
        }
    }

    private async analyzeTrend(item: Partial<TrendItem>): Promise<{isSpam: boolean, canonicalTopic: string, entities: string, summary: string}> {
        const fallBackTopic = item.canonical_topic || item.display_name || '';
        if (!this.ai) return { isSpam: false, canonicalTopic: fallBackTopic, entities: fallBackTopic, summary: item.description || '' };

        try {
            const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(fallBackTopic)}+when:24h&hl=en-US&gl=US&ceid=US:en`);
            const newsText = res.ok ? await res.text() : '';
            const match = newsText.match(/<title>(.*?)<\/title>/g);
            const context = match ? match.slice(1, 3).join(' | ') : '';

            const system = `Output JSON: {"isSpam":bool,"canonicalTopic":"str","entities":"str","summary":"str"}`;
            const prompt = `Term: ${item.display_name}\nContext: ${context || item.description}`;

            const response = await this.ai.run('@cf/meta/llama-3-8b-instruct', { 
                messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] 
            });
            
            let answer = response?.response || '{}';
             if (answer.includes('```')) {
                const m = answer.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (m && m[1]) answer = m[1];
            }
            const parsed = JSON.parse(answer);
            return {
                isSpam: !!parsed.isSpam,
                canonicalTopic: parsed.canonicalTopic || fallBackTopic,
                entities: parsed.entities || fallBackTopic,
                summary: parsed.summary || item.description || ''
            };
        } catch (err) {
            return { isSpam: false, canonicalTopic: fallBackTopic, entities: fallBackTopic, summary: item.description || '' };
        }
    }

    private determineCategory(item: Partial<TrendItem>): string {
        const text = `${item.display_name} ${item.canonical_topic} ${item.description || ''}`.toLowerCase();
        const sports = ['football', 'nfl', 'nba', 'match', 'cup', 'cricket', 'soccer', 'tennis', 'hockey', 'olympics'];
        const ent = ['movie', 'series', 'film', 'trailer', 'netflix', 'hbo', 'show', 'tv'];
        const celebs = ['actor', 'star', 'musician', 'singer', 'rapper', 'wedding', 'divorce'];

        if (sports.some(k => text.includes(k))) return 'sports';
        if (ent.some(k => text.includes(k))) return 'entertainment';
        if (celebs.some(k => text.includes(k))) return 'celebrities';
        return 'general';
    }
}
