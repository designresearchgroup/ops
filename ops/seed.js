/*
 * Seed pipeline — James E. Coleman's existing job-search assets, mapped to the
 * tracker schema (SKILL Part 6) with added tier / verdict / flags / fit metadata.
 * Source: "Master Index of Job Search Assets". Statuses reflect best-known state;
 * verify against your own records before relying on them for anything official.
 * Loaded only when the tracker is empty (first run). "Reset tracker" re-seeds this.
 */
window.SEED_PIPELINE = [
  // ---------- TIER 1 — strongest / cleanest ----------
  { tier: 1, employer: "Apple", title: "Design Producer / Producer III (contract)", location: "Culver City / Cupertino, CA", howApplied: "Contract via Harvey Nash (recruiter: Adil)", pay: "~$74.64/hr · 6 mo", status: "In progress", verdict: "clean_fit",
    fit: "Held this EXACT role at Apple. Highest-probability, inbound recruiter lead.", flags: [],
    notes: "Reply sent to recruiter. Keep straight: the recruiter meeting was Agility, not Apple." },
  { tier: 1, employer: "Agility Robotics", title: "Principal / Senior TPM (Physical AI)", location: "Remote / Oregon", howApplied: "Direct (no agencies)", pay: "", status: "In progress", verdict: "clean_fit",
    fit: "The 'moat' role — built the robot UI (FRYBOT/Icon), builds AI, plus program rigor.", flags: ["hard-gate: 8+ yrs hands-on HW/SW (reframe to Physical AI moat, don't claim literally)"],
    notes: "Recruiter phone screen pending. Lead with FRYBOT HRI. Hummer EV = concept design only." },
  { tier: 1, employer: "Lionsgate", title: "Director, Creative AI & Production Technology", location: "Santa Monica, CA", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit",
    fit: "Best-fit of the session — creative + AI + media. MADE CX provenance hits the rights/metadata ask; BBDO Super Bowl / Emmy = production scale.", flags: [],
    notes: "Resume + cover letter built." },
  { tier: 1, employer: "Fehr & Peers", title: "Application Development Manager", location: "Roseville / Sacramento, CA (hybrid)", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit",
    fit: "Clean local fit. Player-coach, AI-assisted dev + MCP/RAG in wheelhouse, no degree gate.", flags: ["Flask/Nginx/Linux framed honestly as 'ramp quickly', not deep hands-on"],
    notes: "Resume + cover letter built." },
  { tier: 1, employer: "Airbnb", title: "Creative Producer", location: "San Francisco, CA (on-site 5 days)", howApplied: "", pay: "$157–185K", status: "Prepared-not-sent", verdict: "legitimate_reach",
    fit: "Natural creative-producer fit; Emmy live-broadcast answers a specific req.", flags: ["on-site SF — real relocation from SoCal", "comp below PM floor — different lane"],
    notes: "Styled + ATS variants built." },

  // ---------- TIER 2 — strong AI / PM / product ----------
  { tier: 2, employer: "Traba", title: "Founding PM, Agents", location: "New York, NY", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit",
    fit: "Two real agents (HumanData proposal-writer, MADE CX monitor) clear the 'real agent builder' bar honestly.", flags: [],
    notes: "Own detect-vs-execute distinction truthfully." },
  { tier: 2, employer: "Mercer / Marsh", title: "Product Leader, Data & Digital", location: "New York, NY (hybrid)", howApplied: "", pay: "$164–328K", status: "Prepared-not-sent", verdict: "legitimate_reach",
    fit: "Legitimate reach; cover letter addresses enterprise-scale gap head-on.", flags: [],
    notes: "Resume + cover letter built." },
  { tier: 2, employer: "Disney", title: "Lead Product Manager", location: "Glendale, CA", howApplied: "", pay: "$155–208K", status: "Prepared-not-sent", verdict: "clean_fit",
    fit: "AI-accelerated PM is a differentiator they explicitly want.", flags: ["gap: co-brand credit-card product experience"],
    notes: "" },
  { tier: 2, employer: "Caterpillar", title: "Principal Digital Project Manager", location: "", howApplied: "Referral: Icon ex-coworker", pay: "", status: "Prepared-not-sent", verdict: "legitimate_reach",
    fit: "Leads with robotics/HRI + AI moat; Azure DevOps (SCE on Azure) hits a must-have.", flags: ["hard-gate: CS/CE/IT bachelor's (Applied AI expected 2026, stated honestly)", "#LI-DNI — may be compliance/PERM posting"],
    notes: "Call Icon ex-coworker; send them the resume." },
  { tier: 2, employer: "KPMG", title: "Technical Lead, Forward Deployed Engineering", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "legitimate_reach",
    fit: "On-theme (ships AI systems, Claude Code/Cursor, context engineering).", flags: ["reach: 7 yrs production AI/ML"],
    notes: "Will require a live system walk-through — prep HumanData/MADE CX demo." },
  { tier: 2, employer: "LegalZoom", title: "AI UX Designer", location: "", howApplied: "Online portal", pay: "", status: "Submitted", verdict: "clean_fit", fit: "", flags: [], notes: "Resume + cover letter submitted." },
  { tier: 2, employer: "Cisco", title: "Senior Product Designer", location: "", howApplied: "Online portal", pay: "", status: "Submitted", verdict: "clean_fit", fit: "", flags: [], notes: "Submitted." },

  // Tier 2 — built / tailored, not yet sent
  { tier: 2, employer: "TribalScale", title: "Product Manager", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit", fit: "", flags: [], notes: "Resume built." },
  { tier: 2, employer: "Instacart", title: "AI Engagement Manager", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit", fit: "", flags: [], notes: "Resume built." },
  { tier: 2, employer: "Tribe AI", title: "Delivery Lead", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit", fit: "", flags: [], notes: "Resume built." },
  { tier: 2, employer: "Guidant", title: "Technical Program Manager", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit", fit: "", flags: [], notes: "Resume built." },
  { tier: 2, employer: "Field AI", title: "Product Manager", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit", fit: "Robotics/physical-AI adjacency.", flags: [], notes: "Resume built." },
  { tier: 2, employer: "Capital Group", title: "AI Product Manager", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit", fit: "", flags: [], notes: "Resume built." },
  { tier: 2, employer: "Fabletics", title: "AI Product Manager", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit", fit: "", flags: [], notes: "Resume built." },
  { tier: 2, employer: "Qvest", title: "Applied AI", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit", fit: "", flags: [], notes: "Resume built." },
  { tier: 2, employer: "Google", title: "UX Program Manager", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "legitimate_reach", fit: "", flags: [], notes: "Resume built." },
  { tier: 2, employer: "WME", title: "Technical Program Manager", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit", fit: "", flags: [], notes: "Resume built." },
  { tier: 2, employer: "Beacon Hill", title: "Technical Program Manager", location: "", howApplied: "Agency", pay: "", status: "Prepared-not-sent", verdict: "clean_fit", fit: "", flags: ["agency"], notes: "Resume built." },
  { tier: 2, employer: "West Monroe", title: "Data Product Manager", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit", fit: "", flags: [], notes: "Resume built." },
  { tier: 2, employer: "Slalom", title: "Senior Product Manager", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit", fit: "", flags: [], notes: "Resume built." },
  { tier: 2, employer: "Ford", title: "Builder TPM", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit", fit: "", flags: [], notes: "Resume built." },

  // ---------- TIER 3 — stretch / specialized ----------
  { tier: 3, employer: "Sacramento (name TBD)", title: "AI Transformation Consultant", location: "Sacramento, CA", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "legitimate_reach",
    fit: "AWS framed honestly.", flags: ["gap: 5+ yrs AWS (not held professionally)", "gap: Bedrock (not held)"],
    notes: "Recover company name from LinkedIn before submitting." },
  { tier: 3, employer: "Blue State", title: "Contract PM (Digital, Websites)", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit",
    fit: "Good fit; purpose-driven agency.", flags: ["evergreen — pipeline, not active"], notes: "Resume built." },
  { tier: 3, employer: "Tata Consultancy", title: "AI Transformation Lead", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "legitimate_reach", fit: "", flags: ["full-stack depth stretch"], notes: "Resume + cover letter built." },
  { tier: 3, employer: "PwC", title: "AI Solutions Delivery Lead", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "legitimate_reach", fit: "", flags: ["classical-ML flag", "degree flag"], notes: "Resume built." },
  { tier: 3, employer: "Deloitte", title: "Deployment Specialist", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "legitimate_reach", fit: "", flags: [], notes: "Resume built." },
  { tier: 3, employer: "Infosys", title: "Engagement Manager", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "legitimate_reach", fit: "", flags: [], notes: "Resume built." },
  { tier: 3, employer: "Pragmatike", title: "Staff Product Engineer", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "legitimate_reach", fit: "", flags: ["biggest engineering-screen stretch"], notes: "Resume built." },
  { tier: 3, employer: "TravisMathew", title: "AI Strategy Manager", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit", fit: "", flags: [], notes: "Cover letter still owed." },
  { tier: 3, employer: "LA28", title: "Manager, Digital Experience", location: "Los Angeles, CA", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "clean_fit", fit: "", flags: [], notes: "Resume + cover letter built." },
  { tier: 3, employer: "AWS re/Start", title: "Training Program", location: "", howApplied: "", pay: "", status: "Prepared-not-sent", verdict: "legitimate_reach", fit: "", flags: ["training program, not a role"], notes: "Resume + 5 essay answers." },
  { tier: 3, employer: "Advanced Marketers", title: "Web / CRO Manager", location: "Local", howApplied: "", pay: "$65–80K", status: "Prepared-not-sent", verdict: "legitimate_reach", fit: "", flags: ["comp below floor"], notes: "3 app questions still owed if pursuing." },
  { tier: 3, employer: "CHAOS", title: "Product Manager", location: "", howApplied: "", pay: "", status: "Not accepted", verdict: "skip", fit: "Defense radar — passed on.", flags: ["different profession / defense"], notes: "Passed on." },

  // ---------- GOVERNMENT / CIVIL SERVICE ----------
  { tier: 2, employer: "LA County DPH", title: "IT Specialist I (Exam PH2569G-EA)", location: "Los Angeles, CA", howApplied: "County exam", pay: "", status: "Applied", verdict: "legitimate_reach",
    fit: "MQ hinges on principal-level equivalence (coin-flip).", flags: ["hard-gate: MQ equivalence"], notes: "Applied." },
  { tier: 2, employer: "LA County DHS", title: "Senior Application Developer, Data & Analytics (Exam Y2525G)", location: "Los Angeles, CA", howApplied: "County exam", pay: "", status: "Not accepted", verdict: "skip",
    fit: "Screened at supplemental questionnaire — healthcare-domain gaps, exactly as flagged.", flags: ["healthcare-domain hard gates"], notes: "No appeal recommended (answers were accurate)." }
];
