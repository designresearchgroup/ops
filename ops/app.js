/* ============================================================================
 * OPS — Job Opportunity Validator & Processor
 * A contained, Claude-powered app for validating and processing job opportunities
 * against a canonical profile with honesty guardrails (SKILL Parts 1–7).
 * Everything runs in the browser; the Claude API is called directly with the
 * user's own key. No server, no data leaves the machine except the API call.
 * ==========================================================================*/

const LS = {
  key: 'ops.apiKey',
  model: 'ops.model',
  mode: 'ops.mode',        // 'proxy' (server secret) | 'direct' (browser key)
  profile: 'ops.profile',
  tracker: 'ops.tracker',
  chat: 'ops.chat',
  trends: 'ops.trends',
  interview: 'ops.interview',
  template: 'ops.template',
  theme: 'ops.theme'
};
const API_URL = 'https://api.anthropic.com/v1/messages';
// Server proxy route (PHP at ops/api/claude.php on GoDaddy).
// Resolved relative to this page so it works wherever /ops/ is mounted.
const PROXY_URL = new URL('api/claude.php', location.href.replace(/[^/]*$/, '')).href;
const MODELS = [
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 (recommended)' },
  { id: 'claude-opus-5', label: 'Claude Opus 5 (deepest reasoning)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (fastest / cheapest)' }
];

/* ---------- tiny helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(kid));
  return n;
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
function load(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Could not save locally: ' + e.message, true); } }

let toastTimer;
function toast(msg, isErr = false) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = 'toast', 2600);
}

/* ---------- state ---------- */
let state = {
  profile: load(LS.profile, null) || structuredCloneSafe(window.DEFAULT_PROFILE),
  tracker: load(LS.tracker, null),
  lastAnalysis: null,     // most recent fit analysis
  lastJD: '',
  lastDocs: null,         // { resume, cover_letter, self_check }
  clarifierAnswers: {},
  chat: load(LS.chat, []),
  trends: load(LS.trends, null),
  interview: load(LS.interview, { jd: '', resumeName: '', resumeText: '' }),
  template: load(LS.template, { a: 0, f: 0, h: 0 })
};
if (!state.tracker) { state.tracker = seedTracker(); save(LS.tracker, state.tracker); }

function structuredCloneSafe(o) { return JSON.parse(JSON.stringify(o)); }
function seedTracker() {
  return (window.SEED_PIPELINE || []).map(r => {
    const est = estimateCash(r);
    return {
      id: uid(), dateApplied: '', createdAt: Date.now(),
      employer: r.employer, title: r.title, location: r.location || '',
      howApplied: r.howApplied || '', pay: r.pay || '', status: r.status,
      notes: r.notes || '', tier: r.tier || null, verdict: r.verdict || null,
      flags: r.flags || [], fit: r.fit || '',
      potentialAmount: est.amount, potentialMidpoint: est.mid, probability: est.prob
    };
  });
}
// Starting estimate for seeded rows (transparent, code-derived; refine per role by validating).
function parsePayMid(pay) {
  if (!pay) return null;
  const hr = /(\d+(?:\.\d+)?)\s*\/?\s*hr/i.exec(pay);
  if (hr) return Math.round(parseFloat(hr[1]) * 2080);
  const nums = (pay.match(/\$?\s*(\d{2,3})\s*[kK]/g) || []).map(s => parseInt(s.replace(/[^\d]/g, ''), 10) * 1000);
  if (nums.length >= 2) return Math.round((nums[0] + nums[1]) / 2);
  if (nums.length === 1) return nums[0];
  return null;
}
function estMidFromTitle(t) {
  t = (t || '').toLowerCase();
  if (/director|principal|head|lead|staff/.test(t)) return 235000;
  if (/tpm|technical program|product manager|product leader|ai|forward deployed|engineer/.test(t)) return 210000;
  if (/manager|producer|consultant|transformation/.test(t)) return 165000;
  if (/specialist|analyst|designer|cro|web/.test(t)) return 130000;
  return 150000;
}
function estimateCash(r) {
  const mid = parsePayMid(r.pay) || estMidFromTitle(r.title);
  let prob = { clean_fit: 55, legitimate_reach: 32, skip: 5 }[r.verdict] ?? 38;
  const s = r.status;
  if (s === 'Submitted' || s === 'Applied') prob += 12;
  else if (s === 'In progress') prob += 22;
  else if (s === 'Not accepted') prob = 0;
  if ((r.flags || []).some(f => /evergreen|LI-DNI|internal|wired|different profession|defense/i.test(f))) prob = Math.round(prob * 0.6);
  prob = Math.max(0, Math.min(90, prob));
  const amount = r.pay || (mid ? fmtUSD(mid) + '/yr (est.)' : '');
  return { amount, mid, prob };
}

/* ============================================================================
 * Claude API
 * ==========================================================================*/
function getKey() { return load(LS.key, '') || ''; }
function getModel() { return load(LS.model, MODELS[0].id); }
// Default to proxy when served over http(s) (deployed), direct when opened as a file.
function getMode() { return load(LS.mode, location.protocol === 'file:' ? 'direct' : 'proxy'); }
function ready() { return getMode() === 'proxy' || !!getKey(); }

async function callClaude({ system, messages, tools, tool_choice, max_tokens = 4096 }) {
  const mode = getMode();
  const body = { model: getModel(), max_tokens, messages };
  if (system) body.system = system;
  if (tools) body.tools = tools;
  if (tool_choice) body.tool_choice = tool_choice;

  let url, headers;
  if (mode === 'proxy') {
    if (window.SB && SB.configured()) {
      url = SB.edgeFn('claude');
      headers = { 'content-type': 'application/json', apikey: SB.anonKey(), Authorization: 'Bearer ' + SB.anonKey() };
    } else {
      url = PROXY_URL;
      headers = { 'content-type': 'application/json' };
    }
  } else {
    const key = getKey();
    if (!key) throw new Error('NO_KEY');
    url = API_URL;
    headers = {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    };
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = j.error?.message || JSON.stringify(j.error || j); } catch { detail = await res.text().catch(() => ''); }
    const err = new Error(detail || (res.status + ' ' + res.statusText));
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function toolResult(resp, toolName) {
  const block = (resp.content || []).find(b => b.type === 'tool_use' && b.name === toolName);
  if (!block) {
    const text = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    throw new Error('Model did not return structured output. ' + (text ? 'It said: ' + text.slice(0, 300) : ''));
  }
  return block.input;
}
function textOf(resp) { return (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim(); }

/* ---------- system prompt: rules + profile + guardrails (Parts 1–4) ---------- */
function buildSystemPrompt() {
  const p = state.profile;
  const emp = p.employment.map(e =>
    `- ${e.company}${e.title ? ' — ' + e.title : ''}${e.dates ? ' (' + e.dates + ')' : ''}: ${e.summary}${e.stack ? ' Stack: ' + e.stack : ''}`
  ).join('\n');

  return `You are the Job Opportunity Agent for candidate ${p.identity.name}. You validate and tailor job opportunities under strict honesty guardrails. These rules are non-negotiable.

CORE OPERATING PRINCIPLES (SKILL Part 1)
1. Honesty is the product. Never fabricate employers, titles, dates, degrees, certifications, skills, or metrics. Every claim must be defensible in a live interview.
2. Reframe, don't inflate. When adjacent to a requirement, state the true adjacent strength ("comfortable in X, ramps quickly"), never claim years the candidate lacks.
3. Scope claims precisely. "Concept-car design (design/experience side)" ≠ "engineered the vehicle." "Ran delivery of the robot's UI" ≠ "built the robot." "Used AWS" ≠ "professional AWS experience."
4. The fit analysis comes FIRST. Output strong fits (requirement → evidence), gaps/stretches (flagged plainly), a verdict (clean_fit / legitimate_reach / skip) with one-line reasoning, and special flags.
5. If a role is a different profession from the candidate's background (quota-carrying enterprise sales, deep hardware engineering, security specialist without receipts, deep classical-ML research), recommend SKIP rather than generating a resume that will auto-screen.
6. Lead with the MOAT — the rare, differentiated combination — not generic boilerplate. Pick ONE primary frame matched to the role's job family.
7. Mirror the JD's exact keywords/phrases — but ONLY the true ones. Never keyword-stuff with skills the candidate lacks.

THE MOAT (positioning through-line)
${p.moat}

CANONICAL PROFILE — the only facts you may use (SKILL Part 4)
Name: ${p.identity.name}
Contact: ${p.identity.phone} · ${p.identity.email} · ${p.identity.portfolio} · ${p.identity.linkedin}
Location: ${p.identity.location} (${p.identity.locationNote})
Work auth: ${p.identity.workAuth}
Comp floor: ${p.identity.compFloor}

EMPLOYMENT HISTORY (verified — use these, invent nothing beyond them):
${emp}

EDUCATION & CREDENTIALS:
${p.education.map(e => '- ' + e).join('\n')}

SKILLS THE CANDIDATE HAS (safe to claim when true for the role):
${p.skillsHave.join('; ')}

SKILLS THE CANDIDATE DOES NOT HAVE (NEVER claim these — flag as gaps if required):
${p.skillsDontHave.map(s => '- ' + s).join('\n')}

STYLE PREFERENCES:
${p.stylePreferences.map(s => '- ' + s).join('\n')}

CONSISTENCY RULES: SCE Charge Ready lives under Quigley-Simpson (built on Azure/Azure DevOps), never DRGx. Apple = Product Design Producer, Ad Platform + Apple News (producer, did not code the platforms). Hummer EV = concept design/experience only. Don't lead with "founder" on employee roles — use "Creator & Product Lead" / "Built."`;
}

/* ============================================================================
 * TAB: VALIDATE
 * ==========================================================================*/
const FIT_TOOL = {
  name: 'submit_fit_analysis',
  description: 'Return the honest fit analysis for this job description against the candidate profile.',
  input_schema: {
    type: 'object',
    properties: {
      parsed: {
        type: 'object', description: 'Parsed JD facts.',
        properties: {
          title: { type: 'string' }, company: { type: 'string' },
          location: { type: 'string' }, comp: { type: 'string', description: 'Pay/range if stated, else empty.' }
        },
        required: ['title', 'company', 'location', 'comp']
      },
      primary_frame: { type: 'string', description: 'The ONE lead angle to position the candidate for this role (e.g., "Technical Program Manager — Physical AI").' },
      verdict: { type: 'string', enum: ['clean_fit', 'legitimate_reach', 'skip'] },
      verdict_reason: { type: 'string', description: 'One-line reasoning for the verdict.' },
      strong_fits: {
        type: 'array', description: 'Requirements the candidate genuinely meets.',
        items: { type: 'object', properties: { requirement: { type: 'string' }, evidence: { type: 'string', description: 'Specific candidate evidence from the profile.' } }, required: ['requirement', 'evidence'] }
      },
      gaps: {
        type: 'array', description: 'Stated requirements the candidate does not meet — flagged plainly, never papered over.',
        items: { type: 'object', properties: { requirement: { type: 'string' }, note: { type: 'string', description: 'Honest read: true absence, or adjacent strength to reframe.' } }, required: ['requirement', 'note'] }
      },
      flags: {
        type: 'array', description: 'Special flags.',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['hard_gate', 'li_dni', 'evergreen', 'onsite_relocation', 'comp', 'no_sponsorship', 'agency', 'different_profession', 'other'] },
            detail: { type: 'string' }, hard: { type: 'boolean', description: 'true if this is a hard blocker (degree gate, specific years, named cert/tool, wrong profession).' }
          },
          required: ['type', 'detail', 'hard']
        }
      },
      keywords: { type: 'array', items: { type: 'string' }, description: 'JD keywords/phrases that are TRUE for the candidate and should be mirrored in the resume.' },
      donthave_required: { type: 'array', items: { type: 'string' }, description: 'Any DON\'T-HAVE skills the JD requires — must be surfaced, never claimed.' },
      cash: {
        type: 'object',
        description: 'Per-opportunity cash rating — the money THIS single opportunity is worth, not an annual salary or an aggregate.',
        properties: {
          potential_amount: { type: 'string', description: 'Realistic cash THIS opportunity pays if landed, as a figure or range. A gig, task, or contract engagement is typically hundreds to a few thousand dollars — use the posted pay if there is one; do not annualize a salary into a large number.' },
          potential_midpoint_usd: { type: 'integer', description: 'Single USD midpoint of potential_amount for this one opportunity, as an integer (e.g. 850 or 3200).' },
          conversion_probability: { type: 'integer', description: 'HONEST percent (0–100) that this converts to cash — the user lands it AND gets paid. Weigh fit, gaps, competition and posting authenticity: cut it hard for ghost/fake/evergreen/likely-internal postings.' },
          basis: { type: 'string', description: 'One line on what drives both numbers.' }
        },
        required: ['potential_amount', 'potential_midpoint_usd', 'conversion_probability', 'basis']
      },
      authenticity: {
        type: 'object',
        description: 'Threat/legitimacy assessment of the posting itself — how likely it is a low-yield posting. Judge ONLY from tells in the JD text; do not speculate beyond evidence.',
        properties: {
          risk: { type: 'string', enum: ['low', 'elevated', 'high'], description: 'Overall risk that applying here is low-yield (ghost / fake / already decided).' },
          likely_internal: { type: 'boolean', description: 'Tells suggest a pre-identified internal or known candidate (e.g. hyper-specific must-haves, "for the right person already known", compliance/PERM #LI-DNI language).' },
          ghost_or_fake: { type: 'boolean', description: 'Tells suggest a ghost job (perpetual pipeline, never actually hiring), a fake/scam posting (vague company, urgency + personal email, pay-to-start, data harvesting), or an AGGREGATOR REPOST / job-alert-spam (LENSA, ZipRecruiter/Jobcase-style, Lensa/Talent.com scrapers) where the listing is a middleman copy, not the employer\'s own posting.' },
          signals: { type: 'array', items: { type: 'object', properties: { signal: { type: 'string' }, detail: { type: 'string' } }, required: ['signal', 'detail'] }, description: 'Concrete tells from the JD or its source: aggregator/scraper repost (LENSA and similar job-alert spam — send them to find the employer\'s own posting), evergreen/reposted language, PERM/#LI-DNI, agency-not-direct, over-specified requirements, no company identity, unrealistic scope, salary/urgency red flags. Empty if it reads legitimate.' },
          recommendation: { type: 'string', description: 'One line: how much effort to invest given the risk (e.g. "apply direct + find a referral; skip the portal", "worth a fast application only", "likely wired — deprioritize").' }
        },
        required: ['risk', 'likely_internal', 'ghost_or_fake', 'signals', 'recommendation']
      },
      template_response: { type: 'string', description: 'A ready-to-send outreach/application message the user can copy and send NOW — 4–6 short sentences, plain and human, moat-led, honest about any gap, tuned to this specific opportunity. Sign "James." Empty string only if the verdict is skip.' },
      clarifiers: { type: 'array', items: { type: 'string' }, description: 'Questions to ask the candidate before generating, when a requirement needs a fact not in the profile. Empty if none.' }
    },
    required: ['parsed', 'primary_frame', 'verdict', 'verdict_reason', 'strong_fits', 'gaps', 'flags', 'keywords', 'donthave_required', 'cash', 'authenticity', 'template_response', 'clarifiers']
  }
};

