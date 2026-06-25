export function calculateReadability(text) {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const words = text.match(/\b\w+\b/g) || [];

  if (sentences.length === 0 || words.length === 0) {
    return { wordCount: 0, avgSentenceLen: 0 };
  }

  return {
    wordCount: words.length,
    avgSentenceLen: words.length / sentences.length,
  };
}

export function preprocessContent(content) {
  // Strip markdown code blocks
  let text = content.replace(/```[\s\S]*?```/g, "");
  // Strip HTML script and style tags
  text = text.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
  // Strip HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  return text;
}

export function cleanMarkdownToPlainText(mdText) {
  // Remove markdown links, keeping text: [text](url) -> text
  let text = mdText.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Remove bold/italic markup
  text = text.replace(/[\*_]{1,3}/g, "");

  const lines = [];
  for (let line of text.split("\n")) {
    line = line.trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      // Skip divider rows e.g. |---|
      if (/^\|[\s\-\:\+\|]+$/.test(line)) {
        continue;
      }
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      lines.push(cells.filter(Boolean).join(" - "));
    } else {
      lines.push(line);
    }
  }

  return lines.join("\n").trim();
}

export function extractSections(content) {
  const cleanContent = preprocessContent(content);
  const sections = [];
  let currentHeader = null;
  let currentText = [];

  for (const line of cleanContent.split("\n")) {
    const headerMatch = line.match(/^(##+)\s+(.+)$/);
    if (headerMatch) {
      if (currentHeader) {
        sections.push({ header: currentHeader, body: currentText.join("\n").trim() });
      }
      currentHeader = headerMatch[2].trim();
      currentText = [];
    } else {
      if (currentHeader !== null) {
        currentText.push(line);
      }
    }
  }

  if (currentHeader) {
    sections.push({ header: currentHeader, body: currentText.join("\n").trim() });
  }

  return sections;
}
