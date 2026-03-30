import { WikipediaAdapter } from './adapters/wikipedia';
import { GoogleAdapter } from './adapters/google';
import { GoogleBlockbusterAdapter } from './adapters/google_bb';
import { BingAdapter } from './adapters/bing';
import { RedditAdapter } from './adapters/reddit';
import { YouTubeAdapter } from './adapters/youtube';
import { TrendService } from './services';

export interface Env {
    DB: any;
    AI: any;
    VECTORIZE: any;
}

export default {
    async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
        const url = new URL(request.url);

        const dbAdapter: any = {
            prepare: (q: string) => ({
                bind: (...args: any[]) => ({
                    all: () => env.DB.prepare(q).bind(...args).all(),
                    run: () => env.DB.prepare(q).bind(...args).run(),
                    first: () => env.DB.prepare(q).bind(...args).first()
                }),
                all: () => env.DB.prepare(q).all()
            })
        };

        const trendService = new TrendService(dbAdapter, env.AI, env.VECTORIZE);

        if (url.pathname === '/health') return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });

        if (url.pathname === '/api/trends/latest') {
            try {
                const response = await trendService.getLatestTrends('US');
                return new Response(JSON.stringify(response), {
                    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
                });
            } catch (e: any) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
            }
        }

        if (url.pathname === '/api/debug/poll' && request.method === 'POST') {
            try {
                // Perform fetches synchronously but offload the heavy AI/DB work to ctx.waitUntil
                const adapters = [new WikipediaAdapter(), new RedditAdapter()];
                const results: any[] = [];
                const allTrends: any[] = [];

                for (const adapter of adapters) {
                    try {
                        const trends = await adapter.fetchTrends(env);
                        allTrends.push(...trends);
                        results.push({ source: adapter.sourceName, count: trends.length });
                    } catch (e: any) {
                        results.push({ source: adapter.sourceName, error: e.message });
                    }
                }

                // IMPORTANT: Process the heavy lifing in the background to avoid 500 (CPU Timeout)
                if (allTrends.length > 0) {
                    ctx.waitUntil(trendService.upsertTrends(allTrends));
                }

                return new Response(JSON.stringify({ success: true, results, note: 'Ingestion running in background' }), {
                    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
                });
            } catch (error: any) {
                return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
            }
        }

        if (url.pathname === '/api/pulse/inject' && request.method === 'POST') {
            try {
                const body: any = await request.json();
                
                // Add your shared secret as an Environment Variable (API_SECRET) later, 
                // but for now we hardcode a basic check to prevent spam
                if (!body.secret || body.secret !== (env as any).TRENDPULSE_API_SECRET && body.secret !== 'local-dev-secret') {
                    return new Response('Unauthorized', { status: 401 });
                }

                if (!body.trends || !Array.isArray(body.trends) || body.trends.length === 0) {
                    return new Response('No trends provided', { status: 400 });
                }

                ctx.waitUntil(trendService.upsertTrends(body.trends));
                
                return new Response(JSON.stringify({ success: true, count: body.trends.length, status: "Ingesting in background" }), {
                    headers: { 'Content-Type': 'application/json; charset=utf-8' }
                });
            } catch (error: any) {
                return new Response(JSON.stringify({ error: error.message }), { status: 500 });
            }
        }

        if (url.pathname === '/api/debug/db') {
            const response = await trendService.getLatestTrends('US');
            const rows = response.trends.map(t => `
                <tr style="border-bottom:1px solid #eee">
                    <td style="padding:10px;text-transform:uppercase;font-size:12px;font-weight:bold">${t.source}</td>
                    <td style="padding:10px">
                        <div style="font-weight:bold">${t.display_name}</div>
                        <div style="font-size:11px;color:#666">${t.description?.substring(0, 100) || 'Durable capture...'}</div>
                    </td>
                    <td style="padding:10px;color:#007bff;font-weight:bold">${t.score.toFixed(1)}</td>
                    <td style="padding:10px;font-size:11px;color:#999">${new Date(t.last_seen_at).toLocaleTimeString()}</td>
                </tr>
            `).join('');

            return new Response(`
                <html><head><meta charset="UTF-8"></head><body style="font-family:sans-serif;max-width:800px;margin:20px auto">
                    <h1>TrendPulse Explorer 🚀⚓✨</h1>
                    <table style="width:100\%;border-collapse:collapse">${rows}</table>
                    <form action="/api/debug/poll" method="POST"><button style="margin-top:20px;padding:10px">Force Global Sync</button></form>
                </body></html>
            `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }

        if (url.pathname === '/api/debug/reset' && request.method === 'POST') {
            await env.DB.prepare('DELETE FROM trends').run();
            return new Response(JSON.stringify({ success: true }), { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        return new Response('Not Found', { status: 404 });
    },

    async scheduled(event: any, env: Env, ctx: any) {
        const dbAdapter: any = {
            prepare: (q: string) => ({
                bind: (...args: any[]) => ({
                    all: () => env.DB.prepare(q).bind(...args).all(),
                    run: () => env.DB.prepare(q).bind(...args).run(),
                    first: () => env.DB.prepare(q).bind(...args).first()
                }),
                all: () => env.DB.prepare(q).all()
            })
        };
        const trendService = new TrendService(dbAdapter, env.AI, env.VECTORIZE);
        const adapters = [new WikipediaAdapter(), new RedditAdapter()];
        const allTrends: any[] = [];
        for (const adapter of adapters) {
            try {
                const trends = await adapter.fetchTrends(env);
                allTrends.push(...trends);
            } catch (e) {}
        }
        if (allTrends.length > 0) ctx.waitUntil(trendService.upsertTrends(allTrends));
    }
};
