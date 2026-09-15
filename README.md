# OPS — the honest career CRM

A CV-creation & delegation tool ("Salesforce for jobseekers") that validates job opportunities, writes **interview-defensible** resumes and cover letters, exports them as real ATS-parseable **PDFs**, and manages a pipeline that aligns proven skills to current job-market trends. Lives at **jamesecoleman.com/ops/**. Implements `job_application_agent_SKILL.md` (Parts 1–7).

## What it does

- **Dashboard** — a **conversational agent** is the centerpiece: a long-tail qualification chat that pressure-tests each claim for interview-defensibility and maps your proven work to a given role. Alongside it, pipeline KPIs, status funnel, verdict mix, recent opportunities. The conversation persists locally.
- **Validate** — paste a JD → honest fit read (SKILL Part 1.2): verdict (clean fit / legitimate reach / skip), strong fits → evidence, gaps, flags (hard gate, #LI-DNI, evergreen, on-site, comp, sponsorship, agency), true keywords to mirror, and a guardrail surface of any DON'T-HAVE skill the role demands.
- **Generate** — on a non-skip verdict, Claude returns a **structured** resume that renders deterministically to a submission-grade, ATS-parseable **PDF** (single column, one font, plain CAPS headings, " | " contact line, round bullets, dates inline) — plus a styled navy/green variant and a cover letter, all self-checked against the HAVE/DON'T lists. Real, selectable text (not an image).
- **Pipeline** — the Part-6 application log, seeded from the existing asset index. Inline status/date editing, filters, search, CSV export.
- **Skill trends** — the agent maps your proven ("older") skills onto current in-demand language: rising demand in your lane, bridges (proven strength → today's term → honest reframe), gaps worth weighing, and positioning moves. Grounded in your profile + pipeline; never invents.
- **Profile** — canonical facts + honesty guardrails (Part 4) as editable JSON. Swap the block to reuse OPS for anyone.

## Architecture

```
.
├── ops/                       # the app (served at /ops/)
│   ├── index.html · styles.css · app.js
│   ├── profile.js             # canonical profile (SKILL Part 4)
│   ├── seed.js                # existing pipeline → tracker seed
│   ├── supabase.js            # Postgres data layer + edge-function client
│   └── api/
│       ├── claude.php         # GoDaddy PHP Claude proxy (fallback)
│       └── config.sample.php  # copy → config.php on the server (gitignored)
├── supabase/
│   ├── schema.sql             # opportunities table + RLS
│   └── functions/claude/index.ts   # Edge Function Claude proxy (primary)
├── .github/workflows/deploy.yml    # CI/CD → GoDaddy over FTPS
└── README.md
```

**Frontend:** static, no build step, on GoDaddy shared hosting.
**Data:** Supabase Postgres when connected (synced across devices); browser `localStorage` otherwise.
**Claude key:** never in the browser — held server-side in a Supabase Edge Function secret (primary) or the GoDaddy PHP proxy (fallback). Local file use falls back to your own key entered in Settings.

## Setup

### 1. Supabase (database + edge function)

1. Create a project at [supabase.com](https://supabase.com). Note the **Project URL** and the **anon public** key (Settings → API).
2. Run `supabase/schema.sql` in the SQL editor (creates `opportunities` + row-level security). The default policy allows the anon key full access — fine for a single private operator; see the file's comments to switch to per-user auth when you commoditize.
3. Deploy the Claude proxy and set its secret:
   ```bash
   supabase functions deploy claude
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
4. In the app → **Settings → Supabase**, paste the Project URL + anon key → **Connect**. The pipeline now syncs to Postgres and Claude routes through the edge function.

### 2. GoDaddy deploy (CI/CD + repo secrets)

The workflow at `.github/workflows/deploy.yml` syncs `ops/` to `public_html/ops/` over FTPS on every push to `main`. In **GitHub → repo → Settings → Secrets and variables → Actions**, add:

| Secret | Value |
| --- | --- |
| `FTP_SERVER` | e.g. `ftp.jamesecoleman.com` |
| `FTP_USERNAME` | full cPanel/FTP user |
| `FTP_PASSWORD` | that user's password |

> If your repo root **is** the app (not a nested `ops/`), change `local-dir: ./ops/` to `local-dir: ./` in the workflow. Adjust `server-dir` if your web root isn't `public_html`.

### 3. Claude key options

- **Supabase Edge Function** (recommended) — set once as above; nothing in the browser.
- **GoDaddy PHP proxy** (fallback, no Supabase) — copy `ops/api/config.sample.php` → `config.php` on the server and paste the key, *or* set an `ANTHROPIC_API_KEY` env var in cPanel. `config.php` is gitignored and excluded from deploys, so it's never overwritten.
- **Direct** — for local use, paste your own key in Settings; it stays in your browser.

## Local development

```bash
python3 -m http.server 8099    # open http://localhost:8099/ops/  (Direct mode + your key)
```

The PHP proxy needs a PHP host to run; on GoDaddy it works out of the box.

## Push to the repo

```bash
git init && git add -A
git commit -m "OPS: honest career CRM at /ops/"
git remote add origin https://github.com/designresearchgroup/ops.git
git branch -M main && git push -u origin main
```

## Guardrail summary (carried everywhere)

Never invent facts · every claim interview-defensible · reframe never inflate · scope precisely · fit analysis before generation · lead with the moat · mirror only true keywords · ATS-safe format · ask before assuming · validate against HAVE/DON'T · keep the log honest.
