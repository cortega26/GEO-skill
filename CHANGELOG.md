# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added an enforced changelog policy for code changes, with local verification
  and GitHub Actions coverage.
- Added CLI contract and Python parity coverage for JSON output, robots
  semantics, config failures, HTML schema replacement, and symlink write guards.

### Changed

- Changed `npm run check` to include the Python parity test suite.
- Reframed the GEO score documentation as an uncalibrated heuristic inspired by
  the GEO framework.

### Fixed

- Fixed injection write authorization to resolve symlinks before allowing
  writes or backups outside the working directory.
- Fixed JSON audit mode so batch and thresholded runs emit a single parseable
  JSON object or array on stdout while diagnostics stay on stderr.
- Fixed explicitly supplied malformed config files to fail closed.
- Fixed HTML schema descriptions and replacement of existing JSON-LD script tags
  with quoted or unquoted `type` attributes.
- Fixed robots audits to focus on AI crawlers and wildcard groups while honoring
  root-level `Allow`/`Disallow` precedence.

### Docs

- Added `AGENTS.md` as the canonical AI-agent instruction file and reduced
  `CLAUDE.md` to a compatibility pointer.

## [2.0.0] - 2026-06-25

### Added

- Added source-available Community and Commercial licensing, preserving the
  historical MIT grant through commit `67f18be`.
- Added Tooltician Pro entitlement support and the `--no-branding` option.
- Added neutral `Optimized with Tooltician` branding for Community injections.
- Added local, non-blocking support reminders after sustained interactive use,
  limited to once per week and permanently user-disableable.
- Added `geo-opt config get|set reminders` in both JavaScript and Python.
- Added batch auditing, score thresholds, dry runs, backups, enhanced verbal
  statistic detection, and HTML/Markdown structured-data injection.
- Added maintained engineering findings and paid-offering roadmap documents.

### Changed

- Split the JavaScript implementation into focused domain modules.
- Changed unconfigured schema generation to omit author, publisher,
  publication date, price, availability, and other unsupported claims.
- Restricted npm package contents to runtime, product documentation, and
  licensing files.
- Updated the package version to 2.0.0 for the licensing and behavior changes.

### Security

- Added injection path restrictions, signature sanitization, and JSON-LD
  `</script>` breakout protection.

## [1.0.0] - 2026-06-25

### Added

- Initial zero-dependency GEO audit CLI.
- Markdown and HTML scoring, Schema.org generation, schema injection, and
  robots.txt auditing.
- JavaScript and Python implementations with baseline tests and tooling.

[Unreleased]: https://github.com/cortega26/GEO-skill/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/cortega26/GEO-skill/compare/67f18be...v2.0.0
[1.0.0]: https://github.com/cortega26/GEO-skill/commits/67f18be
