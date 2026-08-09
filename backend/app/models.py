"""
Data models for the RizeOS AI Ops Agent.

These represent the shape of platform data the Monitor Agent scans,
and the "finding" it produces when something looks stuck or anomalous.
"""

from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class Payment(BaseModel):
    id: str
    freelancer_name: str
    amount: float
    status: Literal["sent", "pending", "failed"]
    sent_at: datetime
    recipient_account_last4: str
    verified_profile_account_last4: str


class Verification(BaseModel):
    id: str
    employer_name: str
    submitted_at: datetime
    queue_position: int
    document_type: Literal["scan", "photo"]
    ocr_confidence: float  # 0-1


class Application(BaseModel):
    id: str
    candidate_name: str
    employer_name: str
    submitted_at: datetime
    employer_last_active_days_ago: int
    viewed_by_employer: bool


class Finding(BaseModel):
    """A case the Monitor Agent has flagged as worth looking into."""
    id: str
    type: Literal["payment_stuck", "verification_stuck", "application_stuck"]
    source_id: str  # id of the Payment / Verification / Application
    summary: str
    detected_at: datetime
    raw_data: dict  # the underlying record, for the Diagnostic Agent to reason over later