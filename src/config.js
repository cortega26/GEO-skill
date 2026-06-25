import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const MAX_PRONOUN_DENSITY = 0.02;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadConfig(configPath = null) {
  const searchPaths = [];
  if (configPath) {
    if (!fs.existsSync(configPath)) {
      console.error(`Error: Specified config file ${configPath} not found.`);
      process.exit(1);
      return;
    }
    searchPaths.push(configPath);
  } else {
    searchPaths.push(path.join(process.cwd(), "geo_config.json"));
    searchPaths.push(
      path.resolve(__dirname, "..", ".agents", "skills", "geo-optimization", "geo_config.json")
    );
  }

  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, { encoding: "utf8", flag: "r" });
        return { config: JSON.parse(raw), configPath: p };
      } catch (e) {
        console.warn(`Warning: Failed to parse config at ${p}: ${e.message}`);
      }
    }
  }

  return { config: {}, configPath: null };
}
