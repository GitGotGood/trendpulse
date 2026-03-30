/**
 * Custom D1 Schema Initializer for TrendPulse
 * Pushes schema.sql to Cloudflare D1 via REST API.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!ACCOUNT_ID || !API_TOKEN) {
    console.error('❌ Error: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables are required.');
    process.exit(1);
}

// Parse Database ID
const wranglerToml = fs.readFileSync(path.join(__dirname, '../wrangler.toml'), 'utf8');
const DB_ID = wranglerToml.match(/database_id = "(.*?)"/)?.[1];

if (!DB_ID || DB_ID === 'to-be-created-id') {
    console.error('❌ Error: database_id is missing or placeholder. Please create the D1 database and update wrangler.toml first.');
    process.exit(1);
}

async function run() {
    try {
        console.log(`🗄️ Initializing D1 Schema for ${DB_ID}...`);

        const sql = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');

        const options = {
            hostname: 'api.cloudflare.com',
            path: `/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                const response = JSON.parse(body);
                if (response.success) {
                    console.log('✅ Schema Applied Successfully!');
                } else {
                    console.error('❌ Schema Execution Failed:', JSON.stringify(response.errors, null, 2));
                }
            });
        });

        req.on('error', (e) => console.error(`❌ Request Error: ${e.message}`));
        req.write(JSON.stringify({ sql }));
        req.end();

    } catch (err) {
        console.error('❌ Critical Error during DB init:', err.message);
        process.exit(1);
    }
}

run();
