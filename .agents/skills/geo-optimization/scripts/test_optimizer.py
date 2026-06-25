#!/usr/bin/env python3
import unittest
import os
import tempfile
import sys
import json
from datetime import datetime, timezone
from io import StringIO

# Add current directory to path to import script
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from geo_optimizer import (
    calculate_readability,
    audit_file,
    check_robots,
    generate_schema_data,
    has_pro_entitlement,
    inject_schema,
    load_config,
    read_engagement_state,
    record_successful_free_injection,
    reminders_are_enabled,
    set_reminders_enabled,
)

class TestGeoOptimizer(unittest.TestCase):
    
    def setUp(self):
        self.held_stdout = StringIO()
        sys.stdout = self.held_stdout
        self.config = {
            "author": {
                "name": "Carlos Ortega González",
                "jobTitle": "Sr. Software Automation and Data Analyst",
                "sameAs": "https://www.linkedin.com/in/cortega26/"
            },
            "publisher": {
                "name": "Tooltician",
                "url": "https://www.tooltician.com",
                "logo": "https://www.tooltician.com/logo.png"
            },
            "acronyms": {
                "AWS": "Amazon Web Services",
                "GDPR": "General Data Protection Regulation"
            },
            "product": {
                "offer": {
                    "price": "49.00",
                    "priceCurrency": "USD",
                    "availability": "https://schema.org/InStock"
                }
            }
        }
        
    def tearDown(self):
        sys.stdout = sys.__stdout__

    def test_calculate_readability(self):
        text = "This is a simple sentence. Here is another sentence containing more words."
        word_count, avg_len = calculate_readability(text)
        self.assertEqual(word_count, 12)
        self.assertEqual(avg_len, 6.0)

    def test_check_robots_blocking(self):
        with tempfile.NamedTemporaryFile(mode='w+', suffix='.txt', delete=False) as temp:
            temp.write("User-agent: GPTBot\nDisallow: /\nUser-agent: *\nDisallow: /private\n")
            temp_path = temp.name
            
        try:
            check_robots(temp_path)
            output = self.held_stdout.getvalue()
            self.assertIn("WARNING: The following AI agents are blocked", output)
            self.assertIn("GPTBot", output)
        finally:
            os.remove(temp_path)

    def test_check_robots_allowing(self):
        with tempfile.NamedTemporaryFile(mode='w+', suffix='.txt', delete=False) as temp:
            temp.write("User-agent: *\nDisallow: /admin\n")
            temp_path = temp.name
            
        try:
            check_robots(temp_path)
            output = self.held_stdout.getvalue()
            self.assertIn("SUCCESS: No major AI agents or wildcard directives are blocking", output)
        finally:
            os.remove(temp_path)

    def test_generate_schema_data_article(self):
        with tempfile.NamedTemporaryFile(mode='w+', suffix='.md', delete=False) as temp:
            temp.write("# Test Headline\n\nThis is the introductory paragraph that acts as the description.")
            temp_path = temp.name
            
        try:
            schema = generate_schema_data(temp_path, "article", self.config)
            self.assertEqual(schema["@context"], "https://schema.org")
            self.assertIn("@graph", schema)
            
            # Find NewsArticle in graph
            article = next(x for x in schema["@graph"] if x["@type"] == "NewsArticle")
            self.assertEqual(article["headline"], "Test Headline")
            self.assertEqual(article["author"]["@id"], "https://www.tooltician.com/#author")
            
            # Find Person in graph
            person = next(x for x in schema["@graph"] if x["@type"] == "Person")
            self.assertEqual(person["name"], "Carlos Ortega González")
        finally:
            os.remove(temp_path)

    def test_audit_json_format(self):
        with tempfile.NamedTemporaryFile(mode='w+', suffix='.md', delete=False) as temp:
            temp.write("# Test Title\n\nThis is a short intro. It has GDPR in it but AWS is not defined here.\n\n- Bullet 1\n- Bullet 2\n")
            temp_path = temp.name
            
        try:
            audit_file(temp_path, self.config, output_format="json")
            output_str = self.held_stdout.getvalue()
            report = json.loads(output_str)
            self.assertIn("total_score", report)
            self.assertEqual(report["file"], temp_path)
            self.assertIn("acronyms", report["breakdown"]["clarity"]["details"][-1])
        finally:
            os.remove(temp_path)

    def test_inject_schema_markdown(self):
        # Create temp file inside CWD to pass path traversal guard
        fd, temp_path = tempfile.mkstemp(suffix='.md', dir=os.getcwd())
        with os.fdopen(fd, 'w') as f:
            f.write("# Test Markdown File\n\nThis is the content.")

        try:
            inject_schema(temp_path, "article", self.config)
            with open(temp_path, 'r', encoding='utf-8') as f:
                updated_content = f.read()
            self.assertIn("```json", updated_content)
            self.assertIn("Carlos Ortega González", updated_content)
            self.assertIn("Tooltician", updated_content)
        finally:
            os.remove(temp_path)

    def test_unconfigured_schema_omits_identity_and_offer_claims(self):
        with tempfile.NamedTemporaryFile(mode='w+', suffix='.md', delete=False) as temp:
            temp.write("# Independent Article\n\nIndependent body text.")
            temp_path = temp.name

        try:
            article_schema = generate_schema_data(temp_path, "article", {})
            self.assertEqual(
                [node["@type"] for node in article_schema["@graph"]],
                ["NewsArticle"],
            )
            article = article_schema["@graph"][0]
            self.assertNotIn("author", article)
            self.assertNotIn("publisher", article)
            self.assertNotIn("datePublished", article)

            product_schema = generate_schema_data(temp_path, "product", {})
            product = next(
                node for node in product_schema["@graph"]
                if node["@type"] == "Product"
            )
            self.assertNotIn("brand", product)
            self.assertNotIn("offers", product)
        finally:
            os.remove(temp_path)

    def test_no_branding_requires_local_pro_key(self):
        valid_key = "tt_pro_1234567890abcdefghij"
        self.assertFalse(has_pro_entitlement({}))
        self.assertTrue(has_pro_entitlement({"license": {"key": valid_key}}))

        fd, temp_path = tempfile.mkstemp(suffix='.md', dir=os.getcwd())
        with os.fdopen(fd, 'w') as f:
            f.write("# Independent Article\n\nIndependent body text.")

        original_key = os.environ.get("TOOLTICIAN_LICENSE_KEY")
        try:
            inject_schema(temp_path, "article", {})
            with open(temp_path, 'r', encoding='utf-8') as f:
                branded_content = f.read()
            self.assertIn("Optimized with [Tooltician]", branded_content)

            os.environ["TOOLTICIAN_LICENSE_KEY"] = valid_key
            inject_schema(temp_path, "article", {}, no_branding=True)
            with open(temp_path, 'r', encoding='utf-8') as f:
                updated_content = f.read()
            self.assertIn("```json", updated_content)
            self.assertNotIn("Tooltician", updated_content)
            self.assertNotIn("Carlos Ortega", updated_content)
        finally:
            if original_key is None:
                os.environ.pop("TOOLTICIAN_LICENSE_KEY", None)
            else:
                os.environ["TOOLTICIAN_LICENSE_KEY"] = original_key
            os.remove(temp_path)

    def test_support_reminders_are_infrequent_and_disableable(self):
        class TtyBuffer(StringIO):
            def isatty(self):
                return True

        with tempfile.TemporaryDirectory() as state_directory:
            state_path = os.path.join(state_directory, "state.json")
            stderr = TtyBuffer()
            first_run = datetime(2026, 1, 1, tzinfo=timezone.utc)

            for _ in range(9):
                result = record_successful_free_injection(
                    {},
                    state_path=state_path,
                    env={},
                    stderr=stderr,
                    now=first_run,
                )
                self.assertFalse(result["shown"])

            result = record_successful_free_injection(
                {},
                state_path=state_path,
                env={},
                stderr=stderr,
                now=first_run,
            )
            self.assertTrue(result["shown"])
            self.assertIn("config set reminders false", stderr.getvalue())

            self.assertTrue(set_reminders_enabled(False, state_path, {}))
            self.assertFalse(reminders_are_enabled(state_path, {}))
            disabled = record_successful_free_injection(
                {},
                state_path=state_path,
                env={},
                stderr=stderr,
                now=datetime(2026, 3, 1, tzinfo=timezone.utc),
            )
            self.assertEqual(disabled["reason"], "disabled")

            self.assertTrue(set_reminders_enabled(True, state_path, {}))
            automated = record_successful_free_injection(
                {},
                state_path=state_path,
                env={"CI": "true"},
                stderr=stderr,
                now=datetime(2026, 3, 1, tzinfo=timezone.utc),
            )
            self.assertEqual(automated["reason"], "suppressed")
            self.assertTrue(
                read_engagement_state(state_path, {})["remindersEnabled"]
            )

if __name__ == "__main__":
    unittest.main()
