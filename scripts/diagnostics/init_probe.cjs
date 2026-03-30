const fs = require('fs');
const path = require('path');

console.log('--- TrendPulse Diagnostic Probe ---');

const manifestPath = path.join(__dirname, '../../manifest.json');
if (fs.existsSync(manifestPath)) {
    const manifest = require(manifestPath);
    console.log(`[PASS] manifest.json found (Version: ${manifest.version})`);
} else {
    console.error('[FAIL] manifest.json NOT found');
}

const iconsDir = path.join(__dirname, '../../icons');
if (fs.existsSync(iconsDir)) {
    console.log('[PASS] icons/ directory initialized');
} else {
    console.log('[INFO] icons/ directory NOT found (optional)');
}

console.log('--- Probe Complete ---');