async function runValidate() {
  const jd = $('#jd').value.trim();
  if (jd.length < 40) { toast('Paste a fuller job description first.', true); return; }
  if (!ready()) { toast('Add your Claude API key (or use the server proxy) in Settings first.', true); switchTab('settings'); return; }

  state.lastJD = jd; state.lastDocs = null; state.clarifierAnswers = {};
  const btn = $('#btn-validate');
  setBtnLoading(btn, true, 'Validating…');
  $('#validate-error').hidden = true;
  $('#validate-empty').hidden = true;
  $('#result').innerHTML = '';
  $('#result').append(loadingCard('Running the fit analysis…'));

  try {
    const resp = await callClaude({
      system: buildSystemPrompt(),
      max_tokens: 3000,
      tools: [FIT_TOOL],
      tool_choice: { type: 'tool', name: 'submit_fit_analysis' },
      messages: [{ role: 'user', content: `Parse this job description and run the fit analysis. Be honest — recommend "skip" if it's a different profession or the hard gates are disqualifying.\n\nAlso run the posting threat assessment: from tells in the JD text alone, judge whether this is likely a ghost job, a fake/scam, an evergreen pipeline post, a compliance/PERM posting (#LI-DNI), agency-not-direct, or a role likely already earmarked for an internal/known candidate — and how much effort it's worth. Don't speculate beyond what the text supports.\n\nAnd give the cash read — Giggy is a cash partner: the realistic annualized cash value if landed, and an HONEST probability it converts to cash. Cut the probability hard for ghost/fake/evergreen/likely-internal postings and unclearable hard gates; a great-fit clean role converts far better than a legitimate reach behind a wired posting.\n\nJOB DESCRIPTION:\n${jd}` }]
    });
    const analysis = toolResult(resp, 'submit_fit_analysis');
    state.lastAnalysis = analysis;
    renderAnalysis(analysis);
  } catch (e) {
    $('#result').innerHTML = '';
    showApiError('#validate-error', e);
  } finally {
    setBtnLoading(btn, false);
  }
}

function renderAnalysis(a) {
  const root = $('#result'); root.innerHTML = '';
  const p = a.parsed || {};
  const vlabel = { clean_fit: 'Clean fit', legitimate_reach: 'Legitimate reach', skip: 'Skip' }[a.verdict] || a.verdict;

  const head = el('div', { class: 'card pad' });
  head.append(
    el('div', { class: 'verdict-head' },
      el('span', { class: 'verdict-badge verdict-' + a.verdict }, el('span', { class: 'vdot' }), vlabel),
      el('div', { class: 'small muted', style: 'flex:1;min-width:180px' }, a.verdict_reason)
    ),
    el('div', { class: 'meta-line', html: `<b>${esc(p.title || '—')}</b> · ${esc(p.company || '—')}${p.location ? ' · ' + esc(p.location) : ''}${p.comp ? ' · ' + esc(p.comp) : ''}` }),
    el('div', { class: 'frame-chip' }, el('span', { class: 'lead' }, 'Lead frame'), el('span', {}, a.primary_frame || '—'))
  );

  // Guardrail / don't-have surfacing
  if (a.donthave_required && a.donthave_required.length) {
    const g = el('div', { class: 'guardrail-bad' });
    g.append(el('div', { style: 'display:flex;gap:7px;align-items:center' }, ico(IC.warn), el('b', {}, 'Guardrail — JD requires skills the candidate must NOT claim:')));
    g.append(el('ul', { style: 'margin:6px 0 0;padding-left:18px' }, ...a.donthave_required.map(s => el('li', {}, s))));
    head.append(g);
  }
  root.append(head);

  // Cash read (Giggy's headline)
  if (a.cash) renderCash(root, a.cash);

  // Posting threat assessment
  if (a.authenticity) renderAuthenticity(root, a.authenticity);

  // Flags
  if (a.flags && a.flags.length) {
    const sec = section('Flags');
    a.flags.forEach(f => {
      sec.append(el('div', { class: 'flag' + (f.hard ? ' hard' : '') },
        el('span', { class: 'ftype' }, prettyFlag(f.type)),
        el('span', {}, f.detail)));
    });
    root.append(sec);
  }

  // Strong fits
  if (a.strong_fits && a.strong_fits.length) {
    const sec = section(`Strong fits · ${a.strong_fits.length}`);
    a.strong_fits.forEach(f => sec.append(el('div', { class: 'item good' },
      el('div', { class: 'req' }, el('span', { html: CHECK }), el('span', {}, f.requirement)),
      el('div', { class: 'ev' }, f.evidence))));
    root.append(sec);
  }

  // Gaps
  if (a.gaps && a.gaps.length) {
    const sec = section(`Gaps / stretches · ${a.gaps.length}`);
    a.gaps.forEach(f => sec.append(el('div', { class: 'item gap' },
      el('div', { class: 'req' }, el('span', { html: TRI }), el('span', {}, f.requirement)),
      el('div', { class: 'ev' }, f.note))));
    root.append(sec);
  }

  // Keywords
  if (a.keywords && a.keywords.length) {
    const sec = section('Keywords to mirror (true only)');
    const chips = el('div', { style: 'display:flex;flex-wrap:wrap;gap:7px' });
    a.keywords.forEach(k => chips.append(el('span', { class: 'tag kw' }, k)));
    sec.append(chips); root.append(sec);
  }

  // Clarifiers
  if (a.clarifiers && a.clarifiers.length) {
    const c = el('div', { class: 'clarifier' });
    c.append(el('h3', {}, ico(IC.help), 'Confirm before generating — never assume'));
    a.clarifiers.forEach((q, i) => {
      c.append(el('div', { class: 'q' }, q,
        el('textarea', { id: 'clar-' + i, placeholder: 'Your answer (optional — leave blank to skip)', oninput: e => state.clarifierAnswers[q] = e.target.value })));
    });
    root.append(c);
  }

  // Actions
  const actions = el('div', { class: 'card pad btnrow', style: 'margin-top:16px' });
  if (a.verdict !== 'skip') {
    actions.append(el('button', { class: 'btn ok', id: 'btn-generate', onclick: runGenerate }, ico(IC.doc), 'Generate CV + cover letter'));
  } else {
    actions.append(el('div', { class: 'small muted', style: 'flex:1' }, 'Verdict is skip — generation intentionally disabled. Reframe the role or move on.'));
  }
  actions.append(el('button', { class: 'btn', onclick: logCurrent }, ico(IC.plus), 'Add to pipeline'));
  root.append(actions);
  root.append(el('div', { id: 'docs-out' }));
  root.append(el('div', { id: 'generate-error', class: 'err-box', hidden: 'true', style: 'margin-top:14px' }));
}

function section(title) {
  const s = el('div', { class: 'card pad', style: 'margin-top:16px' });
  s.append(el('p', { class: 'section-label' }, title));
  return s;
}
function fmtUSD(n) {
  n = Math.round(Number(n) || 0);
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(n % 1000000 ? 1 : 0).replace(/\.0$/, '') + 'M';
  if (n >= 10000) return '$' + Math.round(n / 1000) + 'K';   // 10k+ → compact
  return '$' + n.toLocaleString();                            // hundreds/thousands → exact ($1,750, $850)
}
function probClass(p) { return p >= 55 ? 'ok' : p >= 30 ? 'warn' : 'bad'; }
function renderCash(root, cash) {
  const mid = Number(cash.potential_midpoint_usd) || 0;
  const prob = Math.max(0, Math.min(100, Number(cash.conversion_probability) || 0));
  const expected = Math.round(mid * prob / 100);
  const sec = section('Cash read');
  const row = el('div', { class: 'cash-row' });
  row.append(
    el('div', { class: 'cash-cell' }, el('div', { class: 'cash-k' }, 'Potential'), el('div', { class: 'cash-v' }, cash.potential_amount || fmtUSD(mid))),
    el('div', { class: 'cash-cell' }, el('div', { class: 'cash-k' }, 'Convert to cash'), el('div', { class: 'cash-v ' + probClass(prob) }, prob + '%')),
    el('div', { class: 'cash-cell hero' }, el('div', { class: 'cash-k' }, 'Expected value'), el('div', { class: 'cash-v' }, fmtUSD(expected)))
  );
  sec.append(row);
  // probability meter
  sec.append(el('div', { class: 'bar', style: 'margin-top:12px' }, el('span', { class: 'meter ' + probClass(prob), style: 'width:' + prob + '%' })));
  if (cash.basis) sec.append(el('div', { class: 'small muted', style: 'margin-top:8px' }, cash.basis));
  root.append(sec);
}
function renderAuthenticity(root, au) {
  const sec = section('Posting check — is it real?');
  const riskCls = { low: 'ok', elevated: 'warn', high: 'bad' }[au.risk] || 'neutral';
  const riskLbl = { low: 'Looks legitimate', elevated: 'Apply with caution', high: 'Low-yield — likely ghost/wired' }[au.risk] || au.risk;
  const head = el('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px' });
  head.append(el('span', { class: 'pill ' + riskCls }, el('span', { class: 'dt' }), riskLbl));
  if (au.likely_internal) head.append(el('span', { class: 'pill warn' }, 'Likely internal/known candidate'));
  if (au.ghost_or_fake) head.append(el('span', { class: 'pill bad' }, 'Ghost / fake signals'));
  sec.append(head);
  if (au.signals && au.signals.length) {
    au.signals.forEach(s => sec.append(el('div', { class: 'item', style: 'border-top:1px solid var(--border-2)' },
      el('div', { class: 'req' }, s.signal), el('div', { class: 'ev', style: 'padding-left:0' }, s.detail))));
  } else {
    sec.append(el('div', { class: 'small muted' }, 'No obvious red flags in the posting text.'));
  }
  if (au.recommendation) sec.append(el('div', { class: 'frame-chip', style: 'margin-top:10px' }, el('span', { class: 'lead' }, 'Play'), el('span', {}, au.recommendation)));
  root.append(sec);
}
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const TRI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
// Professional icon set (stroke, currentColor). No emoji anywhere in the UI.
const S = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">';
const IC = {
  doc: S + '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  plus: S + '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  download: S + '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  copy: S + '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  print: S + '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  x: S + '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  cash: S + '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  warn: S.replace('1.9', '2') + '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  help: S + '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  flag: S + '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
  sun: S + '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: S + '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
};
function ico(svg) { return el('span', { class: 'ico', html: svg }); }
function prettyFlag(t) {
  return { hard_gate: 'Hard gate', li_dni: '#LI-DNI', evergreen: 'Evergreen', onsite_relocation: 'On-site', comp: 'Comp', no_sponsorship: 'Sponsorship', agency: 'Agency', different_profession: 'Wrong lane', other: 'Note' }[t] || t;
}

