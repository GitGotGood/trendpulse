/**
 * Canonical processed trend item
 */
export interface TrendItem {
    id: string;
    canonical_topic: string;
    display_name: string;
    source: 'wikipedia' | 'google' | 'reddit' | 'youtube' | 'bing';
    source_item_id: string | null;
    rank: number;
    score: number;
    first_seen_at: string; // ISO timestamp
    last_seen_at: string;  // ISO timestamp
    is_new: boolean;
    primary_url: string;
    secondary_url?: string | null;
    fallback_url?: string | null;
    metadata: {
        wiki_article_title?: string | null;
        google_query?: string | null;
        entities?: string;
        threads?: { title: string; url: string; source: string }[];
        [key: string]: any;
    };
    category: string;
    description?: string;
}

/**
 * Backend response for the latest trends
 */
export interface TrendsResponse {
    generated_at: string;
    region: string;
    trends: TrendItem[];
}

/**
 * Notification candidates response
 */
export interface NotificationResponse {
    generated_at: string;
    candidates: Pick<TrendItem, 'id' | 'display_name' | 'source' | 'primary_url'>[];
}
