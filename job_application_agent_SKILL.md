# SKILL: Job Application Agent — ATS-Compliant Resume & Cover Letter Generator

## Purpose
An agent that ingests a job description (JD), and outputs an ATS-compliant, honestly-tailored resume (and optional cover letter) as a Google Doc, based on a standard template and a canonical candidate profile. Optionally, given standing context about the job seeker, it proactively sources matching opportunities.

Powered by a Claude API key. Built for candidate: **James E. Coleman** (facts below; swap the profile block to reuse for anyone).

---

## PART 1 — CORE OPERATING PRINCIPLES (non-negotiable)

These are the rules that made the human-in-the-loop version work. The agent must enforce all of them.

### 1.1 Honesty is the product
- **Never fabricate** employers, titles, dates, degrees, certifications, skills, or metrics.
- Every claim must be **defensible in a live interview**. The test: "Could the candidate speak to this in depth if a screener probed it?" If no, cut or reframe.
- **Reframe, don't inflate.** When the candidate is adjacent to a requirement, state the true adjacent strength ("comfortable in X, ramps quickly") rather than claiming years they lack.
- **Scope claims precisely.** "Concept-car design (design/experience side)" ≠ "engineered the vehicle." "Ran delivery of the robot's UI" ≠ "built the robot." "Used AWS" ≠ "professional AWS experience."
- When a required skill is genuinely absent, say so in the fit analysis and frame the gap honestly on the resume — do not paper over it.

### 1.2 The fit analysis comes FIRST, before generating anything
For every JD, output an honest fit read:
- **Strong fits** (requirement → specific candidate evidence)
- **Gaps / stretches** (stated requirements the candidate does not meet, flagged plainly)
- **Verdict**: clean fit / legitimate reach / skip — with one-line reasoning
- **Special flags**: hard-gate requirements (degree, specific years, named cert/tool), #LI-DNI (compliance/PERM posting), "evergreen" (pipeline, not active), on-site/relocation, comp vs. candidate floor, no-sponsorship, agency-vs-direct.
- If a role is a different profession from the candidate's background (e.g., quota-carrying enterprise sales, deep hardware engineering, security specialist without security receipts), **recommend skipping** rather than generating a resume that will auto-screen.

### 1.3 Match the framing to the role's job family
The same candidate is framed differently per role. Decide the lead angle before writing:
- Pick ONE primary frame (e.g., "AI Product Leader," "Creative Producer," "Technical Program Manager — Physical AI," "Application Developer," "Design Producer").
- **Lead with the moat** — the rare, differentiated combination — not generic boilerplate. Generic openers ("define scope, manage dependencies") are what every candidate writes; open with what's rare and true.
- Demote or omit experience that dilutes the target frame (e.g., don't lead a creative-producer resume with a 2008 role; don't foreground founder/AI on a traditional-employee role if it reads as flight risk).

### 1.4 Keyword mirroring for ATS
- Extract the JD's exact keywords/phrases (tools, methods, responsibilities) and weave the TRUE ones into the summary, a "Core Skills" block, and bullets.
- Use the JD's own vocabulary where it's honest ("run of show," "SOWs," "change control," "integrated schedule," "context engineering," "evaluation discipline," etc.).
- Never keyword-stuff with skills the candidate lacks.

---

## PART 2 — ATS-COMPLIANT OUTPUT FORMAT

The format that reliably parses (learned the hard way; third-party "ATS score" popups are mostly fear-marketing, but real parsers do have constraints):

### 2.1 Structure (single column, no tables)
- **Single column only.** No tables, no text boxes, no multi-column layouts, no header/footer regions for content.
- **One standard font** throughout (Calibri or Arial). No exotic fonts.
- **Plain section headings** in caps: PROFESSIONAL SUMMARY, CORE SKILLS, PROFESSIONAL EXPERIENCE, EDUCATION, etc.
- **Standard bullets** (round). No custom glyphs.
- **Dates in plain text** "Mon YYYY - Mon YYYY" on the same line as the job title/company — NOT right-aligned via tab stops (positional tabs can break parsers).
- **Contact line**: Name (bold, large) / target title / location + phone + email + portfolio, each separated by " | ".
- **No divider-line tricks** that older parsers choke on.
- Two pages is fine for ATS — do not cram to one page at the cost of readability. (A styled one-page version can exist separately for human/direct-send use.)

### 2.2 Section order
1. Name + target title + contact line
2. Professional Summary (3-5 sentences, leads with the moat, keyword-rich)
3. Core Skills (keyword-dense, scannable, semicolon-separated groups)
4. Role Alignment (optional, powerful) — bullets mirroring the JD's top responsibilities
5. Professional Experience (reverse-chronological OR relevance-forward; each role: "Title, Company | Dates" then bullets)
6. Education & Certifications
7. Clients / Awards (optional)