/* ---------- Generate resume + cover letter (Parts 2, 3) ---------- */
const DOC_TOOL = {
  name: 'submit_documents',
  description: 'Return a STRUCTURED resume (rendered deterministically to an ATS-safe PDF), a cover letter, and a guardrail self-check. Do not format the resume as prose — fill the fields.',
  input_schema: {
    type: 'object',
    properties: {
      resume: {
        type: 'object',
        description: 'Structured resume content. Reverse-chronological or relevance-forward. Every fact must come from the candidate profile — invent nothing.',
        properties: {
          name: { type: 'string' },
          target_title: { type: 'string', description: 'The role title to lead with, matched to this JD (e.g. "Technical Program Manager — Physical AI").' },
          contact: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'Location line tuned to the role\'s geography (do not lead with SoCal for an NYC role).' },
              phone: { type: 'string' }, email: { type: 'string' }, portfolio: { type: 'string' }, linkedin: { type: 'string' }
            },
            required: ['location', 'phone', 'email', 'portfolio', 'linkedin']
          },
          summary: { type: 'string', description: '3–5 sentences. Leads with the moat, keyword-rich, no generic openers.' },
          core_skills: {
            type: 'array', description: 'Keyword-dense, grouped. Only true skills.',
            items: { type: 'object', properties: { category: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } }, required: ['category', 'items'] }
          },
          role_alignment: { type: 'array', items: { type: 'string' }, description: 'Optional. 3–5 bullets mirroring the JD\'s top responsibilities in the candidate\'s true terms. Empty array to omit.' },
          experience: {
            type: 'array', description: 'Relevant roles, strongest first. Demote/omit roles that dilute the target frame.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' }, company: { type: 'string' },
                location: { type: 'string', description: 'Optional; empty string if not needed.' },
                dates: { type: 'string', description: 'Plain text "Mon YYYY - Mon YYYY".' },
                bullets: { type: 'array', items: { type: 'string' }, description: 'Achievement-oriented, scoped precisely, JD keywords woven in where true.' }
              },
              required: ['title', 'company', 'location', 'dates', 'bullets']
            }
          },
          education: { type: 'array', items: { type: 'string' }, description: 'Degrees & certifications, each one line.' },
          awards: { type: 'array', items: { type: 'string' }, description: 'Optional clients/awards. Empty array to omit.' }
        },
        required: ['name', 'target_title', 'contact', 'summary', 'core_skills', 'role_alignment', 'experience', 'education', 'awards']
      },
      cover_letter: { type: 'string', description: '4–5 short paragraphs per the cover-letter method: open on the role\'s specific hook, lead with moat + proof, address the biggest gap honestly in one paragraph, match cultural tone, close with a specific offer. Sign "James." Separate paragraphs with a blank line. Empty string if not applicable.' },
      self_check: {
        type: 'object', description: 'Validation pass against the guardrails.',
        properties: {
          claimed_donthave: { type: 'array', items: { type: 'string' }, description: 'Any DON\'T-HAVE skills that ended up claimed (should be empty).' },
          invented_facts: { type: 'array', items: { type: 'string' }, description: 'Any employers/titles/dates/metrics not in the profile (should be empty).' },
          notes: { type: 'string', description: 'Any honesty caveats the candidate should know.' }
        },
        required: ['claimed_donthave', 'invented_facts', 'notes']
      }
    },
    required: ['resume', 'cover_letter', 'self_check']
  }
};

async function runGenerate() {
  const a = state.lastAnalysis; if (!a) return;
  const btn = $('#btn-generate'); setBtnLoading(btn, true, 'Generating…');
  $('#generate-error').hidden = true;
  const out = $('#docs-out'); out.innerHTML = ''; out.append(loadingCard('Writing the ATS resume + cover letter, then validating against the HAVE/DON\'T lists…'));

  const clar = Object.entries(state.clarifierAnswers).filter(([, v]) => v && v.trim()).map(([q, v]) => `- ${q} → ${v.trim()}`).join('\n');
  const userMsg = `Fill the structured resume for this role. Lead frame: "${a.primary_frame}". Target title should reflect it. Mirror ONLY these true keywords where honest: ${(a.keywords || []).join(', ')}.
Honestly frame these gaps (do not paper over, do not claim): ${(a.gaps || []).map(g => g.requirement).join('; ') || 'none'}.
${clar ? 'Candidate-confirmed facts (use these, still nothing beyond the profile):\n' + clar + '\n' : ''}
Rules: single column; summary leads with the moat (no generic openers); core skills grouped and keyword-dense but only true; experience relevance-forward with precise scope (Hummer EV = concept design; Apple = producer; SCE under Quigley-Simpson); 4–8 tight bullets on lead roles, fewer on older ones; two pages is fine. Write a cover letter that addresses the biggest gap honestly. Then run the self-check against the HAVE/DON'T lists.

JOB DESCRIPTION:
${state.lastJD}`;

  try {
    const resp = await callClaude({
      system: buildSystemPrompt(),
      max_tokens: 8000,
      tools: [DOC_TOOL],
      tool_choice: { type: 'tool', name: 'submit_documents' },
      messages: [{ role: 'user', content: userMsg }]
    });
    const docs = toolResult(resp, 'submit_documents');
    state.lastDocs = docs;
    renderDocs(docs);
  } catch (e) {
    $('#docs-out').innerHTML = '';
    showApiError('#generate-error', e);
  } finally {
    setBtnLoading(btn, false);
  }
}

function renderDocs(d, container) {
  const out = container || $('#docs-out');
  if (!container) out.innerHTML = '';   // when targeting the Validate result slot, clear it; preview manages its own header
  const panel = el('div', { class: container ? 'card pad' : 'card pad', style: 'margin-top:12px' });

  // guardrail: deterministic code gate (Node 6) + LLM self-check
  const sc = d.self_check || { claimed_donthave: [], invented_facts: [], notes: '' };
  const det = deterministicGuardrail(d.resume || {});
  state.lastGuard = det;
  const llmClean = (!sc.claimed_donthave || !sc.claimed_donthave.length) && (!sc.invented_facts || !sc.invented_facts.length);
  if (det.clean && llmClean) {
    panel.append(el('div', { class: 'guardrail-ok' }, el('span', { html: CHECK }), 'Guardrail passed — code scan + model self-check found no DON\'T-HAVE claims or invented employers.' + (sc.notes ? ' Note: ' + sc.notes : '')));
  } else {
    const g = el('div', { class: 'guardrail-bad' });
    g.append(el('div', { style: 'display:flex;gap:7px;align-items:center' }, ico(IC.warn), el('b', {}, 'Guardrail flagged issues — review before sending:')));
    if (det.claimed.length) g.append(el('div', {}, el('b', {}, 'Code scan — DON\'T-HAVE terms present: '), det.claimed.join(', ')));
    if (det.invented.length) g.append(el('div', {}, el('b', {}, 'Code scan — employer not in profile: '), det.invented.join(', ')));
    if (sc.claimed_donthave?.length) g.append(el('div', {}, 'Model flagged claims: ' + sc.claimed_donthave.join('; ')));
    if (sc.invented_facts?.length) g.append(el('div', {}, 'Model flagged facts: ' + sc.invented_facts.join('; ')));
    if (sc.notes) g.append(el('div', { class: 'muted' }, sc.notes));
    panel.append(g);
  }

  const r = d.resume || {};
  // doc tabs — real rendered previews
  const tabs = el('div', { class: 'doc-tabs', style: 'margin-top:14px' });
  const stage = el('div', { class: 'doc-stage' });
  const styledPage = () => { const p = el('div', { class: 'resume-page styled', html: resumeHTML(r, true) }); applyTemplate(p); return p; };
  const views = [
    { key: 'ats', label: 'Résumé — ATS', build: () => el('div', { class: 'resume-page', html: resumeHTML(r, false) }) },
    { key: 'styled', label: 'Design · ' + TEMPLATE_COUNT + '+', build: styledPage },
    { key: 'cover', label: 'Cover letter', build: () => el('div', { class: 'resume-page', html: coverHTML(d.cover_letter || '') }) }
  ];
  let active = (docActive === 'cover' && !d.cover_letter) ? 'ats' : docActive;
  const paint = () => {
    stage.innerHTML = '';
    if (active === 'styled') stage.append(templateBar());
    stage.append(views.find(v => v.key === active).build());
    $$('.doc-tab', tabs).forEach(t => t.classList.toggle('active', t.dataset.k === active));
  };
  views.forEach(v => { if (v.key === 'cover' && !d.cover_letter) return; tabs.append(el('button', { class: 'doc-tab', 'data-k': v.key, onclick: () => { active = v.key; docActive = v.key; paint(); } }, v.label)); });
  panel.append(tabs, stage);

  // actions
  const safe = (state.lastAnalysis?.parsed?.company || 'Company').replace(/[^a-z0-9]+/gi, '');
  const row = el('div', { class: 'btnrow', style: 'margin-top:14px' });
  row.append(
    el('button', { class: 'btn sm primary', onclick: () => savePDF('ats') }, ico(IC.print), 'PDF — ATS'),
    el('button', { class: 'btn sm', onclick: () => savePDF('styled') }, ico(IC.print), 'PDF — Styled'),
    d.cover_letter ? el('button', { class: 'btn sm', onclick: () => savePDF('cover') }, ico(IC.print), 'PDF — Cover') : null,
    el('button', { class: 'btn sm', onclick: () => copyText(active === 'cover' ? d.cover_letter : resumeText(r)) }, ico(IC.copy), 'Copy'),
    el('button', { class: 'btn sm', onclick: () => download(`James_Coleman_${safe}.md`, docsMarkdown(d)) }, ico(IC.download), '.md')
  );
  panel.append(row);
  panel.append(el('div', { class: 'hint' }, 'PDFs are real, selectable text — ATS-parseable, single column, one font, plain dates, round bullets. In the print dialog pick “Save as PDF”, paper size Letter, margins Default. The styled variant is the same content with navy headings + a green rule for human/direct send.'));
  out.append(panel);
  paint();
}

function docsMarkdown(d) {
  return `# Résumé (ATS)\n\n${resumeText(d.resume || {})}\n\n---\n\n# Cover Letter\n\n${d.cover_letter || '(none)'}\n`;
}

/* ============================================================================
 * TAB: TRACKER  (SKILL Part 6 schema)
 * ==========================================================================*/
const STATUSES = ['Submitted', 'Applied', 'In progress', 'Prepared-not-sent', 'Not accepted'];

