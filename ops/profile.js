/*
 * Canonical candidate profile — the source of truth (SKILL Part 4).
 * Swap this block to reuse the tool for a different job seeker.
 * The app loads this as the default; edits in the Profile tab are saved to
 * localStorage and override these defaults until you "Reset to defaults".
 */
window.DEFAULT_PROFILE = {
  identity: {
    name: "James E. Coleman",
    phone: "310.430.2523",
    email: "info@jamesecoleman.com",
    portfolio: "jamesecoleman.com",
    linkedin: "linkedin.com/in/james-e-coleman-ca",
    location: "Southern California (Irvine/Costa Mesa). Open to relocation.",
    locationNote: "Adjust the location line to the role's geography — don't lead with SoCal for an NYC role.",
    workAuth: "US authorized, no visa sponsorship needed.",
    compFloor: "~$250K total comp for senior PM/AI roles (NYC market); flexible on base/equity mix. Contract roles: accept posted rate to move fast."
  },

  moat:
    "I'm the UI and data/intelligence layer for systems-level infrastructure — I design, build, and ship AI-native products end to end, across the interface AND the intelligence, plus 15+ years of program rigor. Real triad: Data Analysis + Robotics (interface/HRI) + AI. Security = coursework / 'security-aware', NOT a claimed pillar.",

  // Verified employment history — never invent beyond this.
  employment: [
    {
      company: "HumanData Technologies",
      title: "Founder",
      dates: "Oct 2022 – Present",
      summary: "Builds agentic AI platform for grants/gov contracting: multimodal intake (voice/text/image/PDF) → grant/contract discovery matched to profile → eligibility determination → autonomous proposal writing → document-rating quality check; maintains knowledge center + funding pipeline (deadlines, funder contacts); skills-based architecture with validation; payment-gated/metered operations; conversational interface.",
      stack: "Python, JS/TS, SQL, NoSQL/MongoDB, LLMs, RAG, agents, GCP, Supabase."
    },
    {
      company: "MADE CX",
      title: "Founder",
      dates: "2021 – Present",
      summary: "Live cultural-IP licensing platform. Autonomous scheduled agent detects unauthorized use of creators' work → reasons about viability → reports via human-review layer. REST API, blockchain provenance (BLK CHAIN ID), royalty logic, credit/entitlement metering + payment-gating. Detect-and-report today; tool-orchestration/execution on roadmap."
    },
    {
      company: "Deep Venue (deepvenue.co)",
      title: "Creator & Product Lead",
      dates: "",
      summary: "Live geospatial platform: helps venues, sports enterprises, tour promoters measure/project economic impact of live events; 44 stadiums, cost/revenue models, SCSA/Levi's command center."
    },
    {
      company: "Bioelectric (trybioelectric.com)",
      title: "Creator & Product Lead",
      dates: "",
      summary: "Live DTC product: interactive configurator, AI formula-matcher, dynamic pricing."
    },
    {
      company: "Canyon Oaks Ventures, LLC",
      title: "Consultant — Data Analyst / App Developer / Project Manager",
      dates: "Aug 2024 – Present (ongoing, pending contract continuance)",
      summary: "Consultant to City of Santa Clara / Santa Clara Stadium Authority (municipal gov, competitive 'best value' RFP award). 25 hrs/wk, supervised 4. Supervisor: Taj Tashombe, Principal Consultant. Work: stadium market/economic-impact benchmarking, 11-touchpoint digital-journey systems analysis, tech-implementation roadmap, PUBLIC-RECORDS data process across NFL/MLB stadium authorities, presented to City Managers & City Council. Built deepvenue.co + interactive analytics dashboard (drgx.co/flow/scsa/)."
    },
    {
      company: "DRGx (Design Research Group)",
      title: "Founder / Principal Consultant — App Developer / Project Manager",
      dates: "Jun 2015 – Present",
      summary: "Consulting: systems, web, data, AI for enterprise & government-adjacent clients. (Started after Quigley-Simpson.)"
    },
    {
      company: "Icon Group",
      title: "Product Manager (robotics UX & product)",
      dates: "Apr 2022 – Nov 2022",
      summary: "Managed design/dev of a POS system for the FRYBOT commercial kitchen robot (Lab2Fab/Middleby, for Sonic chain). Scoped product with CEO (Shawn) and Creative Director (Mathew Coburn), ran Agile/Scrum sprints (~6 wk) alongside a Senior UI Designer. Reframed engagement into human-robot interaction: app-controlled robot moves for in-store customers, crew-engagement features — robot as brand/experience moment. Also GM Hummer EV concept-car design (design/experience side ONLY — can speak to concept design, NOT production engineering). Left: recruited back to Apple."
    },
    {
      company: "Apple Inc.",
      title: "Product Design Producer, Ad Platform + Apple News",
      dates: "2022 – 2023 (Oct 2022 start)",
      summary: "Culver City, CA. Managed design+dev delivery, design reviews, specs handoff to eng, build review, cross-functional. Did NOT code Apple's platforms (producer role). Supervisor: Ashley Schuact [confirm spelling]. Left: 'Moved on to government technology assignments and returned to school to study Applied AI at University of Arizona.' Use the Ad Platform + Apple News framing — do NOT mix with the older AirPods/retail-560-locations version."
    },
    {
      company: "Quigley-Simpson",
      title: "Senior Program Manager",
      dates: "Jun 2015 – Jun 2016",
      summary: "Performance-marketing agency (employee role). Built SCE Charge Ready enrollment platform (CPUC-approved $436M EV-charging program; automated eligibility, doc mgmt, applicant/utility-review workflows) on Microsoft Azure (Azure DevOps); migrated all ad units SWF/Flash→JavaScript; built design system; built corporate comms site (JS/CSS/SQL); led UX validation. SCE Charge Ready lives HERE, not under DRGx — never double-list."
    },
    {
      company: "Code and Theory",
      title: "Technical Program Manager",
      dates: "Feb 2021 – Oct 2021",
      summary: "Enterprise clients incl. Amazon, Prudential."
    },
    {
      company: "Tibco (tibbr Geo)",
      title: "Lead UI Developer / Prototyper / Product Dev Lead",
      dates: "Jun 2011 – Jun 2012",
      summary: "UI/experience layer on enterprise systems-level communications platform."
    },
    {
      company: "AltspaceVR",
      title: "Product Developer",
      dates: "Mar 2012 – Jun 2012",
      summary: "Social VR / spatial-computing platform, later acquired by Microsoft (2017)."
    },
    {
      company: "Atmosphere BBDO",
      title: "Senior Integrated Producer",
      dates: "2008 – 2010",
      summary: "Produced VFX-involved broadcast campaigns: AT&T/Network trust campaign, Conservation International 'Save an Acre' (aired during Super Bowl), Bud Light 'Dude' VFX campaign."
    },
    {
      company: "Oscars.com — ABC/Disney",
      title: "Integrated Producer (Emmy Winner)",
      dates: "Dec 2010 – May 2011",
      summary: "Emmy-winning live-simulcast digital experience."
    },
    {
      company: "Earlier / other",
      title: "",
      dates: "",
      summary: "Milk Studios, Industrial Color; commercial work with Nike, Adidas, Google, Toyota, Condé Nast. Working photographer since 1995."
    }
  ],

  // Guardrails — the honesty engine.
  skillsHave: [
    "Python", "JavaScript/TypeScript", "SQL", "NoSQL/MongoDB", "LLMs", "RAG", "agents",
    "LangChain", "prompt engineering", "orchestration", "MCP-style servers", "CI/CD", "Git",
    "Tableau", "Business Objects", "data analysis/visualization", "GCP", "Azure (incl. Azure DevOps)",
    "Supabase/Postgres", "Agile/Scrum/Lean", "Jira", "Confluence", "UX/UI", "information architecture",
    "Figma", "design systems", "WCAG", "program/project management", "Claude Code/Cursor/Copilot"
  ],
  skillsDontHave: [
    "professional AWS experience (only used it; Supabase runs on AWS ≠ AWS experience)",
    "Amazon Bedrock (production)",
    "PyTorch/scikit-learn deep ML",
    "hardware/mechatronics engineering",
    "deep Flask/Gunicorn/Nginx production",
    "HEDIS/QIP/CMS healthcare P4P",
    "FHIR/EDI",
    "medical coding (CPT/ICD/SNOMED)",
    "cybersecurity as a practiced pillar (U of A coursework only)",
    "Deltek/Esri ArcGIS (unless confirmed)",
    "Agile/Scrum certification (experience only, no cert)"
  ],

  education: [
    "University of Arizona — B.A.S., Applied Computing / Applied Artificial Intelligence. Jun 2024 – Jun 2026 (expected). Tucson, AZ. Includes cybersecurity coursework.",
    "Cert: Coding for Data Program (SQL & Python for Data Analytics) — University of Arizona.",
    "Cert: Website Audience Analysis Project — Data Visualization & Analysis — Global Career Accelerator (Recording Academy).",
    "John F. Kennedy University — Institute of Entrepreneurial Leadership (Pleasant Hill, CA).",
    "City College of San Francisco — Photography & Multimedia Studies.",
    "Foothill College — Commercial Photography (Los Altos Hills, CA).",
    "Emmy Award — Outstanding Creative Achievement in Interactive Media (2011).",
    "Working photographer since 1995."
  ],

  targetRoles: [
    "AI Product Manager/Leader",
    "Technical Program Manager (esp. Physical AI/robotics)",
    "Design/Creative Producer",
    "Application Development Manager",
    "Forward-Deployed AI Engineer",
    "Digital/Website Program Manager",
    "AI Transformation Consultant"
  ],
  sourcingWeightToward: "Builds real AI systems, ships 0→1, robotics/HRI, creative+tech hybrid, gov/enterprise delivery.",
  sourcingFilterOut: "Quota-carrying sales leadership, deep-hardware/mechatronics engineering, security-specialist roles, deep-classical-ML research.",

  stylePreferences: [
    "NEVER write 'React/Next' (say 'full-stack').",
    "Shorten emails, plainer phrasing, fewer em-dashes. Sign 'James.'",
    "Don't lead with 'founder' for employee roles (flight-risk signal) — use 'Creator & Product Lead' / 'Built.'",
    "Aura-farming-with-receipts: confident positioning always backed by verifiable work."
  ]
};
