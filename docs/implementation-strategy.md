# Implementation Strategy — JS vs Python

## Decision

As of 2026-06-25, the modular **`src/` JavaScript implementation** is canonical for geo-opt. The Python implementation in `.agents/skills/geo-optimization/scripts/geo_optimizer.py` is a secondary port used by the agent skill defined in `SKILL.md`.

## Rationale

1. **Public interface**: The npm package `geo-opt` is the documented public CLI (`README.md`). The `bin` entry in `package.json` makes it available via `npx geo-opt`.
2. **CI/CD**: `npm run check` is the automated verification path and includes
   JavaScript linting, formatting, JavaScript tests, Python parity tests, and
   changelog policy enforcement.
3. **Feature recency**: JS has received more recent fixes (plan 002 fixed 4 bugs in JS; Python equivalents may still be unfixed).

## Keeping them in sync

When making changes to the canonical JS implementation, apply equivalent changes to the Python port following this checklist:

### Sync checklist

- [ ] `loadConfig` / `load_config` — config search paths and error handling
- [ ] `preprocessContent` / `preprocess_content` — regex patterns for stripping code blocks, scripts, styles, comments
- [ ] `cleanMarkdownToPlainText` / `clean_markdown_to_plain_text` — link removal, table conversion, bold/italic stripping
- [ ] `extractSections` / `extract_sections` — heading parsing and body extraction (note: different return types: objects vs tuples)
- [ ] `auditFile` / `audit_file` — all 5 scoring dimensions, HTML path, output formatting (text + JSON)
- [ ] `checkRobots` / `check_robots` — agent list, blocking detection
- [ ] `generateSchemaData` / `generate_schema_data` — schema generation for article, faq, product types; FAQ filters
- [ ] `injectSchema` / `inject_schema` — signature injection, schema replacement, HTML vs markdown path, path validation, dry-run mode
- [ ] Licensing and branding — Pro-key resolution and `--no-branding` behavior

### Known differences (intentional)

- **Return types**: JS `extractSections` returns `[{header, body}]`; Python returns `[(header, body)]`. Both are valid for their language idioms.
- **CLI parsing**: JS uses manual `process.argv`; Python uses `argparse`. This is acceptable — the CLI layer is not duplicated logic.
- **Config fallback**: JS searches `.agents/skills/geo-optimization/` as a secondary fallback; Python searches relative to the script directory. This reflects their different deployment contexts.

## Migration path (future)

If maintaining both implementations becomes unsustainable, the recommended migration is:

1. Make the Python version a thin wrapper that shells out to the JS CLI: `subprocess.run(['node', 'bin/cli.js', ...])`.
2. Or: extract scoring rules into a shared JSON/YAML config file that both implementations load, reducing logic duplication to I/O and formatting.
