async function fetchLiveNewsContext(query) {
    try {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
        const res = await fetch(url);
        const text = await res.text();
        const matches = text.match(/<title>(.*?)<\/title>/g);
        if (!matches) return 'NO MATCHES';
        const headlines = matches.slice(1, 4).map(m => m.replace(/<\/?title>/g, '').replace(/&apos;/g, "'").replace(/&quot;/g, '"'));
        return headlines.join(' | ');
    } catch (e) { return 'ERROR: ' + e.message; }
}
async function test() {
    console.log('JOE KENT:', await fetchLiveNewsContext('Joe Kent'));
    console.log('MICHAEL B JORDAN:', await fetchLiveNewsContext('Michael B. Jordan'));
    console.log('SPIDERMAN:', await fetchLiveNewsContext('Spider-Man: Brand New Day'));
}
test();