### 2.3 Two template variants
- **`_ATS.docx`** — the parse-safe version above, for online portals.
- **`_Resume.docx`** — a styled version (navy #1F3A4D headers, green #2E7D5B accents, section rules) for human/direct send. Same content, nicer look.

---

## PART 3 — GENERATION WORKFLOW

Given a JD, the agent runs:

1. **Parse the JD** → extract: title, company, location, comp, must-haves, nice-to-haves, hard gates, keywords, red flags (evergreen / LI-DNI / sponsorship / on-site).
2. **Load canonical profile** (Part 5) + any role-specific truths the candidate has confirmed.
3. **Run the fit analysis** (1.2) → output to the user; if "skip," stop and explain.
4. **If any requirement needs a fact not in the profile** (e.g., "do you have Flask experience?"), ASK the candidate before generating — never assume. Common asks: specific tool/stack depth, exact dates, team size, cert yes/no, professional-vs-hobby use of a named platform.
5. **Choose the lead frame** (1.3) → confirm with candidate if ambiguous.
6. **Generate** the resume: summary (moat-first) → core skills (keyword-mirrored) → role alignment → experience (reframed per target, honest) → education.
7. **ATS-format** it (Part 2), export to Google Doc via API/Drive.
8. **Offer** a cover letter and a styled variant.
9. **Log** the application to the job-search tracker (Part 6).

### 3.1 Cover letter method
- 4-5 short paragraphs. Open on the role's specific hook (quote their framing). Lead with the moat + proof. Address the biggest gap HONESTLY in one paragraph ("I'll be candid about fit…") and reframe it as motivation/strength. Match the company's cultural tone (warm/humble for values-driven firms; sharp/thesis-driven for startups). Close with a specific offer (walk through a system, talk approach).

---

## PART 4 — CANDIDATE PROFILE (canonical facts — the source of truth)

> Swap this block to reuse the skill for a different job seeker.

### Identity
- **Name:** James E. Coleman
- **Contact:** 310.430.2523 · info@jamesecoleman.com · jamesecoleman.com · linkedin.com/in/james-e-coleman-ca
- **Location:** Southern California (Irvine/Costa Mesa). Open to relocation. (Adjust location line per role's geography — don't lead with SoCal for an NYC role.)
- **Work auth:** US authorized, no visa sponsorship needed.
- **Comp floor:** ~$250K total comp for senior PM/AI roles (NYC market); flexible on base/equity mix. Contract roles: accept posted rate to move fast.

### The Moat (positioning through-line)
"I'm the UI and data/intelligence layer for systems-level infrastructure — I design, build, and ship AI-native products end to end, across the interface AND the intelligence, plus 15+ years of program rigor." Real triad: **Data Analysis + Robotics (interface/HRI) + AI**. Security = coursework/"security-aware," NOT a claimed pillar.

### Employment history (USE THESE — verified)
- **HumanData Technologies** — Founder; builds agentic AI platform for grants/gov contracting. Agent does: multimodal intake (voice/text/image/PDF) → grant/contract discovery matched to profile → eligibility determination → autonomous proposal writing → document-rating quality check; maintains knowledge center + funding pipeline (deadlines, funder contacts); skills-based architecture with validation; payment-gated/metered operations; conversational interface. Stack: Python, JS/TS, SQL, NoSQL/MongoDB, LLMs, RAG, agents, GCP, Supabase. Oct 2022–Present.
- **MADE CX** — Founder; live cultural-IP licensing platform. Autonomous scheduled agent detects unauthorized use of creators' work → reasons about viability → reports via human-review layer. REST API, blockchain provenance (BLK CHAIN ID), royalty logic, credit/entitlement metering + payment-gating. Detect-and-report today; tool-orchestration/execution on roadmap. 2021–Present.
- **Deep Venue (deepvenue.co)** — live geospatial platform: helps venues, sports enterprises, tour promoters measure/project economic impact of live events; 44 stadiums, cost/revenue models, SCSA/Levi's command center.
- **Bioelectric (trybioelectric.com)** — live DTC product: interactive configurator, AI formula-matcher, dynamic pricing.
- **Canyon Oaks Ventures, LLC** — Consultant to City of Santa Clara / Santa Clara Stadium Authority (municipal gov, competitive "best value" RFP award). Data analyst / app developer / project manager. Aug 2024–Present (ongoing, pending contract continuance). 25 hrs/wk, supervised 4. Supervisor: Taj Tashombe, Principal Consultant. Work: stadium market/economic-impact benchmarking, 11-touchpoint digital-journey systems analysis, tech-implementation roadmap, PUBLIC-RECORDS data process across NFL/MLB stadium authorities, presented to City Managers & City Council. Built deepvenue.co + interactive analytics dashboard (drgx.co/flow/scsa/).
- **DRGx (Design Research Group)** — Founder; principal consultant / app developer / project manager. Jun 2015–Present (started after Quigley-Simpson). Consulting: systems, web, data, AI for enterprise & government-adjacent clients.
- **Icon Group** — Product Manager (robotics UX & product). Apr 2022–Nov 2022. Brought on to manage design/dev of a POS system for the FRYBOT commercial kitchen robot (Lab2Fab/Middleby, for Sonic chain). Scoped product with CEO (Shawn) and Creative Director (Mathew Coburn), ran Agile/Scrum sprints (~6 wk) alongside a Senior UI Designer. REFRAMED engagement into human-robot interaction: app-controlled robot moves for in-store customers, crew-engagement features (rock-paper-scissors w/ robot) — robot as brand/experience moment. Also automotive concept work incl. **GM Hummer EV concept-car design (design/experience side ONLY — can speak to concept design, NOT production engineering)**. Reason for leaving: recruited back to Apple.
- **Apple Inc.** — Product Design Producer, Ad Platform + Apple News. Culver City, CA 90232 (8600 Hayden Place). 2022–2023 (Oct 2022 start). Supervisor: Ashley Schuact [confirm spelling]. Managed design+dev delivery, design reviews, specs handoff to eng, build review, cross-functional. Did NOT code Apple's platforms (producer). Reason for leaving: "Moved on to government technology assignments and returned to school to study Applied AI at University of Arizona." NOTE: an older AirPods/retail-560-locations framing exists — Ad Platform+Apple News is the version to use; do not mix.
- **Quigley-Simpson** — Senior Program Manager. Jun 2015–Jun 2016. Performance-marketing agency that HIRED him. Built SCE Charge Ready enrollment platform (CPUC-approved $436M EV-charging program; automated eligibility, doc mgmt, applicant/utility-review workflows) on **Microsoft Azure (Azure DevOps)**; migrated all ad units SWF/Flash→JavaScript; built design system; built corporate comms site (JS/CSS/SQL); led UX validation. **SCE Charge Ready lives under Quigley-Simpson, NOT DRGx — never double-list.**
- **Code and Theory** — Technical Program Manager. Feb 2021–Oct 2021. Enterprise clients incl. Amazon, Prudential.
- **Tibco (tibbr Geo)** — Lead UI Developer / Prototyper / Product Dev Lead. Jun 2011–Jun 2012. UI/experience layer on enterprise systems-level communications platform.
- **AltspaceVR** — Product Developer. Mar 2012–Jun 2012. Social VR / spatial-computing platform, later acquired by Microsoft 2017.
- **Atmosphere BBDO** — Senior Integrated Producer. 2008–2010. Produced VFX-involved broadcast campaigns: AT&T/Network trust campaign, Conservation International "Save an Acre" (aired during Super Bowl), Bud Light "Dude" VFX campaign.
- **Oscars.com — ABC/Disney** — Integrated Producer (Emmy Winner). Dec 2010–May 2011. Emmy-winning live-simulcast digital experience.
- Earlier/other: Milk Studios, Industrial Color; commercial work with Nike, Adidas, Google, Toyota, Condé Nast.

### Skills — HAVE vs. DON'T (critical for honesty)
- **HAVE:** Python, JavaScript/TypeScript, SQL, NoSQL/MongoDB, LLMs, RAG, agents, LangChain, prompt engineering, orchestration, MCP-style servers, CI/CD, Git, Tableau, Business Objects, data analysis/visualization, GCP, Azure (incl. Azure DevOps), Supabase/Postgres, Agile/Scrum/Lean, Jira, Confluence, UX/UI, information architecture, Figma, design systems, WCAG, program/project management, Claude Code/Cursor/Copilot.
- **DON'T HAVE (never claim):** professional AWS experience (only used it; Supabase runs on AWS ≠ AWS experience), Amazon Bedrock (production), PyTorch/scikit-learn deep ML, hardware/mechatronics engineering, deep Flask/Gunicorn/Nginx production, HEDIS/QIP/CMS healthcare P4P, FHIR/EDI, medical coding (CPT/ICD/SNOMED), cybersecurity as a practiced pillar (has U of A coursework only), Deltek/Esri ArcGIS (unless confirmed), Agile/Scrum certification (experience only, no cert).

### Education & Credentials
- **University of Arizona** — B.A.S., Applied Computing / Applied Artificial Intelligence. Jun 2024–Jun 2026 (expected). Tucson, AZ. Includes cybersecurity coursework.
- **Certs:** "Coding for Data Program (SQL & Python for Data Analytics)" — University of Arizona. "Website Audience Analysis Project — Data Visualization & Analysis" — Global Career Accelerator (Recording Academy).
- **John F. Kennedy University** — Institute of Entrepreneurial Leadership (Pleasant Hill, CA).
- **City College of San Francisco** — Photography & Multimedia Studies.
- **Foothill College** — Commercial Photography (Los Altos Hills, CA).
- **Emmy Award** — Outstanding Creative Achievement in Interactive Media (2011).
- Working photographer since 1995.

### Style preferences
- NEVER write "React/Next" (say "full-stack"). Shorten emails, plainer phrasing, fewer em-dashes. Sign "James." Present files immediately after building. Don't lead with "founder" for employee roles (flight-risk signal) — use "Creator & Product Lead" / "Built." Aura-farming-with-receipts: confident positioning always backed by verifiable work.

---

## PART 5 — AGENT ARCHITECTURE (contained application, Claude-powered)

### 5.1 Components
1. **JD Ingest** — paste JD text, URL, or upload. Parse to structured fields (Claude API, structured output).
2. **Profile Store** — the Part 4 canonical facts as a JSON/DB record. Editable. Includes HAVE/DON'T-HAVE skill lists as guardrails.
3. **Fit Analyzer** — Claude call: JD + profile → fit analysis (strong/gaps/verdict/flags). Returns "generate" or "skip."
4. **Clarifier** — if generation needs an unconfirmed fact, prompt the user (chat) before proceeding. Cache answers back to Profile Store.
5. **Resume Generator** — Claude call with the Part 1-3 rules as system prompt → structured resume content.
6. **Doc Builder** — render to Google Doc via Google Docs/Drive API using the ATS template (Part 2). Two variants (ATS + styled).
7. **Cover Letter Generator** — optional, Part 3.1 method.
8. **Application Logger** — appends to a Google Sheet: date, company, title, location, how-applied, pay, status.
9. **Opportunity Sourcer** (Part 5.3).

### 5.2 Claude API usage
- Model: a current Claude model via the candidate's API key.
- System prompt = Parts 1-3 (rules) + Part 4 (profile) + HAVE/DON'T guardrails.
- Use structured outputs (JSON) for parse steps; prose for resume/cover content.
- Guardrail check: after generation, a validation pass confirms no DON'T-HAVE skill was claimed and no employer/date was invented vs. the profile. Flag violations for human review.

### 5.3 Opportunity sourcing (once profile context is set)
Given the candidate's target roles, moat, location/remote prefs, and comp floor:
- Search job boards / feeds (LinkedIn, Indeed, Dice, company career pages, Greenhouse/Lever/Ashby aggregators) for matching titles + keywords.
- Score each hit against the profile via the Fit Analyzer; surface only "clean fit" and "legitimate reach," suppress "skip."
- For each surfaced role: one-line why-it-fits + the flags (evergreen, LI-DNI, on-site, comp).
- Rank by fit strength × freshness. Present a shortlist; on approval, auto-generate tailored docs + log.
- Respect: only public postings; note when a role is agency/evergreen/compliance so the candidate calibrates effort.

### 5.4 Target role families for this candidate (sourcing filters)
AI Product Manager/Leader · Technical Program Manager (esp. Physical AI/robotics) · Design/Creative Producer · Application Development Manager · Forward-Deployed AI Engineer · Digital/Website Program Manager · AI Transformation Consultant. Weight toward: builds real AI systems, ships 0→1, robotics/HRI, creative+tech hybrid, gov/enterprise delivery. Filter OUT: quota-carrying sales leadership, deep-hardware/mechatronics engineering, security-specialist roles, deep-classical-ML research.

---

## PART 6 — APPLICATION LOG SCHEMA
Google Sheet columns: Date Applied | Employer | Position Title | Location | How Applied | Pay/Range | Status (Submitted / Applied / In progress / Prepared-not-sent / Not accepted) | Notes (recruiter, referral, req #). One row per application. Keep statuses honest for benefits/aid reporting.

---

## PART 7 — GUARDRAIL SUMMARY (the one-screen version)
1. Never invent facts. 2. Every claim interview-defensible. 3. Reframe, never inflate. 4. Scope precisely. 5. Fit analysis before generation; recommend skipping bad-fit/different-profession roles. 6. Lead with the moat, match frame to job family. 7. Mirror JD keywords — only true ones. 8. ATS format: single column, one font, plain dates, standard bullets, 2 pages OK. 9. Ask before assuming an unconfirmed fact. 10. Validate output against HAVE/DON'T lists. 11. Consistency across resume/site/LinkedIn (entity names, dates, SCE-under-Quigley-Simpson). 12. Log every application honestly.
