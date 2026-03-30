/**
 * Custom D1 Database Creator for TrendPulse
 * Creates the D1 database via Cloudflare REST API to bypass broken wrangler CLI.
 */

const https = require('https');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DB_NAME = 'trendpulse-db';

if (!ACCOUNT_ID || !API_TOKEN) {
    console.error('❌ Error: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables are required.');
    process.exit(1);
}

async function run() {
    try {
        console.log(`📡 Requesting creation of D1 database: ${DB_NAME}...`);

        const options = {
            hostname: 'api.cloudflare.com',
            path: `/client/v4/accounts/${ACCOUNT_ID}/d1/database`,
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
                    console.log('✅ Database Created Successfully!');
                    console.log('--------------------------------------------------');
                    console.log(`NAME: ${response.result.name}`);
                    console.log(`ID:   ${response.result.uuid}`);
                    console.log('--------------------------------------------------');
                    console.log('👉 ACTION: Copy the ID above and paste it into your wrangler.toml file!');
                } else {
                    // Check if it already exists
                    if (response.errors.some(e => e.message && e.message.includes('already exists'))) {
                        console.warn('⚠️ Database already exists. Fetching info...');
                        fetchDatabases();
                    } else {
                        console.error('❌ Creation Failed:', JSON.stringify(response.errors, null, 2));
                    }
                }
            });
        });

        req.on('error', (e) => console.error(`❌ Request Error: ${e.message}`));
        req.write(JSON.stringify({ name: DB_NAME }));
        req.end();

    } catch (err) {
        console.error('❌ Critical Error during DB creation:', err.message);
        process.exit(1);
    }
}

function fetchDatabases() {
    const options = {
        hostname: 'api.cloudflare.com',
        path: `/client/v4/accounts/${ACCOUNT_ID}/d1/database`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${API_TOKEN}`
        }
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            const response = JSON.parse(body);
            const db = response.result.find(d => d.name === DB_NAME);
            if (db) {
                console.log('✅ Found Existing Database:');
                console.log(`ID: ${db.uuid}`);
                console.log('👉 ACTION: Copy the ID above and paste it into your wrangler.toml file!');
            } else {
                console.error('❌ Could not find database or create it.');
            }
        });
    });
    req.end();
}

run();
