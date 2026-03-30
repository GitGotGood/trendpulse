const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 8787;

// 1. Setup JSON Storage (The "No-Native-Bindings" way for ARM64)
const dbPath = path.join(__dirname, '../local_db.json');

const loadDB = () => {
    if (!fs.existsSync(dbPath)) return { trends: [] };
    try {
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    } catch (e) {
        return { trends: [] };
    }
};

const saveDB = (data) => {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
};

console.log(`[JSON DB] Persistent store at ${dbPath}`);

// 2. Trend Logic 
const upsertTrend = (item) => {
    const db = loadDB();
    const now = new Date().toISOString();
    const canonicalId = item.id || `trend_${item.canonical_topic.replace(/\s+/g, '_')}`;

    const existingIndex = db.trends.findIndex(t => t.canonical_topic === item.canonical_topic);

    if (existingIndex !== -1) {
        const existing = db.trends[existingIndex];

        // Intelligence: Calculate Velocity (Delta)
        const history = existing.history || [];
        const lastSnapshot = history[history.length - 1] || { score: item.score, rank: item.rank };
        const scoreDelta = (item.score || 0) - (lastSnapshot.score || 0);
        const rankDelta = (lastSnapshot.rank || 99) - (item.rank || 99); // Positive is good

        // Momentum Classification
        let momentum = 'sustained';
        if (item.is_new || (scoreDelta > 0.5 && rankDelta > 5)) momentum = 'exploding';
        else if (scoreDelta < -0.2 && rankDelta < -3) momentum = 'peaked';

        // Keep last 10 snapshots for sparklines
        const newSnapshot = { t: now, score: item.score, rank: item.rank };
        history.push(newSnapshot);
        if (history.length > 10) history.shift();

        db.trends[existingIndex] = {
            ...existing,
            display_name: item.display_name || existing.display_name,
            rank: item.rank || existing.rank,
            score: item.score || existing.score,
            last_seen_at: now,
            is_new: false,
            momentum,
            velocity: scoreDelta,
            history: history,
            source: item.source || existing.source,
            primary_url: item.primary_url || existing.primary_url,
            secondary_url: item.secondary_url || existing.secondary_url,
            metadata: { ...(existing.metadata || {}), ...(item.metadata || {}) }
        };
    } else {
        db.trends.push({
            id: canonicalId,
            ...item,
            momentum: 'new',
            velocity: 0,
            history: [{ t: now, score: item.score, rank: item.rank }],
            last_seen_at: now,
            is_new: true,
            metadata: item.metadata || {}
        });
    }
    saveDB(db);
};

// Helper to clean entities and tags
const cleanText = (str) => {
    if (!str) return "";
    return str
        .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') // Strip CDATA
        .replace(/<[^>]*>/g, '') // Strip HTML tags
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#039;/g, "'")
        .trim();
};

// 3. Adapters
const fetchWikiTrends = async () => {
    const fetchForDate = async (date) => {
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '/');
        const url = `https://en.wikipedia.org/api/rest_v1/feed/featured/${dateStr}`;
        console.log(`[Wiki] Fetching from: ${url}`);
        const resp = await fetch(url, {
            headers: { 'User-Agent': 'TrendPulse/1.0 (contact: dan@example.com)' }
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return (data.mostread && data.mostread.articles) ? data : null;
    };

    try {
        let data = await fetchForDate(new Date());
        if (!data) {
            console.warn(`[Wiki] No data for today, trying yesterday...`);
            data = await fetchForDate(new Date(Date.now() - 86400000));
        }

        if (!data) {
            console.error(`[Wiki] No data available for today or yesterday.`);
            return [];
        }

        return data.mostread.articles.slice(0, 15).map((a, i) => {

            const topicName = a.normalizedtitle;
            const baseScore = 1 / (i + 1);
            const jitter = baseScore * (0.98 + Math.random() * 0.04);
            return {
                canonical_topic: topicName,
                display_name: cleanText(a.titles?.display || a.displaytitle || topicName),
                source: 'wikipedia',
                rank: i + 1,
                score: jitter,
                primary_url: a.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${a.titles.canonical}`,
                secondary_url: `https://www.google.com/search?q=${encodeURIComponent(topicName)}&tbm=nws`,
                metadata: { views: a.views }
            };
        });
    } catch (err) {
        console.error('Wiki Fetch Error:', err.message);
        return [];
    }
};


const fetchGoogleTrends = async () => {
    try {
        const resp = await fetch('https://trends.google.com/trending/rss?geo=US');
        const text = await resp.text();
        const items = [];
        const matches = text.matchAll(/<item>([\s\S]*?)<\/item>/g);
        for (const m of matches) {
            const content = m[1];
            const rawTitle = (content.match(/<title>(.*?)<\/title>/) || [])[1];
            const title = cleanText(rawTitle);
            const trafficStr = (content.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/) || [])[1];

            // Map traffic string (e.g. "50,000+") to a numeric score
            const trafficNum = parseInt((trafficStr || "0").replace(/[,+]/g, '')) || 500;
            const score = Math.log10(trafficNum) + (Math.random() * 0.2); // Log scale + jitter

            if (title) {
                items.push({
                    canonical_topic: title,
                    display_name: title,
                    source: 'google',
                    rank: items.length + 1,
                    score: score,
                    primary_url: `https://www.google.com/search?q=${encodeURIComponent(title)}`,
                    secondary_url: `https://www.google.com/search?q=${encodeURIComponent(title)}&tbm=nws`,
                    metadata: { approx_traffic: trafficStr }
                });
            }
        }
        return items.slice(0, 15);
    } catch (err) {

        console.error('Google Fetch Error:', err.message);
        return [];
    }
};


// 4. Server Setup
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), platform: 'node-json-dev' });
});

app.get('/api/trends/latest', (req, res) => {
    const db = loadDB();
    const sorted = db.trends.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 20);
    res.json({ generated_at: new Date().toISOString(), region: 'US', trends: sorted });
});

app.post('/api/debug/poll', async (req, res) => {
    console.log('[Poll] Starting manual poll...');
    try {
        const [wiki, google] = await Promise.all([fetchWikiTrends(), fetchGoogleTrends()]);
        const combined = [...wiki, ...google];
        combined.forEach(upsertTrend);
        res.json({ success: true, counts: { wiki: wiki.length, google: google.length } });
        console.log(`[Poll] Success: ${wiki.length} wiki, ${google.length} google`);
    } catch (err) {
        console.error('[Poll] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`\n🚀 TrendPulse Dev Backend LIVE (JSON STORAGE) at http://localhost:${port}`);
    console.log(`👉 Run 'node scripts/validate_system.cjs' to verify extension connection.`);
});
