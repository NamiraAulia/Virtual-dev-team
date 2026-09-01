"""
Autonomous AI Virtual Dev Team — Backend Entry Point.

FastAPI application with CORS, API routes, and health check.
"""

import logging

# pyrefly: ignore [missing-import]
from fastapi import FastAPI

# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware

from app.presentation.api_v1.tasks import router as tasks_router

#  Logging                                                           
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

#  App                                                               

app = FastAPI(
    title="Autonomous AI Dev Engine",
    description="AI-powered autonomous code maintenance platform with Human-in-the-Loop approval.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


#  Routes                                                            

app.include_router(tasks_router)


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "message": "Backend engine is running"}