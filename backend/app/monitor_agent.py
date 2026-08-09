"""
Monitor Agent (Day 1 — rule-based, no LLM yet).

This is the "watching" layer described in the architecture doc: it scans
platform data for patterns that look stuck or anomalous, and turns them
into Findings. The Diagnostic Agent (Day 2, Groq + LangGraph) will later
take these Findings and reason about *why* they happened.

Kept deliberately rule-based here — the AI Track requirement is a working
AI/LLM pipeline for *diagnosis*, not for detection. Using simple rules for
detection is honest engineering, not a shortcut.
"""

from datetime import datetime
from app.models import Finding
from app.mock_data import get_payments, get_verifications, get_applications

NOW = datetime(2026, 8, 10, 12, 0, 0)

PAYMENT_STUCK_HOURS = 48
VERIFICATION_STUCK_HOURS = 72


def scan_payments() -> list[Finding]:
    findings = []
    for p in get_payments():
        hours_since_sent = (NOW - p.sent_at).total_seconds() / 3600

        if p.status == "failed":
            findings.append(Finding(
                id=f"FIND-{p.id}",
                type="payment_stuck",
                source_id=p.id,
                summary=f"Payment {p.id} failed outright for {p.freelancer_name}",
                detected_at=NOW,
                raw_data=p.model_dump(mode="json"),
            ))
        elif p.status == "sent" and hours_since_sent > PAYMENT_STUCK_HOURS:
            findings.append(Finding(
                id=f"FIND-{p.id}",
                type="payment_stuck",
                source_id=p.id,
                summary=f"Payment {p.id} sent {int(hours_since_sent)}h ago, still unconfirmed",
                detected_at=NOW,
                raw_data=p.model_dump(mode="json"),
            ))
    return findings


def scan_verifications() -> list[Finding]:
    findings = []
    for v in get_verifications():
        hours_since_submit = (NOW - v.submitted_at).total_seconds() / 3600
        if hours_since_submit > VERIFICATION_STUCK_HOURS:
            findings.append(Finding(
                id=f"FIND-{v.id}",
                type="verification_stuck",
                source_id=v.id,
                summary=f"Verification {v.id} stuck in queue {int(hours_since_submit)}h (position {v.queue_position})",
                detected_at=NOW,
                raw_data=v.model_dump(mode="json"),
            ))
    return findings


def scan_applications() -> list[Finding]:
    findings = []
    for a in get_applications():
        days_since_submit = (NOW - a.submitted_at).days
        if not a.viewed_by_employer and days_since_submit >= 3:
            findings.append(Finding(
                id=f"FIND-{a.id}",
                type="application_stuck",
                source_id=a.id,
                summary=f"Application {a.id} unviewed for {days_since_submit} days",
                detected_at=NOW,
                raw_data=a.model_dump(mode="json"),
            ))
    return findings


def run_monitor() -> list[Finding]:
    """Entry point: scan everything, return every finding worth diagnosing."""
    return scan_payments() + scan_verifications() + scan_applications()