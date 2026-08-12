"""
RizeOS AI Ops Agent — backend entry point.

Day 1 scope: expose the mock platform data and the Monitor Agent's
findings over a real API. Day 2 will add the Diagnostic Agent (Groq +
LangGraph) that takes these findings and reasons about them.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Literal, Optional

from app.mock_data import get_payments, get_verifications, get_applications
from app.monitor_agent import run_monitor
from app.diagnostic_agent import diagnose_finding, ask_about_case
from app.feedback_logger import log_override, get_log, get_pattern_summary

app = FastAPI(title="RizeOS AI Ops Agent", version="0.1.0")

# Allow the React dashboard (running on a different port) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this before any real deployment
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "ok", "service": "rizeos-ai-ops-agent"}


@app.get("/data/payments")
def payments():
    return get_payments()


@app.get("/data/verifications")
def verifications():
    return get_verifications()


@app.get("/data/applications")
def applications():
    return get_applications()


@app.get("/findings")
def findings():
    """
    Everything the Monitor Agent has flagged as worth looking into.
    This is what the Diagnostic Agent consumes next.
    """
    return run_monitor()


@app.get("/cases")
def cases():
    """
    The full pipeline: Monitor -> Diagnose -> Route, for every current
    Finding. This is what the dashboard calls, including on manual
    "re-scan" — every call genuinely re-runs the live pipeline.
    """
    all_findings = run_monitor()
    results = []
    for f in all_findings:
        diagnosis_result = diagnose_finding(f.model_dump(mode="json"))
        results.append({
            "finding": f.model_dump(mode="json"),
            **diagnosis_result,
        })
    return results


class OverrideRequest(BaseModel):
    finding_id: str
    finding_type: str
    action: Literal["resolved", "escalated"]
    note: Optional[str] = ""


@app.post("/cases/override")
def override_case(body: OverrideRequest):
    """
    A human manually marks a case resolved or escalated, overriding (or
    confirming) what the agent decided. This is the real Feedback Logger
    from the architecture diagram — it's what the Playbook page reads from.
    """
    log_override(body.finding_id, body.finding_type, body.action, body.note)
    return {"status": "logged"}


class AskRequest(BaseModel):
    finding: dict
    diagnosis: dict
    question: str


@app.post("/cases/ask")
def ask_case(body: AskRequest):
    """A human asks a follow-up question about a specific case's diagnosis."""
    return ask_about_case(body.finding, body.diagnosis, body.question)


@app.get("/playbook")
def playbook():
    """
    Real accumulated history of human overrides, grouped into patterns.
    Grows as the ops team actually uses the system — not hardcoded.
    """
    return {
        "log": get_log(),
        "patterns": get_pattern_summary(),
    }