#!/usr/bin/env python3
import sys
import re
import os
import json
import argparse
from datetime import datetime, timezone

# Default thresholds
MAX_PRONOUN_DENSITY = 0.02
LICENSE_ENV_VAR = "TOOLTICIAN_LICENSE_KEY"
PRO_LICENSE_PATTERN = re.compile(r"^tt_pro_[A-Za-z0-9_-]{20,}$")
TOOLTICIAN_BRANDING_MARKDOWN = "Optimized with [Tooltician](https://www.tooltician.com)"
TOOLTICIAN_BRANDING_HTML = (
    '<div class="geo-signature"><p>Optimized with '
    '<a href="https://www.tooltician.com">Tooltician</a></p></div>'
)
SUPPORTED_SCHEMA_TYPES = {"article", "faq", "product"}
REMINDER_INJECTION_INTERVAL = 10
REMINDER_COOLDOWN_SECONDS = 7 * 24 * 60 * 60
STATE_DIR_ENV_VAR = "GEO_OPT_STATE_DIR"
SUPPORT_URL = "https://www.tooltician.com"


def resolve_license_key(config, env=None):
    """Returns the locally configured Pro license key without logging it."""
    env = os.environ if env is None else env
    license_config = config.get("license", {})
    configured_key = (
        license_config.get("key")
        if isinstance(license_config, dict)
        else None
    ) or config.get("licenseKey")
    candidate = env.get(LICENSE_ENV_VAR) or configured_key
    return candidate.strip() if isinstance(candidate, str) else ""


def has_pro_entitlement(config, env=None):
    """Checks the local Tooltician Pro key format.

    This is a convenience entitlement gate for the source-available CLI, not a
    cryptographic or server-side license verification mechanism.
    """
    return bool(PRO_LICENSE_PATTERN.fullmatch(resolve_license_key(config, env)))


def no_branding_error(config, env=None):
    if has_pro_entitlement(config, env):
        return None
    return (
        "--no-branding requires a Tooltician Pro license key. "
        f"Set {LICENSE_ENV_VAR} or license.key in geo_config.json."
    )


def get_state_path(env=None):
    env = os.environ if env is None else env
    base_dir = (
        env.get(STATE_DIR_ENV_VAR)
        or env.get("XDG_CONFIG_HOME")
        or os.path.join(os.path.expanduser("~"), ".config")
    )
    return os.path.join(base_dir, "geo-opt", "state.json")


def default_engagement_state():
    return {
        "remindersEnabled": True,
        "successfulFreeInjections": 0,
        "lastReminderAt": None,
    }


def read_engagement_state(state_path=None, env=None):
    state_path = state_path or get_state_path(env)
    try:
        with open(state_path, "r", encoding="utf-8") as state_file:
            parsed = json.load(state_file)
        state = default_engagement_state()
        state.update(parsed)
        state["remindersEnabled"] = parsed.get("remindersEnabled") is not False
        count = parsed.get("successfulFreeInjections", 0)
        state["successfulFreeInjections"] = max(0, count) if isinstance(count, int) else 0
        last_reminder = parsed.get("lastReminderAt")
        state["lastReminderAt"] = last_reminder if isinstance(last_reminder, str) else None
        return state
    except (OSError, ValueError, TypeError):
        return default_engagement_state()


def write_engagement_state(state, state_path=None, env=None):
    state_path = state_path or get_state_path(env)
    directory = os.path.dirname(state_path)
    temporary_path = f"{state_path}.{os.getpid()}.tmp"
    try:
        os.makedirs(directory, mode=0o700, exist_ok=True)
        with open(temporary_path, "w", encoding="utf-8") as state_file:
            json.dump(state, state_file, indent=2)
            state_file.write("\n")
        os.chmod(temporary_path, 0o600)
        os.replace(temporary_path, state_path)
        return True
    except OSError:
        try:
            os.remove(temporary_path)
        except OSError:
            pass
        return False


def set_reminders_enabled(enabled, state_path=None, env=None):
    state = read_engagement_state(state_path, env)
    state["remindersEnabled"] = enabled
    return write_engagement_state(state, state_path, env)


def reminders_are_enabled(state_path=None, env=None):
    return read_engagement_state(state_path, env)["remindersEnabled"]


def is_automated_environment(env):
    return any(
        env.get(name)
        for name in (
            "CI",
            "GITHUB_ACTIONS",
            "GITLAB_CI",
            "BUILDKITE",
            "JENKINS_URL",
            "TF_BUILD",
        )
    )


