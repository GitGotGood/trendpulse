/**
 * Custom Cloudflare Deployer for TrendPulse
 * Bypasses broken wrangler CLI on ARM64 by using Cloudflare REST API directly.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Configuration - User must provide these or set in .env
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!ACCOUNT_ID || !API_TOKEN) {
    console.error('❌ Error: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables are required.');
    process.exit(1);
}

// 0. Parse wrangler.toml for dynamic config
const wranglerToml = fs.readFileSync(path.join(__dirname, '../wrangler.toml'), 'utf8');
const SCRIPT_NAME = wranglerToml.match(/name = "(.*?)"/)?.[1] || 'trendpulse-backend';
const DB_ID = wranglerToml.match(/database_id = "(.*?)"/)?.[1];

if (!DB_ID || DB_ID === 'to-be-created-id') {
    console.warn('⚠️ Warning: database_id is missing or placeholder. D1 binding might fail.');
}

async function run() {
    try {
        console.log(`🚀 Starting Custom Deployment for ${SCRIPT_NAME}...`);

        // 1. Bundle using esbuild (which is already in node_modules)
        console.log('📦 Bundling Worker...');
        const bundlePath = path.join(__dirname, '../dist/index.js');
        if (!fs.existsSync(path.join(__dirname, '../dist'))) fs.mkdirSync(path.join(__dirname, '../dist'));

        execSync(`npx esbuild src/index.ts --bundle --outfile=dist/index.js --platform=browser --format=esm --target=es2022 --minify`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });

        const scriptContent = fs.readFileSync(bundlePath, 'utf8');

        // 2. Prepare Metadata for Worker
        const bindings = [];
        if (DB_ID && DB_ID !== 'to-be-created-id') {
            bindings.push({
                type: 'd1',
                name: 'DB',
                id: DB_ID
            });
        }

        bindings.push({
            type: 'ai',
            name: 'AI'
        });

        bindings.push({
            type: 'vectorize',
            name: 'VECTORIZE',
            index_name: 'trendpulse-vectors'
        });

        const metadata = {
            main_module: 'index.js',
            compatibility_date: '2024-03-06',
            bindings: bindings
        };

        // 3. Upload to Cloudflare via API
        console.log('📤 Uploading to Cloudflare...');

        const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
        const formData = [
            `--${boundary}`,
            'Content-Disposition: form-data; name="metadata"; filename="metadata.json"',
            'Content-Type: application/json',
            '',
            JSON.stringify(metadata),
            `--${boundary}`,
            'Content-Disposition: form-data; name="index.js"; filename="index.js"',
            'Content-Type: application/javascript+module',
            '',
            scriptContent,
            `--${boundary}--`,
            ''
        ].join('\r\n');

        const options = {
            hostname: 'api.cloudflare.com',
            path: `/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`,
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': Buffer.byteLength(formData)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                const response = JSON.parse(body);
                if (response.success) {
                    console.log('✅ Deployment Successful!');
                    console.log(`🔗 URL: https://${SCRIPT_NAME}.dan-walsh.workers.dev`);

                    // 4. Update Cron Triggers
                    const cronsMatch = wranglerToml.match(/crons\s*=\s*\[(.*?)\]/);
                    if (cronsMatch) {
                        const crons = cronsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
                        if (crons.length > 0) {
                            console.log(`🕒 Updating Cron Triggers: ${crons.join(', ')}...`);
                            updateCrons(crons);
                        }
                    }
                } else {
                    console.error('❌ Deployment Failed:', JSON.stringify(response.errors, null, 2));
                }
            });
        });

        req.on('error', (e) => console.error(`❌ Request Error: ${e.message}`));
        req.write(formData);
        req.end();

    } catch (err) {
        console.error('❌ Critical Error during deployment:', err.message);
        process.exit(1);
    }
}

function updateCrons(crons) {
    const schedules = crons.map(cron => ({ cron: cron }));
    const data = JSON.stringify(schedules);
    const options = {
        hostname: 'api.cloudflare.com',
        path: `/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}/schedules`,
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };
    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            const response = JSON.parse(body);
            if (response.success) {
                console.log('✅ Cron Triggers Updated!');
            } else {
                console.error('❌ Cron Update Failed:', JSON.stringify(response.errors, null, 2));
            }
        });
    });
    req.on('error', (e) => console.error(`❌ Cron Request Error: ${e.message}`));
    req.write(data);
    req.end();
}

run();
