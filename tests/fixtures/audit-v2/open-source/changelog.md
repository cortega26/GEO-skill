# Changelog

All notable changes to this project are documented in this file.

## [2.1.0] — 2026-06-15

### Added

- `--model v2` flag for profile-aware audit model (experimental).
- Versioned finding contract (`Finding` type) with evidence labels.
- Evidence registry with `strong`, `probable`, `experimental`, and `heuristic`
  levels.

### Changed

- Crawler registry now distinguishes `search` and `training` purposes.
- HTML semantic audit uses cheerio instead of regex selectors.

### Fixed

- Dotfile directories (`.git`, `.DS_Store`) are no longer scanned during
  recursive walks.
- Symlinks are detected and skipped instead of being followed.

## [2.0.0] — 2026-03-01

### Breaking

- `auditFile` now returns an object with `score` and `report` instead of
  printing directly. Use `--format text` for the old behavior.
- Configuration file renamed from `.georc` to `geo_config.json`.

### Added

- `auditFiles()` batch function for multi-file analysis.
- `aggregateReport()` summary generator.
- TypeScript type declarations (`index.d.ts`).

## [1.2.1] — 2025-12-10

### Fixed

- Memory leak in `discoverFiles` when scanning more than 1000 files.
- Incorrect pronoun density calculation for files under 100 words.

## [1.2.0] — 2025-11-20

### Added

- `--recursive` flag for directory scanning.
- `--ignore` option for path exclusion patterns.

### Changed

- Scoring weight for statistics reduced from 25 to 20 points.
- `llms.txt` generation now prefers curated entries over auto-detected ones.

## [1.1.0] — 2025-09-05

### Added

- `llms.txt` and `llms-full.txt` generator.
- `robots.txt` AI crawler audit.
- Python skill package for AI-assisted GEO optimization.

## [1.0.0] — 2025-07-01

Initial public release.