def record_successful_free_injection(
    config,
    state_path=None,
    env=None,
    stderr=None,
    now=None,
):
    env = os.environ if env is None else env
    stderr = sys.stderr if stderr is None else stderr
    now = datetime.now(timezone.utc) if now is None else now

    if (
        has_pro_entitlement(config, env)
        or not getattr(stderr, "isatty", lambda: False)()
        or is_automated_environment(env)
        or env.get("GEO_OPT_DISABLE_REMINDERS") == "1"
    ):
        return {"shown": False, "reason": "suppressed"}

    state = read_engagement_state(state_path, env)
    if not state["remindersEnabled"]:
        return {"shown": False, "reason": "disabled"}

    state["successfulFreeInjections"] += 1
    last_reminder = None
    if state["lastReminderAt"]:
        try:
            last_reminder = datetime.fromisoformat(
                state["lastReminderAt"].replace("Z", "+00:00")
            )
        except ValueError:
            last_reminder = None

    cooldown_elapsed = (
        last_reminder is None
        or (now - last_reminder).total_seconds() >= REMINDER_COOLDOWN_SECONDS
    )
    interval_reached = (
        state["successfulFreeInjections"] >= REMINDER_INJECTION_INTERVAL
    )

    if interval_reached and cooldown_elapsed:
        print(
            "\nEnjoying geo-opt? Support Tooltician and unlock branding-free output:\n"
            f"{SUPPORT_URL}\n"
            "Hide this message: geo-opt config set reminders false\n",
            file=stderr,
        )
        state["successfulFreeInjections"] = 0
        state["lastReminderAt"] = now.isoformat()
        write_engagement_state(state, state_path, env)
        return {"shown": True, "reason": "interval"}

    write_engagement_state(state, state_path, env)
    return {
        "shown": False,
        "reason": "cooldown" if interval_reached else "interval",
    }


def optional_id(base_url, fragment):
    return f"{base_url}/#{fragment}" if base_url else None


def reference_or_inline(node, node_id):
    return {"@id": node_id} if node_id else node


def strip_tooltician_branding(content):
    content = re.sub(
        r"\n{0,2}Optimized (?:by|with) \[Tooltician\]"
        r"\(https?://(?:www\.)?tooltician\.com/?\)\s*",
        "\n",
        content,
        flags=re.IGNORECASE,
    )
    return re.sub(
        r'\s*<div[^>]*class=["\'][^"\']*\bgeo-signature\b[^"\']*["\'][^>]*>'
        r".*?</div>\s*",
        "\n",
        content,
        flags=re.DOTALL | re.IGNORECASE,
    )

def load_config(config_path=None):
    """Loads configuration file containing default author details and acronym dictionary."""
    search_paths = []
    if config_path:
        # If user explicitly passed a config path, it must exist
        if not os.path.exists(config_path):
            print(f"Error: Specified config file {config_path} not found.", file=sys.stderr)
            sys.exit(1)
        search_paths.append(config_path)
    else:
        # Fallback defaults
        search_paths.append(os.path.join(os.getcwd(), "geo_config.json"))
        script_dir = os.path.dirname(os.path.abspath(__file__))
        search_paths.append(os.path.abspath(os.path.join(script_dir, "..", "geo_config.json")))
    
    for path in search_paths:
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8', errors='replace') as f:
                    return json.load(f), path
            except Exception as e:
                print(f"Warning: Failed to parse config at {path}: {e}", file=sys.stderr)
                
    return {}, None

def calculate_readability(text):
    """Simple heuristic for text clarity: sentence and word counts."""
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    words = re.findall(r'\b\w+\b', text)
    
    if not sentences or not words:
        return 0, 0
        
    avg_sentence_len = len(words) / len(sentences)
    return len(words), avg_sentence_len

