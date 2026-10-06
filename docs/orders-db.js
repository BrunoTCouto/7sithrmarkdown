/*
 * Loader for the pin-order database (data/orders/*.csv), with a browser cache.
 *
 * The 272 CSV files are parsed into typed arrays (about 20 MB) and the result is kept in
 * IndexedDB, stamped with the version from data/orders/version.json (a hash of the CSVs that
 * scripts/build-orders.js writes). Later visits read the arrays back in well under a second
 * instead of fetching 272 files; when the data is regenerated the version changes and the
 * cache is rebuilt. The solver page calls schedulePreload() so the cache is usually warm by the
 * time someone opens the finder.
 *
 * Needs clock.js (for the pin-state order). Exposes window.OrdersDB = { load, preload, schedulePreload, clear }.
 */
(function (root) {
  "use strict";
  const DB_NAME = "clock7", STORE = "orders", KEY = "db", BASE = "data/orders/", CONCURRENCY = 6;
  const Clock = root.Clock;
  const PIN_INDEX = Object.fromEntries(Clock.PIN_STATES.map((p, i) => [p, i]));

  // ---- IndexedDB (tiny promise wrappers; any failure just means "no cache") ----
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = root.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("blocked"));
    });
  }
  function withStore(mode, fn) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(req && req.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error("aborted")); };
    }));
  }
  const idbGet = () => withStore("readonly", (s) => s.get(KEY));
  const idbPut = (value) => withStore("readwrite", (s) => s.put(value, KEY));
  const idbClear = () => withStore("readwrite", (s) => s.clear());

  // ---- network ----
  async function fetchVersion() {
    const res = await fetch(BASE + "version.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("version.json " + res.status);
    return String((await res.json()).version);
  }

  function parseSetFile(text, n, base, d) {
    const lines = text.split("\n");
    let r = base;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const c = line.split(",");
      const names = c[0].split(" ");
      let mask = 0;
      for (let k = 0; k < 7; k++) { const pi = PIN_INDEX[names[k]]; d.pins[r * 7 + k] = pi; mask |= 1 << pi; }
      d.pinMask[r] = mask; d.setNo[r] = n;
      d.stMin[r] = +c[1]; d.stMax[r] = +c[2]; d.stSum[r] = +c[3]; d.stMem[r] = +c[4]; d.stD[r] = +c[5]; d.stPinSum[r] = +c[6]; d.stPinMax[r] = +c[7];
      r++;
    }
    return r - base;
  }

  async function fetchAll(onProgress) {
    const res = await fetch(BASE + "sets.csv");
    if (!res.ok) throw new Error("Could not load sets.csv (" + res.status + ")");
    const sets = [];
    for (const line of (await res.text()).trim().split("\n").slice(1)) {
      const c = line.split(",");
      const det = parseInt(c[2], 10);
      sets.push({ n: +c[0], pins: c[1], det, thirds: Math.abs(det) !== 1 });
    }
    const N = sets.length * 5040;
    const d = {
      N, sets, pins: new Uint8Array(N * 7), pinMask: new Uint16Array(N), setNo: new Uint16Array(N),
      stMin: new Uint8Array(N), stMax: new Uint8Array(N), stSum: new Uint8Array(N), stMem: new Uint8Array(N),
      stD: new Uint8Array(N), stPinSum: new Uint8Array(N), stPinMax: new Uint8Array(N),
    };
    let done = 0, filled = 0;
    const queue = sets.slice();
    async function worker() {
      while (queue.length) {
        const s = queue.shift();
        const file = String(s.n).padStart(3, "0") + ".csv";
        const r = await fetch(BASE + file);
        if (!r.ok) throw new Error("Could not load " + file + " (" + r.status + ")");
        const text = await r.text(); // (await inside "filled += …" would read filled before the await and lose other workers' adds)
        filled += parseSetFile(text, s.n, (s.n - 1) * 5040, d);
        done++;
        onProgress({ from: "network", done, total: sets.length });
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (filled !== N) throw new Error("Expected " + N + " orders, read " + filled);
    return d;
  }

  async function currentAndCached() {
    let version = null, cached = null;
    try { version = await fetchVersion(); } catch (e) {}
    if (root.indexedDB) { try { cached = await idbGet(); } catch (e) {} }
    const fresh = !!(cached && cached.N && (version === null ? cached.version != null : cached.version === version));
    return { version, cached, fresh };
  }

  /** Load the database: from IndexedDB when its version matches, else from the CSVs (and cache them). */
  async function load({ onProgress = () => {} } = {}) {
    const { version, cached, fresh } = await currentAndCached();
    if (fresh) { onProgress({ from: "cache", done: cached.sets.length, total: cached.sets.length }); return cached; }
    const d = await fetchAll(onProgress);
    d.version = version;
    d.storedAt = Date.now();
    if (root.indexedDB) { try { await idbPut(d); } catch (e) {} }
    return d;
  }

  /** Fill the cache quietly if it is missing or stale. Resolves to true when it fetched something. */
  let preloading = null;
  function preload() {
    if (preloading) return preloading;
    if (!root.indexedDB) return Promise.resolve(false);
    const conn = navigator.connection;
    if (conn && conn.saveData) return Promise.resolve(false);
    preloading = (async () => {
      const { version, fresh } = await currentAndCached();
      if (fresh || version === null) return false;
      const d = await fetchAll(() => {});
      d.version = version; d.storedAt = Date.now();
      await idbPut(d);
      return true;
    })().catch(() => false);
    return preloading;
  }
  /** Preload once the page is idle, so it never competes with what the visitor is doing. */
  function schedulePreload() {
    const go = () => { preload(); };
    if (root.requestIdleCallback) root.requestIdleCallback(go, { timeout: 8000 }); else setTimeout(go, 3000);
  }

  root.OrdersDB = { load, preload, schedulePreload, clear: idbClear };
})(typeof self !== "undefined" ? self : this);
