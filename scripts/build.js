#!/usr/bin/env node
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC_DIR = "src";
const BIN_DIR = "bin";
const DIST_DIR = "dist";
const PLACEHOLDER = "<<<LICENSING_HASH>>>";

// 1. Limpiar y recrear dist/
if (existsSync(DIST_DIR)) {
  rmSync(DIST_DIR, { recursive: true });
}
mkdirSync(join(DIST_DIR, "bin"), { recursive: true });

// 2. Copiar src/ directamente en dist/ (estructura plana idéntica a src/)
cpSync(SRC_DIR, DIST_DIR, { recursive: true });

// 3. Copiar bin/ a dist/bin/ y parchear rutas de importación relativas.
//    bin/cli.js usa "../src/" para desarrollo local; en dist/bin/ los módulos
//    ya están en el nivel padre ("../"), así que ajustamos las rutas.
cpSync(BIN_DIR, join(DIST_DIR, "bin"), { recursive: true });
const distCli = join(DIST_DIR, "bin", "cli.js");
const cliContent = readFileSync(distCli, "utf8");
writeFileSync(
  distCli,
  cliContent.replace(/from "\.\.\/src\//g, 'from "../').replace(/from '\.\.\/src\//g, "from '../")
);

// 4. Calcular SHA256 de dist/licensing.js sin ofuscar.
//    La ofuscación con javascript-obfuscator es no-determinista (dead-code
//    injection + self-defending varían por ejecución), lo que viola el
//    criterio de artefacto reproducible del plan 032.
const licensingDist = join(DIST_DIR, "licensing.js");
const licensingContent = readFileSync(licensingDist, "utf8");
const hash = createHash("sha256").update(licensingContent).digest("hex");

// 5. Reemplazar el placeholder en dist/integrity.js con el hash real
const integrityDist = join(DIST_DIR, "integrity.js");
let integritySource = readFileSync(integrityDist, "utf8");
if (!integritySource.includes(PLACEHOLDER)) {
  console.error(`Error: ${integrityDist} debe contener el placeholder ${PLACEHOLDER}`);
  process.exit(1);
}
integritySource = integritySource.replace(PLACEHOLDER, hash);
writeFileSync(integrityDist, integritySource, "utf8");

console.log(`Build completa: dist/ preparado (SHA256 licensing: ${hash.substring(0, 16)}...)`);