def preprocess_content(content):
    """Strips markdown code blocks and HTML comments to clean text for analysis."""
    # Strip markdown code blocks
    text = re.sub(r'```.*?```', '', content, flags=re.DOTALL)
    # Strip HTML script and style blocks
    text = re.sub(r'<script.*?>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style.*?>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
    # Strip HTML comments
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
    return text

def clean_markdown_to_plain_text(md_text):
    """Converts markdown (links, bold, tables) to clean, search-compliant plain text for schema nodes."""
    # Remove links keeping text: [text](url) -> text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', md_text)
    # Unwrap inline code spans before stripping formatting, so that
    # * and _ inside `backticks` are preserved as literal characters.
    text = re.sub(r'`([^`]+)`', r'\1', text)
    # Remove bold/italic tags
    text = re.sub(r'[\*_]{1,3}', '', text)
    
    lines = []
    for line in text.split('\n'):
        line = line.strip()
        if line.startswith('|') and line.endswith('|'):
            # Skip divider rows
            if re.match(r'^\|[\s\-\:\+\|]+$', line):
                continue
            cells = [c.strip() for c in line.split('|')[1:-1]]
            lines.append(' - '.join(c for c in cells if c))
        else:
            lines.append(line)
            
    # Join lines and strip any remaining HTML tags for clean schema output
    return re.sub(r'<[^>]+>', '', '\n'.join(lines)).strip()

def extract_sections(content):
    """Robustly extracts headings and their clean body text from markdown, stripping code blocks."""
    clean_content = preprocess_content(content)
    sections = []
    current_header = None
    current_text = []
    
    for line in clean_content.split('\n'):
        # Markdown headings: ## Title, ### Subtitle
        header_match = re.match(r'^(##+)\s+(.+)$', line)
        if not header_match:
            # HTML headings: <h2>Title</h2>, <h3>Subtitle</h3>
            header_match = re.match(r'^<h([234])[^>]*>(.+)</h\1>$', line, re.IGNORECASE)
        if header_match:
            if current_header:
                sections.append((current_header, '\n'.join(current_text).strip()))
            current_header = header_match.group(2).strip()
            current_text = []
        else:
            if current_header is not None:
                current_text.append(line)
                
    if current_header:
        sections.append((current_header, '\n'.join(current_text).strip()))
        
    return sections

def audit_file(filepath, config, output_format="text"):
    if not os.path.exists(filepath):
        print(f"Error: File {filepath} not found.", file=sys.stderr)
        sys.exit(1)
        
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except Exception as e:
        print(f"Error: Failed to read file {filepath}: {e}", file=sys.stderr)
        sys.exit(1)

    text_content = preprocess_content(content)
    
    # 1. Answer-First & Structure (Max 20 pts)
    struct_score = 0
    struct_breakdown = []
    
    lines = [line.strip() for line in text_content.split('\n') if line.strip()]
    intro_para = ""
    for line in lines:
        if not line.startswith('#'):
            intro_para = line
            break
            
    if intro_para:
        words = intro_para.split()
        word_count = len(words)
        is_definition = any(verb in intro_para.lower() for verb in [" is a ", " is an ", " refers to ", " represents ", " is the strategic "])
        
        if 40 <= word_count <= 90:
            if is_definition:
                struct_score += 10
                struct_breakdown.append("Answer-First: Optimal length (40-90 words) and contains definition markers (+10 pts)")
            else:
                struct_score += 7
                struct_breakdown.append("Answer-First: Optimal length but lacks clear definition markers (+7 pts)")
        else:
            struct_breakdown.append(f"Answer-First: Intro paragraph has {word_count} words (optimal is 40-90) (+0 pts)")
    else:
        struct_breakdown.append("Answer-First: No intro paragraph found (+0 pts)")
        
    if ("|" in text_content and re.search(r'\|\s*:?-+:?\s*\|', text_content)) or "<table>" in text_content.lower():
        struct_score += 4
        struct_breakdown.append("Tables: Structured data tables present (+4 pts)")
    else:
        struct_breakdown.append("Tables: No tables found (+0 pts)")
        
    if re.search(r'^\s*[\-\*\+\d\.]+\s+', text_content, re.MULTILINE):
        struct_score += 3
        struct_breakdown.append("Lists: Bulleted or numbered lists present (+3 pts)")
    else:
        struct_breakdown.append("Lists: No lists found (+0 pts)")
        
    if re.search(r'^##+\s+\w+', text_content, re.MULTILINE) or re.search(r'<h[234]>', text_content.lower()):
        struct_score += 3
        struct_breakdown.append("Headers: Clean H2/H3 hierarchy found (+3 pts)")
    else:
        struct_breakdown.append("Headers: No H2/H3 headers found (+0 pts)")

    # Check for HTML semantic layout if it's an HTML file (Technical AI Readiness)
    # Use text_content (code blocks stripped) to avoid false positives
    # when markdown files contain HTML code examples inside code fences.
    if filepath.endswith('.html') or "<html" in text_content.lower():
        html_lowered = text_content.lower()
        semantic_tags = ["<article", "<main", "<header", "<footer", "<nav", "<section"]
        found_tags = [t for t in semantic_tags if t in html_lowered]
        if len(found_tags) >= 3:
            struct_breakdown.append(f"Semantic HTML: Good HTML5 layout tags used ({', '.join(found_tags)}) (+0 pts)")
        else:
            deduction = 4
            struct_score = max(0, struct_score - deduction)
            struct_breakdown.append(f"Semantic HTML: Lacks HTML5 structural tags (e.g. <main>, <article>). Found only: {', '.join(found_tags)} (-{deduction} pts)")
            
        # Check for dynamic client-side JS rendering setups
        dynamic_indicators = ["id=\"app\"", "id=\"root\"", "createapp(", "reactdom.render("]
        found_dynamic = [ind for ind in dynamic_indicators if ind in html_lowered]
        if found_dynamic:
            struct_breakdown.append("Dynamic Rendering Warning: Detects client-side JS references. Ensure content is pre-rendered / SSR for AI crawler searchability.")

    # 2. Statistics Density (Max 20 pts)
    stats_score = 0
    stat_matches = re.findall(r'\b\d+(?:\.\d+)?%|\$\d+(?:\.\d+)?[kKmMbB]?|\b\d+(?:\.\d+)?[xX]\b|\b\d{2,}(?:,\d{3})*(?:\.\d+)?\b', text_content)
    
    # Filter out isolated calendar years (1900 - 2099)
    filtered_stats = []
    for s in stat_matches:
        if re.match(r'^(19|20)\d{2}$', s):
            continue
        filtered_stats.append(s)
        
    stat_count = len(filtered_stats)

    # Enhanced: detect verbal/non-numeric statistics
    verbal_patterns = [
        # Fractions
        r'\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:-|—)\s*(?:third|quarter|fifth|sixth|seventh|eighth|ninth|tenth)s?\b',
        r'\b(?:one|two|three|four|five)\s*-?\s*(?:third|quarter|fifth)s?\b',
        # Proportional phrases
        r'\b\d+\s*(?:out\s*of|in)\s*\d+\b',
        # Multiplier words
        r'\b(?:double|triple|quadruple|half|twice)\b',
        # Percentage words
        r'\b(?:majority|minority|plurality)\b',
    ]

    verbal_count = 0
    verbal_matches = []
    for pattern in verbal_patterns:
        matches = re.findall(pattern, text_content, re.IGNORECASE)
        verbal_count += len(matches)
        if matches:
            verbal_matches.extend(matches[:3])

    total_stat_count = stat_count + verbal_count

    if total_stat_count >= 3:
        stats_score = 20
        detail_parts = filtered_stats[:3] + (["..."] if len(filtered_stats) > 3 else [])
        verbal_sample = verbal_matches[:3] if verbal_matches else []
        parts_str = ", ".join(detail_parts + verbal_sample) if filtered_stats else ", ".join(verbal_sample)
        stats_breakdown = f"High density ({total_stat_count} stats found: {parts_str}...) (+20 pts)"
    elif total_stat_count > 0:
        stats_score = 10
        all_matches = filtered_stats + verbal_matches
        stats_breakdown = f"Moderate density ({total_stat_count} stats found: {', '.join(all_matches)}) (+10 pts)"
    else:
        stats_breakdown = "No statistics or numerical evidence found (+0 pts)"

    # 3. Quotation Density (Max 20 pts)
    quotes_score = 0
    quote_blocks = re.findall(r'^\s*>\s+.+', text_content, re.MULTILINE)
    inline_quotes = re.findall(r'"([^"]{15,})"', text_content)
    quote_count = len(quote_blocks) + len(inline_quotes)
    
    if quote_count >= 2:
        quotes_score = 20
        quotes_breakdown = f"High density ({quote_count} quotes found) (+20 pts)"
    elif quote_count > 0:
        quotes_score = 10
        quotes_breakdown = f"Moderate density ({quote_count} quotes found) (+10 pts)"
    else:
        quotes_breakdown = "No expert quotes or direct attributions found (+0 pts)"

    # 4. Citation & Authority (Max 20 pts)
    citation_score = 0
    links = re.findall(r'\[([^\]]+)\]\((https?://[^\)]+)\)', text_content)
    html_links = re.findall(r'href=["\'](https?://[^"\']+)["\']', text_content)
    link_count = len(links) + len(html_links)
    
    has_sources_header = any(keyword in text_content.lower() for keyword in ["sources", "references", "citations", "bibliography"])
    
    if link_count >= 3:
        citation_score += 15
        citation_breakdown = f"Links: High authority link density ({link_count} links found) (+15 pts)"
    elif link_count > 0:
        citation_score += 8
        citation_breakdown = f"Links: Moderate link density ({link_count} links found) (+8 pts)"
    else:
        citation_breakdown = "Links: No external hyperlinks found (+0 pts)"
        
    if has_sources_header:
        citation_score += 5
        citation_breakdown += "\nReferences: Dedicated citation/sources section found (+5 pts)"
    else:
        citation_breakdown += "\nReferences: No dedicated citation section found (+0 pts)"

    # 5. Semantic Clarity & Readability (Max 20 pts)
    clarity_score = 20
    clarity_breakdown = []
    
    words = re.findall(r'\b\w+\b', text_content.lower())
    total_word_count = len(words)
    
    if total_word_count > 0:
        # Pronoun check
        pronouns = ["it", "they", "them", "this", "these", "those"]
        pronoun_count = sum(words.count(p) for p in pronouns)
        pronoun_density = pronoun_count / total_word_count
        
        pronoun_limit = config.get("limits", {}).get("max_pronoun_density", MAX_PRONOUN_DENSITY)
        if pronoun_density > pronoun_limit:
            deduction = min(15, int((pronoun_density - pronoun_limit) * 100))
            clarity_score -= deduction
            clarity_breakdown.append(f"Pronoun Ambiguity: High density of ambiguous pronouns ({pronoun_density:.1%}). Limit use of 'it', 'they', etc. (-{deduction} pts)")
        else:
            clarity_breakdown.append(f"Pronoun Ambiguity: Low density of ambiguous pronouns ({pronoun_density:.1%}) (+0 pts)")
            
        # Acronym check - strip markdown headers to prevent ALL CAPS HEADERS false positives
        no_headers = re.sub(r'^##+.*$', '', text_content, flags=re.MULTILINE)
        found_acronyms = set(re.findall(r'\b[A-Z]{2,}\b', no_headers))
        
        # Stopwords filter
        stopwords = {"THE", "AND", "FOR", "BUT", "YOU", "NOT", "YES", "OUT", "OFF", "HOW", "WHY", "OUR", "WHO"}
        found_acronyms = {acr for acr in found_acronyms if acr not in stopwords}
        
        acronym_dict = config.get("acronyms", {})
        unexplained = []
        
        for acr in found_acronyms:
            if acr in acronym_dict:
                expansion = acronym_dict[acr]
                acr_positions = [m.start() for m in re.finditer(rf'\b{acr}\b', text_content)]
                is_explained = False
                for pos in acr_positions:
                    start_look = max(0, pos - 120)
                    end_look = min(len(text_content), pos + 120)
                    window = text_content[start_look:end_look].lower()
                    if expansion.lower() in window:
                        is_explained = True
                        break
                if not is_explained:
                    unexplained.append(f"{acr} ('{expansion}')")
            else:
                pattern = rf'({acr}\s*\([^)]+\)|\([^)]+\)\s*{acr})'
                if not re.search(pattern, text_content, re.IGNORECASE) and len(acr) > 2:
                    unexplained.append(acr)
        
        if unexplained:
            deduct_pts = min(5, len(unexplained))
            clarity_score -= deduct_pts
            clarity_breakdown.append(f"Acronym Clarity: Unexplained acronyms found: {', '.join(unexplained)}. Spell them out on first mention (-{deduct_pts} pts)")
        else:
            clarity_breakdown.append("Acronym Clarity: All acronyms are defined or none detected (+0 pts)")
    else:
        clarity_breakdown.append("Empty file or no words found.")

    total_score = struct_score + stats_score + quotes_score + citation_score + clarity_score

    recs = []
    if struct_score < 15:
        recs.append("Format the opening paragraph to be a self-contained definition/summary of 40-90 words (Answer-First).")
        recs.append("Use markdown tables, headers, and bulleted lists to break up dense blocks of text.")
    if stats_score < 20:
        recs.append("Add specific metrics, percentages, dollar values, or dates from studies or reports to support your claims.")
    if quotes_score < 20:
        recs.append("Include direct quotes from experts or industry leaders to increase authority.")
    if citation_score < 20:
        recs.append("Add external hyperlinks to reputable sources and include a 'References' or 'Sources' list.")
    if clarity_score < 18:
        recs.append("Replace ambiguous pronouns ('it', 'they', 'this') with specific nouns (e.g. 'the database', 'this setup').")
        recs.append("Spell out acronyms when they are first used (e.g., 'SaaS (Software as a Service)').")

    if output_format == "json":
        report_data = {
            "file": filepath,
            "total_score": total_score,
            "breakdown": {
                "structure": {
                    "score": struct_score,
                    "max": 20,
                    "details": struct_breakdown
                },
                "statistics": {
                    "score": stats_score,
                    "max": 20,
                    "details": [stats_breakdown]
                },
                "quotations": {
                    "score": quotes_score,
                    "max": 20,
                    "details": [quotes_breakdown]
                },
                "citations": {
                    "score": citation_score,
                    "max": 20,
                    "details": citation_breakdown.split('\n')
                },
                "clarity": {
                    "score": clarity_score,
                    "max": 20,
                    "details": clarity_breakdown
                }
            },
            "recommendations": recs
        }
        print(json.dumps(report_data, indent=2, ensure_ascii=False))
    else:
        print("==================================================")
        print("            GEO OPTIMIZATION AUDIT REPORT         ")
        print("==================================================")
        print(f"File: {filepath}")
        print(f"Total GEO Score: {total_score}/100")
        print("--------------------------------------------------")
        print(f"1. Answer-First & Structure: {struct_score}/20")
        for item in struct_breakdown:
            print(f"   - {item}")
        print("--------------------------------------------------")
        print(f"2. Statistics Density: {stats_score}/20")
        print(f"   - {stats_breakdown}")
        print("--------------------------------------------------")
        print(f"3. Quotation Density: {quotes_score}/20")
        print(f"   - {quotes_breakdown}")
        print("--------------------------------------------------")
        print(f"4. Citation & Authority: {citation_score}/20")
        for item in citation_breakdown.split('\n'):
            print(f"   - {item}")
        print("--------------------------------------------------")
        print(f"5. Semantic Clarity: {clarity_score}/20")
        for item in clarity_breakdown:
            print(f"   - {item}")
        print("==================================================")
        
        print("\nActionable Recommendations:")
        if not recs:
            print("Excellent! This page is fully optimized for generative search engine indexing.")
        else:
            for r in recs:
                print(f"- {r}")
        print("==================================================")
        
    return total_score

def check_robots(robots_path):
    if not os.path.exists(robots_path):
        print(f"Error: robots.txt not found at {robots_path}", file=sys.stderr)
        sys.exit(1)
        
    try:
        with open(robots_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except Exception as e:
        print(f"Error: Failed to read robots.txt: {e}", file=sys.stderr)
        sys.exit(1)
        
    print("==================================================")
    print("            ROBOTS.TXT CRAWLER AUDIT             ")
    print("==================================================")
    
    blocked_agents = []
    lines = content.split('\n')
    current_agents = []

    for line in lines:
        line = line.strip()
        # Blank line starts a new directive block
        if not line:
            current_agents = []
            continue
        if line.startswith('#'):
            continue

        agent_match = re.match(r'^User-agent:\s*(.+)$', line, re.IGNORECASE)
        if agent_match:
            current_agents.append(agent_match.group(1).strip())
            continue

        disallow_match = re.match(r'^Disallow:\s*(.+)$', line, re.IGNORECASE)
        if disallow_match and current_agents:
            disallowed_path = disallow_match.group(1).strip()
            if disallowed_path in ["/", "/*"]:
                for agent in current_agents:
                    blocked_agents.append((agent, disallowed_path))
                
    if blocked_agents:
        print("WARNING: The following AI agents are blocked from crawling your root directory:")
        for agent, path in blocked_agents:
            print(f"  - User-agent: {agent} (Disallow: {path})")
        print("\nNote: Blocking these crawlers prevents AI engines from indexing your content and citing your pages.")
    else:
        print("SUCCESS: No major AI agents or wildcard directives are blocking root access.")
        print("Your content is crawler-friendly for generative search engine indexing.")
    print("==================================================")

def generate_schema_data(filepath, schema_type, config, _content=None):
    if schema_type not in SUPPORTED_SCHEMA_TYPES:
        print(
            f'Error: Unsupported schema type "{schema_type}". '
            "Expected article, faq, or product.",
            file=sys.stderr,
        )
        sys.exit(1)

    # _content is an optional pre-read file body. When provided, the file
    # existence check and read are skipped — the caller (inject_schema) has
    # already read the file once to avoid double I/O.
    content = _content
    if content is None:
        if not os.path.exists(filepath):
            print(f"Error: File {filepath} not found.", file=sys.stderr)
            sys.exit(1)

        try:
            with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
        except Exception as e:
            print(f"Error: Failed to read file {filepath}: {e}", file=sys.stderr)
            sys.exit(1)
        
    # Strip code blocks to prevent title/description contamination
    clean_text = preprocess_content(content)

    # Try markdown H1 first, then HTML <h1>
    title_match = re.search(r'^#\s+(.+)$', clean_text, re.MULTILINE)
    if not title_match:
        title_match = re.search(r'<h1[^>]*>(.+)</h1>', clean_text, re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else "Untitled Document"
    
    intro_match = re.search(r'^#\s+.+?\n\n([^#\n]+)', clean_text, re.DOTALL)
    description = intro_match.group(1).strip() if intro_match else ""
    if len(description) > 150:
        description = description[:147] + "..."
        
    author_info = config.get("author", {})
    pub_info = config.get("publisher", {})
    
    pub_url_value = pub_info.get("url")
    pub_url = pub_url_value.strip().rstrip("/") if isinstance(pub_url_value, str) else ""
    org_id = optional_id(pub_url, "organization")
    author_id = optional_id(pub_url, "author")
    graph_nodes = []

    org_node = None
    if pub_info.get("name") or pub_url:
        org_node = {"@type": "Organization"}
        if org_id:
            org_node["@id"] = org_id
        if pub_info.get("name"):
            org_node["name"] = pub_info["name"]
        if pub_url:
            org_node["url"] = pub_url
        if pub_info.get("logo"):
            org_node["logo"] = {
                "@type": "ImageObject",
                "url": pub_info.get("logo"),
            }
        if org_id:
            graph_nodes.append(org_node)

    author_node = None
    if author_info.get("name"):
        author_node = {
            "@type": "Person",
            "name": author_info["name"],
        }
        if author_id:
            author_node["@id"] = author_id
        if author_info.get("jobTitle"):
            author_node["jobTitle"] = author_info["jobTitle"]
        if author_info.get("sameAs"):
            author_node["sameAs"] = author_info["sameAs"]
        if author_id:
            graph_nodes.append(author_node)

    if schema_type == "article":
        article_node = {
            "@type": "NewsArticle",
            "headline": title,
        }
        article_id = optional_id(pub_url, "article")
        if article_id:
            article_node["@id"] = article_id
        if description:
            article_node["description"] = description
        if config.get("datePublished"):
            article_node["datePublished"] = config["datePublished"]
        if author_node:
            article_node["author"] = reference_or_inline(author_node, author_id)
        if org_node:
            article_node["publisher"] = reference_or_inline(org_node, org_id)
        graph_nodes.append(article_node)
        
        # Robust FAQ extraction using header parsing
        sections = extract_sections(content)
        if sections:
            qa_list = []
            for q, a in sections[:5]:
                # Skip sections with empty content or header metadata
                if len(a) < 15 or q.lower() in ["sources", "references", "citations", "bibliography"]:
                    continue
                # Clean answer markdown to plain text for compliant JSON-LD
                clean_answer = clean_markdown_to_plain_text(a)
                qa_list.append({
                    "@type": "Question",
                    "name": q,
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": clean_answer
                    }
                })
            if qa_list:
                faq_node = {
                    "@type": "FAQPage",
                    "mainEntity": qa_list
                }
                faq_id = optional_id(pub_url, "faq")
                if faq_id:
                    faq_node["@id"] = faq_id
                graph_nodes.append(faq_node)
            
    elif schema_type == "faq":
        sections = extract_sections(content)
        qa_list = []
        for q, a in sections[:5]:
            # Skip sections with empty content or header metadata
            if len(a) < 15 or q.lower() in [
                "sources",
                "references",
                "citations",
                "bibliography",
            ]:
                continue
            # Clean answer markdown to plain text for compliant JSON-LD
            clean_answer = clean_markdown_to_plain_text(a)
            qa_list.append({
                "@type": "Question",
                "name": q,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": clean_answer
                }
            })
        faq_node = {
            "@type": "FAQPage",
            "mainEntity": qa_list
        }
        faq_id = optional_id(pub_url, "faq")
        if faq_id:
            faq_node["@id"] = faq_id
        graph_nodes.append(faq_node)
        
    elif schema_type == "product":
        product_node = {
            "@type": "Product",
            "name": title,
        }
        product_id = optional_id(pub_url, "product")
        if product_id:
            product_node["@id"] = product_id
        if description:
            product_node["description"] = description
        if org_node:
            product_node["brand"] = reference_or_inline(org_node, org_id)

        offer_info = config.get("product", {}).get("offer", {})
        if offer_info.get("price") is not None and offer_info.get("priceCurrency"):
            product_node["offers"] = {
                "@type": "Offer",
                "price": str(offer_info["price"]),
                "priceCurrency": offer_info["priceCurrency"],
            }
            if offer_info.get("availability"):
                product_node["offers"]["availability"] = offer_info["availability"]
            if org_node:
                product_node["offers"]["seller"] = reference_or_inline(org_node, org_id)
        graph_nodes.append(product_node)
        
    return {
        "@context": "https://schema.org",
        "@graph": graph_nodes
    }

def inject_schema(filepath, schema_type, config, dry_run=False, no_branding=False):
    if no_branding:
        entitlement_error = no_branding_error(config)
        if entitlement_error:
            print(f"Error: {entitlement_error}", file=sys.stderr)
            sys.exit(1)

    if not os.path.exists(filepath):
        print(f"Error: File {filepath} not found.", file=sys.stderr)
        sys.exit(1)

    # SEC-01: Validate path is within working directory
    resolved_path = os.path.abspath(filepath)
    cwd = os.path.abspath(os.getcwd())
    if not resolved_path.startswith(cwd + os.sep) and resolved_path != cwd:
        print(
            f"Error: Security restriction — target file {filepath} is outside the current working directory.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Read file once; pass to generate_schema_data to avoid double I/O.
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except Exception as e:
        print(f"Error: Failed to read file {filepath}: {e}", file=sys.stderr)
        sys.exit(1)

    schema = generate_schema_data(filepath, schema_type, config, content)
    # Escape "</" to prevent breaking out of <script> tags when
    # JSON-LD is embedded in HTML (SEC-03).
    schema_json = json.dumps(schema, indent=2, ensure_ascii=False).replace("</", "<\\/")
        
    schema_pattern = r'```json\s*\{\s*"@context":\s*"https://schema\.org".*?\}\s*```'
    script_pattern = r'<script[^>]*type="application/ld\+json"[^>]*>.*?https://schema\.org.*?</script>'
    
    content = strip_tooltician_branding(content)
    sig_md = "" if no_branding else f"\n\n{TOOLTICIAN_BRANDING_MARKDOWN}\n"
    sig_html = "" if no_branding else f"\n{TOOLTICIAN_BRANDING_HTML}\n"
            
    injected_code = f"{sig_md}\n```json\n{schema_json}\n```\n"
    
    if filepath.endswith('.html') or "<html" in content.lower():
        injected_code = f'{sig_html}\n<script type="application/ld+json">\n{schema_json}\n</script>\n'
        if re.search(script_pattern, content, re.DOTALL | re.IGNORECASE):
            # If replacing schema, we only inject HTML signature if not present
            content = re.sub(script_pattern, injected_code.strip(), content, flags=re.DOTALL | re.IGNORECASE)
            print(f"Successfully replaced existing JSON-LD script tag in {filepath}.")
        else:
            if re.search(r'(?i)</head>', content):
                content = re.sub(r'(?i)</head>', f"{injected_code}</head>", content, count=1)
            elif re.search(r'(?i)</body>', content):
                content = re.sub(r'(?i)</body>', f"{injected_code}</body>", content, count=1)
            else:
                content += injected_code
            print(f"Successfully injected JSON-LD script tag into {filepath}.")
    else:
        if re.search(schema_pattern, content, re.DOTALL):
            # If signature needs injection, prepend it to the new block
            content = re.sub(schema_pattern, injected_code.strip(), content, flags=re.DOTALL)
            print(f"Successfully updated existing Schema.org block in markdown file {filepath}.")
        else:
            content += injected_code
            print(f"Successfully appended Schema.org block to markdown file {filepath}.")
            
    if dry_run:
        print("=== DRY RUN: The following would be injected ===")
        print(injected_code)
        print("=== End of dry run preview ===")
        return

    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f"Error: Failed to write to file {filepath}: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="GEO (Generative Engine Optimization) Audit and Helper Tool")
    parser.add_argument("--config", help="Path to geo_config.json configuration file")

    subparsers = parser.add_subparsers(dest="command", help="Subcommand to run")

    # Audit Command
    audit_parser = subparsers.add_parser("audit", help="Audit content for GEO optimization score")
    audit_parser.add_argument("filepaths", nargs="+", help="Path(s) to the markdown or HTML file(s) to audit")
    audit_parser.add_argument("-f", "--format", choices=["text", "json"], default="text", help="Output format")
    audit_parser.add_argument("-t", "--threshold", type=int, default=None, help="Exit with code 1 if score is below threshold")

    # Robots Command
    robots_parser = subparsers.add_parser("robots", help="Audit robots.txt for AI bot block rules")
    robots_parser.add_argument("filepath", help="Path to robots.txt")

    # Schema Command
    schema_parser = subparsers.add_parser("schema", help="Generate JSON-LD schema markup from file content")
    schema_parser.add_argument("filepath", help="Path to markdown or HTML file")
    schema_parser.add_argument("type", choices=["article", "faq", "product"], help="Type of schema to generate")

    # Inject Command
    inject_parser = subparsers.add_parser("inject", help="Generate and inject JSON-LD schema block directly into file")
    inject_parser.add_argument("filepath", help="Path to target markdown or HTML file")
    inject_parser.add_argument("type", choices=["article", "faq", "product"], help="Type of schema to generate")
    inject_parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    inject_parser.add_argument("--backup", action="store_true", help="Create .bak file before modifying")
    inject_parser.add_argument(
        "--no-branding",
        action="store_true",
        help="Remove Tooltician branding (Pro license required)",
    )

    config_parser = subparsers.add_parser(
        "config", help="Manage local geo-opt preferences"
    )
    config_parser.add_argument("action", choices=["get", "set"])
    config_parser.add_argument("setting", choices=["reminders"])
    config_parser.add_argument("value", nargs="?", choices=["true", "false"])

    args = parser.parse_args()

    config, config_path = load_config(args.config)

    if args.command == "audit":
        results = []
        for fp in args.filepaths:
            score = audit_file(fp, config, args.format)
            results.append((fp, score))

        if args.threshold is not None:
            failures = [(fp, s) for fp, s in results if s < args.threshold]
            if failures:
                print(f"\nThreshold not met for {len(failures)} file(s):", file=sys.stderr)
                for fp, s in failures:
                    print(f"  {fp}: {s}/100 (threshold: {args.threshold})", file=sys.stderr)
                sys.exit(1)
            print(f"\nAll {len(results)} file(s) meet threshold {args.threshold}/100.")

    elif args.command == "robots":
        check_robots(args.filepath)
    elif args.command == "schema":
        schema = generate_schema_data(args.filepath, args.type, config)
        print(json.dumps(schema, indent=2, ensure_ascii=False))
    elif args.command == "inject":
        dry_run = args.dry_run or False
        backup = args.backup or False
        no_branding = args.no_branding or False

        if no_branding:
            entitlement_error = no_branding_error(config)
            if entitlement_error:
                print(f"Error: {entitlement_error}", file=sys.stderr)
                sys.exit(1)

        if backup and not dry_run:
            backup_path = args.filepath + ".bak"
            try:
                import shutil
                shutil.copy2(args.filepath, backup_path)
                print(f"Backup created: {backup_path}")
            except Exception as e:
                print(f"Error: Failed to create backup {backup_path}: {e}", file=sys.stderr)
                sys.exit(1)

        inject_schema(
            args.filepath,
            args.type,
            config,
            dry_run=dry_run,
            no_branding=no_branding,
        )
        if not dry_run:
            record_successful_free_injection(config)
    elif args.command == "config":
        if args.action == "get":
            print("true" if reminders_are_enabled() else "false")
        else:
            if args.value is None:
                config_parser.error("set reminders requires true or false")
            enabled = args.value == "true"
            if not set_reminders_enabled(enabled):
                print(
                    "Error: Could not save the local reminder preference.",
                    file=sys.stderr,
                )
                sys.exit(1)
            print(f"Support reminders {'enabled' if enabled else 'disabled'}.")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
