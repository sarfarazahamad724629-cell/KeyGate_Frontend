const KEY_PREFIX = 'lethem_cache_';
const LEGACY_PREFIX = 'kg_cache_';
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000;

function currentScope() {
  if (typeof window !== 'undefined' && window.__LETHEM_CACHE_SCOPE) return window.__LETHEM_CACHE_SCOPE;
  return 'public';
}

function safeScope(scope) {
  return String(scope || currentScope()).replace(/[^a-zA-Z0-9._:-]/g, '_');
}

function cacheKey(path, scope) {
  return `${KEY_PREFIX}${safeScope(scope)}:${path}`;
}

function isCacheKey(key) {
  return Boolean(key && (key.startsWith(KEY_PREFIX) || key.startsWith(LEGACY_PREFIX)));
}

function eachCacheKey(callback) {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (isCacheKey(key)) keys.push(key);
  }
  keys.forEach(callback);
}

export function cachePruneExpired() {
  try {
    eachCacheKey((key) => {
      try {
        const entry = JSON.parse(localStorage.getItem(key) || 'null');
        if (!entry?.ts || Date.now() - entry.ts > MAX_CACHE_AGE) localStorage.removeItem(key);
      } catch {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // localStorage unavailable — silently skip
  }
}

export function cacheGet(path, scope) {
  try {
    const key = cacheKey(path, scope);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry?.ts || Date.now() - entry.ts > MAX_CACHE_AGE) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheSet(path, data, scope) {
  try {
    cachePruneExpired();
    const entry = { data, ts: Date.now(), ttl: MAX_CACHE_AGE };
    localStorage.setItem(cacheKey(path, scope), JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

/** Bust exact path or any path starting with prefix for one cache scope. */
export function cacheBust(pathOrPrefix, scope) {
  try {
    const prefix = cacheKey(pathOrPrefix, scope);
    eachCacheKey((key) => {
      if (key.startsWith(prefix)) localStorage.removeItem(key);
    });
    if (
      pathOrPrefix !== '/console-page'
      && (pathOrPrefix.startsWith('/api/analytics')
        || pathOrPrefix.startsWith('/api/subkeys')
        || pathOrPrefix.startsWith('/api/master-keys')
        || pathOrPrefix.startsWith('/api/projects')
        || pathOrPrefix.startsWith('/api/billing'))
    ) {
      const consolePrefix = cacheKey('/console-page', scope);
      eachCacheKey((key) => {
        if (key.startsWith(consolePrefix)) localStorage.removeItem(key);
      });
    }
  } catch {
    // silently skip
  }
}

export function cacheBustScope(scope) {
  try {
    const scopedPrefix = `${KEY_PREFIX}${safeScope(scope)}:`;
    eachCacheKey((key) => {
      if (key.startsWith(scopedPrefix) || key.startsWith(LEGACY_PREFIX)) localStorage.removeItem(key);
    });
  } catch {
    // silently skip
  }
}

export function cacheBustAfterMutation(path, scope) {
  cacheBust(path, scope);
  const segments = path.split('/').filter(Boolean);
  while (segments.length > 1) {
    segments.pop();
    cacheBust('/' + segments.join('/'), scope);
  }
  if (path.startsWith('/api/subkeys') || path.startsWith('/api/master-keys') || path.startsWith('/api/projects') || path.startsWith('/v1/')) {
    cacheBust('/api/analytics', scope);
    cacheBust('/api/subkeys', scope);
    cacheBust('/api/projects', scope);
    cacheBust('/console-page', scope);
  }
  if (path.startsWith('/api/billing')) {
    cacheBust('/api/billing', scope);
    cacheBust('/console-page', scope);
  }
}

/** Bust all Lethem cache entries — call on logout, login, or hard reset. */
export function cacheClearAll() {
  try {
    eachCacheKey((key) => localStorage.removeItem(key));
  } catch {
    // silently skip
  }
}

if (typeof window !== 'undefined') {
  cachePruneExpired();
  window.cacheClearAll = cacheClearAll;
  window.cacheBust = cacheBust;
  window.cacheGet = cacheGet;
  window.cacheScope = () => currentScope();
}

export function setCacheScope(scope) {
  if (typeof window !== 'undefined') window.__LETHEM_CACHE_SCOPE = safeScope(scope || 'public');
}
