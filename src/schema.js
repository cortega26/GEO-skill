import fs from "fs";
import path from "path";
import { preprocessContent, cleanMarkdownToPlainText, extractSections } from "./text.js";

export function generateSchemaData(filepath, schemaType, config) {
  if (!fs.existsSync(filepath)) {
    console.error(`Error: File ${filepath} not found.`);
    process.exit(1);
  }

  let content = "";
  try {
    content = fs.readFileSync(filepath, { encoding: "utf8", flag: "r" });
  } catch (e) {
    console.error(`Error: Failed to read file ${filepath}: ${e.message}`);
    process.exit(1);
  }

  const cleanText = preprocessContent(content);

  const titleMatch = cleanText.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "Untitled Document";

  const introMatch = cleanText.match(/^#\s+.+?\n\n([^#\n]+)/s);
  let description = introMatch ? introMatch[1].trim() : "";
  if (description.length > 150) {
    description = description.slice(0, 147) + "...";
  }

  const authorInfo = config.author || {};
  const pubInfo = config.publisher || {};

  const pubUrl = (pubInfo.url || "https://example.com").replace(/\/+$/, "");
  const orgId = `${pubUrl}/#organization`;
  const orgNode = {
    "@type": "Organization",
    "@id": orgId,
    name: pubInfo.name || "Publisher Name",
    url: pubUrl,
  };
  if (pubInfo.logo) {
    orgNode.logo = {
      "@type": "ImageObject",
      url: pubInfo.logo,
    };
  }

  const authorId = `${pubUrl}/#author`;
  const authorNode = {
    "@type": "Person",
    "@id": authorId,
    name: authorInfo.name || "Author Name",
    jobTitle: authorInfo.jobTitle || "Job Title",
  };
  if (authorInfo.sameAs) {
    authorNode.sameAs = authorInfo.sameAs;
  }

  const graphNodes = [orgNode, authorNode];

  if (schemaType === "article") {
    const articleNode = {
      "@type": "NewsArticle",
      "@id": `${pubUrl}/#article`,
      headline: title,
      description: description,
      datePublished: new Date().toISOString(),
      author: { "@id": authorId },
      publisher: { "@id": orgId },
    };
    graphNodes.push(articleNode);

    // FAQ extraction
    const sections = extractSections(content);
    if (sections.length > 0) {
      const qaList = [];
      for (const section of sections.slice(0, 5)) {
        if (
          section.body.length < 15 ||
          ["sources", "references", "citations", "bibliography"].includes(
            section.header.toLowerCase()
          )
        ) {
          continue;
        }
        qaList.push({
          "@type": "Question",
          name: section.header,
          acceptedAnswer: {
            "@type": "Answer",
            text: cleanMarkdownToPlainText(section.body),
          },
        });
      }
      if (qaList.length > 0) {
        const faqNode = {
          "@type": "FAQPage",
          "@id": `${pubUrl}/#faq`,
          mainEntity: qaList,
        };
        graphNodes.push(faqNode);
      }
    }
  } else if (schemaType === "faq") {
    const sections = extractSections(content);
    const qaList = [];
    for (const section of sections.slice(0, 5)) {
      if (
        section.body.length < 15 ||
        ["sources", "references", "citations", "bibliography"].includes(
          section.header.toLowerCase()
        )
      ) {
        continue;
      }
      qaList.push({
        "@type": "Question",
        name: section.header,
        acceptedAnswer: {
          "@type": "Answer",
          text: cleanMarkdownToPlainText(section.body),
        },
      });
    }
    const faqNode = {
      "@type": "FAQPage",
      "@id": `${pubUrl}/#faq`,
      mainEntity: qaList,
    };
    graphNodes.push(faqNode);
  } else if (schemaType === "product") {
    const productNode = {
      "@type": "Product",
      "@id": `${pubUrl}/#product`,
      name: title,
      description: description,
      brand: { "@id": orgId },
      offers: {
        "@type": "Offer",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        seller: { "@id": orgId },
      },
    };
    graphNodes.push(productNode);
  }

  return {
    "@context": "https://schema.org",
    "@graph": graphNodes,
  };
}

export function injectSchema(filepath, schemaType, config, dryRun = false) {
  if (!fs.existsSync(filepath)) {
    console.error(`Error: File ${filepath} not found.`);
    process.exit(1);
  }

  // SEC-01: Validate path is within working directory
  const resolvedPath = path.resolve(filepath);
  const cwd = path.resolve(process.cwd());
  if (!resolvedPath.startsWith(cwd + path.sep) && resolvedPath !== cwd) {
    console.error(
      `Error: Security restriction — target file ${filepath} is outside the current working directory.`
    );
    process.exit(1);
  }

  const schema = generateSchemaData(filepath, schemaType, config);
  const schemaJson = JSON.stringify(schema, null, 2);

  let content = "";
  try {
    content = fs.readFileSync(filepath, { encoding: "utf8", flag: "r" });
  } catch (e) {
    console.error(`Error: Failed to read file ${filepath}: ${e.message}`);
    process.exit(1);
  }

  const schemaPattern = /```json\s*\{\s*"@context":\s*"https:\/\/schema\.org"[\s\S]*?\}\s*```/;
  const scriptPattern =
    /<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?https:\/\/schema\.org[\s\S]*?<\/script>/i;

  const signature = config.signature;
  let sigMd = "";
  let sigHtml = "";

  if (signature) {
    // SEC-02: Validate signature format — only allow markdown link syntax [text](https://url) with optional text
    const sigPattern = /^[^<>\n]*\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)[^<>\n]*$/;
    if (!sigPattern.test(signature)) {
      console.error(
        `Error: Security restriction — signature must contain a markdown link and no HTML tags. Got: ${signature}`
      );
      process.exit(1);
    }

    // Check if signature is already present by stripping markdown link markers
    const sigRaw = signature.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    if (!content.includes(sigRaw)) {
      const escapedText = signature
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

      sigMd = `\n\n${signature}\n`;
      // For HTML, use the escaped version to prevent XSS
      sigHtml = `\n<div class="geo-signature"><p>${escapedText}</p></div>\n`;
    }
  }

  let injectedCode = `${sigMd}\n\`\`\`json\n${schemaJson}\n\`\`\`\n`;

  if (filepath.endsWith(".html") || content.toLowerCase().includes("<html")) {
    injectedCode = `${sigHtml}\n<script type="application/ld+json">\n${schemaJson}\n</script>\n`;
    if (scriptPattern.test(content)) {
      content = content.replace(scriptPattern, injectedCode.trim());
      console.log(`Successfully replaced existing JSON-LD script tag in ${filepath}.`);
    } else {
      if (/<\/head>/i.test(content)) {
        content = content.replace(/<\/head>/i, `${injectedCode}</head>`);
      } else if (/<\/body>/i.test(content)) {
        content = content.replace(/<\/body>/i, `${injectedCode}</body>`);
      } else {
        content += injectedCode;
      }
      console.log(`Successfully injected JSON-LD script tag into ${filepath}.`);
    }
  } else {
    if (schemaPattern.test(content)) {
      content = content.replace(schemaPattern, injectedCode.trim());
      console.log(`Successfully updated existing Schema.org block in markdown file ${filepath}.`);
    } else {
      content += injectedCode;
      console.log(`Successfully appended Schema.org block to markdown file ${filepath}.`);
    }
  }

  if (dryRun) {
    console.log("=== DRY RUN: The following would be injected ===");
    console.log(injectedCode);
    console.log("=== End of dry run preview ===");
    return;
  }

  try {
    fs.writeFileSync(filepath, content, { encoding: "utf8" });
  } catch (e) {
    console.error(`Error: Failed to write to file ${filepath}: ${e.message}`);
    process.exit(1);
  }
}
