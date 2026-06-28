/**
 * Tests para generación de JSON-LD schema.
 *
 * Cubre:
 * - Título desde filename para archivos sin H1 (consolidación extractPageMetadata)
 * - "Untitled Document" nunca aparece como título
 * - injectSchema return value (plan 050)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { generateSchemaData, injectSchema } from "../src/index.js";

describe("generateSchemaData — title fallback", () => {
  it("usa el filename como título para archivos sin H1", () => {
    const content = "No heading here.\n\nJust body text.";
    const filepath = path.join(process.cwd(), "my-article.md");
    const result = generateSchemaData(filepath, "article", {}, content);
    // Title should come from the filename, not "Untitled Document"
    const node = Array.isArray(result["@graph"]) ? result["@graph"][0] : result;
    const title = node.headline || node.name;
    assert.ok(title === "my-article", `Expected "my-article", got "${title}"`);
  });

  it('nunca retorna "Untitled Document" como título', () => {
    const content = "No heading here.";
    const filepath = path.join(process.cwd(), "page.md");
    const result = generateSchemaData(filepath, "article", {}, content);
    const node = Array.isArray(result["@graph"]) ? result["@graph"][0] : result;
    const title = node.headline || node.name;
    assert.notStrictEqual(title, "Untitled Document");
  });
});

describe("injectSchema return value (plan 050)", () => {
  it("injectSchema returns a result object with replaced and message fields", () => {
    const tmpFile = path.join(process.cwd(), `tmp-injectSchema-test-${Date.now()}.md`);
    fs.writeFileSync(tmpFile, "# Test\n\nContent.\n");
    try {
      const result = injectSchema(tmpFile, "article", {});
      assert.strictEqual(typeof result, "object");
      assert.strictEqual(typeof result.replaced, "boolean");
      assert.strictEqual(typeof result.message, "string");
      assert.ok(result.message.length > 0);
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  it("injectSchema dryRun returns result without writing file", () => {
    const tmpFile = path.join(process.cwd(), `tmp-injectSchema-dry-${Date.now()}.md`);
    fs.writeFileSync(tmpFile, "# Test\n\nContent.\n");
    const before = fs.readFileSync(tmpFile, "utf8");
    try {
      const result = injectSchema(tmpFile, "article", {}, { dryRun: true });
      assert.strictEqual(result.dryRun, true);
      assert.ok(typeof result.preview === "string");
      assert.strictEqual(fs.readFileSync(tmpFile, "utf8"), before, "file must be unchanged");
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });
});
