"""
Mock platform data layer.

In production this would query RizeOS's real database. For the hackathon
MVP, we generate realistic synthetic records with a deliberate mix of
normal cases and edge cases (delays, mismatches, ambiguous situations) so
the Monitor Agent has something real to catch.
"""

from datetime import datetime, timedelta
from app.models import Payment, Verification, Application

NOW = datetime(2026, 8, 10, 12, 0, 0)


def get_payments() -> list[Payment]:
    return [
        # Normal case: sent recently, will resolve itself
        Payment(
            id="PAY-1001",
            freelancer_name="Meera S.",
            amount=8000,
            status="sent",
            sent_at=NOW - timedelta(hours=6),
            recipient_account_last4="4281",
            verified_profile_account_last4="4281",
        ),
        # Edge case: account mismatch, funds likely misrouted
        Payment(
            id="PAY-1002",
            freelancer_name="Ravi K.",
            amount=15000,
            status="sent",
            sent_at=NOW - timedelta(days=3),
            recipient_account_last4="4821",
            verified_profile_account_last4="4281",
        ),
        # Normal case: standard bank delay, matches known pattern
        Payment(
            id="PAY-1003",
            freelancer_name="Arjun P.",
            amount=5200,
            status="sent",
            sent_at=NOW - timedelta(days=1, hours=10),
            recipient_account_last4="9012",
            verified_profile_account_last4="9012",
        ),
        # Failed payment — should always escalate
        Payment(
            id="PAY-1004",
            freelancer_name="Divya N.",
            amount=3000,
            status="failed",
            sent_at=NOW - timedelta(hours=2),
            recipient_account_last4="5567",
            verified_profile_account_last4="5567",
        ),
    ]


def get_verifications() -> list[Verification]:
    return [
        # Normal: within queue SLA
        Verification(
            id="VER-2001",
            employer_name="Fatima N. Studio",
            submitted_at=NOW - timedelta(hours=20),
            queue_position=5,
            document_type="scan",
            ocr_confidence=0.97,
        ),
        # Edge case: stuck past SLA, low OCR confidence — needs a human
        Verification(
            id="VER-2002",
            employer_name="Aditya R. Ventures",
            submitted_at=NOW - timedelta(days=5),
            queue_position=3,
            document_type="photo",
            ocr_confidence=0.41,
        ),
    ]


def get_applications() -> list[Application]:
    return [
        # Edge case: inactive employer, not a platform issue
        Application(
            id="APP-3001",
            candidate_name="Fatima N.",
            employer_name="Nexora Labs",
            submitted_at=NOW - timedelta(days=4),
            employer_last_active_days_ago=6,
            viewed_by_employer=False,
        ),
        # Normal: recently submitted, employer active
        Application(
            id="APP-3002",
            candidate_name="Kabir S.",
            employer_name="BrightWorks",
            submitted_at=NOW - timedelta(hours=5),
            employer_last_active_days_ago=0,
            viewed_by_employer=True,
        ),
    ]

















































