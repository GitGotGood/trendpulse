/**
 * Database Reset for TrendPulse
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

const wranglerToml = fs.readFileSync(path.join(__dirname, '../wrangler.toml'), 'utf8');
const DB_ID = wranglerToml.match(/database_id = "(.*?)"/)?.[1];

async function reset() {
    console.log(`🧹 Wiping D1 trends table...`);
    const data = JSON.stringify({ sql: "DELETE FROM trends;" });
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
        let b = '';
        res.on('data', d => b += d);
        res.on('end', () => {
            const r = JSON.parse(b);
            if (r.success) console.log('✅ DB Wiped!');
            else console.error('❌ Failed:', b);
        });
    });
    req.write(data);
    req.end();
}
reset();
