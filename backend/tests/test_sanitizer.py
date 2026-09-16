from __future__ import annotations

import unittest
from app.infrastructure.security.sanitizer import DataSanitizer


class TestDataSanitizer(unittest.TestCase):
    """Unit tests to verify security & PII data scrubbing capabilities."""

    def test_sanitize_bearer_token(self):
        text = "Authorization header contains Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcLEOsqWTCGh6EFGU"
        cleaned = DataSanitizer.sanitize_text(text)
        self.assertNotIn("eyJhbGci", cleaned)
        self.assertIn("Bearer [REDACTED_TOKEN]", cleaned)

    def test_sanitize_api_keys(self):
        sample = (
            "OpenAI sk-proj-1234567890abcdefghijklmn and "
            "Gemini AIzaSyAbcdEfgh1234567890AbcdEfgh12345 and "
            "GitHub ghp_1234567890abcdefghijklmnopqrstuvwxyz"
        )
        cleaned = DataSanitizer.sanitize_text(sample)
        self.assertNotIn("sk-proj-1234567890", cleaned)
        self.assertNotIn("AIzaSyAbcd", cleaned)
        self.assertNotIn("ghp_1234567890", cleaned)
        self.assertIn("[REDACTED_OPENAI_KEY]", cleaned)
        self.assertIn("[REDACTED_GEMINI_KEY]", cleaned)
        self.assertIn("[REDACTED_GITHUB_TOKEN]", cleaned)

    def test_sanitize_db_connection_strings(self):
        log_line = "Failed to connect to postgresql://postgres:SuperSecret2026@db.supabase.co:5432/postgres"
        cleaned = DataSanitizer.sanitize_text(log_line)
        self.assertNotIn("SuperSecret2026", cleaned)
        self.assertIn("postgresql://[REDACTED_DB_CREDENTIALS]", cleaned)

    def test_sanitize_email_and_passwords(self):
        log = "Crash for user email=john.doe@company.org with password='MySecretPassword!'"
        cleaned = DataSanitizer.sanitize_text(log)
        self.assertNotIn("john.doe@company.org", cleaned)
        self.assertNotIn("MySecretPassword!", cleaned)
        self.assertIn("[REDACTED_EMAIL]", cleaned)
        self.assertIn("password=[REDACTED]", cleaned)

    def test_sanitize_nested_dict(self):
        payload = {
            "title": "Error in auth service",
            "headers": {
                "Authorization": "Bearer secret_token_123456789",
                "Cookie": "session_id=abcdef12345",
            },
            "user": {
                "email": "alice@example.com",
                "api_key": "sk-1234567890123456789012345",
            },
            "metadata": ["User alice@example.com triggered crash", 100],
        }
        sanitized = DataSanitizer.sanitize_dict(payload)
        self.assertEqual(sanitized["headers"]["Authorization"], "[REDACTED]")
        self.assertEqual(sanitized["headers"]["Cookie"], "[REDACTED]")
        self.assertEqual(sanitized["user"]["email"], "[REDACTED_EMAIL]")
        self.assertNotIn("sk-12345", sanitized["user"]["api_key"])
        self.assertIn("[REDACTED_EMAIL]", sanitized["metadata"][0])
        self.assertEqual(sanitized["metadata"][1], 100)


if __name__ == "__main__":
    unittest.main()
