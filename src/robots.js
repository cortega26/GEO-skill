import fs from "fs";

export function checkRobots(robotsPath) {
  if (!fs.existsSync(robotsPath)) {
    console.error(`Error: robots.txt not found at ${robotsPath}`);
    process.exit(1);
  }

  let content = "";
  try {
    content = fs.readFileSync(robotsPath, { encoding: "utf8", flag: "r" });
  } catch (e) {
    console.error(`Error: Failed to read robots.txt: ${e.message}`);
    process.exit(1);
  }

  const aiAgents = [
    "GPTBot",
    "Google-Extended",
    "ClaudeBot",
    "PerplexityBot",
    "Applebot-Extended",
    "Anthropic-AI",
  ];

  console.log("==================================================");
  console.log("            ROBOTS.TXT CRAWLER AUDIT             ");
  console.log("==================================================");

  const blockedAgents = [];
  const lines = content.split("\n");
  let currentAgent = null;

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const agentMatch = line.match(/^User-agent:\s*(.+)$/i);
    if (agentMatch) {
      currentAgent = agentMatch[1].trim();
      continue;
    }

    const disallowMatch = line.match(/^Disallow:\s*(.+)$/i);
    if (disallowMatch && currentAgent) {
      const disallowedPath = disallowMatch[1].trim();
      if (
        disallowedPath === "/" ||
        disallowedPath === "/*" ||
        (currentAgent === "*" && (disallowedPath === "/" || disallowedPath === "/*"))
      ) {
        blockedAgents.push({ agent: currentAgent, path: disallowedPath });
      }
    }
  }

  if (blockedAgents.length > 0) {
    console.log("WARNING: The following AI agents are blocked from crawling your root directory:");
    for (const b of blockedAgents) {
      console.log(`  - User-agent: ${b.agent} (Disallow: ${b.path})`);
    }
    console.log(
      "\nNote: Blocking these crawlers prevents AI engines from indexing your content and citing your pages."
    );
  } else {
    console.log("SUCCESS: No major AI agents or wildcard directives are blocking root access.");
    console.log("Your content is crawler-friendly for generative search engine indexing.");
  }
  console.log("==================================================");
}
