async function run(query) {
    const res = await fetch(\https://news.google.com/rss/search?q=\&hl=en-US&gl=US&ceid=US:en\);
    const text = await res.text();
    const matches = text.match(/<title>(.*?)<\/title>/g);
    if (!matches) return console.log('No matches for', query);
    const headlines = matches.slice(1, 4).map(m => m.replace(/<\/?title>/g, '').replace(/&apos;/g, "'").replace(/&quot;/g, '"'));
    console.log(query, '->', headlines);
}
run('Michael B. Jordan');
run('One Battle After Another');
