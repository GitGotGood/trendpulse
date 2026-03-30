import { TrendItem } from '../../../shared/trends';

/**
 * Interface for the SQLite database (D1)
 */
export interface Database {
    prepare: (query: string) => {
        bind: (...args: any[]) => {
            all: <T = any>() => Promise<{ results: T[] }>;
            run: () => Promise<any>;
            first: <T = any>() => Promise<T | null>;
        };
        all: <T = any>() => Promise<{ results: T[] }>;
    };
}

/**
 * Interface that all trend source adapters must implement.
 */
export interface TrendSourceAdapter {
    readonly sourceName: 'wikipedia' | 'google' | 'reddit' | 'youtube' | 'bing';

    /**
     * Fetch raw data from the source and normalize it into TrendItems.
     */
    fetchTrends(env?: any): Promise<NormalizedTrendItem[]>;
}

/**
 * Base metadata extracted from raw results before ranking/deduplication.
 */
export interface NormalizedTrendItem extends Partial<TrendItem> {
    id: string;
    display_name: string;
    canonical_topic: string;
    source: 'wikipedia' | 'google' | 'reddit' | 'youtube' | 'bing';
    primary_url: string;
}
