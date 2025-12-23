/**
 * AI Chatbot Widget - Cloudflare Worker
 * Workers AI (streaming) + Vectorize (RAG) + KV (sessions)
 */

interface Env { AI: Ai; VECTORIZE: VectorizeIndex; CHAT_SESSIONS: KVNamespace; ASSETS: Fetcher; }
interface Msg { role: 'user' | 'assistant' | 'system'; content: string; timestamp: number; }
interface Session { id: string; messages: Msg[]; createdAt: number; updatedAt: number; }

const SYSTEM = `You are a helpful customer support assistant for TechGadgets, an online electronics store.
Be friendly, professional, and concise. Use the FAQ context to give accurate answers.
If you don't know something, say so. For order-specific questions, ask for the order number.`;

const json = (data: unknown, status = 200, extra: HeadersInit = {}) => 
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...extra } });

const getCookie = (req: Request) => req.headers.get('Cookie')?.match(/chatbot_session=([^;]+)/)?.[1];
const setCookie = (id: string) => `chatbot_session=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;

async function embed(env: Env, text: string) {
  const r = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [text] });
  if ('data' in r && r.data) return r.data[0];
  throw new Error('Embedding failed');
}

async function searchFAQ(env: Env, query: string) {
  try {
    const results = await env.VECTORIZE.query(await embed(env, query), { topK: 3, returnMetadata: 'all' });
    return results.matches.map(m => `Q: ${m.metadata?.question}\nA: ${m.metadata?.answer}`).join('\n\n');
  } catch (e) { console.error('FAQ search error:', e); return ''; }
}

async function handleChat(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  
  const { message } = await req.json() as { message: string };
  if (!message?.trim()) return json({ error: 'Message required' }, 400);

  let sessId = getCookie(req), isNew = false;
  let sess: Session | null = sessId ? await env.CHAT_SESSIONS.get(sessId, 'json') : null;
  if (!sess) { sessId = 'sess_' + crypto.randomUUID(); sess = { id: sessId, messages: [], createdAt: Date.now(), updatedAt: Date.now() }; isNew = true; }

  sess.messages.push({ role: 'user', content: message.trim(), timestamp: Date.now() });
  const context = await searchFAQ(env, message);
  const msgs = [{ role: 'system' as const, content: SYSTEM + (context ? `\n\nFAQ:\n${context}` : '') }, ...sess.messages.slice(-10).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))];

  const stream = await env.AI.run('@cf/meta/llama-3-8b-instruct', { messages: msgs, stream: true });
  let full = '';
  const { readable, writable } = new TransformStream({
    transform(chunk, ctrl) {
      const text = new TextDecoder().decode(chunk);
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ') && line.slice(6) !== '[DONE]') {
          try { full += JSON.parse(line.slice(6)).response || ''; } catch {}
        }
      }
      ctrl.enqueue(chunk);
    },
    async flush() {
      if (full) { sess!.messages.push({ role: 'assistant', content: full, timestamp: Date.now() }); sess!.updatedAt = Date.now(); await env.CHAT_SESSIONS.put(sessId!, JSON.stringify(sess), { expirationTtl: 30 * 24 * 60 * 60 }); }
    }
  });
  (stream as ReadableStream).pipeTo(writable);
  return new Response(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*', ...(isNew ? { 'Set-Cookie': setCookie(sessId!) } : {}) } });
}

async function handleHistory(req: Request, env: Env) {
  const id = getCookie(req);
  const sess = id ? await env.CHAT_SESSIONS.get<Session>(id, 'json') : null;
  return json({ messages: sess?.messages || [] });
}

async function handleSeed(req: Request, env: Env) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const faqs = [
    { id: 'faq-1', q: 'How long does shipping take?', a: 'Standard 5-7 days, Express 2-3 days, Same-day in select areas.' },
    { id: 'faq-2', q: 'What is your return policy?', a: '30-day returns for unused items. Electronics 15 days if defective.' },
    { id: 'faq-3', q: 'Do you offer free shipping?', a: 'Yes! Orders over $50 get free standard shipping.' },
    { id: 'faq-4', q: 'How can I track my order?', a: 'Check your email for tracking or log into your account.' },
    { id: 'faq-5', q: 'What payment methods do you accept?', a: 'Visa, Mastercard, Amex, PayPal, Apple Pay, Google Pay.' },
    { id: 'faq-6', q: 'Do you have a warranty?', a: "All products have manufacturer warranty. Extended plans available." },
    { id: 'faq-7', q: 'Can I cancel my order?', a: 'Within 1 hour if not processed. Otherwise return after delivery.' },
    { id: 'faq-8', q: 'Do you ship internationally?', a: 'Yes, 50+ countries. 7-14 days. Duties paid by customer.' },
  ];
  try {
    const vectors = await Promise.all(faqs.map(async f => ({ id: f.id, values: await embed(env, f.q + ' ' + f.a), metadata: { question: f.q, answer: f.a } })));
    await env.VECTORIZE.upsert(vectors);
    return json({ success: true, count: faqs.length });
  } catch (e) { return json({ error: 'Seed failed' }, 500); }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const path = new URL(req.url).pathname;
    if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    if (path === '/api/chat') return handleChat(req, env);
    if (path === '/api/history') return handleHistory(req, env);
    if (path === '/api/seed') return handleSeed(req, env);
    if (path === '/api/health') return json({ status: 'ok' });
    return env.ASSETS.fetch(req);
  }
} satisfies ExportedHandler<Env>;
