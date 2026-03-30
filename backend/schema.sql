-- D1 Database Schema for TrendPulse

-- Processed and ranked trend items
CREATE TABLE IF NOT EXISTS trends (
    id TEXT PRIMARY KEY,
    canonical_topic TEXT NOT NULL,
    display_name TEXT NOT NULL,
    source TEXT NOT NULL, -- 'wikipedia' or 'google'
    source_item_id TEXT,
    rank INTEGER,
    score REAL DEFAULT 0.0,
    first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_new BOOLEAN DEFAULT 1,
    momentum TEXT DEFAULT 'new', -- 'exploding', 'sustained', 'peaked', 'new'
    velocity REAL DEFAULT 0.0,
    history TEXT, -- JSON array of snapshots [{t, score, rank}]
    primary_url TEXT NOT NULL,
    secondary_url TEXT,
    fallback_url TEXT,
    metadata TEXT, -- JSON string
    description TEXT,
    category TEXT DEFAULT 'general'
);

-- Index for fast lookup by topic/source
CREATE INDEX IF NOT EXISTS idx_trends_topic ON trends(canonical_topic);
CREATE INDEX IF NOT EXISTS idx_trends_last_seen ON trends(last_seen_at);

-- Raw records of every poll
CREATE TABLE IF NOT EXISTS raw_pulls (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    pulled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_payload TEXT -- JSON string
);

-- Log of notifications sent to users
CREATE TABLE IF NOT EXISTS notification_logs (
    id TEXT PRIMARY KEY,
    trend_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(trend_id) REFERENCES trends(id)
);
