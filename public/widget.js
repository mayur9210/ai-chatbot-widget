/**
 * AI Chatbot Widget - Embeddable Script
 * Usage: <script src="https://your-domain.com/widget.js"></script>
 */
(function() {
  'use strict';

  const CFG = {
    baseUrl: window.CHATBOT_BASE_URL || '',
    title: window.CHATBOT_TITLE || 'AI Assistant',
    placeholder: window.CHATBOT_PLACEHOLDER || 'Message...',
    greeting: window.CHATBOT_GREETING || '👋 Hi! How can I help you today?',
  };

  let isOpen = false, messages = [], isTyping = false, isMenuOpen = false;
  let isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  const $ = id => document.getElementById(id);
  const toggle = (el, cls, on) => el.classList.toggle(cls, on);

  function init() {
    // Load styles
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CFG.baseUrl + '/styles.css';
    document.head.appendChild(link);

    // Create widget
    const div = document.createElement('div');
    div.id = 'cb';
    div.innerHTML = `
      <button id="cb-btn" class="fixed bottom-6 right-6 w-14 h-14 bg-black rounded-full shadow-2xl flex items-center justify-center cursor-pointer hover:scale-110 transition-all duration-300 z-[99999]">
        <svg id="cb-ico-open" class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        <svg id="cb-ico-close" class="w-6 h-6 text-white absolute opacity-0 scale-50 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
      <div id="cb-win" class="fixed bottom-24 right-6 w-[400px] h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[99999] opacity-0 scale-95 pointer-events-none transition-all duration-300 origin-bottom-right bg-white dark:bg-gray-900">
        <div class="flex items-center justify-between px-5 py-4 border-b bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-black rounded-full flex items-center justify-center"><span class="text-white font-bold text-lg">C</span></div>
            <h3 class="font-semibold text-gray-900 dark:text-white">${CFG.title}</h3>
          </div>
          <div class="relative">
            <button id="cb-menu" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><svg class="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg></button>
            <div id="cb-drop" class="hidden absolute right-0 top-full mt-2 w-44 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-50">
              <button id="cb-theme" class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                <svg id="cb-sun" class="w-4 h-4 hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/></svg>
                <svg id="cb-moon" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                <span id="cb-theme-txt">Dark Mode</span>
              </button>
              <button id="cb-clear" class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Clear Chat
              </button>
            </div>
          </div>
        </div>
        <div id="cb-msgs" class="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-gray-50 dark:bg-gray-950"></div>
        <div id="cb-typing" class="hidden px-5 pb-2 bg-gray-50 dark:bg-gray-950">
          <div class="flex items-center gap-2 text-gray-400 text-sm"><div class="flex gap-1"><span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span><span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay:.15s"></span><span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay:.3s"></span></div>Thinking...</div>
        </div>
        <form id="cb-form" class="flex items-center gap-3 px-4 py-4 border-t bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800">
          <input id="cb-input" type="text" class="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600" placeholder="${CFG.placeholder}" autocomplete="off"/>
          <button type="submit" id="cb-send" class="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full disabled:opacity-50"><svg class="w-5 h-5 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z"/></svg></button>
        </form>
      </div>`;
    document.body.appendChild(div);
    bindEvents();
    loadHistory();
    applyTheme();
  }

  function bindEvents() {
    $('cb-btn').onclick = toggleChat;
    $('cb-form').onsubmit = handleSubmit;
    $('cb-menu').onclick = e => { e.stopPropagation(); isMenuOpen = !isMenuOpen; toggle($('cb-drop'), 'hidden', !isMenuOpen); };
    $('cb-theme').onclick = () => { isDark = !isDark; applyTheme(); isMenuOpen = false; toggle($('cb-drop'), 'hidden', true); };
    $('cb-clear').onclick = () => { messages = []; render(); isMenuOpen = false; toggle($('cb-drop'), 'hidden', true); };
    document.onclick = () => { if (isMenuOpen) { isMenuOpen = false; toggle($('cb-drop'), 'hidden', true); } };
    window.matchMedia('(prefers-color-scheme: dark)').onchange = e => { isDark = e.matches; applyTheme(); };
  }

  function applyTheme() {
    toggle($('cb'), 'dark', isDark);
    $('cb-theme-txt').textContent = isDark ? 'Light Mode' : 'Dark Mode';
    toggle($('cb-sun'), 'hidden', !isDark);
    toggle($('cb-moon'), 'hidden', isDark);
  }

  function toggleChat() {
    isOpen = !isOpen;
    const win = $('cb-win'), icoO = $('cb-ico-open'), icoC = $('cb-ico-close');
    toggle(win, 'opacity-0', !isOpen); toggle(win, 'scale-95', !isOpen); toggle(win, 'pointer-events-none', !isOpen);
    toggle(win, 'opacity-100', isOpen); toggle(win, 'scale-100', isOpen);
    toggle(icoO, 'opacity-0', isOpen); toggle(icoO, 'scale-50', isOpen);
    toggle(icoC, 'opacity-0', !isOpen); toggle(icoC, 'scale-50', !isOpen);
    toggle(icoC, 'opacity-100', isOpen); toggle(icoC, 'scale-100', isOpen);
    if (isOpen) { $('cb-input').focus(); if (!messages.length) addMsg('assistant', CFG.greeting); }
  }

  function addMsg(role, content) { messages.push({ role, content }); render(); }

  function render() {
    $('cb-msgs').innerHTML = messages.map((m, i) => m.role === 'user'
      ? `<div class="flex justify-end"><div class="bg-black text-white rounded-2xl rounded-br-md px-4 py-3 max-w-[85%]"><div id="m${i}" class="text-sm whitespace-pre-wrap">${esc(m.content)}</div></div></div>`
      : `<div class="flex justify-start"><div class="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%] border border-gray-200 dark:border-gray-700 shadow-sm">
          <div class="flex items-center gap-2 mb-2"><div class="w-6 h-6 bg-black rounded-full flex items-center justify-center"><span class="text-white font-bold text-xs">C</span></div><span class="text-sm font-medium text-gray-700 dark:text-gray-300">${CFG.title}</span></div>
          <div id="m${i}" class="text-sm leading-relaxed whitespace-pre-wrap">${esc(m.content)}</div></div></div>`
    ).join('');
    $('cb-msgs').scrollTop = $('cb-msgs').scrollHeight;
  }

  function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML.replace(/\n/g, '<br>'); }

  async function handleSubmit(e) {
    e.preventDefault();
    const msg = $('cb-input').value.trim();
    if (!msg || isTyping) return;
    addMsg('user', msg);
    $('cb-input').value = '';
    $('cb-send').disabled = true;
    isTyping = true;
    toggle($('cb-typing'), 'hidden', false);

    try {
      const res = await fetch(CFG.baseUrl + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }), credentials: 'include' });
      if (!res.ok) throw new Error();
      const reader = res.body.getReader(), decoder = new TextDecoder();
      let txt = '', idx = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6);
          if (d === '[DONE]') continue;
          try {
            const p = JSON.parse(d);
            if (p.response) {
              txt += p.response;
              if (idx === null) { toggle($('cb-typing'), 'hidden', true); isTyping = false; messages.push({ role: 'assistant', content: txt }); idx = messages.length - 1; render(); }
              else { messages[idx].content = txt; const el = $('m' + idx); if (el) el.innerHTML = esc(txt); }
              $('cb-msgs').scrollTop = $('cb-msgs').scrollHeight;
            }
          } catch {}
        }
      }
    } catch { toggle($('cb-typing'), 'hidden', true); isTyping = false; addMsg('assistant', 'Sorry, an error occurred.'); }
    finally { $('cb-send').disabled = false; isTyping = false; toggle($('cb-typing'), 'hidden', true); }
  }

  async function loadHistory() {
    try { const r = await fetch(CFG.baseUrl + '/api/history', { credentials: 'include' }); if (r.ok) { const d = await r.json(); if (d.messages?.length) { messages = d.messages; render(); } } } catch {}
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
