#!/usr/bin/env node
import fs from "fs";
import {
  auditFile,
  checkRobots,
  generateSchemaData,
  injectSchema,
  loadConfig,
} from "../src/index.js";

function printHelp() {
  console.log(`
GEO (Generative Engine Optimization) CLI Helper Tool

Usage:
  geo-opt [options] <command> [arguments]

Options:
  --config <path>    Path to geo_config.json configuration file

Commands:
  audit <filepath> [--format <text|json>]
                    Audit content for GEO optimization score
  robots <filepath>
                    Audit robots.txt for AI bot block rules
  schema <filepath> <article|faq|product>
                    Generate JSON-LD schema markup from file content
  inject <filepath> <article|faq|product>
                    Generate and inject JSON-LD schema block directly into file
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  let configPath = null;
  const configIndex = args.indexOf("--config");
  if (configIndex !== -1 && configIndex < args.length - 1) {
    configPath = args[configIndex + 1];
    args.splice(configIndex, 2);
  }

  const command = args[0];
  const cmdArgs = args.slice(1);

  const { config } = loadConfig(configPath);

  if (command === "audit") {
    const filepath = cmdArgs[0];
    if (!filepath) {
      console.error("Error: Missing file path for audit command.");
      process.exit(1);
    }
    const formatIndex = cmdArgs.indexOf("--format");
    const fIndex = cmdArgs.indexOf("-f");
    let format = "text";
    if (formatIndex !== -1 && formatIndex < cmdArgs.length - 1) {
      format = cmdArgs[formatIndex + 1];
    } else if (fIndex !== -1 && fIndex < cmdArgs.length - 1) {
      format = cmdArgs[fIndex + 1];
    }

    // Parse --threshold
    const thresholdIndex = cmdArgs.indexOf("--threshold");
    const tIndex = cmdArgs.indexOf("-t");
    let threshold = null;
    if (thresholdIndex !== -1 && thresholdIndex < cmdArgs.length - 1) {
      threshold = parseInt(cmdArgs[thresholdIndex + 1], 10);
    } else if (tIndex !== -1 && tIndex < cmdArgs.length - 1) {
      threshold = parseInt(cmdArgs[tIndex + 1], 10);
    }

    const score = auditFile(filepath, config, format);

    if (threshold !== null && !isNaN(threshold)) {
      if (score < threshold) {
        console.error(
          `\nThreshold not met: score ${score}/100 is below required ${threshold}/100.`
        );
        process.exit(1);
      }
      console.log(`\nThreshold met: score ${score}/100 >= ${threshold}/100.`);
    }
  } else if (command === "robots") {
    const filepath = cmdArgs[0];
    if (!filepath) {
      console.error("Error: Missing file path for robots command.");
      process.exit(1);
    }
    checkRobots(filepath);
  } else if (command === "schema") {
    const filepath = cmdArgs[0];
    const type = cmdArgs[1];
    if (!filepath || !type) {
      console.error("Error: Missing arguments for schema command. Usage: schema <file> <type>");
      process.exit(1);
    }
    const schema = generateSchemaData(filepath, type, config);
    console.log(JSON.stringify(schema, null, 2));
  } else if (command === "inject") {
    const filepath = cmdArgs[0];
    const type = cmdArgs[1];
    if (!filepath || !type) {
      console.error("Error: Missing arguments for inject command. Usage: inject <file> <type>");
      process.exit(1);
    }

    const dryRun = cmdArgs.includes("--dry-run");
    const backup = cmdArgs.includes("--backup");

    if (backup) {
      const backupPath = filepath + ".bak";
      try {
        fs.copyFileSync(filepath, backupPath);
        console.log(`Backup created: ${backupPath}`);
      } catch (e) {
        console.error(`Error: Failed to create backup ${backupPath}: ${e.message}`);
        process.exit(1);
      }
    }

    injectSchema(filepath, type, config, dryRun);
  } else {
    console.error(`Error: Unknown command "${command}"`);
    printHelp();
    process.exit(1);
  }
}

main();
