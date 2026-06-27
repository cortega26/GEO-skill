import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validateSchemaFile } from "../src/validate.js";

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "geo-validate-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// Intercepta process.exit para que no termine el proceso de test.
// validateSchemaFile llama process.exit en errores de I/O; plan 030 los aislará.
function captureExit(fn) {
  const captured = { code: undefined, called: false };
  const origExit = process.exit;
  process.exit = (code) => {
    captured.code = code;
    captured.called = true;
    throw new Error(`process.exit(${code})`);
  };
  try {
    fn();
  } catch (e) {
    if (!e.message.startsWith("process.exit")) throw e;
  } finally {
    process.exit = origExit;
  }
  return captured;
}

// Captura todo lo escrito a console.log / console.error durante fn().
function captureConsole(fn) {
  const logs = [];
  const errors = [];
  const origLog = console.log;
  const origError = console.error;
  console.log = (...args) => logs.push(args.join(" "));
  console.error = (...args) => errors.push(args.join(" "));
  try {
    fn();
  } finally {
    console.log = origLog;
    console.error = origError;
  }
  return { logs, errors };
}

describe("validateSchemaFile — comportamiento de validación JSON-LD", () => {
  it("sale con código 1 y mensaje de error cuando el archivo no existe", () => {
    let exitResult;
    const { errors } = captureConsole(() => {
      exitResult = captureExit(() => {
        validateSchemaFile(join(dir, "does-not-exist.md"));
      });
    });
    assert.ok(exitResult.called, "process.exit debería haberse llamado");
    assert.equal(exitResult.code, 1);
    const errorOutput = errors.join(" ");
    assert.ok(
      errorOutput.includes("not found"),
      `stderr debería indicar archivo no encontrado, obtuvo: ${errorOutput}`
    );
  });

  it("informa que no hay bloques cuando el archivo no contiene JSON-LD", () => {
    const file = join(dir, "no-jsonld.md");
    writeFileSync(file, "# Página sin schema\n\nTexto normal sin bloques JSON-LD.\n");

    const { logs } = captureConsole(() => {
      validateSchemaFile(file);
    });
    const output = logs.join("\n");
    assert.ok(
      output.includes("No JSON-LD blocks found"),
      `Debería indicar que no hay bloques JSON-LD, obtuvo: ${output}`
    );
  });

  it("reporta JSON-LD válido con los campos requeridos presentes", () => {
    const schema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Acme Corp",
    });
    const file = join(dir, "valid.md");
    writeFileSync(file, "```json\n" + schema + "\n```\n");

    const { logs } = captureConsole(() => {
      validateSchemaFile(file);
    });
    const output = logs.join("\n");
    assert.ok(output.includes("✅"), `Debería mostrar éxito, obtuvo: ${output}`);
    assert.ok(output.includes("Organization"), `Debería mencionar el tipo, obtuvo: ${output}`);
  });

  it("reporta problemas cuando faltan campos requeridos en el tipo conocido", () => {
    const schema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
    });
    const file = join(dir, "missing-fields.md");
    writeFileSync(file, "```json\n" + schema + "\n```\n");

    const { logs } = captureConsole(() => {
      validateSchemaFile(file);
    });
    const output = logs.join("\n");
    assert.ok(
      output.includes("⚠️") || output.includes("Issues"),
      `Debería reportar problemas, obtuvo: ${output}`
    );
    assert.ok(
      output.includes("headline"),
      `Debería mencionar campo faltante 'headline', obtuvo: ${output}`
    );
  });

  it("detecta JSON-LD embebido en script HTML", () => {
    const schema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Juan García",
    });
    const file = join(dir, "html-script.html");
    writeFileSync(
      file,
      `<html><head><script type="application/ld+json">${schema}</script></head></html>`
    );

    const { logs } = captureConsole(() => {
      validateSchemaFile(file);
    });
    const output = logs.join("\n");
    assert.ok(output.includes("1 JSON-LD block"), `Debería encontrar 1 bloque, obtuvo: ${output}`);
    assert.ok(output.includes("✅"), `Debería reportar válido, obtuvo: ${output}`);
  });

  it("reporta el número correcto de bloques cuando hay múltiples", () => {
    const s1 = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "A",
    });
    const s2 = JSON.stringify({ "@context": "https://schema.org", "@type": "Person", name: "B" });
    const file = join(dir, "multi.md");
    writeFileSync(file, "```json\n" + s1 + "\n```\n\n```json\n" + s2 + "\n```\n");

    const { logs } = captureConsole(() => {
      validateSchemaFile(file);
    });
    const output = logs.join("\n");
    assert.ok(output.includes("2 JSON-LD block"), `Debería encontrar 2 bloques, obtuvo: ${output}`);
  });

  it("informa tipo desconocido como nota, no como error bloqueante", () => {
    const schema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
    });
    const file = join(dir, "unknown-type.md");
    writeFileSync(file, "```json\n" + schema + "\n```\n");

    const { logs } = captureConsole(() => {
      validateSchemaFile(file);
    });
    const output = logs.join("\n");
    assert.ok(
      output.includes("Note:") || output.includes("not in the known-types list"),
      `Debería notar tipo desconocido, obtuvo: ${output}`
    );
  });
});
