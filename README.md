# geo-opt

`geo-opt` is a source-available Node.js command-line interface (CLI) and
JavaScript library for repeatable technical AI discoverability checks. It
audits Markdown and HTML content for structure, evidence, citations, and
clarity; generates and validates JSON-LD; reviews crawler controls; and
supports batch and continuous integration workflows. Processing is local by
default, with no telemetry or silent content uploads.

The audit score is a project heuristic characterized against a 32-fixture
regression corpus. It is not statistically calibrated and is not a prediction
or guarantee of ranking, retrieval, inclusion, mention, or citation by any
search or artificial intelligence (AI) system. See `docs/architecture.md` for
characterization limitations and known blind spots.

## Why teams use geo-opt

| Capability                                    | Practical outcome                                                                                   |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Single-file and recursive audits              | Apply the same review criteria across one page or an entire content tree                            |
| Text and JSON output                          | Review findings interactively or consume machine-readable results in automation                     |
| Thresholds and aggregate summaries            | Enforce a project baseline and identify the weakest pages first                                     |
| JSON-LD generation, injection, and validation | Create reviewable structured data without inventing author, publisher, date, price, or availability |
| `robots.txt` audit and generation             | Make crawler policy explicit and detect blocking rules before publication                           |
| `llms.txt` generation and audit               | Produce and check files that follow the current community proposal                                  |
| Dry runs, backups, and path confinement       | Preview content changes and reduce accidental writes outside the working tree                       |
| Node.js and Python implementations            | Use the canonical Node runtime or the capability-scoped Python compatibility port                   |

`geo-opt` is designed for evidence-backed remediation: it reports observable
content and delivery signals, then leaves editorial and publication decisions
with the operator.

## Project status

