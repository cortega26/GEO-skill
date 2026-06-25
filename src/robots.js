import fs from "fs";

export function checkRobots(robotsPath) {
  if (!fs.existsSync(robotsPath)) {
    console.error(`Error: robots.txt not found at ${robotsPath}`);
    process.exit(1);
    return;
  }

  let content = "";
  try {
    content = fs.readFileSync(robotsPath, { encoding: "utf8", flag: "r" });
  } catch (e) {
    console.error(`Error: Failed to read robots.txt: ${e.message}`);
    process.exit(1);
    return;
  }

  console.log("==================================================");
  console.log("            ROBOTS.TXT CRAWLER AUDIT             ");
  console.log("==================================================");

  const blockedAgents = [];
  const lines = content.split("\n");
  let currentAgents = [];

  for (let line of lines) {
    line = line.trim();
    // Blank line starts a new directive block
    if (!line) {
      currentAgents = [];
      continue;
    }
    if (line.startsWith("#")) {
      continue;
    }

    const agentMatch = line.match(/^User-agent:\s*(.+)$/i);
    if (agentMatch) {
      currentAgents.push(agentMatch[1].trim());
      continue;
    }

    const disallowMatch = line.match(/^Disallow:\s*(.+)$/i);
    if (disallowMatch && currentAgents.length > 0) {
      const disallowedPath = disallowMatch[1].trim();
      if (disallowedPath === "/" || disallowedPath === "/*") {
        for (const agent of currentAgents) {
          blockedAgents.push({ agent, path: disallowedPath });
        }
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
