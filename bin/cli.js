#!/usr/bin/env node
import { parseArgs } from "node:util";
import fs from "fs";
import path from "path";
import {
  auditFile,
  checkRobots,
  generateSchemaData,
  injectSchema,
  loadConfig,
  getNoBrandingError,
  recordSuccessfulFreeInjection,
  remindersAreEnabled,
  setRemindersEnabled,
} from "../src/index.js";

function printHelp(command = null) {
  if (command === "audit") {
    console.log(`
geo-opt audit <file...> [options]

Audit content for GEO optimization score.

Options:
  --config <path>     Path to geo_config.json
  --format <type>     Output format: text (default) or json
  --threshold <n>     Exit with code 1 if score is below n
  -f, -t              Short forms of --format, --threshold

Example:
  geo-opt audit post.md --format json --threshold 70
`);
  } else if (command === "inject") {
    console.log(`
geo-opt inject <file> <type> [options]

Generate and inject JSON-LD schema into file.

Options:
  --config <path>     Path to geo_config.json
  --dry-run           Preview changes without writing
  --backup            Create .bak file before modifying
  --no-branding       Remove Tooltician branding (Pro license required)

Example:
  geo-opt inject post.md article --dry-run
`);
  } else if (command === "robots") {
    console.log(`
geo-opt robots <file> [options]

Audit robots.txt for AI crawler blocking rules.

Options:
  --config <path>     Path to geo_config.json

Example:
  geo-opt robots public/robots.txt
`);
  } else if (command === "schema") {
    console.log(`
geo-opt schema <file> <type> [options]

Generate JSON-LD Schema.org structured data from file content.

Options:
  --config <path>     Path to geo_config.json

Supported types: article, faq, product

Example:
  geo-opt schema post.md article
`);
  } else if (command === "config") {
    console.log(`
geo-opt config <get|set> reminders [true|false]

Manage local geo-opt preferences.

Examples:
  geo-opt config get reminders
  geo-opt config set reminders false
`);
  } else {
    console.log(`
geo-opt — Generative Engine Optimization CLI

Commands:
  audit    <file...>     Audit content for GEO score
  schema   <file> <type>  Generate JSON-LD schema (article|faq|product)
  inject   <file> <type>  Inject schema into file (article|faq|product)
  robots   <file>         Audit robots.txt for AI crawler rules
  config                  Manage local preferences

Options:
  --config <path>         Path to geo_config.json
  --help                  Show this help

Run 'geo-opt <command> --help' for command-specific options.
`);
  }
}

