from __future__ import annotations

import os
import sys

# Add backend directory to sys.path so 'app' package is discoverable
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# pyrefly: ignore [missing-import]
from app.main import app  # noqa: E402
