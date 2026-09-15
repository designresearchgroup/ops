/**
 * Supabase Edge Function — Claude proxy for OPS.
 * Deploy:  supabase functions deploy claude
 * Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *
 * The browser calls this with the project anon key (Authorization: Bearer <anon>),
 * which Supabase's gateway verifies. The Anthropic key never leaves the server.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS_CAP = 8000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: { message: "Method not allowed." } }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: { message: "Server is missing the ANTHROPIC_API_KEY secret." } }, 501);

  let payload: any;
  try { payload = await req.json(); }
  catch { return json({ error: { message: "Invalid JSON body." } }, 400); }

  if (typeof payload?.model !== "string" || !payload.model.startsWith("claude-"))
    return json({ error: { message: "Only Claude models are permitted." } }, 400);
  if (!Array.isArray(payload?.messages))
    return json({ error: { message: "messages[] is required." } }, 400);
  payload.max_tokens = Math.min(Number(payload.max_tokens) || 4096, MAX_TOKENS_CAP);

  let upstream: Response;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return json({ error: { message: "Upstream request failed: " + (e as Error).message } }, 502);
  }

  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { ...cors, "content-type": "application/json" } });
});
