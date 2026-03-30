/**
 * TrendPulse Settings Logic
 */

const PREFS = {
    NOTIFS_ENABLED: 'tp_prefs_notifs_enabled',
    NOTIF_FREQ: 'tp_prefs_notif_freq',
    REGION: 'tp_prefs_region'
};

document.addEventListener('DOMContentLoaded', async () => {
    // Load current values
    chrome.storage.local.get([
        PREFS.NOTIFS_ENABLED,
        PREFS.NOTIF_FREQ,
        PREFS.REGION
    ], (result) => {
        document.getElementById('notifications-enabled').checked = result[PREFS.NOTIFS_ENABLED] ?? true;
        document.getElementById('notification-frequency').value = result[PREFS.NOTIF_FREQ] ?? 3;
    });

    // Save on change
    document.getElementById('notifications-enabled').addEventListener('change', (e) => {
        chrome.storage.local.set({ [PREFS.NOTIFS_ENABLED]: e.target.checked });

        // If enabling, request permission proactively
        if (e.target.checked) {
            chrome.notifications.getPermissionLevel((level) => {
                if (level !== 'granted') {
                    console.log('Notification permission not granted, user will be prompted later or should enable in browser settings.');
                }
            });
        }
    });

    document.getElementById('notification-frequency').addEventListener('change', (e) => {
        chrome.storage.local.set({ [PREFS.NOTIF_FREQ]: parseInt(e.target.value, 10) });
    });

    document.getElementById('close-btn').addEventListener('click', () => {
        window.close();
    });
});
