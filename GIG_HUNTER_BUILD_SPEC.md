# GIG HUNTER — Build Spec & Prompt Graph

The product: Workday-safe, LLM-created and -steered resumes, customized to specific JDs — honest by construction.

Companion to `job_application_agent_SKILL.md` (the agent's operating rules + candidate profile). This file is the BUILD spec: architecture, the prompt graph, and the exact node prompts to wire into Claude Code.

## 0. PRODUCT DEFINITION (one line)
Given a job description, Gig Hunter outputs an ATS/Workday-safe resume (and optional cover letter) that is (a) tailored to the JD, (b) generated and steered by an LLM, and (c) honest — never claiming anything the candidate can't defend. It can also source matching roles proactively.

The three things competitors fail at, which are our moat:
1. **Honest** — hard guardrails (HAVE/DON'T-HAVE), never fabricates.
2. **JD-precise** — keyword-mirrored, role-framed per job family.
3. **Workday-safe** — parse-clean output that survives the ATS.

## 1. ARCHITECTURE (nodes = pipeline stages)
```
[JD Input] -> (parse) -> [Fit Analyzer] --skip--> [Explain & Stop]
                              |
                            build
                              v
                        [Clarifier] <--(asks user only if a needed fact is missing)
                              |
                              v
                        [Frame Selector] (pick lead angle for this job family)
                              |
                              v
                        [Resume Generator] -> [Guardrail Validator] --fail--> (regenerate/flag)
                              |                                   pass
                              v                                    |
                        [Cover Letter Gen (optional)]              v
                              |                              [Workday-Safe Renderer]
                              v                                    |
                        [Application Logger] <---------------------+
                              |
                              v
                        [Opportunity Sourcer] (standalone loop; feeds JD Input)
```
Each node is a function; LLM nodes call the Claude API with the node prompt below + shared context (SKILL rules + candidate profile). Deterministic nodes (render, log, validate-structural) are plain code.

## 2. SHARED CONTEXT (injected into every LLM node's system prompt)
- `SKILL.md` Parts 1-3 (operating rules, ATS format, workflow)
- `SKILL.md` Part 4 (candidate profile JSON) — the source of truth
- The HAVE / DON'T-HAVE skill lists (guardrails)
- Style rules (no "React/Next"; don't lead with "founder" on employee roles; plain phrasing)

## 3. THE PROMPT GRAPH — node-by-node prompts

### NODE 1 — JD PARSER (structured output)
SYSTEM: "Extract structured fields from this job description. Return JSON only." USER: `{jd_text}` OUTPUT SCHEMA:
```json
{
  "company": "", "title": "", "location": "", "remote": "onsite|hybrid|remote",
  "comp_range": "", "must_haves": [], "nice_to_haves": [], "hard_gates": [],
  "keywords": [], "job_family": "", "ats_hint": "workday|greenhouse|lever|other|unknown",
  "flags": ["evergreen?","LI-DNI?","no-sponsorship?","agency-vs-direct?","degree-required?"]
}
```

### NODE 2 — FIT ANALYZER
SYSTEM: "Using the candidate profile and guardrails, assess fit honestly. Recommend generate or skip. Never inflate. Flag hard gates the candidate does not meet." USER: `Parsed JD: {jd_json}\nCandidate profile: {profile}` OUTPUT:
```json
{
  "verdict": "clean_fit|legitimate_reach|skip",
  "strong_fits": ["requirement -> candidate evidence", ...],
  "gaps": ["stated requirement candidate does NOT meet", ...],
  "flags": ["evergreen","degree-gate","comp-below-floor", ...],
  "reasoning": "one to three sentences",
  "recommended_lead_frame": "e.g. 'AI builder + legal domain'"
}
```
RULE: if verdict == skip (different profession, unclearable hard gate), stop and explain to user; do not generate.

### NODE 3 — CLARIFIER (conditional)
Trigger only if generating requires a fact NOT in the profile (e.g., "does candidate have Flask? Azure DevOps? professional AWS?"). SYSTEM: "List only the missing facts that materially change the resume. Ask the user concise yes/no or short-answer questions. Do NOT assume." OUTPUT: a short list of questions -> present to user -> cache answers into profile.

### NODE 4 — FRAME SELECTOR
SYSTEM: "Choose ONE lead frame matching the job family. Lead with the moat, not generic boilerplate. Demote experience that dilutes the target frame." INPUT: fit analysis + job_family. OUTPUT: `{ "lead_frame": "", "demote": [...], "feature": [...] }`

### NODE 5 — RESUME GENERATOR
SYSTEM: (SKILL rules + profile + guardrails) "Generate resume CONTENT as structured JSON. Mirror the JD's true keywords. Scope every claim precisely and honestly. Use only profile facts. Frame per lead_frame." OUTPUT SCHEMA:
```json
{
  "name": "James E. Coleman",
  "target_title": "",
  "contact_line": "location · phone · email · site",
  "summary": "3-5 sentences, moat-first, keyword-rich",
  "alignment": ["bullet mirroring a top JD responsibility", ...],
  "experience": [
    {"title":"","company":"","dates":"Mon YYYY - Mon YYYY","bullets":["",""]}
  ],
  "skills": ["grouped semicolon lines"],
  "education": ""
}
```

### NODE 6 — GUARDRAIL VALIDATOR (deterministic + LLM check)
DETERMINISTIC pass (code): scan all generated text; if any term in DONT_HAVE list appears as a claim, FLAG. Verify every company/title/date exists in profile (no invented employers). LLM pass: SYSTEM: "Review this resume against the candidate profile and the DON'T-CLAIM list. Return any sentence that overclaims, fabricates, or scopes a credential too high (e.g., implies attorney when candidate is a legal analyst). Return [] if clean." On fail: regenerate the flagged section or surface to user. NOTHING renders until validator passes.

### NODE 7 — COVER LETTER GENERATOR (optional)
SYSTEM: "4-5 short paragraphs. Open on the role's specific hook (quote their framing). Lead with the moat + proof. Address the biggest gap honestly in one paragraph and reframe as motivation. Match company tone. Close with a specific offer. Honest scoping throughout."

### NODE 8 — WORKDAY-SAFE RENDERER (deterministic — THE PARSE-SAFE SPEC)
Render the resume JSON to .docx / Google Doc using THESE rules (this is what makes it Workday-safe):
- Single column. No tables, no text boxes, no multi-column, no header/footer content regions.
- One font (Calibri or Arial), sizes ~11pt body / ~16pt name.
- Section headers: plain caps words on their own line — SUMMARY, EXPERIENCE, SKILLS, EDUCATION.
- Each job STACKED on separate lines (critical for Workday):
```
Job Title            (bold)
Company Name         (plain)
Month YYYY - Month YYYY   (italic)
• bullet
• bullet
```
**NO pipes ( | ), NO tab-aligned right-side dates, NO "Title, Company | Dates" on one line — Workday scrambles those.**
- Standard round bullets. Dates always "Month YYYY - Month YYYY".
- Two output variants: `_ATS.docx` (this spec) for portals; `_Styled.docx` (navy/green headers) for human/direct send. Same content.
- Two pages is fine.

### NODE 9 — APPLICATION LOGGER (deterministic)
Append to Google Sheet: Date | Company | Title | Location | How Applied | Pay/Range | Status | Notes(req #, referral). Statuses: Submitted / Applied / In progress / Prepared-not-sent / Not accepted.

### NODE 10 — OPPORTUNITY SOURCER (standalone loop)
SYSTEM: "Given the candidate's target role families, moat, location/remote prefs, and comp floor, search public postings and score each with the Fit Analyzer. Surface only clean_fit and legitimate_reach; suppress skip. For each: one-line why-it-fits + flags." Feeds accepted roles back into [JD Input]. Target families: AI Product Manager/Leader; TPM (esp. Physical AI/robotics); Applied AI Engineer/Solutions; AI Strategy/Transformation; Design/Creative Producer; App Dev Manager; Digital/Program Manager; legal-AI. Filter OUT: quota-carrying sales, deep-hardware engineering, security-specialist, deep classical-ML research.

## 4. TECH NOTES FOR CLAUDE CODE
- Repo layout: `/context/SKILL.md` + `/context/profile.json` (loaded into every LLM node's system prompt); `/nodes/*` (parse, fit, clarify, frame, generate, validate, cover, render, log, source); `/templates/` (docx builders — reuse the wsafe stacked helper).
- Use Claude structured outputs (JSON) for parse/fit/generate; prose for cover.
- Google Docs/Drive API for render + Sheets API for log.
- The Guardrail Validator (Node 6) is load-bearing — make it a hard gate, code-enforced, not prompt-only.
- Cache clarifier answers back to profile.json so the agent learns the candidate over time.
- Respect: only public postings; label evergreen/LI-DNI/agency so the candidate calibrates effort.

## 5. WHAT TODAY VALIDATED (so the build starts from proof, not theory)
- The honesty guardrails work: repeatedly caught/declined overclaims (AWS, Bedrock, attorney-vs-analyst, healthcare payer/claims, hardware engineering).
- Fit analysis correctly flagged skips (Cisco sales leader, deep-hardware) and reaches (Meta evals, PwC) vs. clean fits (GLG, McDermott, Fehr & Peers, Patagonia).
- Workday-safe stacked format solved the parser-mangling problem — it is the default renderer.
- JD-customization + moat-framing produced materially different, on-target resumes per role from ONE profile.

---

## Mapping to the OPS implementation (this repo)
- **Nodes 1–2 (Parse + Fit)** → the Validate tab's `submit_fit_analysis` tool (`ops/app.js`).
- **Node 3 (Clarifier)** → the fit analysis `clarifiers[]` + the dashboard qualification chat.
- **Nodes 4–5 (Frame + Generate)** → `submit_documents` returns the lead frame + structured resume.
- **Node 6 (Guardrail Validator)** → BOTH the LLM `self_check` AND a deterministic code scan (`deterministicGuardrail()` in `ops/app.js`): flags any DON'T-HAVE acronym present in the rendered text and any employer not found in the profile; PDF export warns/confirms on a flag. (Not yet a hard render-block; it gates on confirm.)
- **Node 7 (Cover Letter)** → `cover_letter` in `submit_documents`.
- **Node 8 (Workday-Safe Renderer)** → `resumeHTML()` / `resumeText()` in `ops/app.js` — **stacked, no pipes** for the ATS variant (title / company / dates each on its own line; "·" not "|" in the contact line).
- **Node 9 (Logger)** → the Pipeline tab (Supabase / localStorage) + CSV export.
- **Node 10 (Sourcer)** → not yet built (roadmap).
- **MCP-client intake (e.g. a16z's `/intake/mcp`)** → NOT built and out of the current architecture. OPS is an MCP/Claude-API *consumer for doc generation*, not an *MCP client that connects out to a third-party server to drive their intake flow*. That is separate work and needs a server runtime (not the GoDaddy static host).
