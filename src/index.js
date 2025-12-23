/** AI Chatbot Widget - Cloudflare Worker */
const SYS = `You are a helpful customer support assistant. Be friendly, professional, and concise. Use the FAQ context to give accurate answers. If you don't know something, say so.`;
const TTL = 30*24*60*60;
const cors = { 'Access-Control-Allow-Origin': '*' };
const json = (d, s=200, h={}) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...cors, ...h } });
const cookie = r => r.headers.get('Cookie')?.match(/chatbot_session=([^;]+)/)?.[1];

async function faq(env, q) {
  try {
    const e = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [q] });
    if (!e.data) return '';
    const r = await env.VECTORIZE.query(e.data[0], { topK: 3, returnMetadata: 'all' });
    return r.matches.map(m => `Q: ${m.metadata?.question}\nA: ${m.metadata?.answer}`).join('\n\n');
  } catch { return ''; }
}

async function chat(req, env) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const { message } = await req.json();
  if (!message?.trim()) return json({ error: 'Message required' }, 400);

  let sid = cookie(req), isNew = !sid;
  let sess = sid ? await env.CHAT_SESSIONS.get(sid, 'json') : null;
  if (!sess) { sid = 'sess_' + crypto.randomUUID(); sess = { id: sid, messages: [], createdAt: Date.now(), updatedAt: Date.now() }; isNew = true; }

  sess.messages.push({ role: 'user', content: message.trim(), timestamp: Date.now() });
  const ctx = await faq(env, message);
  const msgs = [{ role: 'system', content: SYS + (ctx ? `\n\nFAQ:\n${ctx}` : '') }, ...sess.messages.slice(-10).map(m => ({ role: m.role, content: m.content }))];

  const stream = await env.AI.run('@cf/meta/llama-3-8b-instruct', { messages: msgs, stream: true });
  let full = '';
  const { readable, writable } = new TransformStream({
    transform(chunk, ctrl) {
      for (const ln of new TextDecoder().decode(chunk).split('\n'))
        if (ln.startsWith('data: ') && ln.slice(6) !== '[DONE]') try { full += JSON.parse(ln.slice(6)).response || ''; } catch {}
      ctrl.enqueue(chunk);
    },
    async flush() {
      if (full) { sess.messages.push({ role: 'assistant', content: full, timestamp: Date.now() }); sess.updatedAt = Date.now(); await env.CHAT_SESSIONS.put(sid, JSON.stringify(sess), { expirationTtl: TTL }); }
    }
  });
  stream.pipeTo(writable);
  return new Response(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', ...cors, ...(isNew ? { 'Set-Cookie': `chatbot_session=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL}` } : {}) } });
}

async function seed(req, env) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const faqs = [
    ['How long does shipping take?', 'Standard 5-7 days, Express 2-3 days, Same-day in select areas.'],
    ['What is your return policy?', '30-day returns for unused items. Electronics 15 days if defective.'],
    ['Do you offer free shipping?', 'Yes! Orders over $50 get free standard shipping.'],
    ['How can I track my order?', 'Check your email for tracking or log into your account.'],
    ['What payment methods do you accept?', 'Visa, Mastercard, Amex, PayPal, Apple Pay, Google Pay.'],
    ['Do you have a warranty?', 'All products have manufacturer warranty. Extended plans available.'],
    ['Can I cancel my order?', 'Within 1 hour if not processed. Otherwise return after delivery.'],
    ['Do you ship internationally?', 'Yes, 50+ countries. 7-14 days. Duties paid by customer.'],
  ];
  try {
    const vecs = await Promise.all(faqs.map(async ([q,a], i) => {
      const e = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [q+' '+a] });
      return { id: `faq-${i+1}`, values: e.data?.[0] || [], metadata: { question: q, answer: a } };
    }));
    await env.VECTORIZE.upsert(vecs);
    return json({ success: true, count: faqs.length });
  } catch { return json({ error: 'Seed failed' }, 500); }
}

export default {
  async fetch(req, env) {
    const p = new URL(req.url).pathname;
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    if (p === '/api/chat') return chat(req, env);
    if (p === '/api/history') { const s = cookie(req); return json({ messages: s ? (await env.CHAT_SESSIONS.get(s, 'json'))?.messages || [] : [] }); }
    if (p === '/api/seed') return seed(req, env);
    if (p === '/api/health') return json({ status: 'ok' });
    return env.ASSETS.fetch(req);
  }
};