/* ---- cloud sync (Supabase, optional) ---- */
function dbOn() { return !!(window.SB && SB.configured()); }
function dbUpsert(rec) { if (dbOn()) SB.upsert(rec).catch(e => toast('Cloud save failed: ' + e.message, true)); }
function dbDelete(id) { if (dbOn()) SB.remove(id).catch(e => toast('Cloud delete failed: ' + e.message, true)); }
async function loadPipeline() {
  if (!dbOn()) return;
  try {
    const rows = await SB.list();
    if (!rows.length) { await SB.upsertMany(state.tracker); }   // seed an empty DB
    else { state.tracker = rows; save(LS.tracker, state.tracker); }
    updateNavCount();
    const active = ($('.view.active') || {}).id || '';
    if (active === 'view-dashboard') renderDashboard();
    if (active === 'view-tracker') renderTracker();
  } catch (e) { toast('Supabase load failed — using local data.', true); }
}

function logCurrent() {
  const a = state.lastAnalysis; if (!a) { toast('Run a validation first.', true); return; }
  const p = a.parsed || {};
  const rec = {
    id: uid(), createdAt: Date.now(), dateApplied: '',
    employer: p.company || '', title: p.title || '', location: p.location || '',
    howApplied: '', pay: p.comp || '', status: 'Prepared-not-sent',
    notes: a.verdict_reason || '', tier: null, verdict: a.verdict,
    flags: (a.flags || []).map(f => prettyFlag(f.type) + ': ' + f.detail), fit: a.primary_frame || '',
    potentialAmount: a.cash?.potential_amount || '', potentialMidpoint: a.cash?.potential_midpoint_usd || null, probability: a.cash?.conversion_probability ?? null
  };
  state.tracker.unshift(rec); save(LS.tracker, state.tracker); dbUpsert(rec);
  updateNavCount();
  toast('Added to pipeline — set status & date there.');
}

let trackerFilter = 'all';
function renderTracker() {
  const wrap = $('#tracker-body'); wrap.innerHTML = '';
  renderTrackerStats();

  let rows = state.tracker.slice();
  if (trackerFilter !== 'all') rows = rows.filter(r => r.status === trackerFilter);
  const q = $('#tracker-search').value.trim().toLowerCase();
  if (q) rows = rows.filter(r => (r.employer + ' ' + r.title + ' ' + r.notes + ' ' + (r.fit || '')).toLowerCase().includes(q));

  if (!rows.length) { wrap.append(el('div', { class: 'empty' }, 'No opportunities match. Validate a JD or clear the filter.')); return; }

  const table = el('table', { class: 'tracker' });
  table.append(el('thead', {}, el('tr', {},
    el('th', {}, 'Employer'), el('th', {}, 'Position'), el('th', {}, 'Location'),
    el('th', {}, 'How applied'), el('th', {}, 'Cash outlook'), el('th', {}, 'Date'),
    el('th', {}, 'Status'), el('th', {}, 'Notes / flags'), el('th', {}, ''))));

  const tb = el('tbody');
  rows.forEach(r => {
    const statusSel = el('select', { class: 'status-select', onchange: e => { r.status = e.target.value; save(LS.tracker, state.tracker); dbUpsert(r); renderTrackerStats(); } });
    STATUSES.forEach(s => statusSel.append(el('option', { value: s, ...(s === r.status ? { selected: '' } : {}) }, s)));

    const dateInp = el('input', { type: 'text', value: r.dateApplied || '', placeholder: 'YYYY-MM-DD', style: 'width:104px;font-size:12px;padding:5px 7px', onchange: e => { r.dateApplied = e.target.value; save(LS.tracker, state.tracker); dbUpsert(r); } });

    const notesCell = el('td', { class: 'notes' });
    const meta = el('div', { style: 'display:flex;gap:5px;flex-wrap:wrap;margin-bottom:3px' });
    if (r.tier) meta.append(el('span', { class: 'pill tier' }, 'Tier ' + r.tier));
    if (r.verdict) meta.append(el('span', { class: 'tag' }, prettyVerdict(r.verdict)));
    if (meta.children.length) notesCell.append(meta);
    if (r.notes) notesCell.append(el('div', {}, r.notes));
    if (r.flags && r.flags.length) notesCell.append(el('div', { class: 'small', style: 'margin-top:3px;color:var(--warn);display:flex;gap:5px;align-items:flex-start' }, ico(IC.flag), el('span', {}, r.flags.join(' · '))));

    tb.append(el('tr', {},
      el('td', {}, el('b', {}, r.employer)),
      el('td', {}, r.title),
      el('td', { class: 'small muted' }, r.location || '—'),
      el('td', { class: 'small muted' }, r.howApplied || '—'),
      cashCell(r),
      el('td', {}, dateInp),
      el('td', {}, statusPill(r.status), el('div', { style: 'margin-top:5px' }, statusSel)),
      notesCell,
      el('td', {}, el('button', { class: 'btn sm danger-ghost', title: 'Remove', onclick: () => { if (confirm('Remove ' + r.employer + ' — ' + r.title + ' from the pipeline?')) { state.tracker = state.tracker.filter(x => x.id !== r.id); save(LS.tracker, state.tracker); dbDelete(r.id); updateNavCount(); renderTracker(); } } }, ico(IC.x)))
    ));
  });
  table.append(tb);
  wrap.append(el('div', { class: 'table-wrap' }, table));
  updateNavCount();
}
function prettyVerdict(v) { return { clean_fit: 'Clean fit', legitimate_reach: 'Reach', skip: 'Skip' }[v] || v; }
function cashCell(r) {
  const mid = Number(r.potentialMidpoint) || 0;
  const p = (r.probability == null || isNaN(Number(r.probability))) ? null : Number(r.probability);
  const td = el('td');
  td.append(el('div', { style: 'font-weight:600' }, r.potentialAmount || (mid ? fmtUSD(mid) : '—')));
  if (p != null && mid) {
    const exp = Math.round(mid * p / 100);
    td.append(el('div', { class: 'small', style: 'margin-top:2px;display:flex;align-items:center;gap:6px' },
      el('span', { class: 'prob-dot ' + probClass(p) }), el('span', { class: 'muted' }, p + '% → '), el('span', { style: 'font-weight:600' }, fmtUSD(exp))));
  } else if (p != null) {
    td.append(el('div', { class: 'small muted', style: 'margin-top:2px' }, p + '% convert'));
  }
  return td;
}

function renderTrackerStats() {
  const counts = {}; STATUSES.forEach(s => counts[s] = 0);
  state.tracker.forEach(r => { if (counts[r.status] != null) counts[r.status]++; });
  const total = state.tracker.length;
  const bar = $('#tracker-stats'); bar.innerHTML = '';
  bar.append(el('button', { class: 'fchip' + (trackerFilter === 'all' ? ' active' : ''), onclick: () => { trackerFilter = 'all'; renderTracker(); } }, 'All', el('span', { class: 'c' }, String(total))));
  STATUSES.forEach(s => bar.append(el('button', { class: 'fchip' + (trackerFilter === s ? ' active' : ''), onclick: () => { trackerFilter = (trackerFilter === s ? 'all' : s); renderTracker(); } }, s, el('span', { class: 'c' }, String(counts[s])))));
}

function exportCSV() {
  const cols = ['Date Applied', 'Employer', 'Position Title', 'Location', 'How Applied', 'Pay/Range', 'Status', 'Notes'];
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const lines = [cols.map(q).join(',')];
  state.tracker.forEach(r => {
    const notes = [r.notes, (r.flags || []).length ? 'Flags: ' + r.flags.join('; ') : '', r.fit ? 'Frame: ' + r.fit : ''].filter(Boolean).join(' | ');
    lines.push([r.dateApplied, r.employer, r.title, r.location, r.howApplied, r.pay, r.status, notes].map(q).join(','));
  });
  download('James_Coleman_Job_Search_Log.csv', lines.join('\n'));
}

function addBlankRow() {
  const rec = { id: uid(), createdAt: Date.now(), dateApplied: todayISO(), employer: 'New employer', title: 'Position', location: '', howApplied: '', pay: '', status: 'Prepared-not-sent', notes: '', tier: null, verdict: null, flags: [], fit: '' };
  state.tracker.unshift(rec); save(LS.tracker, state.tracker); dbUpsert(rec);
  updateNavCount(); toast('Blank row added — edit inline.'); renderTracker();
}

/* ============================================================================
 * TAB: PROFILE
 * ==========================================================================*/
function renderProfile() {
  const p = state.profile;
  $('#profile-json').value = JSON.stringify(p, null, 2);
  const have = $('#have-pills'); have.innerHTML = '';
  p.skillsHave.forEach(s => have.append(el('span', { class: 'pl' }, s)));
  const no = $('#donthave-pills'); no.innerHTML = '';
  p.skillsDontHave.forEach(s => no.append(el('span', { class: 'pl no' }, s)));
  $('#moat-text').textContent = p.moat;
  $('#emp-count').textContent = p.employment.length + ' roles';
}
function saveProfile() {
  try {
    const parsed = JSON.parse($('#profile-json').value);
    if (!parsed.identity || !parsed.skillsHave || !parsed.employment) throw new Error('Missing required keys (identity / skillsHave / employment).');
    state.profile = parsed; save(LS.profile, parsed);
    renderProfile(); toast('Profile saved. It now drives every validation.');
  } catch (e) { toast('Invalid JSON: ' + e.message, true); }
}
function resetProfile() {
  if (!confirm('Reset the profile to the built-in canonical facts? Your edits will be lost.')) return;
  state.profile = structuredCloneSafe(window.DEFAULT_PROFILE); localStorage.removeItem(LS.profile);
  renderProfile(); toast('Profile reset to defaults.');
}

/* ============================================================================
 * TAB: SETTINGS
 * ==========================================================================*/