// sync-only; no async operations in this function
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    process.exit(0);
  }

  // Extract --config globally
  let configPath = null;
  const configIndex = args.indexOf("--config");
  if (configIndex !== -1 && configIndex < args.length - 1) {
    configPath = args[configIndex + 1];
    args.splice(configIndex, 2);
  }

  const { config } = loadConfig(configPath);

  const command = args[0];
  const rest = args.slice(1);

  switch (command) {
    case "audit": {
      let parsed;
      try {
        parsed = parseArgs({
          args: rest,
          options: {
            format: { type: "string", short: "f", default: "text" },
            threshold: { type: "string", short: "t" },
            help: { type: "boolean", short: "h" },
          },
          allowPositionals: true,
        });
      } catch (e) {
        console.error(`Error: ${e.message}`);
        printHelp("audit");
        process.exit(1);
      }

      if (parsed.values.help) {
        printHelp("audit");
        process.exit(0);
      }

      const filepaths = parsed.positionals;
      if (filepaths.length === 0) {
        console.error("Error: Missing file path for audit command.");
        process.exit(1);
      }

      const format = parsed.values.format;
      let threshold = null;
      if (parsed.values.threshold !== undefined) {
        const raw = parsed.values.threshold;
        if (!/^\d+$/.test(raw)) {
          console.error(`Error: --threshold must be an integer, got "${raw}".`);
          process.exit(1);
        }
        threshold = parseInt(raw, 10);
      }

      const results = [];
      for (const fp of filepaths) {
        const score = auditFile(fp, config, format);
        results.push({ file: fp, score });
      }

      // Batch threshold check
      if (threshold !== null && !isNaN(threshold)) {
        const failures = results.filter((r) => r.score < threshold);
        if (failures.length > 0) {
          console.error(`\nThreshold not met for ${failures.length} file(s):`);
          for (const f of failures) {
            console.error(`  ${f.file}: ${f.score}/100 (threshold: ${threshold})`);
          }
          process.exit(1);
        }
        console.log(`\nAll ${results.length} file(s) meet threshold ${threshold}/100.`);
      }

      break;
    }

    case "robots": {
      let parsed;
      try {
        parsed = parseArgs({
          args: rest,
          options: {
            help: { type: "boolean", short: "h" },
          },
          allowPositionals: true,
        });
      } catch (e) {
        console.error(`Error: ${e.message}`);
        process.exit(1);
      }

      if (parsed.values.help) {
        printHelp("robots");
        process.exit(0);
      }

      const filepath = parsed.positionals[0];
      if (!filepath) {
        console.error("Error: Missing file path for robots command.");
        process.exit(1);
      }
      checkRobots(filepath);
      break;
    }

    case "schema": {
      let parsed;
      try {
        parsed = parseArgs({
          args: rest,
          options: {
            help: { type: "boolean", short: "h" },
          },
          allowPositionals: true,
        });
      } catch (e) {
        console.error(`Error: ${e.message}`);
        process.exit(1);
      }

      if (parsed.values.help) {
        printHelp("schema");
        process.exit(0);
      }

      const filepath = parsed.positionals[0];
      const type = parsed.positionals[1];
      if (!filepath || !type) {
        console.error("Error: Missing arguments for schema command. Usage: schema <file> <type>");
        process.exit(1);
      }
      const schema = generateSchemaData(filepath, type, config);
      console.log(JSON.stringify(schema, null, 2));
      break;
    }

    case "inject": {
      let parsed;
      try {
        parsed = parseArgs({
          args: rest,
          options: {
            "dry-run": { type: "boolean" },
            backup: { type: "boolean" },
            "no-branding": { type: "boolean" },
            help: { type: "boolean", short: "h" },
          },
          allowPositionals: true,
        });
      } catch (e) {
        console.error(`Error: ${e.message}`);
        printHelp("inject");
        process.exit(1);
      }

      if (parsed.values.help) {
        printHelp("inject");
        process.exit(0);
      }

      const filepath = parsed.positionals[0];
      const type = parsed.positionals[1];
      if (!filepath || !type) {
        console.error("Error: Missing arguments for inject command. Usage: inject <file> <type>");
        process.exit(1);
      }

      const dryRun = parsed.values["dry-run"] || false;
      const backup = parsed.values.backup || false;
      const noBranding = parsed.values["no-branding"] || false;

      if (noBranding) {
        const entitlementError = getNoBrandingError(config);
        if (entitlementError) {
          console.error(`Error: ${entitlementError}`);
          process.exit(1);
        }
      }

      // Validate path before any file operations (defense in depth —
      // injectSchema repeats this check internally)
      const resolvedPath = path.resolve(filepath);
      const cwd = path.resolve(process.cwd());
      if (!resolvedPath.startsWith(cwd + path.sep) && resolvedPath !== cwd) {
        console.error(
          `Error: Security restriction — target file ${filepath} is outside the current working directory.`
        );
        process.exit(1);
      }

      if (backup && !dryRun) {
        const backupPath = filepath + ".bak";
        try {
          fs.copyFileSync(filepath, backupPath);
          console.log(`Backup created: ${backupPath}`);
        } catch (e) {
          console.error(`Error: Failed to create backup ${backupPath}: ${e.message}`);
          process.exit(1);
        }
      }

      injectSchema(filepath, type, config, { dryRun, noBranding });
      if (!dryRun) {
        recordSuccessfulFreeInjection(config);
      }
      break;
    }

    case "config": {
      const action = rest[0];
      const setting = rest[1];

      if (action === "--help" || action === "-h") {
        printHelp("config");
        process.exit(0);
      }

      if (setting !== "reminders" || !["get", "set"].includes(action)) {
        console.error("Error: Usage: geo-opt config <get|set> reminders [true|false]");
        process.exit(1);
      }

      if (action === "get") {
        console.log(remindersAreEnabled() ? "true" : "false");
        break;
      }

      const rawValue = rest[2];
      if (!["true", "false"].includes(rawValue)) {
        console.error("Error: reminders must be true or false.");
        process.exit(1);
      }

      const enabled = rawValue === "true";
      if (!setRemindersEnabled(enabled)) {
        console.error("Error: Could not save the local reminder preference.");
        process.exit(1);
      }
      console.log(`Support reminders ${enabled ? "enabled" : "disabled"}.`);
      break;
    }

    case "--help":
    case "-h":
      printHelp();
      process.exit(0);
      break;

    default:
      console.error(`Error: Unknown command "${command}"`);
      printHelp();
      process.exit(1);
  }
}

main();
