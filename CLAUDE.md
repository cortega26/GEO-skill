# CLAUDE.md — geo-opt

## Project

`geo-opt` is a zero-dependency CLI tool for Generative Engine Optimization
(GEO). It audits Markdown/HTML content and scores it 0–100 based on the
Princeton GEO framework (KDD 2024). It also generates and injects JSON-LD
Schema.org structured data and audits robots.txt for AI crawler access.
Current releases are source-available under the Tooltician Community License
1.0, with separate commercial licensing for branding-free use.

## Architecture

- **Two implementations** of the same logic:
  - `src/` — JavaScript/Node.js ESM, published as npm package `geo-opt`.
    Domain modules: `scoring.js` (407 lines), `schema.js` (254 lines),
    `text.js`, `robots.js`, `config.js`, `licensing.js`, and `index.js`
  - `.agents/skills/geo-optimization/scripts/geo_optimizer.py` (682 lines) —
    Python 3, used by the agent skill defined in `SKILL.md`
- **CLI entry point**: `bin/cli.js` (261 lines) — manual argv parsing with
  `node:util.parseArgs`
- **Tests**: `tests/optimizer.test.js` (node:test) +
  `.agents/skills/geo-optimization/scripts/test_optimizer.py` (unittest,
  unittest)

## Commands

| Purpose | Command |
|---------|---------|
| Test (JS) | `npm test` |
| Test (Python) | `python3 .agents/skills/geo-optimization/scripts/test_optimizer.py` |
| Lint | `npm run lint` |
| Format check | `npm run format:check` |
| Format apply | `npm run format` |
| Full check | `npm run check` |
| Run CLI | `node bin/cli.js <command> [args]` |

## Conventions

- JS: ESM, camelCase, double quotes, semicolons, `process.exit(1)` on errors
- Python: snake_case, `sys.exit(1)` on errors, `print(..., file=sys.stderr)`
- Error pattern: `console.error`/`print(stderr)` + `process.exit(1)`/`sys.exit(1)`
- Output functions write to stdout; core functions return data
- Config loaded from `geo_config.json` in CWD or the neutral `.agents/` fallback
- Free injection includes Tooltician branding; `--no-branding` requires a
  locally configured Pro key
- Community support reminders are local-only, non-blocking, automation-safe,
  and user-disableable through `geo-opt config set reminders false`
- Never infer author, publisher, publication date, price, or availability

## Implementation plans

See `plans/README.md` for the current improvement roadmap. Execute plans in
order. All plans are authored for executor models with zero context — read
each plan fully before starting.
