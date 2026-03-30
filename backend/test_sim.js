const token = 'cfut_PW01jk8TIc3kAsrxhX3hYfjWP4uWoYy3wTYh2yBi915b5710';
const acc = 'bae57b9961b236f21aaf609ff302742c';
async function getEmb(text) {
    const res = await fetch(\https://api.cloudflare.com/client/v4/accounts/\/ai/run/@cf/baai/bge-large-en-v1.5\, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({text:[text]}) });
    return (await res.json()).result.data[0];
}
function cosSim(A, B) {
    let dot = 0, normA = 0, normB = 0;
    for(let i=0; i<A.length; i++) { dot += A[i]*B[i]; normA += A[i]*A[i]; normB += B[i]*B[i]; }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
async function run() {
    let t1 = "Michael B. Jordan";
    let t2 = "Sinners (2025 film)";
    let e1 = await getEmb(t1); let e2 = await getEmb(t2);
    console.log("TITLE ONLY:", cosSim(e1, e2));
    
    let d1 = "Michael B. Jordan: Michael Bakari Jordan is an American actor, producer, and director.";
    let d2 = "Sinners (2025 film): Sinners is a 2025 American film produced, written, and directed by Ryan Coogler. The film stars Michael B. Jordan in dual roles.";
    let f1 = await getEmb(d1); let f2 = await getEmb(d2);
    console.log("WITH DESC:", cosSim(f1, f2));
}
run();
