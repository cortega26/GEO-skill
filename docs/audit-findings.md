# Engineering audit findings

This register preserves the findings from the deep repository audit performed
on June 25, 2026. It describes the current working tree, including changes
made after the original audit.

Status meanings:

- **Resolved**: the audited problem has been addressed and covered by tests or
  package verification.
- **Partial**: meaningful work landed, but part of the original risk remains.
- **Open**: the finding still needs implementation.

## Findings

| # | Finding | Impact | Status | Current position |
|---|---|---:|---|---|
| 1 | Silent Tooltician/Carlos identity attribution for unconfigured users | High | Resolved | Unconfigured schema omits author and publisher claims. Free injected output uses neutral, disclosed Tooltician branding instead. |
| 2 | Lexical path checks allow symlink writes outside the working directory | High | Open | `path.resolve`/`abspath` verifies the link location, not its real target. Resolve and authorize real paths before backup or write operations in both runtimes. |
| 3 | Generated structured data invents publication dates, product prices, availability, and identity placeholders | High | Resolved | These properties are now opt-in and are emitted only when configured. |
| 4 | Batch and thresholded `--format json` output is not one valid JSON document | High | Open | Return a single object or array and keep all diagnostics on `stderr`. Add CLI-level JSON parsing tests. |
| 5 | Invalid schema types and malformed explicit configuration can fail silently | Medium–High | Partial | Unsupported schema types are rejected. A malformed explicitly supplied config still warns and falls back to `{}` instead of failing closed. |
| 6 | HTML metadata extraction and JSON-LD replacement are incomplete | Medium–High | Open | HTML descriptions are not extracted reliably, and existing JSON-LD detection does not cover all valid attribute quoting/order variants. |
| 7 | The robots audit reports unrelated crawlers and does not implement rule precedence | Medium | Open | Limit reporting to known AI crawlers plus wildcard rules, and evaluate applicable `Allow`/`Disallow` precedence. |
| 8 | Public CLI contracts and JS/Python parity lack sufficient automated coverage | High | Partial | Branding, Pro entitlement, reminder, config, and injection flows now have CLI/unit coverage. Broader command contracts, robots assertions, scoring assertions, and automatic Python inclusion in the main check remain. |
| 9 | npm publishes development and unrelated repository content | Medium | Resolved | `package.json#files` now limits the package to runtime code, README, and license documents. Dry-run packaging verifies the allowlist. |
| 10 | The 0–100 score is presented more scientifically than its calibration supports | High | Open | Describe it as a project heuristic, document each weight and threshold, and validate future scoring profiles against public benchmarks before making stronger claims. |
| 11 | Architecture, roadmap, and licensing documentation drift from repository state | Medium | Partial | Canonical architecture and licensing docs were updated. `plans/` remains gitignored while `CLAUDE.md` still treats its index as a durable project artifact. |

## Recommended execution order

1. Fix real-path authorization before any further write-oriented features.
2. Repair JSON output and add command-level contract tests.
3. Make malformed explicit configuration fail closed.
4. Correct HTML schema extraction/replacement and robots semantics.
5. Integrate Python tests into the main verification command.
6. Calibrate and document scoring profiles.
7. Reconcile the roadmap storage convention.

## Verification baseline

The repository currently provides:

- `npm run check` for JavaScript lint, formatting, and tests;
- `python3 .agents/skills/geo-optimization/scripts/test_optimizer.py` for the
  Python port;
- `npm pack --dry-run --json` for package-content verification.

This file should be updated when a finding changes status. New findings should
include reproducible evidence, impact, effort, fix risk, and verification
criteria.
