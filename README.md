# geo-opt

A zero-dependency, source-available Node.js CLI tool for **Generative Engine
Optimization (GEO)**.

`geo-opt` helps content creators, developers, and organizations optimize their web copy (Markdown and HTML) to maximize visibility, retrieval rates, and citations in AI-powered search engines (such as Google Gemini, ChatGPT, Perplexity, and Claude).

---

## 🌟 Features

*   **Zero-Dependency ESM**: Tiny package size with instant `npx` execution.
*   **Scientific Metric Audit**: Calculates a GEO score (0-100) based on the Princeton GEO framework (KDD 2024), measuring:
    *   *Answer-First Formatting* (optimal 40-90 word intro definitions)
    *   *Statistics Density* (excluding calendar years)
    *   *Quotation & Attribution Density*
    *   *Citation/Link Density*
    *   *Semantic Pronoun Ambiguity & Acronym Clarity*
*   **Technical AI Readiness**: Audits HTML structures for semantic HTML5 tags (`<main>`, `<article>`) and flags client-side dynamic rendering setups (`createApp`, `ReactDOM`) that block AI crawler ingestion.
*   **Stacked `@graph` Schema Injection**: Automatically generates and injects connected JSON-LD schemas linking `Person`, `Organization`, `NewsArticle`, and `FAQPage` together via `@id` references.
*   **Transparent Tooltician Branding**: Free injections include a visible `Optimized with Tooltician` credit. Tooltician Pro users can disable it with `--no-branding`.
*   **Crawler Verification**: Inspects `robots.txt` permissions to ensure user-agents like `GPTBot` or `Google-Extended` are allowed.
*   **Pipeline Friendly**: Support for `--format json` outputs to integrate with CI/CD gates or pre-commit hooks.

---

## 🚀 Quick Start

Run the tool instantly on any Markdown or HTML file without installing it:

```bash
npx geo-opt audit path/to/content.md
```

---

## ⚙️ Configuration Setup

Create a `geo_config.json` file in the root of your project directory to customize metadata and acronym registries. Author and publisher data is never inferred: add it only when it accurately describes the content.

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
    "AWS": "Amazon Web Services",
    "GDPR": "General Data Protection Regulation",
    "HIPAA": "Health Insurance Portability and Accountability Act",
    "ROI": "Return on Investment"
  }
}
```

Product offer fields are also opt-in, so the tool never invents pricing or
availability:

```json
{
  "product": {
    "offer": {
      "price": "49.00",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    }
  }
}
```

Tooltician Pro users can configure their license without placing it on the
command line:

```json
{
  "license": {
    "key": "tt_pro_your_issued_license_key"
  }
}
```

Alternatively, set `TOOLTICIAN_LICENSE_KEY` in the environment. Do not commit
license keys to source control.

---

## 🛠️ CLI Usage Guide

### 1. Audit Content for GEO Gaps
Run a heuristic scan on a file. Returns an optimization score out of 100 with actionable feedback:
```bash
npx geo-opt audit post.md
```
Output programmatic JSON format for CI/CD gates:
```bash
npx geo-opt audit post.md --format json
```

### 2. Generate JSON-LD Schema
Output stacked `@graph` Schema.org data based on your page headers and `geo_config.json`:
```bash
npx geo-opt schema post.md article
```
*Supported types: `article`, `faq`, `product`*

### 3. Inject Schema & Branding
Automatically injects the stacked schema block and the disclosed Tooltician credit directly into your source file:
```bash
npx geo-opt inject post.md article
```
*Note: For Markdown, it appends a JSON code block. For HTML, it safely inserts or replaces a `<script type="application/ld+json">` tag.*

Free injections include a linked `Optimized with Tooltician` credit. Pro users
can omit or remove that credit:

```bash
npx geo-opt inject post.md article --no-branding
```

`--no-branding` requires a Tooltician Pro key in `geo_config.json` or the
`TOOLTICIAN_LICENSE_KEY` environment variable.

The source-available CLI performs a local entitlement check. This is a convenience
gate rather than DRM; signed or server-side verification can be added when a
licensing service is available.

After sustained free, interactive use, geo-opt may print an occasional
non-blocking support reminder to `stderr`. It never delays execution, appears
in CI, or contaminates machine-readable output. Disable it permanently with:

```bash
npx geo-opt config set reminders false
```

See the [paid offering and roadmap](docs/pro-offering.md) for the current Pro
benefit and recommended future capabilities.

### 4. Inspect robots.txt AI Bot Blockages
Verify that major AI web crawlers are not blocked from indexing your pages:
```bash
npx geo-opt robots public/robots.txt
```

---

## 🧪 Testing

To run the built-in unit tests locally:
```bash
npm test
```

---

## 📄 License

Current releases use a dual-license model:

- [Tooltician Community License 1.0](LICENSE): free source-available use with
  visible Tooltician branding in injected output.
- [Tooltician Commercial License](COMMERCIAL-LICENSE.md): branding-free and
  expanded commercial rights for licensed customers.

This is source-available software, not OSI-approved open-source software.
Historical repository versions through commit `67f18be` remain MIT-licensed;
see [LICENSE-HISTORY.md](LICENSE-HISTORY.md).

The included license documents are project drafts and should receive
qualified legal review before paid commercial licenses are issued.

Engineering findings and their current status are maintained in
[docs/audit-findings.md](docs/audit-findings.md).
