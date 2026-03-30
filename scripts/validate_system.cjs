/**
 * TrendPulse System Validator (v3 Tester Role)
 * Run this to check if the environment is ready for testing.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    backendUrl: 'http://localhost:8787',
    extensionDir: path.join(__dirname, '../extension'),
};

console.log('--- TrendPulse System Validation ---');

async function validate() {
    let allPass = true;

    // 1. Check Extension Files
    console.log('\n[1/3] Checking Extension Files...');
    const requiredFiles = ['manifest.json', 'popup.html', 'popup.js', 'background.js'];
    requiredFiles.forEach(file => {
        const p = path.join(CONFIG.extensionDir, file);
        if (fs.existsSync(p)) {
            console.log(`  [PASS] ${file} found.`);
        } else {
            console.error(`  [FAIL] ${file} is MISSING.`);
            allPass = false;
        }
    });

    // 2. Check Backend Connectivity
    console.log('\n[2/3] Checking Backend Connectivity...');
    try {
        const health = await fetchHealth();
        console.log(`  [PASS] Backend is LIVE at ${CONFIG.backendUrl}`);
        console.log(`         Status: ${health.status}, Time: ${health.timestamp}`);
    } catch (err) {
        console.error(`  [FAIL] Backend is UNREACHABLE at ${CONFIG.backendUrl}`);
        console.error(`         Reason: ${err.message}`);
        console.error(`         TIP: Run 'npx wrangler dev' in the /backend directory.`);
        allPass = false;
    }

    // 3. Check Icons
    console.log('\n[3/3] Checking Icons...');
    const iconPath = path.join(CONFIG.extensionDir, 'icons/icon128.png');
    if (fs.existsSync(iconPath)) {
        console.log('  [PASS] icon128.png found.');
    } else {
        console.error('  [FAIL] icon128.png is MISSING.');
        allPass = false;
    }

    console.log('\n--- Validation Result ---');
    if (allPass) {
        console.log('✅ SYSTEM READY. You can now test the extension.');
    } else {
        console.log('❌ SYSTEM CONFIGURATION ERRORS FOUND. Fix the fails above.');
    }
}

function fetchHealth() {
    return new Promise((resolve, reject) => {
        const req = http.get(`${CONFIG.backendUrl}/health`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Status ${res.statusCode}`));
                }
            });
        });
        req.on('error', (err) => reject(err));
        req.setTimeout(2000, () => req.destroy(new Error('Timeout')));
    });
}

validate();
