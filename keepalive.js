// content/keepalive.js — keep session warm; no auto-reload by default (safer)

(function() {
  'use strict';
  const api = (typeof browser !== 'undefined') ? browser : chrome;
  const tlog = (...args) => { try { window.__tgTelemetry?.apply(null, args); } catch {} };

  const state = {
    enabled: true,
    minutes: 4,
    autoReconnect: true,
    allowReloads: false,   // SAFE DEFAULT: off
    lastReload: 0,
    chosenPath: null,
    lastActivity: Date.now()
  };

  Object.defineProperty(window, '__chatKeepalive', {
    value: {
      setEnabled(v){ state.enabled = !!v; schedule(); },
      setMinutes(m){ m = Math.max(2, Math.min(30, Math.floor(m||state.minutes))); state.minutes = m; schedule(); },
      setAutoReconnect(v){ state.autoReconnect = !!v; },
      setAllowReloads(v){ state.allowReloads = !!v; },
      reconnectNow(){ tryClickRetry() || (state.allowReloads && softReload()); }
    },
    writable: false, configurable: false, enumerable: false
  });

  (async () => {
    try {
      const got = await api.storage.local.get({ keepaliveEnabled: true, keepaliveMinutes: 4, autoReconnect: true, allowReloads: false });
      state.enabled = !!got.keepaliveEnabled;
      state.minutes = Number(got.keepaliveMinutes) || 4;
      state.autoReconnect = !!got.autoReconnect;
      state.allowReloads = !!got.allowReloads;
      schedule();
    } catch {}
  })();

  try { new MutationObserver(() => { state.lastActivity = Date.now(); }).observe(document.documentElement, { subtree: true, childList: true }); } catch {}

  async function pickEndpoint() {
    const candidates = [
      '/api/auth/session',
      '/backend-api/models',
      '/backend-api/conversations?offset=0&limit=1',
      '/favicon.ico',
      '/'
    ];
    for (const path of candidates) { try { if (await headOrGet(path)) return path; } catch {} }
    return '/';
  }

  async function headOrGet(path) {
    const url = new URL(path, location.origin).toString();
    try {
      const ctl = new AbortController(); const t = setTimeout(()=>ctl.abort(), 6000);
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store', credentials: 'include', keepalive: true, signal: ctl.signal });
      clearTimeout(t);
      return !!res && (res.ok || res.type === 'opaqueredirect');
    } catch {}
    try {
      const ctl = new AbortController(); const t = setTimeout(()=>ctl.abort(), 6000);
      const res = await fetch(url, { method: 'GET', cache: 'no-store', credentials: 'include', keepalive: true, signal: ctl.signal, mode: 'same-origin' });
      clearTimeout(t);
      return !!res && (res.ok || res.type === 'opaqueredirect');
    } catch {}
    try {
      if (document.visibilityState !== 'visible' && 'sendBeacon' in navigator) {
        const blob = new Blob([], { type: 'application/octet-stream' });
        navigator.sendBeacon(url, blob);
        return true;
      }
    } catch {}
    return false;
  }

  let timer = null;
  function schedule() {
    if (timer) clearInterval(timer);
    if (!state.enabled) return;
    const base = Math.max(2, Math.min(30, state.minutes));
    const jitter = 0.25 + Math.random() * 0.25;
    const ms = Math.floor(base * jitter * 60000);
    timer = setInterval(ping, ms);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(ping, 1200); }, { passive: true });
    setTimeout(ping, 3000);
  }

  async function ping() {
    if (!state.enabled) return;
    if (!state.chosenPath) state.chosenPath = await pickEndpoint();
    try { await headOrGet(state.chosenPath); tlog('ping'); } catch {}
  }

  function visible() { return document.visibilityState === 'visible'; }
  function notTyping() {
    const ae = document.activeElement;
    return !(ae && (ae.tagName === 'TEXTAREA' || (ae.tagName === 'INPUT' && /text|search|url|email|password/.test(ae.type||''))));
  }

  function tryClickRetry() {
    const labels = ['reload','retry','try again','reconnect'];
    const btns = Array.from(document.querySelectorAll('button, a[role="button"]'));
    for (const b of btns) {
      const t = (b.textContent||'').trim().toLowerCase();
      if (labels.some(L => t.includes(L))) { b.click(); tlog('retryClick'); return true; }
    }
    return false;
  }

  function softReload() {
    const now = Date.now();
    if (now - state.lastReload < 30000) return;
    if (!visible() || !notTyping()) return;
    state.lastReload = now;
    tlog('softReload');
    location.reload();
  }

  const kw = /(trying to reconnect|attempting to connect|reconnecting|network error|disconnected|lost connection)/i;
  const moErr = new MutationObserver((muts) => {
    if (!state.autoReconnect) return;
    for (const m of muts) for (const n of (m.addedNodes || [])) {
      if (n.nodeType === 1) {
        const txt = (n.textContent||'').slice(0, 4096);
        if (kw.test(txt)) { tlog('disconnect'); if (!tryClickRetry() && state.allowReloads) setTimeout(softReload, 2500); return; }
      }
    }
  });
  moErr.observe(document.documentElement || document.body, { childList: true, subtree: true });

  window.addEventListener('online', () => { if (state.autoReconnect && state.allowReloads) setTimeout(() => { if (!tryClickRetry()) softReload(); }, 1200); });
})();
