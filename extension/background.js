/**
 * TrendPulse Background Service Worker
 * Handles periodic checks for new trends and notification management.
 * 
 * Note: Pulse data is now sourced autonomously by the backend via Bing/Google RSS,
 * removing the need for fragile client-side injection bridges.
 */

const PROD_URL = 'https://trendpulse-backend.danthedub.workers.dev';
const LOCAL_URL = 'http://localhost:8787';
let BACKEND_URL = PROD_URL; 

const PREFS = {
    NOTIFS_ENABLED: 'tp_prefs_notifs_enabled',
    NOTIF_FREQ: 'tp_prefs_notif_freq',
    LAST_NOTIF_DAY: 'tp_last_notif_day',
    NOTIFS_SENT_TODAY: 'tp_notifs_sent_today',
    NOTIFIED_IDS: 'tp_notified_ids'
};

const POLL_ALARM = 'tp_poll_trends_alarm';

// Initialize Alarms
chrome.runtime.onInstalled.addListener(() => {
    console.log('TrendPulse Service Worker Installed');
    chrome.alarms.create(POLL_ALARM, { periodInMinutes: 60 });
    checkAndNotify();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === POLL_ALARM) {
        checkAndNotify();
    }
});

/**
 * Core Logic: Fetch candidates from the autonomous backend, check quotas, and trigger notify
 */
async function checkAndNotify() {
    try {
        const prefs = await chrome.storage.local.get([
            PREFS.NOTIFS_ENABLED,
            PREFS.NOTIF_FREQ,
            PREFS.LAST_NOTIF_DAY,
            PREFS.NOTIFS_SENT_TODAY,
            PREFS.NOTIFIED_IDS,
            'tp_active_env',
            'tp_backend_override'
        ]);

        BACKEND_URL = prefs.tp_active_env === 'local' ? LOCAL_URL : (prefs.tp_backend_override || PROD_URL);

        if (prefs[PREFS.NOTIFS_ENABLED] === false) return;

        const today = new Date().toDateString();
        let sentToday = prefs[PREFS.NOTIFS_SENT_TODAY] || 0;
        if (prefs[PREFS.LAST_NOTIF_DAY] !== today) sentToday = 0;

        const maxPerDay = prefs[PREFS.NOTIF_FREQ] ?? 3;
        if (sentToday >= maxPerDay) return;

        console.log(`[NOTIFS] Checking backend for new trends: ${BACKEND_URL}`);
        const response = await fetch(`${BACKEND_URL}/api/trends/latest`);
        if (!response.ok) return;

        const { trends } = await response.json();
        if (!trends || trends.length === 0) return;

        const notifiedIds = prefs[PREFS.NOTIFIED_IDS] || [];
        // Only notify for trends seen in the last 2 hours (fresh)
        const candidate = trends.find(t => t.is_new && !notifiedIds.includes(t.id));

        if (candidate) {
            triggerNotification(candidate);
            chrome.storage.local.set({
                [PREFS.LAST_NOTIF_DAY]: today,
                [PREFS.NOTIFS_SENT_TODAY]: sentToday + 1,
                [PREFS.NOTIFIED_IDS]: [...notifiedIds.slice(-20), candidate.id]
            });
        }
    } catch (err) { console.error('CheckAndNotify failed:', err); }
}

function triggerNotification(trend) {
    chrome.notifications.create(trend.id, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Trending now',
        message: `${trend.display_name} is spiking on ${trend.source}.`,
        contextMessage: 'Click to learn more',
        priority: 1
    });
}

chrome.notifications.onClicked.addListener((notificationId) => {
    chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(notificationId.replace('google_', '').replace(/_/g, ' '))}` });
});
