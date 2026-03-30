import { TrendSourceAdapter } from './base';

export class AdapterRegistry {
    private adapters: Map<string, TrendSourceAdapter> = new Map();

    register(adapter: TrendSourceAdapter) {
        this.adapters.set(adapter.sourceName, adapter);
    }

    getAdapters(): TrendSourceAdapter[] {
        return Array.from(this.adapters.values());
    }
}
