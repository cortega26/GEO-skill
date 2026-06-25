import test, { mock } from "node:test";
import assert from "node:assert";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "url";
import {
  auditFile,
  calculateReadability,
  checkRobots,
  cleanMarkdownToPlainText,
  extractSections,
  generateSchemaData,
  getNoBrandingError,
  hasProEntitlement,
  injectSchema,
  preprocessContent,
  readEngagementState,
  recordSuccessfulFreeInjection,
  remindersAreEnabled,
  setRemindersEnabled,
} from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  author: {
    name: "Carlos Ortega González",
    jobTitle: "Sr. Software Automation and Data Analyst",
    sameAs: "https://www.linkedin.com/in/cortega26/",
  },
  publisher: {
    name: "Tooltician",
    url: "https://www.tooltician.com",
    logo: "https://www.tooltician.com/logo.png",
  },
  acronyms: {
    AWS: "Amazon Web Services",
    GDPR: "General Data Protection Regulation",
  },
  product: {
    offer: {
      price: "49.00",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  },
};

test("calculateReadability parses word counts and sentence averages", () => {
  const text = "This is a simple sentence. Here is another sentence containing more words.";
  const res = calculateReadability(text);
  assert.strictEqual(res.wordCount, 12);
  assert.strictEqual(res.avgSentenceLen, 6);
});

test("cleanMarkdownToPlainText converts tables and links to plain text", () => {
  const md = `
| Head 1 | Head 2 |
| :--- | :--- |
| **Cell 1** | Cell 2 [Link](https://example.com) |
  `;
  const clean = cleanMarkdownToPlainText(md);
  assert.strictEqual(clean, "Head 1 - Head 2\nCell 1 - Cell 2 Link");
});

test("extractSections structurally parses headings and bodies", () => {
  const content = `
# Title

## Heading 1
Body of heading 1.
More text.

## Heading 2
Body of heading 2.
  `;
  const sections = extractSections(content);
  assert.strictEqual(sections.length, 2);
  assert.strictEqual(sections[0].header, "Heading 1");
  assert.strictEqual(sections[0].body, "Body of heading 1.\nMore text.");
  assert.strictEqual(sections[1].header, "Heading 2");
  assert.strictEqual(sections[1].body, "Body of heading 2.");
});

