/**
 * Unified audit engine selector (plan 030).
 *
 * Routes content through the selected scoring model and returns a
 * normalized {score, report} result. Library consumers choose the
 * model; CLI and batch adapters pass it through.
 *
 * This module does NOT own file I/O, text rendering, or process exit codes.
 */

import { scoreContent } from "./scoring.js";
import { scoreContentV2 } from "./scoring-v2.js";

/**
 * Run a GEO audit through the chosen scoring model.
 *
 * @param {string} content  — raw file content (HTML or Markdown)
 * @param {string} filepath — file path (used for HTML detection and report identity)
 * @param {object} config   — parsed geo_config.json
 * @param {"v1"|"v2"} model — scoring model (default: "v1")
 * @returns {{ score: number, report: object }}
 * @throws {Error} if model is unknown
 */
export function auditContent(content, filepath, config = {}, model = "v1") {
  switch (model) {
    case "v1":
      return scoreContent(content, filepath, config);
    case "v2":
      return scoreContentV2(content, filepath, config);
    default:
      throw new Error(`Unknown scoring model "${model}". Expected "v1" or "v2".`);
  }
}
