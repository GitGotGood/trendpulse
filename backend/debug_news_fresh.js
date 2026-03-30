async function fetchLiveNewsContext(query, fresh = false) {
    try {
        const url = fresh 
            ? `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+when:24h&hl=en-US&gl=US&ceid=US:en`
            : `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
        const res = await fetch(url);
        const text = await res.text();
        const matches = text.match(/<title>(.*?)<\/title>/g);
        if (!matches) return 'NO MATCHES';
        const headlines = matches.slice(1, 4).map(m => m.replace(/<\/?title>/g, '').replace(/&apos;/g, "'").replace(/&quot;/g, '"'));
        return (fresh ? '[FRESH] ' : '[STD] ') + headlines.join(' | ');
    } catch (e) { return 'ERROR: ' + e.message; }
}
async function test() {
    console.log(await fetchLiveNewsContext('Michael B. Jordan', false));
    console.log(await fetchLiveNewsContext('Michael B. Jordan', true));
}
test();
