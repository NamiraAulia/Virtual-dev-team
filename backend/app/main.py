from __future__ import annotations

"""
Autonomous AI Virtual Dev Team — Backend Entry Point.

FastAPI application with CORS, API routes, Sentry error monitoring, and health check.
"""

import logging
import os

# pyrefly: ignore [missing-import]
import sentry_sdk
# pyrefly: ignore [missing-import]
from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware

from app.presentation.api_v1.tasks import router as tasks_router
from app.presentation.api_v1.webhooks.sentry import router as sentry_router

# Initialize Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

sentry_sdk.init(
    dsn="https://c69f262da61e3b6f3aa67ed11e74fb4c@o4512059961442304.ingest.us.sentry.io/4512059977498624",
    send_default_pii=True,
    traces_sample_rate=1.0,
    debug=False,
)

# FastAPI Application
app = FastAPI(
    title="Autonomous AI Dev Engine",
    description="Sprint 3 Autonomous Platform with Human-in-the-Loop",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routes
app.include_router(tasks_router)
app.include_router(sentry_router)



@app.get("/health")
@app.get("/api/v1/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "message": "Backend engine is running"}


@app.get("/sentry-debug")
async def trigger_error():
    """Debug endpoint to test Sentry error tracking."""
    # pyrefly: ignore [division-by-zero]
    division_by_zero = 1 / 0
    return {"result": division_by_zero}