The public npm package has not been released. Use the repository checkout for
the current implementation. Supported runtimes are **Node.js 22 LTS** and
**Node.js 24 LTS**. Node.js 20 reached
[end of life](https://nodejs.org/en/about/previous-releases) on 2026-03-24
and is no longer a supported target.

```bash
git clone https://github.com/cortega26/GEO-skill.git
cd GEO-skill
npm install
node bin/cli.js audit path/to/content.md

# Use the profile-aware v2 model (experimental)
node bin/cli.js audit path/to/content.md --model v2
```

Run `node bin/cli.js --help` or append `--help` to any command to inspect the
current interface.

### Runtime capability status

Node.js is the canonical CLI/library implementation. The bundled Python script
supports the legacy v1 audit plus selected schema, robots, `llms.txt`, batch,
configuration and injection workflows. Python does not currently implement v2,
content profiles, the technical HTML audit or the typed JavaScript API.

The normative capability matrix is in
[`docs/architecture.md`](docs/architecture.md). Do not assume that similarly
named Node and Python functions imply full parity.

## Core workflows

### Audit content

Audit one file:

```bash
node bin/cli.js audit content/article.md
```

Audit a content tree, return one machine-readable JSON document, and include a
site-level summary:

```bash
node bin/cli.js audit content/ \
  --recursive \
  --summary \
  --format json
```

Fail automation when any audited page scores below a chosen project baseline:

```bash
node bin/cli.js audit content/ --recursive --threshold 60
```

The score covers five heuristic dimensions, each labeled with the strength of
evidence behind it (see [Evidence vocabulary](#evidence-vocabulary) below):

1. answer-first structure and document organization `[experimental]`;
2. numerical evidence density `[project heuristic]`;
3. quotation and attribution density `[experimental]`;
4. citation and link density `[probable]`;
5. semantic clarity, including ambiguous pronouns and unexplained acronyms
   `[project heuristic]`.

The scoring model is inspired by the
[GEO research paper accepted at KDD 2024](https://arxiv.org/abs/2311.09735),
but `geo-opt` does not reproduce the paper's benchmark or establish causal
effects on live AI products.

### Evidence vocabulary

Every heuristic and recommendation in this project carries an evidence label.
The label describes the quality of research support behind it, **not** a
guaranteed outcome in any AI search or retrieval product.

| Label                 | Meaning                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Strong**            | Supported by multiple independent, reproducible studies and official platform documentation.                                             |
| **Probable**          | Supported by at least one controlled study or consistent platform guidance, but not yet replicated independently across engines.         |
| **Experimental**      | Supported by a single controlled benchmark under specific conditions; results may not transfer to live engines or different domains.     |
| **Project heuristic** | A reasonable practice derived from the project's own observations. No external study confirms a causal effect on AI search or retrieval. |

### Generate and review structured data

Structured data helps search engines understand page entities and powers
supported Search features (articles, products, breadcrumbs). It is not a
special GEO ranking mechanism. Google explicitly states there is no special
schema for AI optimization.

Generate Schema.org JSON-LD without changing the source file:

```bash
node bin/cli.js schema content/article.md article
```

Supported schema modes are `article`, `faq`, and `product`. Identity,
publication date, price, currency, and availability are emitted only when
explicitly configured.

Preview an injection, then apply it with a backup:

```bash
node bin/cli.js inject content/article.md article --dry-run
node bin/cli.js inject content/article.md article --backup
```

Inspect JSON-LD already embedded in Markdown or HTML:

```bash
node bin/cli.js validate content/article.md
```

Validation checks JSON syntax, Schema.org context, node types, and the fields
required by geo-opt's supported shapes. It is a local structural check, not a
substitute for provider-specific rich-result testing.

### Review crawler policy

Audit an existing file:

```bash
node bin/cli.js robots audit public/robots.txt
node bin/cli.js robots audit public/robots.txt --format json
```

Preview the default `search-visible` policy, which allows documented search
crawlers, blocks documented training/control tokens, and keeps sensitive paths
disallowed in every broadly allowed group:

```bash
node bin/cli.js robots generate \
  --disallow /admin /api /private \
  --sitemap https://example.com/sitemap.xml \
  --dry-run
```

Use `--preset open` only when the site owner explicitly wants every registry
entry broadly allowed. Both presets preserve supplied `--disallow` paths in
specific groups so that those groups do not bypass the wildcard policy.

Crawler tokens do not all serve the same purpose. For example,
[OpenAI separates search and training controls](https://developers.openai.com/api/docs/bots),
[Google-Extended is a control token rather than a distinct HTTP user agent](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers#google-extended),
and Anthropic documents separate
[training, search, and user-directed agents](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler).
Review generated rules against the site's actual publishing, training, privacy,
and security policy before deployment. `robots.txt` communicates crawler
preferences; it is not authentication, an access control, or a guarantee of
indexing, retrieval, or citation.

### Generate or audit `llms.txt`

Generate a concise site map and optionally a full-content companion file:

```bash
node bin/cli.js llmstxt generate content/ \
  --recursive \
  --site-url https://example.com \
  --title "Example Documentation" \
  --full
```

Audit structure and compare coverage with local content:

```bash
node bin/cli.js llmstxt audit llms.txt --recursive
```

`llms.txt` is an
[open community proposal](https://llmstxt.org/), not a formal web standard and
not a guaranteed discovery or ranking mechanism. It complements rather than
replaces accessible HTML, `robots.txt`, sitemaps, and structured data.

## Command reference

| Command                       | Purpose                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `audit [files...]`            | Score files or directories; supports recursion, ignore patterns, JSON, summaries, and thresholds |
| `schema <file> <type>`        | Print generated JSON-LD                                                                          |
| `inject <file> <type>`        | Inject JSON-LD; supports dry run, backup, recursion, and Pro branding control                    |
| `validate <file>`             | Inspect JSON-LD blocks already present in Markdown or HTML                                       |
| `robots audit <file>`         | Evaluate effective known-crawler policy; supports text and JSON output                           |
| `robots generate`             | Create a purpose-aware `robots.txt` draft with `search-visible` or `open` preset                 |
| `llmstxt generate [files...]` | Create `llms.txt` and optional `llms-full.txt`                                                   |
| `llmstxt audit <file>`        | Check proposal structure and optional local coverage                                             |
| `config get\|set reminders`   | Read or change the local support-reminder preference                                             |
| `config get\|set telemetry`   | Read or change the local, opt-in telemetry preference (dormant; see below)                       |
| `init`                        | Create a starter `geo_config.json`                                                               |

## Configuration

Create a starter file:

```bash
node bin/cli.js init
```

Then add only metadata that is accurate for the content:

```json
{
  "author": {
    "name": "Content Author",
    "jobTitle": "Author Role",
    "sameAs": "https://example.com/author"
  },
  "publisher": {
    "name": "Content Publisher",
    "url": "https://example.com",
    "logo": "https://example.com/logo.png"
  },
  "acronyms": {
    "GEO": "Generative Engine Optimization",
    "RAG": "Retrieval-Augmented Generation"
  },
  "product": {
    "offer": {
      "price": "49.00",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    }
  }
}
```

Use `--config path/to/geo_config.json` to select a non-default file. Never add
metadata merely to increase a score, and never commit license keys.

## Local-first behavior

- Audits, schema generation, validation, and configuration run locally.
- The CLI does not send content or analytics to Tooltician.
- Machine-readable output is written to `stdout`; diagnostics and eligible
  reminders use `stderr`.
- Community support reminders are local, infrequent, non-blocking, suppressed
  in automation, and permanently disableable:

```bash
node bin/cli.js config set reminders false
```

- Telemetry is **off by default and currently dormant**: there is no consent
  prompt and no network activity. The opt-in consent gate and a frozen,
  content-free event schema are documented in
  [`docs/telemetry.md`](docs/telemetry.md). Nothing is ever sent without
  explicit opt-in, and `DO_NOT_TRACK` is honored.

## Free vs. Pro

`geo-opt` Free cubre la auditoría y validación de páginas individuales. `geo-opt`
Pro desbloquea operaciones de escritura, procesamiento por lote, quality gates de
CI/CD y salida sin marca.

**Si puedes leerlo, es Free. Si lo escribes o lo escalas, es Pro.**

La tabla comparativa completa —comandos CLI, API de librería y ejemplos— está en
[`docs/free-vs-pro.md`](docs/free-vs-pro.md).

La salida inyectada con la edición gratuita incluye la atribución
`Optimized with Tooltician`. Una clave de licencia Tooltician comercial válida
permite omitirla con `--no-branding` y otorga los derechos detallados en los
términos comerciales aplicables. La verificación de titularidad es local y no
envía contenido ni datos a Tooltician.

Las licencias comerciales todavía no están disponibles para compra general. Los
términos comerciales están redactados y pendientes de revisión legal cualificada.
Para más detalles consulta [`docs/commercial-licensing.md`](docs/commercial-licensing.md).

## JavaScript library

The package entry point exports the building blocks used by the CLI, including
scoring (v1 and v2), discovery, batch aggregation, schema generation, crawler
inspection, validation, `llms.txt` helpers, technical HTML observations and
local preference management. Every supported runtime export has an accurate
type declaration in [`index.d.ts`](index.d.ts), verified by a consumer fixture
that compiles against the public API surface.

```javascript
import { loadConfig, scoreContent, scoreContentV2 } from "geo-opt";

const { config } = loadConfig();
const { score, report } = scoreContent(markdown, "article.md", config);
```

### Supported import paths

The package `exports` map defines the public API surface:

| Import path        | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `"geo-opt"`        | Public API entry point (all documented exports)      |
| `"geo-opt/package.json"` | Package metadata for tooling                  |

Importing internal modules directly (e.g., `"geo-opt/src/scoring-v2.js"`) is
not supported and is blocked by the exports map. Internal file paths may change
without notice. Use only the root `"geo-opt"` import for library code.

### TypeScript

Type declarations are maintained in [`index.d.ts`](index.d.ts) and checked by
a dedicated consumer compilation test. Run `npm run typecheck` to verify the
declarations against a realistic consumer fixture.

**Maintenance rule:** any future root export must update the declaration and
consumer fixture in the same change.

## Development and verification

| Check              | Command                     |
| ------------------ | --------------------------- |
| Full project check | `npm run check`             |
| JavaScript tests   | `npm test`                  |
| Python port tests  | `npm run test:python`       |
| Type check         | `npm run typecheck`         |
| Lint               | `npm run lint`              |
| Format check       | `npm run format:check`      |
| Package preview    | `npm pack --dry-run --json` |

The [architecture and contract guide](docs/architecture.md) explains module
ownership and the capability-scoped relationship between the Node.js and Python
implementations.

Documentation sources of truth, invariants and update triggers are defined in
the [documentation governance model](docs/documentation-governance.md).
Maintainers use the local `plans/README.md` as the canonical execution index;
dated audits and archived plans are evidence rather than current instructions.

Report reproducible defects through
[GitHub Issues](https://github.com/cortega26/GEO-skill/issues).

## License

Current source releases use a dual-license model:

- [Tooltician Community License 1.0](LICENSE) permits source-available use with
  the branding and redistribution conditions stated in the license.
- [Tooltician Commercial License](COMMERCIAL-LICENSE.md) covers issued
  commercial entitlements and additional rights.

The project is source-available, not Open Source Initiative (OSI) approved.
Historical versions through commit `67f18be` remain available under the
[MIT license that accompanied those versions](LICENSE-HISTORY.md).

## Sources and specifications

- [GEO: Generative Engine Optimization](https://arxiv.org/abs/2311.09735),
  accepted at KDD 2024.
- [Google AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
  (official guidance on AI and Search).
- [Schema.org vocabulary](https://schema.org/).
- [`llms.txt` community proposal](https://llmstxt.org/).
- [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots).
- [Google crawler documentation](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers).
- [Anthropic crawler documentation](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler).
- [Perplexity crawler documentation](https://docs.perplexity.ai/docs/resources/perplexity-crawlers).
- [What Gets Cited: Measuring the Impact of GEO on LLM
  Citations](https://arxiv.org/abs/2605.25517).
