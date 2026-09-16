from __future__ import annotations

import re
from typing import Any, Optional

class DataSanitizer:
    """
    Local Regex-based Data Sanitizer to scrub PII, secrets, and credentials
    BEFORE payload touches LLMs or persistent task stores.
    Cost: 0 LLM tokens | Latency: < 5ms.
    """

    PATTERNS = [
        # 1. Bearer / Authorization Tokens
        (re.compile(r"(?i)bearer\s+[a-zA-Z0-9_\-\.]{15,}", re.IGNORECASE), "Bearer [REDACTED_TOKEN]"),
        
        # 2. Common AI & Provider API Keys (OpenAI, Gemini, GitHub, AWS, Stripe)
        (re.compile(r"sk-[a-zA-Z0-9_\-]{20,}", re.IGNORECASE), "[REDACTED_OPENAI_KEY]"),
        (re.compile(r"AIza[0-9A-Za-z\-_]{30,}", re.IGNORECASE), "[REDACTED_GEMINI_KEY]"),
        (re.compile(r"(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{30,}", re.IGNORECASE), "[REDACTED_GITHUB_TOKEN]"),
        (re.compile(r"AKIA[0-9A-Z]{16}", re.IGNORECASE), "[REDACTED_AWS_KEY]"),
        (re.compile(r"rk_live_[a-zA-Z0-9]{24,}", re.IGNORECASE), "[REDACTED_STRIPE_KEY]"),
        
        # 3. JWT Tokens (Format: xxx.yyy.zzz)
        (re.compile(r"eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+"), "[REDACTED_JWT_TOKEN]"),

        # 4. Database Connection Strings (Postgres, MySQL, MongoDB, Redis)
        (re.compile(r"(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s\'\"]+"), r"\1://[REDACTED_DB_CREDENTIALS]"),

        # 5. Key-Value Pairs for Passwords / Secrets in logs or query params
        (re.compile(r"(?i)(password|passwd|secret|token|api_key|client_secret|auth)\s*[:=]\s*['\"]?[^'\",\s]+['\"]?"), r"\1=[REDACTED]"),

        # 6. User Emails (PII)
        (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b"), "[REDACTED_EMAIL]"),

        # 7. Credit Card Numbers
        (re.compile(r"\b(?:\d[ -]*?){13,16}\b"), "[REDACTED_CARD_NUMBER]"),
    ]

    @classmethod
    def sanitize_text(cls, text: str | None) -> str:
        """Sanitizes sensitive patterns from a string."""
        if not text:
            return ""
        
        cleaned = text
        for pattern, replacement in cls.PATTERNS:
            cleaned = pattern.sub(replacement, cleaned)
        return cleaned

    @classmethod
    def sanitize_dict(cls, data: dict[str, Any]) -> dict[str, Any]:
        """Recursively sanitizes values in a dictionary."""
        sanitized = {}
        for key, value in data.items():
            # Check key name directly (e.g. headers, cookies)
            if any(sensitive in key.lower() for sensitive in ["cookie", "authorization", "password", "secret", "token"]):
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, str):
                sanitized[key] = cls.sanitize_text(value)
            elif isinstance(value, dict):
                sanitized[key] = cls.sanitize_dict(value)
            elif isinstance(value, list):
                sanitized[key] = [
                    cls.sanitize_dict(item) if isinstance(item, dict)
                    else cls.sanitize_text(item) if isinstance(item, str)
                    else item
                    for item in value
                ]
            else:
                sanitized[key] = value
        return sanitized