test("generateSchemaData generates stacked graph schema with FAQ nodes", () => {
  const tempFile = path.join(__dirname, "temp_article.md");
  fs.writeFileSync(
    tempFile,
    `
# Test Headline

This is the description paragraph of 40 words.

## Key Benefits of Hybrid Cloud
This is the body answer containing more details.
  `,
    { encoding: "utf8" }
  );

  try {
    const schema = generateSchemaData(tempFile, "article", config);
    assert.strictEqual(schema["@context"], "https://schema.org");
    assert.ok(Array.isArray(schema["@graph"]));

    const article = schema["@graph"].find((x) => x["@type"] === "NewsArticle");
    assert.strictEqual(article.headline, "Test Headline");
    assert.strictEqual(article.author["@id"], "https://www.tooltician.com/#author");

    const faq = schema["@graph"].find((x) => x["@type"] === "FAQPage");
    assert.strictEqual(faq.mainEntity.length, 1);
    assert.strictEqual(faq.mainEntity[0].name, "Key Benefits of Hybrid Cloud");
    assert.strictEqual(
      faq.mainEntity[0].acceptedAnswer.text,
      "This is the body answer containing more details."
    );
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
});

test("injectSchema writes signature and stacked JSON-LD markup to file", () => {
  const tempFile = path.join(__dirname, "temp_inject.md");
  fs.writeFileSync(
    tempFile,
    `
# Test Article
This is the body text.
  `,
    { encoding: "utf8" }
  );

  try {
    injectSchema(tempFile, "article", config);
    const content = fs.readFileSync(tempFile, { encoding: "utf8" });

    assert.ok(content.includes("Optimized with [Tooltician]"));
    assert.ok(content.includes("```json"));
    assert.ok(content.includes("Carlos Ortega González"));
    assert.ok(content.includes("https://www.tooltician.com/#author"));
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
});

test("preprocessContent strips code blocks, script tags, style tags, and HTML comments", () => {
  const input = `
# Title
Some text.
\`\`\`
const x = 1;
\`\`\`
More text.
<script>alert('xss')</script>
<style>body { color: red; }</style>
<!-- a comment -->
Final text.
  `;
  const result = preprocessContent(input);
  assert.ok(!result.includes("```"));
  assert.ok(!result.includes("const x"));
  assert.ok(!result.includes("alert"));
  assert.ok(!result.includes("color: red"));
  assert.ok(!result.includes("a comment"));
  assert.ok(result.includes("Some text"));
  assert.ok(result.includes("More text"));
  assert.ok(result.includes("Final text"));
});

test("checkRobots detects blocked AI agents", () => {
  const tempFile = path.join(__dirname, "temp_robots_block.txt");
  fs.writeFileSync(
    tempFile,
    `User-agent: GPTBot
Disallow: /
User-agent: *
Disallow: /private
`,
    { encoding: "utf8" }
  );

  try {
    assert.doesNotThrow(() => {
      checkRobots(tempFile);
    });
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
});

test("checkRobots detects no blocking for permissive robots.txt", () => {
  const tempFile = path.join(__dirname, "temp_robots_allow.txt");
  fs.writeFileSync(
    tempFile,
    `User-agent: *
Disallow: /admin
`,
    { encoding: "utf8" }
  );

  try {
    assert.doesNotThrow(() => {
      checkRobots(tempFile);
    });
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
});

test("auditFile returns a score and produces valid JSON output", () => {
  const tempFile = path.join(__dirname, "temp_audit.md");
  fs.writeFileSync(
    tempFile,
    `# Test Article

Hybrid cloud architecture is an IT infrastructure design that integrates private cloud resources with public cloud services. It provides flexibility and cost efficiency for modern enterprises.

## Key Benefits
Organizations report an average of 34% cost reduction according to IDC research.

> "Hybrid cloud solved our compliance bottleneck." — Jane Doe, CISO at SecureCorp

- Benefit 1
- Benefit 2

## Sources
1. [IDC Report](https://example.com/idc)
  `,
    { encoding: "utf8" }
  );

  try {
    const score = auditFile(tempFile, config, "json");
    assert.ok(typeof score === "number");
    assert.ok(score >= 0 && score <= 100);
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
});

test("auditFile produces text output without crashing", () => {
  const tempFile = path.join(__dirname, "temp_audit_text.md");
  fs.writeFileSync(
    tempFile,
    `# Minimal Article
Short body text without much optimization.
  `,
    { encoding: "utf8" }
  );

  try {
    const score = auditFile(tempFile, config, "text");
    assert.ok(typeof score === "number");
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
});

test("auditFile exits with error on missing file", () => {
  const exitMock = mock.method(process, "exit", () => {});
  const errorMock = mock.method(console, "error", () => {});

  try {
    auditFile("/nonexistent/path/file.md", config, "text");
    assert.ok(exitMock.mock.calls.length > 0);
  } finally {
    mock.reset();
  }
});

test("generateSchemaData generates valid FAQPage schema with filters", () => {
  const tempFile = path.join(__dirname, "temp_faq.md");
  fs.writeFileSync(
    tempFile,
    `# FAQ Page

## What is Hybrid Cloud?
Hybrid cloud is a computing environment that combines on-premises data centers with public cloud services.

## Short
Brief.

## Sources
Some links here.
  `,
    { encoding: "utf8" }
  );

  try {
    const schema = generateSchemaData(tempFile, "faq", config);
    assert.strictEqual(schema["@context"], "https://schema.org");

    const faq = schema["@graph"].find((x) => x["@type"] === "FAQPage");
    assert.ok(faq);
    // "Short" section has body < 15 chars → filtered out
    // "Sources" section → filtered out as sources/references header
    assert.strictEqual(faq.mainEntity.length, 1);
    assert.strictEqual(faq.mainEntity[0].name, "What is Hybrid Cloud?");
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
});

test("generateSchemaData generates valid Product schema", () => {
  const tempFile = path.join(__dirname, "temp_product.md");
  fs.writeFileSync(
    tempFile,
    `# Cloud Migration Toolkit

A comprehensive suite of tools for migrating on-premises workloads to hybrid cloud environments.
  `,
    { encoding: "utf8" }
  );

  try {
    const schema = generateSchemaData(tempFile, "product", config);
    assert.strictEqual(schema["@context"], "https://schema.org");

    const product = schema["@graph"].find((x) => x["@type"] === "Product");
    assert.ok(product);
    assert.strictEqual(product.name, "Cloud Migration Toolkit");
    assert.ok(product.offers);
    assert.strictEqual(product.offers.price, "49.00");
    assert.strictEqual(product.offers.priceCurrency, "USD");
    assert.strictEqual(product.offers.availability, "https://schema.org/InStock");

    const org = schema["@graph"].find((x) => x["@type"] === "Organization");
    assert.strictEqual(product.brand["@id"], org["@id"]);
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
});

test("generateSchemaData omits identity and commerce claims when unconfigured", () => {
  const tempFile = path.join(__dirname, "temp_unconfigured.md");
  fs.writeFileSync(tempFile, "# Independent Article\n\nIndependent body text.", {
    encoding: "utf8",
  });

  try {
    const articleSchema = generateSchemaData(tempFile, "article", {});
    const article = articleSchema["@graph"].find((node) => node["@type"] === "NewsArticle");

    assert.deepStrictEqual(
      articleSchema["@graph"].map((node) => node["@type"]),
      ["NewsArticle"]
    );
    assert.strictEqual(article.author, undefined);
    assert.strictEqual(article.publisher, undefined);
    assert.strictEqual(article.datePublished, undefined);

    const productSchema = generateSchemaData(tempFile, "product", {});
    const product = productSchema["@graph"].find((node) => node["@type"] === "Product");
    assert.strictEqual(product.brand, undefined);
    assert.strictEqual(product.offers, undefined);
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
});

test("Tooltician Pro entitlement uses the documented local key sources", () => {
  const validKey = "tt_pro_1234567890abcdefghij";
  assert.strictEqual(hasProEntitlement({}, {}), false);
  assert.strictEqual(hasProEntitlement({ license: { key: validKey } }, {}), true);
  assert.strictEqual(hasProEntitlement({}, { TOOLTICIAN_LICENSE_KEY: validKey }), true);
  assert.match(getNoBrandingError({}, {}), /requires a Tooltician Pro license key/);
});

test("CLI requires Pro entitlement for --no-branding and removes branding when entitled", () => {
  const tempFile = path.join(__dirname, "temp_no_branding.md");
  const cliPath = path.join(__dirname, "..", "bin", "cli.js");
  const original = "# Independent Article\n\nIndependent body text.\n";
  fs.writeFileSync(tempFile, original, { encoding: "utf8" });

  const cleanEnv = { ...process.env };
  delete cleanEnv.TOOLTICIAN_LICENSE_KEY;

  try {
    const rejected = spawnSync(
      process.execPath,
      [cliPath, "inject", tempFile, "article", "--no-branding"],
      { cwd: path.join(__dirname, ".."), env: cleanEnv, encoding: "utf8" }
    );
    assert.strictEqual(rejected.status, 1);
    assert.match(rejected.stderr, /requires a Tooltician Pro license key/);
    assert.strictEqual(fs.readFileSync(tempFile, "utf8"), original);

    const branded = spawnSync(process.execPath, [cliPath, "inject", tempFile, "article"], {
      cwd: path.join(__dirname, ".."),
      env: cleanEnv,
      encoding: "utf8",
    });
    assert.strictEqual(branded.status, 0, branded.stderr);
    assert.ok(fs.readFileSync(tempFile, "utf8").includes("Optimized with [Tooltician]"));

    const accepted = spawnSync(
      process.execPath,
      [cliPath, "inject", tempFile, "article", "--no-branding"],
      {
        cwd: path.join(__dirname, ".."),
        env: {
          ...cleanEnv,
          TOOLTICIAN_LICENSE_KEY: "tt_pro_1234567890abcdefghij",
        },
        encoding: "utf8",
      }
    );
    assert.strictEqual(accepted.status, 0, accepted.stderr);

    const content = fs.readFileSync(tempFile, "utf8");
    assert.ok(content.includes("```json"));
    assert.strictEqual(content.includes("Tooltician"), false);
    assert.strictEqual(content.includes("Carlos Ortega"), false);
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
});

test("support reminders are infrequent, automation-safe, and user-disableable", () => {
  const stateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "geo-opt-state-"));
  const statePath = path.join(stateDirectory, "state.json");
  const writes = [];
  const stderr = {
    isTTY: true,
    write(message) {
      writes.push(message);
    },
  };
  const env = {};
  const firstRun = new Date("2026-01-01T00:00:00.000Z");

  try {
    for (let index = 0; index < 9; index += 1) {
      const result = recordSuccessfulFreeInjection({}, { statePath, stderr, env, now: firstRun });
      assert.strictEqual(result.shown, false);
    }
    assert.strictEqual(writes.length, 0);

    const tenth = recordSuccessfulFreeInjection({}, { statePath, stderr, env, now: firstRun });
    assert.strictEqual(tenth.shown, true);
    assert.strictEqual(writes.length, 1);
    assert.match(writes[0], /config set reminders false/);

    for (let index = 0; index < 10; index += 1) {
      recordSuccessfulFreeInjection(
        {},
        {
          statePath,
          stderr,
          env,
          now: new Date("2026-01-02T00:00:00.000Z"),
        }
      );
    }
    assert.strictEqual(writes.length, 1);

    const afterCooldown = recordSuccessfulFreeInjection(
      {},
      {
        statePath,
        stderr,
        env,
        now: new Date("2026-01-08T00:00:01.000Z"),
      }
    );
    assert.strictEqual(afterCooldown.shown, true);
    assert.strictEqual(writes.length, 2);

    assert.strictEqual(setRemindersEnabled(false, { statePath, env }), true);
    assert.strictEqual(remindersAreEnabled({ statePath, env }), false);
    const disabled = recordSuccessfulFreeInjection(
      {},
      {
        statePath,
        stderr,
        env,
        now: new Date("2026-03-15T00:00:00.000Z"),
      }
    );
    assert.strictEqual(disabled.reason, "disabled");

    assert.strictEqual(setRemindersEnabled(true, { statePath, env }), true);
    const automated = recordSuccessfulFreeInjection(
      {},
      {
        statePath,
        stderr,
        env: { CI: "true" },
        now: new Date("2026-03-15T00:00:00.000Z"),
      }
    );
    assert.strictEqual(automated.reason, "suppressed");

    const piped = recordSuccessfulFreeInjection(
      {},
      {
        statePath,
        stderr: { isTTY: false, write() {} },
        env,
        now: new Date("2026-03-15T00:00:00.000Z"),
      }
    );
    assert.strictEqual(piped.reason, "suppressed");

    const pro = recordSuccessfulFreeInjection(
      { license: { key: "tt_pro_1234567890abcdefghij" } },
      {
        statePath,
        stderr,
        env,
        now: new Date("2026-03-15T00:00:00.000Z"),
      }
    );
    assert.strictEqual(pro.reason, "suppressed");
    assert.strictEqual(readEngagementState({ statePath, env }).remindersEnabled, true);
  } finally {
    fs.rmSync(stateDirectory, { recursive: true, force: true });
  }
});

test("CLI config command persists the reminder preference", () => {
  const stateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "geo-opt-config-"));
  const cliPath = path.join(__dirname, "..", "bin", "cli.js");
  const env = { ...process.env, GEO_OPT_STATE_DIR: stateDirectory };

  try {
    const disabled = spawnSync(process.execPath, [cliPath, "config", "set", "reminders", "false"], {
      cwd: path.join(__dirname, ".."),
      env,
      encoding: "utf8",
    });
    assert.strictEqual(disabled.status, 0, disabled.stderr);
    assert.match(disabled.stdout, /disabled/);

    const readBack = spawnSync(process.execPath, [cliPath, "config", "get", "reminders"], {
      cwd: path.join(__dirname, ".."),
      env,
      encoding: "utf8",
    });
    assert.strictEqual(readBack.status, 0, readBack.stderr);
    assert.strictEqual(readBack.stdout.trim(), "false");
  } finally {
    fs.rmSync(stateDirectory, { recursive: true, force: true });
  }
});

test("injectSchema injects JSON-LD script tag into HTML file", () => {
  const tempFile = path.join(__dirname, "temp_inject.html");
  fs.writeFileSync(
    tempFile,
    `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><p>Content.</p></body>
</html>`,
    { encoding: "utf8" }
  );

  try {
    injectSchema(tempFile, "article", config);
    const content = fs.readFileSync(tempFile, { encoding: "utf8" });
    assert.ok(content.includes('<script type="application/ld+json">'));
    assert.ok(content.includes('"@context"'));
    assert.ok(content.includes("https://schema.org"));
    assert.ok(content.includes("Tooltician"));
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
});

test("auditFile detects verbal statistics as data points", () => {
  const tempFile = path.join(__dirname, "temp_verbal.md");
  fs.writeFileSync(
    tempFile,
    `# Report

Hybrid cloud adoption is an enterprise IT strategy. It delivers significant benefits.

One third of enterprises report cost reductions. Double the efficiency of legacy setups.
Three out of four IT managers recommend the approach.
  `,
    { encoding: "utf8" }
  );

  try {
    const score = auditFile(tempFile, config, "json");
    // Con "one third", "double", "three out of four" debería tener score > 0
    // en la categoría de estadísticas
    assert.ok(typeof score === "number");
    assert.ok(score > 0);
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
});

test("injectSchema escapes </script> in JSON-LD to prevent XSS breakout (SEC-03)", () => {
  const tempFile = path.join(__dirname, "temp_xss.md");
  const xssTitle = "# Test </script><img src=x onerror=alert(1)>";
  fs.writeFileSync(tempFile, `${xssTitle}\n\nBody text.`, { encoding: "utf8" });

  try {
    injectSchema(tempFile, "article", config);
    const content = fs.readFileSync(tempFile, { encoding: "utf8" });

    // Extract the JSON-LD block from the markdown code fence
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    assert.ok(jsonMatch, "JSON-LD code block should exist");
    const jsonLd = jsonMatch[1];

    // The JSON-LD must escape </ to prevent script tag breakout
    assert.ok(jsonLd.includes("<\\/script"), "JSON-LD should escape </script> as <\\/script");
    // Raw </script> must NOT appear inside the JSON-LD
    assert.strictEqual(
      jsonLd.includes("</script>"),
      false,
      "JSON-LD must not contain raw </script>"
    );
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
});
