# Plan 057: Reposition as a three-pillar AI-discoverability toolkit + add an optional agent defect-reporting protocol

> **Executor instructions**: Follow this plan step by step. Part A is
> documentation-only; Part B adds a skill protocol, a new guide, and an
> issue-template tweak. No `src/` or `bin/cli.js` runtime change. When done,
> update the status row in `plans/README.md` and the `Unreleased` changelog.
>
> **Drift check (run first)**:
> `git diff --stat b8cd937..HEAD -- README.md README.es.md AGENTS.md package.json .agents/skills/geo-optimization/SKILL.md .github/ISSUE_TEMPLATE/bug_report.yml`
> If any changed since this plan was written, compare against the live files
> first.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (docs + skill guidance + issue template; no runtime change)
- **Horizon**: now (go-to-market / DX)
- **Depends on**: none
- **Category**: positioning / dx / governance
- **Planned at**: commit `b8cd937`, 2026-06-30

## Why this matters

`geo-opt` is framed as a **GEO** tool, but a substantial part of its surface is
**technical SEO** and **structured data**, not GEO in the strict sense:

| Pillar | Surface | Modules / commands |
|---|---|---|
| GEO (differentiator) | scoring v1/v2, profiles, answer-first, stats, quotes, clarity, `llms.txt` | `src/scoring-v2.js`, `src/observations.js`, `src/profiles.js`, `src/llms-txt.js` |
| Structured data | Schema.org JSON-LD (8 types), validation, injection | `src/schema.js`, `src/validate.js` |
| Technical SEO | `robots.txt`, `sitemap.xml`, hreflang, canonical, meta robots, lang tags | `src/technical.js`, `src/robots.js`, `src/sitemap.js` |

The README already half-acknowledges this ("AI-discoverability toolkit",
"technical SEO checks"), but the framing undersells the structured-data and
technical-SEO pillars as footnotes. **Part A** repositions the product as an AI
discoverability toolkit on three explicit pillars — keeping GEO as the headline
and differentiator, without renaming the package.

Separately, because the tool is increasingly agent-driven, an agent that hits a
real `geo-opt` defect has full context (command, version, error) to file an
excellent bug report. **Part B** adds an opt-in, privacy-safe protocol so the
agent *offers* to open a clear, professional GitHub Issue — feeding maintainer
improvement without ever leaking user content.

### Owner decisions (locked)

1. **Part A: reposition only.** Do NOT rename the npm/CLI package `geo-opt` or
   the `geo-optimization` skill. Copy/definition change only.
2. **Part B: skill + template + docs.** No `bin/cli.js` runtime change (no crash
   hint). The protocol lives in the skill + issue template + a new guide.

### Governing invariants

- `docs/documentation-governance.md`: a fact has one authoritative source;
  README.md and README.es.md are mirrors and change together; doc/behavior
  changes require a `CHANGELOG.md` `Unreleased` entry (`npm run changelog:check`).
- `AGENTS.md` privacy policy forbids exposing "audited content, paths, URLs,
  file names, or config." **The issue protocol inherits that exact rule** — it is
  consistent with the "100% local, zero telemetry" brand.

## Canonical positioning statement (single source)

Authoritative source: README.md "Why your content needs GEO" / "What geo-opt
does". Other documents summarize it.

> geo-opt is an AI-discoverability toolkit built on three pillars: (1) GEO —
> content quality for generative engines; (2) structured data — Schema.org
> JSON-LD; and (3) technical SEO — `robots.txt`, `sitemap.xml`,
> hreflang/canonical and crawler policy. GEO is the headline and the
> differentiator; structured data and technical SEO are the foundations AI
> engines depend on.

## Part A — Reposition (docs-only)

