/**
 * TrendPulse Popup Logic
 * Handles live data fetching, local caching, and robust UI rendering.
 */

// Configuration
const PROD_URL = 'https://trendpulse-backend.danthedub.workers.dev'; // Live prod URL
const LOCAL_URL = 'http://localhost:8787';
let BACKEND_URL = PROD_URL; // Default is now Production!
const CACHE_KEY = 'trendpulse_cached_trends';
const CACHE_TIME_KEY = 'trendpulse_last_fetch';

/**
 * Resolve the correct backend URL from storage
 */
async function resolveBackendURL() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['tp_backend_override', 'tp_active_env'], (res) => {
            if (res.tp_active_env === 'local') {
                BACKEND_URL = LOCAL_URL;
            } else if (res.tp_backend_override) {
                BACKEND_URL = res.tp_backend_override;
            } else {
                BACKEND_URL = PROD_URL;
            }
            resolve(BACKEND_URL);
        });
    });
}

// Prefs Keys (matching background.js and options.js)
const PREFS = {
    NOTIFS_ENABLED: 'tp_prefs_notifs_enabled',
    NOTIF_FREQ: 'tp_prefs_notif_freq',
    HIDE_SPORTS: 'tp_hide_sports',
    HIDE_CELEBS: 'tp_hide_celebrities',
    HIDE_ENTERTAINMENT: 'tp_hide_entertainment',
    SRC_GOOGLE: 'tp_src_google',
    SRC_BING: 'tp_src_bing',
    SRC_WIKI: 'tp_src_wiki',
    SRC_REDDIT: 'tp_src_reddit',
    SRC_YOUTUBE: 'tp_src_youtube'
};

document.addEventListener('DOMContentLoaded', async () => {
    // 0. Resolve Backend URL first
    await resolveBackendURL();

    initUI();

    // 1. Load Prefs
    await loadSettings();

    // 2. Instant Paint from Cache
    const cached = await getCachedTrends();
    if (cached) {
        renderTrends(cached.trends, cached.timestamp);
    }

    // 3. Fetch Fresh Data
    await fetchLatestTrends();
});

function initUI() {
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', fetchLatestTrends);

    const settingsBtn = document.getElementById('settings-btn');
    const backBtn = document.getElementById('back-btn');
    
    const historyBtn = document.getElementById('history-btn');
    const historyBackBtn = document.getElementById('history-back-btn');

    const trendsView = document.getElementById('trends-view');
    const settingsView = document.getElementById('settings-view');
    const historyView = document.getElementById('history-view');

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            trendsView.classList.add('hidden');
            historyView.classList.add('hidden');
            settingsView.classList.remove('hidden');
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            settingsView.classList.add('hidden');
            trendsView.classList.remove('hidden');
        });
    }

    if (historyBtn) {
        historyBtn.addEventListener('click', () => {
            trendsView.classList.add('hidden');
            settingsView.classList.add('hidden');
            historyView.classList.remove('hidden');
            fetchAndRenderHistory();
        });
    }

    if (historyBackBtn) {
        historyBackBtn.addEventListener('click', () => {
            historyView.classList.add('hidden');
            trendsView.classList.remove('hidden');
        });
    }

    // Settings Listeners
    const notifsCheck = document.getElementById('notifs-enabled');
    const freqSelect = document.getElementById('notif-freq');
    const envSelector = document.getElementById('env-selector');

    if (notifsCheck) notifsCheck.addEventListener('change', (e) => saveSetting(PREFS.NOTIFS_ENABLED, e.target.checked));
    if (freqSelect) freqSelect.addEventListener('change', (e) => saveSetting(PREFS.NOTIF_FREQ, parseInt(e.target.value, 10)));

    if (envSelector) {
        envSelector.addEventListener('change', (e) => {
            const newEnv = e.target.value;
            BACKEND_URL = (newEnv === 'local') ? LOCAL_URL : PROD_URL;
            chrome.storage.local.set({ 'tp_active_env': newEnv }, () => {
                showSaveStatus();
                fetchLatestTrends();
            });
        });
    }

    // Source Toggles
    const srcToggles = [
        { id: 'src-google', key: PREFS.SRC_GOOGLE },
        { id: 'src-bing', key: PREFS.SRC_BING },
        { id: 'src-wiki', key: PREFS.SRC_WIKI },
        { id: 'src-reddit', key: PREFS.SRC_REDDIT },
        { id: 'src-youtube', key: PREFS.SRC_YOUTUBE }
    ];

    srcToggles.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            el.addEventListener('change', (e) => {
                saveSetting(item.key, e.target.checked);
                getCachedTrends().then(cached => {
                    if (cached) renderTrends(cached.trends, cached.timestamp);
                });
            });
        }
    });

    // Category Toggles
    const toggles = [
        { id: 'hide-sports', key: PREFS.HIDE_SPORTS },
        { id: 'hide-celebrities', key: PREFS.HIDE_CELEBS },
        { id: 'hide-entertainment', key: PREFS.HIDE_ENTERTAINMENT }
    ];

    toggles.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            el.addEventListener('change', (e) => {
                saveSetting(item.key, e.target.checked);
                // Instant re-filter from cache
                getCachedTrends().then(cached => {
                    if (cached) renderTrends(cached.trends, cached.timestamp);
                });
            });
        }
    });
}

