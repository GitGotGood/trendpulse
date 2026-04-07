/**
 * Custom D1 Migrator for TrendPulse
 * Bypasses broken wrangler CLI on ARM64 by using Cloudflare REST API for D1 queries.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!ACCOUNT_ID || !API_TOKEN) {
    console.error('❌ Error: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN required.');
    process.exit(1);
}

const wranglerToml = fs.readFileSync(path.join(__dirname, '../wrangler.toml'), 'utf8');
const DB_ID = wranglerToml.match(/database_id = "(.*?)"/)?.[1];

if (!DB_ID) {
    console.error('❌ Error: database_id not found in wrangler.toml');
    process.exit(1);
}

const sql = `CREATE TABLE IF NOT EXISTS daily_snapshots (
    date TEXT PRIMARY KEY,
    top_10_json TEXT NOT NULL
);`;

async function migrate() {
    console.log(`🚀 Applying migration to D1 (${DB_ID})...`);

    const data = JSON.stringify({
        sql: sql
    });

    const options = {
        hostname: 'api.cloudflare.com',
        path: `/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (d) => body += d);
        res.on('end', () => {
            const resp = JSON.parse(body);
            if (resp.success) {
                console.log('✅ Migration Successful!');
            } else {
                console.error('❌ Migration Failed:', JSON.stringify(resp.errors, null, 2));
                // If it already exists, that's fine too
                if (resp.errors.some(e => e.message.includes('duplicate column name'))) {
                    console.log('ℹ️ Column already exists, proceeding.');
                } else {
                    process.exit(1);
                }
            }
        });
    });

    req.on('error', (e) => console.error(e));
    req.write(data);
    req.end();
}

migrate();
