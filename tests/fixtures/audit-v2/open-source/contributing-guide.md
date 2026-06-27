# Contributing to GeoOpt

Thanks for your interest in contributing. This document describes our workflow
and standards.

## Code of Conduct

We follow the [Contributor Covenant](https://www.contributor-covenant.org/)
Code of Conduct. Report issues to [conduct@geoopt.example.com](mailto:conduct@geoopt.example.com).

## Getting started

1. Fork the repository on GitHub.
2. Clone your fork locally.
3. Install dependencies: `npm ci`
4. Run the test suite: `npm test`
5. Create a branch for your change.

## Development workflow

```bash
# Start the test watcher
npm run test:watch

# Run a full check (lint + test + coverage)
npm run check

# Build
npm run build
```

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/). Every
commit message must follow this format:

```
type(scope): summary

Optional body.

Optional footer.
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

## Pull request checklist

- [ ] Tests pass (`npm test`)
- [ ] New tests added for changed behavior
- [ ] Documentation updated if the public API changed
- [ ] Commit messages follow conventional format
- [ ] PR targets the `main` branch

## Code style

We use Prettier and ESLint. Run `npm run fmt` before committing. The CI job
blocks PRs that fail linting.

Prefer explicit names over abbreviations. Every public function must have a
JSDoc comment describing its parameters, return value, and side effects.

## Testing

- Unit tests use the built-in Node.js test runner.
- Integration tests live in `tests/integration/`.
- Fixture files live under `tests/fixtures/`.
- Coverage must stay at or above 80 %.

## Review process

Two maintainers must approve each PR. We aim for a 48-hour first-response
time. If your PR hasn't been reviewed within a week, ping the
`@geoopt/maintainers` team.

## License

By contributing, you agree that your work will be licensed under the project's
MIT license.
