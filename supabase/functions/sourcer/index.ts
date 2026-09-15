/**
 * Supabase Edge Function — ATS Sourcer for Giggy.
 * Deploy:  supabase functions deploy sourcer
 *
 * Pulls jobs straight from employers' OWN applicant-tracking systems
 * (Greenhouse, Lever, Ashby) — first-party, not aggregator reposts — then
 * dedups and ranks by freshness so you see real, recent, low-echo roles.
 *
 * POST body: { companies: [{ats, slug}], query?: string, maxAgeDays?: number, limit?: number }
 * Returns:  { roles: [...], sourced: N, kept: M, errors: [...] }
 * No secret required (public ATS endpoints); called with the project anon key.
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "content-type": "application/json" } });

type Role = {
  source: string; company: string; title: string; location: string;
  url: string; posted_at: string | null; age_days: number | null; description: string;
};

const stripHtml = (h: string) =>
  (h || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

const ageDays = (iso: string | null) =>
  iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)) : null;

async function greenhouse(slug: string): Promise<Role[]> {
  const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`);
  if (!r.ok) throw new Error(`greenhouse ${slug} ${r.status}`);
  const j = await r.json();
  return (j.jobs || []).map((x: any) => ({
    source: "greenhouse", company: slug, title: x.title || "",
    location: x.location?.name || "", url: x.absolute_url || "",
    posted_at: x.updated_at || null, age_days: ageDays(x.updated_at || null),
    description: stripHtml(x.content || "").slice(0, 6000),
  }));
}
async function lever(slug: string): Promise<Role[]> {
  const r = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`);
  if (!r.ok) throw new Error(`lever ${slug} ${r.status}`);
  const j = await r.json();
  return (j || []).map((x: any) => {
    const posted = x.createdAt ? new Date(x.createdAt).toISOString() : null;
    return {
      source: "lever", company: slug, title: x.text || "",
      location: x.categories?.location || "", url: x.hostedUrl || "",
      posted_at: posted, age_days: ageDays(posted),
      description: (x.descriptionPlain || stripHtml(x.description || "")).slice(0, 6000),
    };
  });
}
async function ashby(slug: string): Promise<Role[]> {
  const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`);
  if (!r.ok) throw new Error(`ashby ${slug} ${r.status}`);
  const j = await r.json();
  return (j.jobs || []).map((x: any) => ({
    source: "ashby", company: slug, title: x.title || "",
    location: x.location || x.locationName || "", url: x.jobUrl || x.applyUrl || "",
    posted_at: x.publishedDate || x.updatedAt || null, age_days: ageDays(x.publishedDate || x.updatedAt || null),
    description: (x.descriptionPlain || stripHtml(x.descriptionHtml || x.description || "")).slice(0, 6000),
  }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: { message: "Method not allowed." } }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: { message: "Invalid JSON." } }, 400); }
  const companies = Array.isArray(body.companies) ? body.companies.slice(0, 60) : [];
  const query = (body.query || "").toString().toLowerCase().trim();
  const maxAgeDays = Math.min(Math.max(Number(body.maxAgeDays) || 21, 1), 120);
  const limit = Math.min(Math.max(Number(body.limit) || 40, 1), 100);
  if (!companies.length) return json({ error: { message: "companies[] required" } }, 400);

  const fetchers: Record<string, (s: string) => Promise<Role[]>> = { greenhouse, lever, ashby };
  const errors: string[] = [];
  const results = await Promise.all(companies.map(async (c: any) => {
    const fn = fetchers[(c.ats || "").toLowerCase()];
    if (!fn || !c.slug) { errors.push(`bad entry ${JSON.stringify(c)}`); return []; }
    try { return await fn(c.slug); } catch (e) { errors.push((e as Error).message); return []; }
  }));

  let roles = results.flat();
  const sourced = roles.length;

  // keyword filter (title-weighted, falls back to description)
  if (query) {
    const terms = query.split(/\s+/).filter(Boolean);
    roles = roles.filter((r) => {
      const t = r.title.toLowerCase(), d = r.description.toLowerCase();
      return terms.some((w) => t.includes(w)) || terms.every((w) => d.includes(w));
    });
  }
  // freshness filter
  roles = roles.filter((r) => r.age_days == null || r.age_days <= maxAgeDays);
  // dedup by title+company
  const seen = new Set<string>();
  roles = roles.filter((r) => {
    const k = (r.title + "|" + r.company).toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(k)) return false; seen.add(k); return true;
  });
  // rank: freshest first (unknown age sinks to the bottom)
  roles.sort((a, b) => (a.age_days ?? 9999) - (b.age_days ?? 9999));
  roles = roles.slice(0, limit);

  return json({ roles, sourced, kept: roles.length, errors });
});