async function loadSettings() {
    const keys = [
        PREFS.NOTIFS_ENABLED,
        PREFS.NOTIF_FREQ,
        'tp_active_env',
        PREFS.HIDE_SPORTS,
        PREFS.HIDE_CELEBS,
        PREFS.HIDE_ENTERTAINMENT,
        PREFS.SRC_GOOGLE,
        PREFS.SRC_BING,
        PREFS.SRC_WIKI,
        PREFS.SRC_REDDIT,
        PREFS.SRC_YOUTUBE
    ];
    return new Promise(resolve => {
        chrome.storage.local.get(keys, (res) => {
            const notifsEl = document.getElementById('notifs-enabled');
            if (notifsEl) notifsEl.checked = (res[PREFS.NOTIFS_ENABLED] !== undefined) ? res[PREFS.NOTIFS_ENABLED] : true;

            const freqEl = document.getElementById('notif-freq');
            if (freqEl) freqEl.value = res[PREFS.NOTIF_FREQ] || 3;

            const envEl = document.getElementById('env-selector');
            if (envEl) envEl.value = res.tp_active_env || 'prod';

            // Category Toggles
            const sEl = document.getElementById('hide-sports');
            const cEl = document.getElementById('hide-celebrities');
            const eEl = document.getElementById('hide-entertainment');
            if (sEl) sEl.checked = !!res[PREFS.HIDE_SPORTS];
            if (cEl) cEl.checked = !!res[PREFS.HIDE_CELEBS];
            if (eEl) eEl.checked = !!res[PREFS.HIDE_ENTERTAINMENT];

            // Source Toggles (Default TRUE)
            const sgEl = document.getElementById('src-google');
            const sbEl = document.getElementById('src-bing');
            const swEl = document.getElementById('src-wiki');
            const srEl = document.getElementById('src-reddit');
            const syEl = document.getElementById('src-youtube');
            if (sgEl) sgEl.checked = (res[PREFS.SRC_GOOGLE] !== false);
            if (sbEl) sbEl.checked = (res[PREFS.SRC_BING] !== false);
            if (swEl) swEl.checked = (res[PREFS.SRC_WIKI] !== false);
            if (srEl) srEl.checked = (res[PREFS.SRC_REDDIT] !== false);
            if (syEl) syEl.checked = (res[PREFS.SRC_YOUTUBE] !== false);

            resolve();
        });
    });
}

function saveSetting(key, value) {
    chrome.storage.local.set({ [key]: value }, () => {
        showSaveStatus();
    });
}

function showSaveStatus() {
    const status = document.querySelector('.status-saved');
    if (status) {
        status.classList.remove('hidden');
        setTimeout(() => status.classList.add('hidden'), 2000);
    }
}

/**
 * Fetch latest trends from backend and update UI/Cache
 */
