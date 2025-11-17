// background.js — Firefox MV3 event page
// Tight history gating: only cancel true pagination. No blanket GET cancels.

const api = (typeof browser !== 'undefined') ? browser : chrome;

let cfg = { blockHistory: true, debug: false };
const intent = new Map();       // tabId -> bool (near top)
const allowUntil = new Map();   // tabId -> ms timestamp

try { api.alarms?.create('tg-ping', { periodInMinutes: 4 }); } catch {}

(async () => {
  try {
    const got = await api.storage.local.get({ blockHistory: true, debug: false });
    cfg.blockHistory = !!got.blockHistory;
    cfg.debug = !!got.debug;
  } catch {}
})();

api.storage.onChanged.addListener((c, area) => {
  if (area !== 'local') return;
  if (c.blockHistory) cfg.blockHistory = !!c.blockHistory.newValue;
  if (c.debug) cfg.debug = !!c.debug.newValue;
});

api.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender?.tab?.id;
  if (typeof tabId !== 'number') return;
  try {
    if (msg?.type === 'historyIntent') {
      intent.set(tabId, !!msg.value);
    } else if (msg?.type === 'toggleBlockHistory') {
      cfg.blockHistory = !!msg.value;
      api.storage.local.set({ blockHistory: cfg.blockHistory });
    } else if (msg?.type === 'requestStatus') {
      return Promise.resolve({
        blockHistory: cfg.blockHistory,
        intent: !!intent.get(tabId),
        allowUntil: allowUntil.get(tabId) || 0
      });
    } else if (msg?.type === 'allowHistoryForMs') {
      const ms = Math.max(2000, Math.min(60000, Number(msg.ms) || 10000));
      const until = Date.now() + ms;
      allowUntil.set(tabId, until);
      setTimeout(() => {
        if ((allowUntil.get(tabId) || 0) <= Date.now()) allowUntil.delete(tabId);
      }, ms + 250);
    }
  } catch (e) {
    console.warn('[TrafficGate] bg onMessage error', e);
  }
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

function isHistoryLoad(details) {
  try {
    const u = new URL(details.url);
    if (!/^(chat\.openai\.com|chatgpt\.com)$/.test(u.hostname)) return false;
    const method = (details.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'POST') return false;

    const p = u.pathname.toLowerCase();

    // Allow-list some essentials outright
    if (/\/api\/auth\/session$/.test(p)) return false;
    if (/\/backend-api\/models$/.test(p)) return false;

    // Consider "history-like" paths but only block when explicit pagination shows up
    const looksHistoryPath = /(backend-api\/conversation|backend-api\/conversations|backend-api\/messages|\/history|\/messages|\/conversation|\/threads|\/graphql|\/gql|\/v1\/messages|\/v1\/threads)/.test(p);
    if (!looksHistoryPath) return false;

    // Only treat as history when pagination markers are present
    return hasPagination(u);
  } catch { return false; }
}

try {
  api.webRequest?.onBeforeRequest.addListener(
    (details) => {
      try {
        if (!cfg.blockHistory) return {};
        if (details.type !== 'xmlhttprequest' && details.type !== 'fetch') return {};
        const tabId = details.tabId;
        const now = Date.now();
        const okByTimer = (allowUntil.get(tabId) || 0) > now;
        const okByIntent = !!intent.get(tabId);
        if (!okByTimer && !okByIntent && isHistoryLoad(details)) {
          if (cfg.debug) console.log('[TrafficGate] CANCEL', details.url);
          return { cancel: true };
        }
      } catch (e) { console.warn('[TrafficGate] onBeforeRequest', e); }
      return {};
    },
    { urls: ['https://chat.openai.com/*', 'https://chatgpt.com/*'] },
    ['blocking', 'requestBody']
  );
} catch {}
