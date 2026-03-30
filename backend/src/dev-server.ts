import express from 'express';
import cors from 'cors';
import SQLite from 'better-sqlite3';
import { TrendService, Database } from './services';
import { WikipediaAdapter } from './adapters/wikipedia';
import { GoogleAdapter } from './adapters/google';
import fs from 'fs';
import path from 'path';

const app = express();
const port = 8787;

// Polyfill D1-like interface for better-sqlite3
const dbPath = path.join(__dirname, '../local_db.sqlite');
const sqlite = new SQLite(dbPath);

// Initialize schema if needed
const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
sqlite.exec(schema);

const dbAdapter: Database = {
    prepare: (query: string) => {
        const stmt = sqlite.prepare(query);
        const binder = (...args: any[]) => ({
            all: async () => ({ results: stmt.all(...args) }),
            run: async () => { stmt.run(...args); },
            first: async () => stmt.get(...args)
        });
        return {
            bind: binder,
            all: async () => ({ results: stmt.all() })
        };
    }
};

const trendService = new TrendService(dbAdapter);

app.use(cors());
app.use(express.json());

// API Routes
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), platform: 'node-dev-server' });
});

app.get('/api/trends/latest', async (req, res) => {
    try {
        const data = await trendService.getLatestTrends();
        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Manual Trigger for Polling (since we don't have cron in dev-server yet)
app.post('/api/debug/poll', async (req, res) => {
    console.log('Manual poll triggered...');
    const wikiAdapter = new WikipediaAdapter();
    const googleAdapter = new GoogleAdapter();

    const poll = async (adapter: any) => {
        const trends = await adapter.fetchTrends();
        await trendService.upsertTrends(trends);
        return trends.length;
    };

    try {
        const results = await Promise.all([poll(wikiAdapter), poll(googleAdapter)]);
        res.json({ success: true, counts: results });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`TrendPulse Dev Backend running at http://localhost:${port}`);
    console.log(`Database: ${dbPath}`);
});