async function fetchLatestTrends() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/trends/latest`);
        if (!response.ok) throw new Error('Network response not ok');

        const data = await response.json();
        const trends = data.trends || [];
        const timestamp = data.generated_at || new Date().toISOString();

        chrome.storage.local.set({
            [CACHE_KEY]: trends,
            [CACHE_TIME_KEY]: timestamp
        });

        renderTrends(trends, timestamp);
    } catch (error) {
        console.error('Failed to fetch trends:', error);
        handleFetchError();
    }
}

/**
 * Convert string to Title Case
 */
function toTitleCase(str) {
    if (!str) return '';
    return str.replace(
        /\w\S*/g,
        function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
    );
}

/**
 * Decode HTML entities robustly
 */
function decodeEntities(text) {
    if (!text) return '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

/**
 * Render the list of trends into the DOM
 */
async function renderTrends(trends, timestamp) {
    const listContainer = document.getElementById('trends-list');
    const refreshTime = document.getElementById('refresh-time');
    const template = document.getElementById('trend-item-template');
    const errorState = document.getElementById('error-state');

    const prefs = await new Promise(r => chrome.storage.local.get([
        PREFS.HIDE_SPORTS, PREFS.HIDE_CELEBS, PREFS.HIDE_ENTERTAINMENT,
        PREFS.SRC_GOOGLE, PREFS.SRC_BING, PREFS.SRC_WIKI, PREFS.SRC_REDDIT, PREFS.SRC_YOUTUBE
    ], r));

    if (!listContainer || !template) return;

    listContainer.innerHTML = '';
    errorState.classList.add('hidden');

    if (timestamp) {
        const date = new Date(timestamp);
        refreshTime.textContent = `Updated: ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Filter by Category and Source
    const filteredTrends = trends.filter(t => {
        const category = (t.category || 'general').toLowerCase();
        if (prefs[PREFS.HIDE_SPORTS] && category === 'sports') return false;
        if (prefs[PREFS.HIDE_CELEBS] && category === 'celebrities') return false;
        if (prefs[PREFS.HIDE_ENTERTAINMENT] && category === 'entertainment') return false;

        // Filter by Source (Default TRUE, hide if strictly false)
        if (t.source === 'google' && prefs[PREFS.SRC_GOOGLE] === false) return false;
        if (t.source === 'bing' && prefs[PREFS.SRC_BING] === false) return false;
        if (t.source === 'wikipedia' && prefs[PREFS.SRC_WIKI] === false) return false;
        if (t.source === 'reddit' && prefs[PREFS.SRC_REDDIT] === false) return false;
        if (t.source === 'youtube' && prefs[PREFS.SRC_YOUTUBE] === false) return false;

        return true;
    });

    if (filteredTrends.length === 0) {
        listContainer.innerHTML = '<div class="loader">All categories filtered out.</div>';
        return;
    }

    filteredTrends.forEach((trendObj, index) => {
        try {
            const trend = { ...trendObj };
            ['metadata', 'history'].forEach(key => {
                if (typeof trend[key] === 'string' && (trend[key].startsWith('{') || trend[key].startsWith('['))) {
                    try { trend[key] = JSON.parse(trend[key]); } catch (e) { trend[key] = (key === 'history') ? [] : {}; }
                }
            });

            const clone = template.content.cloneNode(true);
            const card = clone.querySelector('.trend-card');

            // Header & Badges
            clone.querySelector('.trend-rank').textContent = index + 1;

            // NEW Badge only (momentum labels removed as requested)
            if (trend.is_new) {
                clone.querySelector('.new-label').classList.remove('hidden');
            }

            // Name & Primary Metric
            clone.querySelector('.trend-name').textContent = toTitleCase(decodeEntities(trend.display_name));
            const metadata = clone.querySelector('.trend-metadata');

            // Zero-Friction Click on Body
            const cardBody = clone.querySelector('.card-body');
            cardBody.addEventListener('click', () => {
                const searchUrl = trend.primary_url?.startsWith('http') ? trend.primary_url : `https://www.google.com/search?q=${encodeURIComponent(trend.display_name)}`;
                window.open(searchUrl, '_blank');
            });

            // Magnitude %
            let magText = '';
            if (trend.history && trend.history.length > 1) {
                const first = trend.history[0].score || 0.1;
                const last = trend.history[trend.history.length - 1].score || 0.1;
                const pct = ((last - first) / (first || 0.1)) * 100;
                if (Math.abs(pct) > 0.5) {
                    magText = pct > 0 ? ` ↑${pct.toFixed(0)}%` : ` ↓${Math.abs(pct).toFixed(0)}%`;
                }
            }

            // Calculate Hours Trending
            let ageText = 'Breaking News';
            if (trend.first_seen_at && trend.last_seen_at) {
                const first = new Date(trend.first_seen_at);
                const last = new Date(trend.last_seen_at);
                const hours = Math.round((last - first) / (1000 * 60 * 60));
                if (hours >= 1) {
                    ageText = `Trending for ${hours} hours`;
                }
            }

            metadata.textContent = `${ageText}${magText}`;

            // Sparkline Visual
            const canvas = clone.querySelector('.sparkline');
            if (trend.history && Array.isArray(trend.history) && trend.history.length > 0) {
                drawSparkline(canvas, trend.history);
            }

            // Source Badge
            clone.querySelector('.source-badge').textContent = (trend.source || '').toUpperCase();

            // Actions
            const primaryLink = clone.querySelector('.primary-link');
            if (trend.primary_url?.startsWith('http')) {
                primaryLink.href = trend.primary_url;
            } else {
                primaryLink.classList.add('hidden');
            }

            const secLink = clone.querySelector('.secondary-link');
            if (trend.secondary_url?.startsWith('http')) {
                secLink.href = trend.secondary_url;
                secLink.classList.remove('hidden');
            }

            clone.querySelector('.details-trigger').addEventListener('click', () => openDetailsPanel(trend));

            listContainer.appendChild(clone);
        } catch (err) {
            console.error('Error rendering card:', err, trend);
        }
    });
}

