/* ============================================================================
 * Supabase data layer for OPS.
 * - Postgres table `opportunities` holds the pipeline (via PostgREST).
 * - Edge Function `claude` is the server-side Claude proxy (key as a secret).
 * Self-contained (its own localStorage helpers) and exposed as window.SB so it
 * can load before app.js. When not configured, every method is a safe no-op and
 * the app runs on localStorage alone.
 * ==========================================================================*/
(function () {
  const K_URL = 'ops.sbUrl';
  const K_KEY = 'ops.sbKey';
  const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // app record (camelCase) <-> db row (snake_case)
  const toRow = r => ({
    id: r.id, employer: r.employer || '', title: r.title || '', location: r.location || '',
    how_applied: r.howApplied || '', pay: r.pay || '', status: r.status || 'Prepared-not-sent',
    notes: r.notes || '', tier: r.tier ?? null, verdict: r.verdict ?? null,
    flags: r.flags || [], fit: r.fit || '', date_applied: r.dateApplied || '',
    potential_amount: r.potentialAmount || '', potential_midpoint: r.potentialMidpoint ?? null, probability: r.probability ?? null,
    created_at: r.createdAt || Date.now()
  });
  const fromRow = r => ({
    id: r.id, employer: r.employer || '', title: r.title || '', location: r.location || '',
    howApplied: r.how_applied || '', pay: r.pay || '', status: r.status || 'Prepared-not-sent',
    notes: r.notes || '', tier: r.tier ?? null, verdict: r.verdict ?? null,
    flags: Array.isArray(r.flags) ? r.flags : [], fit: r.fit || '', dateApplied: r.date_applied || '',
    potentialAmount: r.potential_amount || '', potentialMidpoint: r.potential_midpoint ?? null, probability: r.probability ?? null,
    createdAt: Number(r.created_at) || Date.now()
  });

  const SB = {
    config() {
      const url = get(K_URL), key = get(K_KEY);
      return (url && key) ? { url: String(url).replace(/\/+$/, ''), key } : null;
    },
    setConfig(url, key) { set(K_URL, (url || '').trim()); set(K_KEY, (key || '').trim()); },
    configured() { return !!SB.config(); },
    edgeFn(name) { const c = SB.config(); return c ? `${c.url}/functions/v1/${name}` : null; },
    anonKey() { const c = SB.config(); return c ? c.key : null; },

    async rest(path, opts = {}) {
      const c = SB.config(); if (!c) throw new Error('Supabase not configured.');
      const res = await fetch(`${c.url}/rest/v1/${path}`, {
        ...opts,
        headers: {
          apikey: c.key, Authorization: 'Bearer ' + c.key,
          'content-type': 'application/json', ...(opts.headers || {})
        }
      });
      if (!res.ok) {
        let m = res.status + ' ' + res.statusText;
        try { const j = await res.json(); m = j.message || j.hint || m; } catch {}
        throw new Error(m);
      }
      return res.status === 204 ? null : res.json();
    },

    async list() {
      const rows = await SB.rest('opportunities?select=*&order=created_at.desc');
      return (rows || []).map(fromRow);
    },
    async upsert(rec) {
      await SB.rest('opportunities', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(toRow(rec))
      });
    },
    async upsertMany(recs) {
      if (!recs.length) return;
      await SB.rest('opportunities', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(recs.map(toRow))
      });
    },
    async remove(id) {
      await SB.rest('opportunities?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    },
    async clearAll() {
      // delete every row (PostgREST needs a filter; created_at >= 0 matches all)
      await SB.rest('opportunities?created_at=gte.0', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    },
    async test() { await SB.rest('opportunities?select=id&limit=1'); return true; },

    // ATS Sourcer edge function — first-party jobs, deduped + freshness-ranked
    async source(payload) {
      const c = SB.config(); if (!c) throw new Error('Supabase not configured.');
      const res = await fetch(`${c.url}/functions/v1/sourcer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: c.key, Authorization: 'Bearer ' + c.key },
        body: JSON.stringify(payload)
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j.error && j.error.message) || (res.status + ' ' + res.statusText));
      return j;
    }
  };

  window.SB = SB;
})();