function renderSettings() {
  $('#api-key').value = getKey();
  const msel = $('#model-select'); msel.innerHTML = '';
  MODELS.forEach(m => msel.append(el('option', { value: m.id, ...(m.id === getModel() ? { selected: '' } : {}) }, m.label)));
  const mode = getMode();
  $$('input[name=mode]').forEach(r => r.checked = (r.value === mode));
  $('#direct-key-wrap').style.display = mode === 'direct' ? '' : 'none';
  // supabase
  const c = window.SB && SB.config();
  $('#sb-url').value = c ? c.url : '';
  $('#sb-key').value = c ? c.key : '';
  $('#sb-dot').className = 'dot ' + (c ? 'ok' : 'no');
  $('#sb-status').textContent = c ? 'Connected — data synced to Postgres' : 'Local only — data stored in this browser';
  updateProxyNote();
  updateKeyStatus();
  renderProfile();   // guardrails + canonical profile now live in Settings
}
function updateProxyNote() {
  const note = $('#proxy-endpoint'); if (!note) return;
  const c = window.SB && SB.config();
  note.textContent = c ? ('Active endpoint: ' + c.url + '/functions/v1/claude') : ('Active endpoint: ' + PROXY_URL + ' (deploy the Edge Function and add Supabase below to switch)');
}
function saveSettings() {
  const mode = ($$('input[name=mode]').find(r => r.checked) || {}).value || 'proxy';
  save(LS.mode, mode);
  save(LS.key, $('#api-key').value.trim());
  save(LS.model, $('#model-select').value);
  renderSettings(); updateKeyStatus(); toast('Settings saved.');
}
async function saveSupabase() {
  const url = $('#sb-url').value.trim(), key = $('#sb-key').value.trim();
  SB.setConfig(url, key);
  updateProxyNote(); updateKeyStatus();
  if (url && key) {
    const btn = $('#btn-sb-save'); setBtnLoading(btn, true, 'Connecting…');
    try { await SB.test(); toast('Supabase connected.'); await loadPipeline(); }
    catch (e) { toast('Supabase reachable check failed: ' + e.message + ' — run schema.sql?', true); }
    finally { setBtnLoading(btn, false); }
  } else { toast('Supabase disconnected — using local data.'); }
}
function updateKeyStatus() {
  const mode = getMode();
  const ok = ready();
  const dot = $('#key-dot'), txt = $('#key-status');
  if (dot) dot.className = 'dot ' + (ok ? 'ok' : 'no');
  if (txt) txt.textContent = mode === 'proxy'
    ? 'Server proxy mode — the key lives in a server secret, not this browser.'
    : (ok ? 'Direct mode — key set, validation enabled.' : 'Direct mode — add a key to enable validation.');
  // sidebar footer
  const viaSb = mode === 'proxy' && window.SB && SB.configured();
  $('#side-dot').className = 'dot ' + (ok ? 'ok' : 'no');
  $('#side-status-txt').textContent = ok ? (viaSb ? 'Supabase connected' : (mode === 'proxy' ? 'Proxy connected' : 'Claude connected')) : 'Not connected';
  renderConnectBanner(ok);
}
function renderConnectBanner(ok) {
  const host = $('#dash-banner'); if (!host) return;
  host.innerHTML = '';
  if (ok) return;
  const b = el('div', { class: 'banner' });
  b.append(
    el('div', { class: 'bi', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>' }),
    el('div', { style: 'flex:1' }, el('b', {}, 'Connect Claude to start validating. '), 'Use the server proxy (key as a deploy secret) once live, or paste your own key for local use.'),
    el('button', { class: 'btn sm primary', onclick: () => switchTab('settings') }, 'Open Settings')
  );
  host.append(b);
}
async function testKey() {
  const mode = getMode();
  if (mode === 'direct' && !getKey()) { toast('Enter a key first.', true); return; }
  const btn = $('#btn-test'); setBtnLoading(btn, true, 'Testing…');
  try {
    await callClaude({ max_tokens: 8, messages: [{ role: 'user', content: 'Reply with just: ok' }] });
    toast(mode === 'proxy' ? 'Proxy + server key work.' : 'Key works.');
  } catch (e) { toast('Test failed: ' + friendlyErr(e), true); }
  finally { setBtnLoading(btn, false); }
}

/* ============================================================================
 * shared UI utils
 * ==========================================================================*/
function loadingCard(msg) {
  return el('div', { class: 'card pad loading-card' },
    el('span', { class: 'spinner', style: 'color:var(--brand)' }), el('span', {}, msg));
}
function setBtnLoading(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.innerHTML = ''; btn.append(el('span', { class: 'spinner' }), label || 'Working…'); }
  else { btn.disabled = false; btn.textContent = btn.dataset.label || btn.textContent; }
}
function friendlyErr(e) {
  if (e.message === 'NO_KEY') return 'No API key set (switch to Server proxy, or add a key in Settings).';
  if (e.status === 401) return getMode() === 'proxy' ? 'Server key rejected (401) — check the ANTHROPIC_API_KEY secret.' : 'Invalid API key (401).';
  if (e.status === 404) return 'Proxy not found (404) — the /ops/api/claude function isn\'t deployed. Deploy it, or switch to Direct mode in Settings.';
  if (e.status === 501) return 'Proxy is up but has no server key (501) — set the ANTHROPIC_API_KEY secret on the deployment.';
  if (e.status === 429) return 'Rate limit / quota (429).';
  if (e.status === 400) return 'Bad request (400): ' + e.message;
  if (e.status === 529) return 'Anthropic overloaded (529) — retry shortly.';
  if (/Failed to fetch|NetworkError|CORS/i.test(e.message)) {
    return getMode() === 'proxy'
      ? 'Could not reach the proxy. If you\'re opening the file directly or the function isn\'t deployed, switch to Direct mode in Settings.'
      : 'Network/CORS blocked the request. Check the key and that this page is served over http(s).';
  }
  return e.message || 'Unknown error.';
}
function showApiError(sel, e) {
  const msg = friendlyErr(e);
  if (sel) {
    const box = $(sel); box.hidden = false; box.innerHTML = '';
    box.append(el('span', { style: 'display:inline-flex;gap:6px;align-items:center;vertical-align:-3px' }, ico(IC.warn)), el('b', {}, ' Request failed. '), document.createTextNode(msg));
    if (e.message === 'NO_KEY' || e.status === 401) box.append(el('div', { style: 'margin-top:6px' }, el('button', { class: 'btn small', onclick: () => switchTab('settings') }, 'Open Settings')));
  }
}
function copyText(t) { navigator.clipboard.writeText(t).then(() => toast('Copied to clipboard.'), () => toast('Copy failed.', true)); }

/* ============================================================================
 * Résumé rendering — one deterministic renderer feeds preview, PDF, and text.
 * ATS-safe: single column, one font, plain CAPS headings, round bullets,
 * dates inline on the title/company line, " | " contact separators, no tables.
 * ==========================================================================*/
/* ---- résumé design templates: accent × font × header = 252 combinations ---- */
const T_ACCENTS = [
  { n: 'Navy', c: '#1F3A4D' }, { n: 'Forest', c: '#2E5E3A' }, { n: 'Teal', c: '#0F6E6E' },
  { n: 'Slate', c: '#37474F' }, { n: 'Charcoal', c: '#2B2B2B' }, { n: 'Burgundy', c: '#7A2E3A' },
  { n: 'Rust', c: '#9A4A2E' }, { n: 'Bronze', c: '#7A5C2E' }, { n: 'Ink Blue', c: '#1D3A8A' },
  { n: 'Ocean', c: '#12557A' }, { n: 'Pine', c: '#1F5145' }, { n: 'Graphite', c: '#3A3F44' },
  { n: 'Oxblood', c: '#5E2A2A' }, { n: 'Steel', c: '#2F5A73' }
]; // 14
const T_FONTS = [
  { n: 'Calibri', s: 'Calibri, Arial, sans-serif' }, { n: 'Arial', s: 'Arial, Helvetica, sans-serif' },
  { n: 'Georgia', s: 'Georgia, "Times New Roman", serif' }, { n: 'Garamond', s: '"EB Garamond", Garamond, Georgia, serif' },
  { n: 'Cambria', s: 'Cambria, Georgia, serif' }, { n: 'Verdana', s: 'Verdana, Geneva, sans-serif' }
]; // 6
const T_HEADERS = [{ n: 'rule', label: 'Rule' }, { n: 'band', label: 'Band' }, { n: 'center', label: 'Centered' }]; // 3
const TEMPLATE_COUNT = T_ACCENTS.length * T_FONTS.length * T_HEADERS.length; // 252
function tmpl() { const t = state.template || { a: 0, f: 0, h: 0 }; return { a: t.a % T_ACCENTS.length, f: t.f % T_FONTS.length, h: t.h % T_HEADERS.length }; }
function templateIndex() { const t = tmpl(); return t.a * (T_FONTS.length * T_HEADERS.length) + t.f * T_HEADERS.length + t.h + 1; }
function applyTemplate(elp) {
  const t = tmpl();
  elp.style.setProperty('--acc', T_ACCENTS[t.a].c);
  elp.style.fontFamily = T_FONTS[t.f].s;
  T_HEADERS.forEach(h => elp.classList.remove('hdr-' + h.n));
  elp.classList.add('hdr-' + T_HEADERS[t.h].n);
}
let docActive = 'ats';
function setTemplate(patch) {
  state.template = { ...tmpl(), ...patch }; save(LS.template, state.template);
  docActive = 'styled';
  if (onHome()) renderPreview(); else if ($('#docs-out') && state.lastDocs) renderDocs(state.lastDocs);
}
function templateBar() {
  const bar = el('div', { class: 'tmpl-bar' });
  bar.append(el('span', { class: 'tmpl-count' }, 'Design ' + templateIndex() + ' / ' + TEMPLATE_COUNT));
  const sw = el('div', { class: 'tmpl-swatches' });
  T_ACCENTS.forEach((a, i) => sw.append(el('button', { class: 'tmpl-sw' + (tmpl().a === i ? ' on' : ''), title: a.n, style: 'background:' + a.c, onclick: () => setTemplate({ a: i }) })));
  bar.append(sw);
  const fsel = el('select', { class: 'tmpl-sel', onchange: e => setTemplate({ f: +e.target.value }) });
  T_FONTS.forEach((f, i) => fsel.append(el('option', { value: i, ...(tmpl().f === i ? { selected: '' } : {}) }, f.n)));
  const hsel = el('select', { class: 'tmpl-sel', onchange: e => setTemplate({ h: +e.target.value }) });
  T_HEADERS.forEach((h, i) => hsel.append(el('option', { value: i, ...(tmpl().h === i ? { selected: '' } : {}) }, h.label)));
  bar.append(fsel, hsel);
  bar.append(el('button', { class: 'btn sm ghost', title: 'Shuffle', onclick: () => setTemplate({ a: Math.floor(Math.random() * T_ACCENTS.length), f: Math.floor(Math.random() * T_FONTS.length), h: Math.floor(Math.random() * T_HEADERS.length) }) }, 'Shuffle'));
  return bar;
}

// Workday-safe: middle-dot separators, never pipes.
function contactLine(c) {
  return [c.location, c.phone, c.email, c.portfolio, c.linkedin].map(s => (s || '').trim()).filter(Boolean).join('  ·  ');
}
function resumeHTML(r, styled) {
  const c = r.contact || {};
  const sec = (title, inner) => inner ? `<section class="rs"><h2 class="sec">${esc(title)}</h2>${inner}</section>` : '';
  const bullets = arr => (arr && arr.length) ? `<ul>${arr.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : '';

  let h = '';
  h += `<header class="rhead"><div class="name">${esc(r.name || '')}</div>`;
  if (r.target_title) h += `<div class="ttl">${esc(r.target_title)}</div>`;
  h += `<div class="contact">${esc(contactLine(c))}</div></header>`;

  h += sec('Professional Summary', r.summary ? `<p>${esc(r.summary)}</p>` : '');

  if (r.core_skills && r.core_skills.length) {
    const rows = r.core_skills.map(g => `<p class="skill"><strong>${esc(g.category)}:</strong> ${esc((g.items || []).join('; '))}</p>`).join('');
    h += sec('Core Skills', rows);
  }
  h += sec('Role Alignment', bullets(r.role_alignment));

  if (r.experience && r.experience.length) {
    // Workday-safe STACKED format (SKILL / Gig Hunter Node 8): title (bold) /
    // company (plain) / dates (italic) each on its own line. No pipes, no
    // tab-aligned dates. Styled variant is the same stack, just coloured.
    const roles = r.experience.map(e => {
      const head =
        `<div class="exp-stack">` +
        `<div class="et"><strong>${esc(e.title)}</strong></div>` +
        `<div class="ec">${esc(e.company)}${e.location ? ', ' + esc(e.location) : ''}</div>` +
        (e.dates ? `<div class="ed">${esc(e.dates)}</div>` : '') +
        `</div>`;
      return `<div class="role">${head}${bullets(e.bullets)}</div>`;
    }).join('');
    h += sec('Professional Experience', roles);
  }

  if (r.education && r.education.length) h += sec('Education & Certifications', bullets(r.education));
  if (r.awards && r.awards.length) h += sec('Clients & Awards', bullets(r.awards));
  return h;
}
function resumeText(r) {
  const c = r.contact || {};
  const L = [];
  L.push(r.name || '');
  if (r.target_title) L.push(r.target_title);
  L.push(contactLine(c)); L.push('');
  const head = t => { L.push(t.toUpperCase()); };
  if (r.summary) { head('Professional Summary'); L.push(r.summary); L.push(''); }
  if (r.core_skills && r.core_skills.length) { head('Core Skills'); r.core_skills.forEach(g => L.push(`${g.category}: ${(g.items || []).join('; ')}`)); L.push(''); }
  if (r.role_alignment && r.role_alignment.length) { head('Role Alignment'); r.role_alignment.forEach(b => L.push('• ' + b)); L.push(''); }
  if (r.experience && r.experience.length) {
    head('Professional Experience');
    r.experience.forEach(e => {
      // stacked, no pipes (Workday-safe)
      L.push(e.title);
      L.push(e.company + (e.location ? ', ' + e.location : ''));
      if (e.dates) L.push(e.dates);
      (e.bullets || []).forEach(b => L.push('• ' + b));
      L.push('');
    });
  }
  if (r.education && r.education.length) { head('Education & Certifications'); r.education.forEach(b => L.push('• ' + b)); L.push(''); }
  if (r.awards && r.awards.length) { head('Clients & Awards'); r.awards.forEach(b => L.push('• ' + b)); }
  return L.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
/* ---- deterministic guardrail (Node 6): code-enforced, not prompt-only ---- */
const DONT_HAVE_ACRONYMS = /\b(AWS|Bedrock|PyTorch|scikit-?learn|sklearn|Flask|Gunicorn|Nginx|HEDIS|QIP|FHIR|EDI|SNOMED|ArcGIS|Esri|Deltek|CSM|PSM|PMP)\b/gi;
function dontHaveTriggers() {
  const terms = new Set();
  (state.profile.skillsDontHave || []).forEach(s => {
    const head = s.split('(')[0];
    (head.match(DONT_HAVE_ACRONYMS) || []).forEach(t => terms.add(t.trim()));
  });
  return [...terms];
}
function normCo(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function deterministicGuardrail(r) {
  const text = (resumeText(r) + ' ' + (r.target_title || '')).toLowerCase();
  const esc = t => t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const claimed = [...new Set(dontHaveTriggers().filter(t => new RegExp('\\b' + esc(t) + '\\b', 'i').test(text)))];
  const profileCos = (state.profile.employment || []).map(e => normCo(e.company)).filter(Boolean);
  const invented = [...new Set((r.experience || []).map(e => e.company).filter(c => {
    const n = normCo(c); return c && n.length > 2 && !profileCos.some(pc => pc.includes(n) || n.includes(pc));
  }))];
  return { claimed, invented, clean: !claimed.length && !invented.length };
}

function coverHTML(text) {
  const c = state.lastAnalysis?.parsed || {};
  const head = `<header class="rhead"><div class="name">James E. Coleman</div><div class="contact">310.430.2523  ·  info@jamesecoleman.com  ·  jamesecoleman.com</div></header>`;
  const meta = (c.company) ? `<p class="cl-meta">${esc(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}<br>${esc(c.company)}${c.location ? ' · ' + esc(c.location) : ''}</p>` : '';
  const body = (text || '').replace(/\r/g, '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  return head + meta + `<div class="cl-body">${body}</div>`;
}

/* ---- print any of the above to a real, selectable-text PDF (ATS-parseable) ---- */
const PRINT_CSS = `
  @page { size: Letter; margin: 0.6in; }
  * { box-sizing: border-box; }
  body { font-family: Calibri, Arial, Helvetica, sans-serif; color:#111; font-size:10.6pt; line-height:1.36; margin:0; }
  .rhead { margin-bottom: 8pt; }
  .name { font-size:20pt; font-weight:700; letter-spacing:-.01em; }
  .ttl { font-size:11.5pt; font-weight:600; margin-top:1pt; }
  .contact { font-size:9.3pt; color:#333; margin-top:3pt; }
  h2.sec { font-size:10.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.06em; margin:12pt 0 4pt; }
  section.rs { break-inside: avoid-page; }
  p { margin:3pt 0; }
  p.skill { margin:2pt 0; }
  .role { margin:7pt 0 7pt; break-inside: avoid; }
  .exp-stack { margin:6pt 0 2pt; }
  .exp-stack .et { font-size:10.8pt; }
  .exp-stack .ec { }
  .exp-stack .ed { font-style:italic; color:#333; font-size:9.8pt; }
  ul { margin:3pt 0 4pt 15pt; padding:0; }
  li { margin:2pt 0; }
  .cl-meta { color:#333; font-size:9.6pt; margin:10pt 0 12pt; }
  .cl-body p { margin:7pt 0; }
`;
function styledCSS() {
  const t = tmpl(); const acc = T_ACCENTS[t.a].c; const font = T_FONTS[t.f].s; const h = T_HEADERS[t.h].n;
  let head = '';
  if (h === 'rule') head = `h2.sec { border-bottom:1.25pt solid ${acc}; padding-bottom:2pt; }`;
  else if (h === 'band') head = `.rhead { background:${acc}; padding:10pt 12pt; margin:0 0 10pt; }
    .rhead .name, .rhead .ttl, .rhead .contact { color:#fff; }`;
  else if (h === 'center') head = `.rhead { text-align:center; } h2.sec { border-bottom:1.25pt solid ${acc}; padding-bottom:2pt; }`;
  return `
    body { font-family:${font}; }
    .name { color:${acc}; }
    .ttl { color:${acc}; opacity:.82; }
    h2.sec { color:${acc}; }
    .exp-stack .et strong { color:${acc}; }
    ${head}
  `;
}
function printHTML(title, bodyHTML, styled) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}${styled ? styledCSS() : ''}</style></head><body>${bodyHTML}</body></html>`;
  let f = document.getElementById('print-frame');
  if (f) f.remove();
  f = document.createElement('iframe');
  f.id = 'print-frame';
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.append(f);
  const fd = f.contentWindow.document;
  fd.open(); fd.write(doc); fd.close();
  const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('Print failed: ' + e.message, true); } };
  if (fd.readyState === 'complete') setTimeout(go, 150); else f.onload = () => setTimeout(go, 150);
  toast('Opening print dialog — choose “Save as PDF”, Letter, default margins.');
}
function savePDF(kind) {
  const d = state.lastDocs; if (!d) return;
  if (kind !== 'cover' && state.lastGuard && !state.lastGuard.clean) {
    const bits = [...state.lastGuard.claimed, ...state.lastGuard.invented].join(', ');
    if (!confirm('Guardrail flagged: ' + bits + '.\nExport anyway? (Fix in the profile/generation first for a clean, defensible submission.)')) return;
  }
  const co = (state.lastAnalysis?.parsed?.company || 'Company').replace(/[^A-Za-z0-9]+/g, '');
  if (kind === 'cover') printHTML(`James_Coleman_${co}_CoverLetter`, coverHTML(d.cover_letter || ''), true);
  else printHTML(`James_Coleman_${co}_${kind === 'styled' ? 'Resume' : 'ATS'}`, resumeHTML(d.resume || {}, kind === 'styled'), kind === 'styled');
}
function download(name, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Downloaded ' + name);
}

/* ============================================================================
 * DASHBOARD
 * ==========================================================================*/
const ICONS = {
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>'
};
function expectedPipelineCash() {
  return Math.round((state.tracker || []).reduce((sum, r) => {
    const mid = Number(r.potentialMidpoint) || 0, p = Number(r.probability);
    return sum + (mid && p != null && !isNaN(p) ? mid * p / 100 : 0);
  }, 0));
}

// Home = conversation + preview (the whole product)
function renderDashboard() { renderChat(); renderPreview(); }

function onHome() { const v = $('#view-dashboard'); return v && v.classList.contains('active'); }

function renderPreview() {
  const p = $('#preview'); if (!p) return;
  p.innerHTML = '';
  if (state.lastDocs) return previewResume(p, state.lastDocs);
  if (state.lastAnalysis) return previewOpinion(p, state.lastAnalysis);
  if (state.interview && state.interview.resumeText) {
    p.append(el('div', { class: 'pv-head' }, el('span', { class: 'pv-t' }, 'Your résumé'), el('span', { class: 'grow' }), el('span', { class: 'tag' }, state.interview.resumeName || 'attached')));
    p.append(el('div', { class: 'small muted' }, 'Paste an opportunity and hit “Rate it” — Giggy will give you the honest read, then we tailor this.'));
    p.append(el('div', { class: 'pv-plain', style: 'margin-top:12px' }, state.interview.resumeText.slice(0, 6000)));
    p.append(el('div', { class: 'btnrow', style: 'margin-top:12px' }, rateBtn()));
    return;
  }
  const e = el('div', { class: 'pv-empty' });
  e.append(el('div', { class: 'pv-ic', html: IC.doc }));
  e.append(el('div', { style: 'font-weight:650;color:var(--text)' }, 'Your preview shows up here'));
  e.append(el('div', { class: 'small' }, 'Attach your résumé PDF and paste an opportunity on the left. Giggy gives you an honest read — the cash it’s worth and whether it’s worth your time — then drafts a tailored, ATS-safe résumé you can save as PDF.'));
  e.append(renderSources());
  p.append(e);
}
function rateBtn() {
  return el('button', { class: 'btn primary', onclick: rateOpportunity, disabled: (state.interview && state.interview.jd) ? null : 'true' }, ico(IC.cash), 'Rate this opportunity');
}
function previewOpinion(p, a) {
  const vlabel = { clean_fit: 'Go for it', legitimate_reach: 'Worth a shot', skip: 'Skip it' }[a.verdict] || a.verdict;
  p.append(el('div', { class: 'pv-head' },
    el('span', { class: 'verdict-badge verdict-' + a.verdict }, el('span', { class: 'vdot' }), vlabel),
    el('span', { class: 'grow' }),
    el('span', { class: 'small muted' }, (a.parsed && a.parsed.company) || '')));
  if (a.verdict_reason) p.append(el('div', { class: 'small muted', style: 'margin-top:8px' }, a.verdict_reason));
  if (a.cash) renderCash(p, a.cash);
  if (a.authenticity) renderAuthenticity(p, a.authenticity);
  if (a.template_response && a.verdict !== 'skip') {
    const sec = section('Ready-to-send response');
    sec.append(el('div', { class: 'pv-plain', style: 'font-family:var(--sans)' }, a.template_response));
    sec.append(el('div', { class: 'btnrow', style: 'margin-top:10px' }, el('button', { class: 'btn sm', onclick: () => copyText(a.template_response) }, ico(IC.copy), 'Copy')));
    p.append(sec);
  }
  const row = el('div', { class: 'btnrow', style: 'margin-top:16px' });
  if (a.verdict !== 'skip') row.append(el('button', { class: 'btn ok', onclick: tailorResume }, ico(IC.doc), 'Tailor my résumé'));
  row.append(el('button', { class: 'btn', onclick: () => { state.lastAnalysis = null; renderPreview(); } }, 'Back'));
  p.append(row);
}
function previewResume(p, d) {
  p.append(el('div', { class: 'pv-head' },
    el('span', { class: 'pv-t' }, 'Tailored résumé'),
    el('span', { class: 'grow' }),
    el('button', { class: 'btn sm ghost', onclick: () => { state.lastDocs = null; renderPreview(); } }, 'Back to opinion')));
  renderDocs(d, p);
}

async function rateOpportunity() {
  const iv = state.interview || {};
  if (!iv.jd) { toast('Add the opportunity / JD first.', true); return; }
  if (!ready()) { toast('Connect Claude in Settings first.', true); switchTab('settings'); return; }
  const p = $('#preview'); p.innerHTML = ''; p.append(loadingCard('Giggy is reading the opportunity against your résumé…'));
  state.lastJD = iv.jd; state.lastDocs = null;
  try {
    const resume = iv.resumeText ? `\n\nThe user's current résumé:\n${iv.resumeText.slice(0, 8000)}` : '';
    const resp = await callClaude({
      system: buildSystemPrompt(), max_tokens: 3000,
      tools: [FIT_TOOL], tool_choice: { type: 'tool', name: 'submit_fit_analysis' },
      messages: [{ role: 'user', content: `Give your honest read on this opportunity for this candidate — radically prioritized: if it's not clearly worth their time, say skip. Include fit, the per-opportunity cash rating (what it pays and the odds it converts), red flags, the angle to lead with, and a ready-to-send template response they can copy and send now (unless it's a skip).${resume}\n\nOPPORTUNITY:\n${iv.jd}` }]
    });
    state.lastAnalysis = toolResult(resp, 'submit_fit_analysis');
    renderPreview();
    postOpinionToChat(state.lastAnalysis);
  } catch (e) { $('#preview').innerHTML = ''; const b = el('div', { class: 'err-box' }); b.append(ico(IC.warn), document.createTextNode(' ' + friendlyErr(e))); $('#preview').append(b); }
}
function postOpinionToChat(a) {
  const v = { clean_fit: 'Go for it', legitimate_reach: 'Worth a shot', skip: 'Skip it' }[a.verdict] || a.verdict;
  const c = a.cash || {};
  const line = `${v}. ${a.verdict_reason || ''}\n\nCash rating: ${c.potential_amount || '—'} · ${c.conversion_probability != null ? c.conversion_probability + '% to convert' : ''}. ${c.basis || ''}\n\nWant me to tailor your résumé for it? Hit “Tailor my résumé” on the right.`;
  state.chat.push({ role: 'assistant', content: line }); save(LS.chat, state.chat); renderChat();
}
async function tailorResume() {
  const a = state.lastAnalysis; if (!a) { rateOpportunity(); return; }
  if (!ready()) { toast('Connect Claude in Settings first.', true); switchTab('settings'); return; }
  const p = $('#preview'); p.innerHTML = ''; p.append(loadingCard('Drafting a tailored, ATS-safe résumé, then checking it against the guardrails…'));
  const iv = state.interview || {};
  const userMsg = `Fill the structured résumé for this opportunity. Lead frame: "${a.primary_frame}". Mirror only true keywords: ${(a.keywords || []).join(', ')}. Frame these gaps honestly, never claim them: ${(a.gaps || []).map(g => g.requirement).join('; ') || 'none'}.${iv.resumeText ? '\nUse the user\'s current résumé as raw material (still nothing beyond the canonical profile):\n' + iv.resumeText.slice(0, 8000) : ''}\n\nOPPORTUNITY:\n${iv.jd || state.lastJD}`;
  try {
    const resp = await callClaude({
      system: buildSystemPrompt(), max_tokens: 8000,
      tools: [DOC_TOOL], tool_choice: { type: 'tool', name: 'submit_documents' },
      messages: [{ role: 'user', content: userMsg }]
    });
    state.lastDocs = toolResult(resp, 'submit_documents');
    renderPreview();
  } catch (e) { $('#preview').innerHTML = ''; const b = el('div', { class: 'err-box' }); b.append(ico(IC.warn), document.createTextNode(' ' + friendlyErr(e))); $('#preview').append(b); previewResumeBackHint(); }
}
function previewResumeBackHint() { $('#preview').append(el('div', { class: 'btnrow', style: 'margin-top:12px' }, el('button', { class: 'btn', onclick: renderPreview }, 'Back'))); }
function initials(s) { return (s || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

/* ============================================================================
 * Agent conversation — long-tail qualification chat (dashboard hero)
 * ==========================================================================*/
const CHAT_CHIPS = [
  'Is this one worth my time?',
  'What is it really worth in cash?',
  'What are the red flags here?',
  'Where should I look for these?'
];
function sourceQuery() {
  const t = (state.profile.targetRoles || ['AI Product Manager'])[0] || 'AI Product Manager';
  return encodeURIComponent(t);
}
function SOURCES() {
  const q = sourceQuery();
  return [
    { name: 'LinkedIn', url: 'https://www.linkedin.com/jobs/search/?keywords=' + q },
    { name: 'Indeed', url: 'https://www.indeed.com/jobs?q=' + q },
    { name: 'Glassdoor', url: 'https://www.glassdoor.com/Job/jobs.htm?sc.keyword=' + q },
    { name: 'Dice', url: 'https://www.dice.com/jobs?q=' + q },
    { name: 'Wellfound', url: 'https://wellfound.com/jobs' },
    { name: 'Upwork · gigs', url: 'https://www.upwork.com/nx/search/jobs/?q=' + q },
    { name: 'Contra · freelance', url: 'https://contra.com/opportunities' }
  ];
}
function renderSources() {
  const wrap = el('div', { class: 'src-wrap' });
  wrap.append(el('div', { class: 'src-lbl' }, 'Where to find opportunities'));
  const row = el('div', { class: 'src-row' });
  SOURCES().forEach(s => row.append(el('a', { class: 'src-chip', href: s.url, target: '_blank', rel: 'noopener' }, s.name)));
  wrap.append(row);
  wrap.append(el('div', { class: 'small muted', style: 'margin-top:8px' }, 'Go straight to the employer\'s careers page — skip aggregators like LENSA and agency reposts; they flood the market with ghosts. Paste anything promising back here and I\'ll tell you if it\'s real and worth your time.'));
  return wrap;
}
function chatGreeting() {
  return { role: 'assistant', content: "I'm Giggy — twenty years hustling contracts and freelance gigs, and I've placed a lot of people. Paste your résumé and the opportunity (a job post or a gig) and I'll give you my honest read: is it worth your time, what it's really worth in cash, and how to position you to win it. Then we sharpen the résumé together.\n\nDrop the opportunity and your résumé PDF above, or just paste them here." };
}
function chatSystem() {
  const iv = state.interview || {};
  const inputs = `

INPUTS
The opportunity (job post / gig the user posted or found):
${iv.jd ? iv.jd.slice(0, 6000) : '(not provided yet — ask them to paste it or attach it)'}

The user's current résumé (extracted from their PDF — their own prior claims to work from, still bound by the canonical profile and HAVE/DON'T guardrails; flag anything that overclaims):
${iv.resumeText ? iv.resumeText.slice(0, 8000) : '(no résumé provided yet)'}`;

  return buildSystemPrompt() + inputs + `

GIGGY — WHO YOU ARE
You are Giggy: a veteran contractor and freelancer who has won gigs and placed people for two decades. You give honest, street-smart career advice and job placement — no fluff, no false hope, no hype. You are on the user's side, which means telling them the truth.

YOUR MISSION
Force the job market to tell a real story. The market is full of noise — ghost jobs, HR spam, aggregator reposts, wired postings. Your job is to cut through it and show the user what's real: real cash, real odds, real postings worth their time. Every read you give strips out the noise and names the truth.

WHAT YOU DO
When the user gives an opportunity + résumé, reply with your OPINION, tight and direct:
- Straight call: go for it, worth a quick shot, or skip — and why, in a sentence or two.
- Cash rating for THIS opportunity: realistic cash it pays if landed (a gig/contract is usually hundreds to a few thousand dollars; use the posted pay if there is one) and an honest percent chance it converts to cash. Cut that percent hard for ghost/fake/evergreen/wired-for-an-insider postings.
- Red flags in the posting (ghost job, fake, agency reposting, likely already-filled internally).
- How to position them: the one angle to lead with, and the gaps to handle honestly — never invent facts or claim a DON'T-HAVE skill; scope precisely (Hummer EV = concept design; Apple = producer; SCE under Quigley-Simpson; robotics = ran the UI/delivery, not built the robot).
RADICAL PRIORITIZATION — NO TIME-WASTERS
You hate wasted effort. Radically prioritize: if an opportunity isn't clearly worth their time, say skip and move on — don't hedge. Rank ruthlessly by cash × odds of converting. Call out ghost jobs, wired-for-an-insider postings, agency reposts, dead evergreen listings, and especially AGGREGATOR / job-alert junk (LENSA, ZipRecruiter/Jobcase-style scrapers) — steer them away from those entirely and tell them to find the role on the employer's own careers page and apply direct, or work a referral. When something IS worth it, hand them a ready-to-send template response so they can act in one move.

WHERE TO SOURCE
When they ask where to find opportunities, point them at the right places for their target roles and gigs: LinkedIn, Indeed, Glassdoor, Dice, Wellfound, and for contract/freelance work Upwork and Contra, plus company career pages. Prefer direct-employer postings over agency reposts.

Then help them work through it and update the résumé. Keep replies short and human — a few sentences or tight bullets, the way a sharp mentor talks. Ask a question back when you genuinely need one fact to give a better read.`;
}

let chatBusy = false;
function ensureChatSeed() { if (!state.chat.length) { state.chat.push(chatGreeting()); save(LS.chat, state.chat); } }
function renderChat() {
  ensureChatSeed();
  const chips = $('#chat-chips');
  if (chips && !chips.dataset.done) {
    CHAT_CHIPS.forEach(q => chips.append(el('button', { class: 'chip-btn', onclick: () => sendChat(q) }, q)));
    chips.dataset.done = '1';
  }
  const sc = $('#chat-scroll'); if (!sc) return;
  sc.innerHTML = '';
  state.chat.forEach(m => sc.append(chatBubble(m.role, m.content)));
  if (chatBusy) {
    sc.append(el('div', { class: 'msg agent' },
      el('div', { class: 'ava' }, 'AI'),
      el('div', { class: 'bub' }, el('div', { class: 'typing' }, el('span', {}), el('span', {}), el('span', {})))));
  }
  sc.scrollTop = sc.scrollHeight;
  renderInterviewSetup();
}
function chatBubble(role, content) {
  const agent = role !== 'user';
  return el('div', { class: 'msg ' + (agent ? 'agent' : 'user') },
    el('div', { class: 'ava' }, agent ? 'AI' : 'JC'),
    el('div', { class: 'bub' }, content));
}
async function sendChat(text) {
  text = (text || '').trim(); if (!text || chatBusy) return;
  if (!ready()) { toast('Connect Claude in Settings first.', true); switchTab('settings'); return; }
  state.chat.push({ role: 'user', content: text }); save(LS.chat, state.chat);
  const ta = $('#chat-text'); if (ta) { ta.value = ''; ta.style.height = 'auto'; }
  chatBusy = true; renderChat();
  try {
    const history = state.chat.slice(-30).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
    const resp = await callClaude({ system: chatSystem(), max_tokens: 1400, messages: history });
    const txt = textOf(resp) || '(no reply)';
    state.chat.push({ role: 'assistant', content: txt });
  } catch (e) {
    state.chat.push({ role: 'assistant', content: 'Error: ' + friendlyErr(e) });
  }
  save(LS.chat, state.chat); chatBusy = false; renderChat();
}
function clearChat() {
  if (!confirm('Clear this interview and its JD/resume inputs?')) return;
  state.chat = [chatGreeting()]; save(LS.chat, state.chat);
  state.interview = { jd: '', resumeName: '', resumeText: '' }; save(LS.interview, state.interview);
  renderInterviewSetup(); renderChat();
}

/* ---- interview inputs: JD + PDF resume (client-side text extraction) ---- */
async function extractPdfText(file) {
  if (typeof pdfjsLib === 'undefined') throw new Error('PDF reader failed to load (offline or blocked).');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const parts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    parts.push(tc.items.map(it => it.str).join(' '));
  }
  return parts.join('\n\n').replace(/[ \t]+/g, ' ').trim();
}
async function onResumeFile(e) {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  const lbl = $('#iv-resume-label'); const prev = lbl.textContent; lbl.textContent = 'Reading…';
  try {
    const text = await extractPdfText(file);
    if (!text || text.length < 40) throw new Error('No selectable text found (scanned image PDF?).');
    state.interview.resumeName = file.name; state.interview.resumeText = text;
    save(LS.interview, state.interview);
    toast('Resume attached — ' + file.name);
  } catch (err) {
    lbl.textContent = prev; toast('Could not read PDF: ' + err.message, true);
  }
  e.target.value = '';
  renderInterviewSetup();
  if (onHome() && !state.lastAnalysis && !state.lastDocs) renderPreview();
}
function saveJD() {
  const v = $('#iv-jd').value.trim();
  state.interview.jd = v; save(LS.interview, state.interview);
  $('#iv-jd-wrap').hidden = true; renderInterviewSetup();
  if (v) { toast('Opportunity set.'); if (ready()) rateOpportunity(); else renderPreview(); }
}
function renderInterviewSetup() {
  if (!$('#iv-jd-btn')) return;
  const iv = state.interview || {};
  const jdBtn = $('#iv-jd-btn'), jdLbl = $('#iv-jd-label');
  jdBtn.classList.toggle('set', !!iv.jd);
  jdLbl.textContent = iv.jd ? 'JD set ✓' : 'Job description';
  const rLbl = $('#iv-resume-label');
  rLbl.parentElement.classList.toggle('set', !!iv.resumeText);
  rLbl.textContent = iv.resumeName ? (iv.resumeName.length > 22 ? iv.resumeName.slice(0, 20) + '…' : iv.resumeName) + ' ✓' : 'Resume PDF';
  // Begin appears once a JD is present and the interview hasn't really started
  const started = state.chat.filter(m => m.role === 'user').length > 0;
  $('#iv-begin').hidden = !(iv.jd && !started);
}
function beginInterview() {
  const iv = state.interview || {};
  const bits = [];
  if (iv.resumeText) bits.push('my resume is attached');
  bits.push(iv.jd ? "here's the job description" : 'let\'s pick a role');
  sendChat(`I'm ready — ${bits.join(' and ')}. Begin the interview: start by confirming the role and asking your first question.`);
}
function statusPill(s) {
  const cls = { 'Submitted': 'ok', 'Applied': 'ok', 'In progress': 'warn', 'Prepared-not-sent': 'neutral', 'Not accepted': 'bad' }[s] || 'neutral';
  return el('span', { class: 'pill ' + cls }, el('span', { class: 'dt' }), s);
}

/* ============================================================================
 * SKILL TRENDS — map proven ("old") skills to current market demand
 * ==========================================================================*/
const TRENDS_TOOL = {
  name: 'submit_trends',
  description: 'Return a market-alignment read for this candidate: rising demand in their lane, bridges from their proven skills to current framing, honest gaps, and positioning moves. Ground everything in the candidate profile — never invent experience or claim a DON\'T-HAVE skill.',
  input_schema: {
    type: 'object',
    properties: {
      rising: {
        type: 'array', description: 'Skills/keywords rising in demand across the candidate\'s target role families that they genuinely have or can honestly claim.',
        items: { type: 'object', properties: { skill: { type: 'string' }, demand: { type: 'string', enum: ['high', 'rising', 'niche'] }, why: { type: 'string', description: 'One line on why it matters now.' } }, required: ['skill', 'demand', 'why'] }
      },
      bridges: {
        type: 'array', description: 'Reframes: a proven/older strength → the current market term/trend → how to position it truthfully.',
        items: { type: 'object', properties: { have: { type: 'string' }, trend: { type: 'string' }, reframe: { type: 'string' } }, required: ['have', 'trend', 'reframe'] }
      },
      gaps: {
        type: 'array', description: 'In-demand skills the candidate does NOT have. Be honest; mark whether each is realistically closeable given their trajectory.',
        items: { type: 'object', properties: { skill: { type: 'string' }, closeable: { type: 'boolean' }, how: { type: 'string' } }, required: ['skill', 'closeable', 'how'] }
      },
      positioning: { type: 'array', items: { type: 'string' }, description: 'Concrete moves: resume/site/LinkedIn language, which target titles to lead with, what to demote.' },
      hot_titles: { type: 'array', items: { type: 'string' }, description: 'Role titles trending now that fit the candidate\'s moat honestly.' }
    },
    required: ['rising', 'bridges', 'gaps', 'positioning', 'hot_titles']
  }
};

async function runTrends() {
  if (!ready()) { toast('Connect Claude in Settings first.', true); switchTab('settings'); return; }
  const btn = $('#btn-trends'); setBtnLoading(btn, true, 'Analyzing…');
  $('#trends-error').hidden = true;
  const out = $('#trends-out'); out.innerHTML = ''; out.append(loadingCard('Mapping your proven skills onto current market demand…'));

  const pipeKw = state.tracker.slice(0, 40).map(r => `${r.title} @ ${r.employer}`).join('; ');
  const p = state.profile;
  const userMsg = `Analyze market alignment for this candidate. Target role families: ${p.targetRoles.join(', ')}. Weight toward: ${p.sourcingWeightToward} Filter out: ${p.sourcingFilterOut}
Their active pipeline (signal for what they're pursuing): ${pipeKw}.
Use ONLY skills they truly have (see HAVE list) for "rising" and "bridges"; put anything from the DON'T-HAVE list or genuinely absent into "gaps" with an honest closeable read. Keep it specific to this person, not generic career advice.`;

  try {
    const resp = await callClaude({
      system: buildSystemPrompt(),
      max_tokens: 3000,
      tools: [TRENDS_TOOL],
      tool_choice: { type: 'tool', name: 'submit_trends' },
      messages: [{ role: 'user', content: userMsg }]
    });
    const t = toolResult(resp, 'submit_trends');
    state.trends = { data: t, at: Date.now() }; save(LS.trends, state.trends);
    renderTrends();
  } catch (e) {
    $('#trends-out').innerHTML = '';
    showApiError('#trends-error', e);
  } finally {
    setBtnLoading(btn, false);
  }
}

function renderTrends() {
  const meta = $('#trends-meta');
  const out = $('#trends-out'); if (!out) return; out.innerHTML = '';
  if (!state.trends) { meta.textContent = 'Not analyzed yet — the read is grounded in your profile + pipeline.'; return; }
  const t = state.trends.data;
  meta.textContent = 'Last analyzed ' + new Date(state.trends.at).toLocaleString() + '. Directional — verify against live postings before you rely on it.';

  // rising demand
  if (t.rising?.length) {
    const sec = section('Rising demand in your lane');
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:9px' });
    t.rising.forEach(r => wrap.append(el('div', { class: 'item good', style: 'border-top:1px solid var(--border-2);padding:9px 0' },
      el('div', { class: 'req', style: 'justify-content:space-between' },
        el('span', {}, r.skill),
        el('span', { class: 'pill ' + (r.demand === 'high' ? 'ok' : r.demand === 'rising' ? 'warn' : 'neutral') }, el('span', { class: 'dt' }), r.demand)),
      el('div', { class: 'ev', style: 'padding-left:0' }, r.why))));
    sec.append(wrap); out.append(sec);
  }

  // bridges
  if (t.bridges?.length) {
    const sec = section('Your proven strengths → today\'s framing');
    t.bridges.forEach(b => {
      const row = el('div', { class: 'item', style: 'border-top:1px solid var(--border-2)' });
      row.append(el('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px' },
        el('span', { class: 'tag' }, b.have),
        el('span', { class: 'muted' }, '→'),
        el('span', { class: 'tag kw' }, b.trend)));
      row.append(el('div', { class: 'ev', style: 'padding-left:0;margin-top:5px' }, b.reframe));
      sec.append(row);
    });
    out.append(sec);
  }

  // gaps
  if (t.gaps?.length) {
    const sec = section('Gaps worth weighing');
    t.gaps.forEach(g => sec.append(el('div', { class: 'item gap', style: 'border-top:1px solid var(--border-2)' },
      el('div', { class: 'req', style: 'justify-content:space-between' },
        el('span', {}, g.skill),
        el('span', { class: 'pill ' + (g.closeable ? 'info' : 'neutral') }, g.closeable ? 'closeable' : 'out of lane')),
      el('div', { class: 'ev', style: 'padding-left:0' }, g.how))));
    out.append(sec);
  }

  // positioning + hot titles side by side
  const grid = el('div', { class: 'grid cols-2', style: 'margin-top:16px' });
  if (t.positioning?.length) {
    const c = el('div', { class: 'card pad' });
    c.append(el('p', { class: 'section-label' }, 'Positioning moves'));
    const ul = el('ul', { class: 'checklist' });
    t.positioning.forEach(pp => ul.append(el('li', {}, el('span', { html: CHECK, style: 'width:16px;height:16px;color:var(--brand);flex:none' }), el('span', {}, pp))));
    c.append(ul); grid.append(c);
  }
  if (t.hot_titles?.length) {
    const c = el('div', { class: 'card pad' });
    c.append(el('p', { class: 'section-label' }, 'Titles trending for your moat'));
    const chips = el('div', { style: 'display:flex;flex-wrap:wrap;gap:7px' });
    t.hot_titles.forEach(h => chips.append(el('span', { class: 'tag kw' }, h)));
    c.append(chips); grid.append(c);
  }
  if (grid.children.length) out.append(grid);
}

/* ============================================================================
 * Navigation / shell
 * ==========================================================================*/
const VIEWS = {
  dashboard: { title: 'Giggy', sub: 'Honest job-placement advice from a contracting & freelancing beast', actions: [] },
  validate:  { title: 'Validate opportunity', sub: 'Fit analysis before generation', actions: [] },
  tracker:   { title: 'Pipeline', sub: 'Every application, honestly tracked',
    actions: [
      { label: 'Add row', cls: 'btn sm', on: addBlankRow },
      { label: 'Export CSV', cls: 'btn sm ok', on: exportCSV },
      { label: 'Reset', cls: 'btn sm ghost', on: resetTracker }
    ] },
  trends:    { title: 'Skill trends', sub: 'Align proven skills to where the market is going', actions: [] },
  profile:   { title: 'Profile & guardrails', sub: 'The canonical source of truth', actions: [] },
  settings:  { title: 'Settings', sub: 'Connection, model & deployment', actions: [] }
};

function renderTopbarActions(name) {
  const bar = $('#topbar-actions'); bar.innerHTML = '';
  (VIEWS[name]?.actions || []).forEach(a => bar.append(el('button', { class: a.cls, onclick: a.on }, a.label)));
}

function switchTab(name) {
  if (!VIEWS[name]) name = 'dashboard';
  $$('.nav-item').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  $('#page-title').textContent = VIEWS[name].title;
  $('#page-sub').textContent = VIEWS[name].sub;
  renderTopbarActions(name);
  closeSidebar();
  if (name === 'dashboard') renderDashboard();
  if (name === 'tracker') renderTracker();
  if (name === 'trends') renderTrends();
  if (name === 'profile') renderProfile();
  if (name === 'settings') renderSettings();
}

async function resetTracker() {
  if (!confirm('Reset the pipeline to the seeded list? Any rows you added or edits you made will be lost.')) return;
  state.tracker = seedTracker(); save(LS.tracker, state.tracker); renderTracker(); updateNavCount();
  if (dbOn()) { try { await SB.clearAll(); await SB.upsertMany(state.tracker); } catch (e) { toast('Cloud reset failed: ' + e.message, true); } }
  toast('Pipeline reset to seed.');
}
function updateNavCount() { $('#nav-count').textContent = state.tracker.length; }

/* theme */
function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
  const isDark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#theme-ic').innerHTML = isDark ? IC.sun : IC.moon;
  $('#theme-lbl').textContent = t === 'system' ? 'System' : (t === 'dark' ? 'Dark' : 'Light');
}
function cycleTheme() {
  const order = ['light', 'dark', 'system'];
  const cur = load(LS.theme, 'light');
  const next = order[(order.indexOf(cur) + 1) % order.length];
  save(LS.theme, next); applyTheme(next);
}

/* mobile sidebar */
function openSidebar() { $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); }
function closeSidebar() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }

/* ============================================================================
 * init
 * ==========================================================================*/
function init() {
  applyTheme(load(LS.theme, 'light'));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(load(LS.theme, 'light')));

  $$('.nav-item').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  $$('[data-goto]').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.goto)));
  $('#menu-btn').addEventListener('click', openSidebar);
  $('#scrim').addEventListener('click', closeSidebar);
  $('#theme-btn').addEventListener('click', cycleTheme);

  // agent conversation
  $('#chat-send').addEventListener('click', () => sendChat($('#chat-text').value));
  $('#chat-clear').addEventListener('click', clearChat);
  $('#iv-jd-btn').addEventListener('click', () => { const w = $('#iv-jd-wrap'); w.hidden = !w.hidden; if (!w.hidden) { $('#iv-jd').value = state.interview.jd || ''; $('#iv-jd').focus(); } });
  $('#iv-jd-save').addEventListener('click', saveJD);
  $('#iv-jd-cancel').addEventListener('click', () => { $('#iv-jd-wrap').hidden = true; });
  $('#iv-resume').addEventListener('change', onResumeFile);
  $('#iv-begin').addEventListener('click', rateOpportunity);
  const ct = $('#chat-text');
  ct.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(ct.value); } });
  ct.addEventListener('input', () => { ct.style.height = 'auto'; ct.style.height = Math.min(ct.scrollHeight, 150) + 'px'; });

  $('#btn-validate').addEventListener('click', runValidate);
  $('#btn-clear-jd').addEventListener('click', () => { $('#jd').value = ''; $('#result').innerHTML = ''; $('#validate-empty').hidden = false; });
  $('#jd').addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runValidate(); });

  $('#btn-save-settings').addEventListener('click', saveSettings);
  $('#btn-test').addEventListener('click', testKey);
  $$('input[name=mode]').forEach(r => r.addEventListener('change', () => {
    $('#direct-key-wrap').style.display = ($$('input[name=mode]').find(x => x.checked)?.value === 'direct') ? '' : 'none';
  }));
  $('#btn-save-profile').addEventListener('click', saveProfile);
  $('#btn-reset-profile').addEventListener('click', resetProfile);
  const resetBtn = $('#btn-reset-tracker-2'); if (resetBtn) resetBtn.addEventListener('click', resetTracker);
  $('#btn-trends').addEventListener('click', runTrends);
  $('#btn-sb-save').addEventListener('click', saveSupabase);
  $('#btn-sb-clear').addEventListener('click', () => { SB.setConfig('', ''); renderSettings(); toast('Supabase disconnected.'); });
  $('#tracker-search').addEventListener('input', renderTracker);

  updateNavCount();
  updateKeyStatus();
  switchTab('dashboard');
  loadPipeline();   // async: hydrate from Supabase if configured
}
document.addEventListener('DOMContentLoaded', init);