/**
 * Draw a mini velocity chart
 */
function drawSparkline(canvas, history) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const scores = history.map(h => h.score || 0);
    const max = Math.max(...scores) || 1;
    const min = Math.min(...scores);
    const range = (max - min) || 1;
    const isFlat = (max === min);

    // Heat Slope Logic
    let strokeColor = '#3b82f6';
    if (scores.length > 1) {
        const last = scores[scores.length - 1];
        const prev = scores[scores.length - 2] || last;
        const delta = (last - prev) / (prev || 0.1);
        if (delta > 0.1) strokeColor = '#22c55e'; // Growth -> Green
        else if (delta < -0.05) strokeColor = '#ef4444'; // Cooling -> Red
    }

    ctx.clearRect(0, 0, width, height);

    // 1. Time Labels
    ctx.font = '700 8px sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('24h', 0, height - 2);
    ctx.fillText('Now', width - 20, height - 2);

    // 2. Trend Line (Stroke)
    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (scores.length === 1) {
        // Draw a single dot on the right side indicating a brand new trend
        ctx.fillStyle = strokeColor;
        ctx.arc(width - 4, height / 2, 2.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath(); // Clear the path so stroke() below does nothing
    } else {
        scores.forEach((s, i) => {
            const x = (i / (scores.length - 1)) * width;
            const y = isFlat ? height / 2 : height - ((s - min) / range) * (height - 12) - 10;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
    }
    ctx.stroke();

    // 3. Fill Area (Only if we have movement)
    if (scores.length > 1 && !isFlat) {
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = strokeColor + '22'; // Faint fill
        ctx.fill();
    }
}

/**
 * Side Panel
 */
function openDetailsPanel(trend) {
    const panel = document.getElementById('details-panel');
    const body = document.getElementById('panel-content');
    const title = document.getElementById('panel-title');

    title.textContent = trend.display_name;
    body.innerHTML = `
        <div class="panel-intelligence">
             <div class="stat-row">
                <span>Velocity Score</span>
                <strong>${(trend.velocity || 0).toFixed(2)}</strong>
             </div>
             ${trend.description ? `
             <div class="description-box" style="margin-top: 16px; padding: 12px; border-radius: 8px; background: rgba(0,0,0,0.03); font-size: 13px; line-height: 1.5; color: #4b5563;">
                ${trend.description}
             </div>
             ` : ''}

              ${(trend.metadata && trend.metadata.threads && trend.metadata.threads.length > 0) ? `
              <div class="related-threads-block" style="margin-top: 16px;">
                   <h4 style="font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; margin-bottom: 8px;">Related Coverage</h4>
                   <div class="related-pills" style="display: flex; flex-direction: column; gap: 6px;">
                       ${trend.metadata.threads.map(t => `<a href="${t.url}" target="_blank" style="font-size: 12px; background: rgba(243,244,246,1); color: #374151; padding: 6px 10px; border-radius: 6px; text-decoration: none; border: 1px solid #e5e7eb; transition: background 0.2s ease;">(${t.source.toUpperCase()}) ${toTitleCase(t.title)}</a>`).join('')}
                   </div>
              </div>
              ` : ''}

              ${(trend.metadata && trend.metadata.related_trends && trend.metadata.related_trends.length > 0) ? `
              <div class="related-trends-block" style="margin-top: 16px;">
                   <h4 style="font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; margin-bottom: 8px;">Related Trends</h4>
                   <div class="related-pills" style="display: flex; flex-wrap: wrap; gap: 6px;">
                       ${trend.metadata.related_trends.map(t => `<a href="https://www.google.com/search?q=${encodeURIComponent(t)}" target="_blank" style="font-size: 12px; background: rgba(59,130,246,0.1); color: #2563eb; padding: 4px 10px; border-radius: 12px; text-decoration: none; font-weight: 500; transition: background 0.2s ease;">${toTitleCase(t)}</a>`).join('')}
                   </div>
              </div>
              ` : ''}

              <a href="${trend.primary_url?.startsWith('http') ? trend.primary_url : `https://www.google.com/search?q=${encodeURIComponent(trend.display_name)}`}" class="cta-button" target="_blank" style="margin-top: 16px;">View Original Context for "${toTitleCase(trend.display_name)}"</a>
         </div>
     `;

    panel.classList.remove('hidden');
    setTimeout(() => panel.classList.add('visible'), 10);
}

// Global UI listeners
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-panel');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const panel = document.getElementById('details-panel');
            panel.classList.remove('visible');
            setTimeout(() => panel.classList.add('hidden'), 300);
        });
    }
});

function handleFetchError() {
    const listContainer = document.getElementById('trends-list');
    const errorState = document.getElementById('error-state');
    if (listContainer && listContainer.children.length === 0) {
        errorState.classList.remove('hidden');
    }
}

async function getCachedTrends() {
    return new Promise((resolve) => {
        chrome.storage.local.get([CACHE_KEY, CACHE_TIME_KEY], (result) => {
            if (result[CACHE_KEY]) {
                resolve({ trends: result[CACHE_KEY], timestamp: result[CACHE_TIME_KEY] });
            } else {
                resolve(null);
            }
        });
    });
}

/**
 * Fetch and Render History
 */
async function fetchAndRenderHistory() {
    const container = document.getElementById('history-content');
    if (!container) return;
    
    container.innerHTML = '<div class="loader">Loading history...</div>';
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/trends/history`);
        if (!response.ok) throw new Error('Failed to fetch history');
        
        const data = await response.json();
        const historyData = data.history || [];
        
        if (historyData.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:20px;color:#666;">No daily snapshots recorded yet.</div>';
            return;
        }
        
        container.innerHTML = historyData.map(day => `
            <div style="margin-bottom: 20px; background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 12px;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #111; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
                    📅 ${new Date(day.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                </h3>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${(day.trends || []).map((t, idx) => `
                        <div style="display:flex; align-items:flex-start; gap:10px; background:white; padding:8px; border-radius:6px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                            <div style="font-weight:bold; color:#777; width:20px; text-align:right;">${idx + 1}</div>
                            <div style="flex:1;">
                                <div style="font-size:13px; font-weight:500; color:#222;">${toTitleCase(decodeEntities(t.display_name))}</div>
                                <div style="font-size:11px; color:#888; text-transform:uppercase;">${t.source} • Score: ${Number(t.score).toFixed(1)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
        
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="color:red;padding:10px;">Error loading history.</div>';
    }
}
