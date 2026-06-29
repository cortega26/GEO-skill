import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import * as licensing from "./licensing.js";

// ═══ Integrity verification ═══
//
// La build reemplaza la asignación de EXPECTED_HASH (línea siguiente) con el
// hash SHA-256 real de dist/licensing.js. Solo existe UNA ocurrencia del token
// de reemplazo en este archivo: la asignación misma.
//
// En desarrollo, EXPECTED_HASH conserva el valor literal del placeholder, que
// nunca coincide con un hash SHA-256 real. La comparación inline (línea ~33)
// usa el mismo literal como sentinela: si EXPECTED_HASH sigue siendo el
// placeholder, la verificación de integridad se desactiva (entorno de
// desarrollo). Si la build lo reemplazó, el check compara el hash esperado
// contra el hash real del archivo en disco.
//
// En producción: si licensing.js fue manipulado después de la instalación,
// actualHash !== EXPECTED_HASH y las funciones Pro se degradan automáticamente.

const EXPECTED_HASH = "<<<LICENSING_HASH>>>";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const licensingPath = join(__dirname, "licensing.js");

let tampered = false;

try {
  const content = readFileSync(licensingPath, "utf8");
  const actualHash = createHash("sha256").update(content).digest("hex");
  tampered = EXPECTED_HASH !== "<<<LICENSING_HASH>>>" && actualHash !== EXPECTED_HASH;
} catch {
  // Si no podemos leer el archivo, asumimos manipulación
  tampered = true;
}

// ═══ Re-export de licensing.js ═══

export const LICENSE_ENV_VAR = licensing.LICENSE_ENV_VAR;

export const resolveLicenseKey = licensing.resolveLicenseKey;

export const hasProEntitlement = tampered ? () => false : licensing.hasProEntitlement;

export const getNoBrandingError = tampered
  ? () =>
      "Integrity verification failed. The licensing module may have been tampered with. " +
      "Please reinstall geo-opt from the official source."
  : licensing.getNoBrandingError;