| File | Edit |
|---|---|
| `package.json` (`description`) | Rewrite to: "Source-available AI-discoverability CLI: GEO content audit, Schema.org JSON-LD, technical SEO, robots.txt, sitemap.xml, and llms.txt — 100% local." |
| `README.md` | (a) Add a "three pillars" paragraph in **Why your content needs GEO** (GEO as umbrella; structured data + technical SEO as first-class pillars). (b) Rename subsection **Inspect (technical)** → **Technical SEO**, elevate to pillar. (c) Adjust the one-liner to name the three pillars. |
| `README.md` (TOC) | Update affected anchors (`#inspect-technical` → `#technical-seo`). |
| `README.es.md` | Mirror (a)/(b)/(c) in neutral Spanish; keep 1:1 section parity. |
| `AGENTS.md` (`## Project`) | Rewrite the first sentence to name the three pillars, keeping the disclaimers ("not a ranking or citation predictor"). |
| `.agents/skills/geo-optimization/SKILL.md` | Broaden the frontmatter `description` to mention structured data + technical SEO; add one scope sentence under the H1. Keep `name: geo-optimization` and the H1 unchanged. |
| `CHANGELOG.md` | `Unreleased` → `### Docs` bullet (see Part B/changelog below). |

Non-goals: no binary/package/skill rename; no "pivot to SEO"; no `src/` change.

## Part B — Defect-reporting protocol (opt-in)

**Privacy rule (governs everything):** an issue must never contain audited
content, file paths, internal URLs, file names, config values, keys, or secrets —
only technical metadata: `geo-opt` version, Node version, OS, the exact command
(sensitive args redacted), and the error output.

- **B1 — `docs/reporting-issues.md` (new, source of truth).** Scope (what is a
  reportable defect vs. not), privacy rules, the prefilled-URL recipe, and the
  `gh issue create` recipe. Published with the npm package (`docs/` is in
  `package.json` → `files`).
- **B2 — `SKILL.md` new `##` section after Phase 7**, "Reporting defects
  (optional, user-confirmed)": trigger/scope, privacy-first, and the 7-step
  protocol (surface → ask → dedupe `gh issue list --search` → draft mapped to
  `bug_report.yml` fields → show for review → submit only on explicit yes via
  prefilled URL by default or `gh issue create` if authed → never auto-submit).
  Summarizes and links B1.
- **B3 — `.github/ISSUE_TEMPLATE/bug_report.yml`.** Add a redaction notice to the
  intro `markdown` block; add an optional (non-required) `checkboxes`:
  "This report was drafted with the help of an AI agent (geo-opt skill)".
- **B4 — `AGENTS.md`.** Short `## Defect reporting` section linking B1 and
  restating the privacy invariant.

Prefilled-URL note (verified): `config.yml` has `blank_issues_enabled: false`, so
the URL must reference `template=bug_report.yml`; query params map by each YAML
field `id`:
`https://github.com/cortega26/geo-opt/issues/new?template=bug_report.yml&title=...&version=...&node-version=...&os=...&command=...&actual=...&labels=bug`.

Non-goals: no `bin/cli.js` change; no automatic network calls; no `config.yml`
change; no telemetry activation.

## Changelog (`Unreleased` → `### Docs`)

- Reposition project as a three-pillar AI-discoverability toolkit (GEO +
  structured data + technical SEO); clarify GEO as the umbrella term.
- Add optional agent-assisted defect-reporting protocol (SKILL.md +
  `docs/reporting-issues.md`) and a privacy/redaction note + agent-origin
  checkbox to the bug-report template.

## Verification

No runtime change, so verification is documentation/consistency:

- `npm run changelog:check` — confirms the `Unreleased` entry.
- `npm run format:check` — prettier scope is `src/ bin/ scripts/ tests/`, not
  `.md`; must still pass unchanged.
- `git diff --check` — no broken whitespace.
- Doc drift (governance grep):
  `rg -n "Node.js 20|identical results|--model v2|--profile" README.md README.es.md AGENTS.md docs .agents/skills/geo-optimization/SKILL.md`.
- TOC: confirm renamed anchors resolve (`#technical-seo`) and README.es.md keeps
  section parity.
- Validate the template parses as YAML; build a sample prefilled URL and confirm
  `bug_report.yml` preloads.
- (Optional) full `npm run check` — must pass unchanged (no code change).

## STOP conditions

- Any edit would change `src/` or `bin/cli.js` runtime behavior → stop; out of
  scope for this plan.
- Repositioning copy would claim a capability the CLI does not have → stop and
  reconcile against the actual command surface first.
