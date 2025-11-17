// content/net-guard.js — document_start guard with SAFE JSON thinning

(() => {
  'use strict';
  const HOSTS = /^(chat\.openai\.com|chatgpt\.com)$/;
  const PATHS = /(backend-api\/conversation|backend-api\/conversations|backend-api\/messages|\/history|\/messages|\/conversation|\/threads|\/graphql|\/gql|\/v1\/messages|\/v1\/threads)/i;
  const KEEP = 60;

  const api = (typeof browser !== 'undefined') ? browser : chrome;
  const gate = { enabled: true, intent: false, allowUntil: 0 };

  const tlog = (...args) => { try { window.__tgTelemetry?.apply(null, args); } catch {} };

  (async () => {
    try {
      const s = await api.storage.local.get({ blockHistory: true });
      gate.enabled = !!s.blockHistory;
    } catch {}
    try {
      const r = await api.runtime.sendMessage({ type: 'requestStatus' });
      if (r) { gate.enabled = !!r.blockHistory; gate.intent = !!r.intent; gate.allowUntil = Number(r.allowUntil || 0); }
    } catch {}
  })();

  Object.defineProperty(window, '__chatTrafficGate', {
    value: {
      setEnabled(v) { gate.enabled = !!v; },
      setIntent(v) { gate.intent = !!v; },
      allowForMs(ms) { gate.allowUntil = Date.now() + Math.max(2000, Math.min(60000, Number(ms)||10000)); }
    },
    writable: false, configurable: false, enumerable: false
  });

  function hasPagination(u) {
    try {
      const q = u.searchParams;
      if (q.has('cursor') || q.has('before')) return true;
      if (q.has('offset') && Number(q.get('offset')) > 0) return true;
      if (q.has('page') && Number(q.get('page')) > 1) return true;
      const dir = (q.get('direction') || '').toLowerCase();
      if (/back|prev|previous/.test(dir)) return true;
    } catch {}
    return false;
  }
  function looksHistory(url) {
    try {
      const u = (typeof url === 'string') ? new URL(url, location.href) : (url instanceof URL ? url : null);
      if (!u) return false;
      if (!HOSTS.test(u.hostname)) return false;
      if (!PATHS.test(u.pathname)) return false;
      return hasPagination(u);
    } catch { return false; }
  }

  function shouldBlock(method, url) {
    const now = Date.now();
    return gate.enabled && (now < gate.allowUntil ? false : !gate.intent) &&
           (method === 'GET' || method === 'POST') && looksHistory(url);
  }

  async function thinIfNeeded(res) {
    try {
      const ct = res.headers.get('content-type') || '';
      if (!/application\/json|json/.test(ct)) return res;
      const clone = res.clone();
      const data = await clone.json();
      let changed = false;

      // Only thin *large* payloads to avoid breaking expectations
      if (Array.isArray(data?.messages) && data.messages.length > KEEP + 10) {
        data.messages.sort((a, b) => (a.create_time || 0) - (b.create_time || 0));
        data.messages = data.messages.slice(-KEEP);
        changed = true;
      } else if (data?.mapping && typeof data.mapping === 'object') {
        const ids = Object.keys(data.mapping);
        if (ids.length > KEEP + 10) {
          const arr = ids.map(id => ({ id, t: data.mapping[id]?.message?.create_time || 0 }))
                         .sort((a,b)=>a.t-b.t)
                         .slice(-KEEP);
          const newMap = {};
          for (const x of arr) newMap[x.id] = data.mapping[x.id];
          data.mapping = newMap;
          changed = true;
        }
      } else if (Array.isArray(data?.items) && data.items.length > KEEP + 10) {
        data.items = data.items.slice(-KEEP);
        changed = true;
      }

      if (!changed) return res;
      const headers = new Headers(res.headers);
      try { headers.delete('content-length'); } catch {}
      if (!headers.get('content-type')) headers.set('content-type', 'application/json; charset=utf-8');
      const body = JSON.stringify(data);
      return new Response(body, { status: res.status, statusText: res.statusText, headers });
    } catch {
      return res;
    }
  }

  const _fetch = window.fetch;
  if (typeof _fetch === 'function') {
    window.fetch = async function patchedFetch(input, init) {
      try {
        const method = ((init && init.method) || 'GET').toUpperCase();
        const url = (input && input.url) ? input.url : String(input);
        if (shouldBlock(method, url)) {
          tlog('historyCancel');
          const err = new DOMException('Blocked by Chat Traffic Gate', 'AbortError');
          return Promise.reject(err);
        }
        const p = _fetch.apply(this, arguments);
        // Thin only paginated history responses
        if (looksHistory(url)) {
          const res = await p;
          return thinIfNeeded(res);
        }
        return p;
      } catch {}
      return _fetch.apply(this, arguments);
    };
  }

  const XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    const _open = XHR.prototype.open, _send = XHR.prototype.send;
    XHR.prototype.open = function(method, url) {
      try { this.__tgMethod = String(method||'GET').toUpperCase(); this.__tgURL = url; } catch {}
      return _open.apply(this, arguments);
    };
    XHR.prototype.send = function(body) {
      try {
        if (shouldBlock(this.__tgMethod, this.__tgURL)) {
          try{ this.abort(); }catch{}; try{ this.dispatchEvent(new Event('error')); }catch{};
          tlog('historyCancel'); return;
        }
      } catch {}
      return _send.apply(this, arguments);
    };
  }
})();
