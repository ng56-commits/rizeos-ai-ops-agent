"""
Feedback Logger.

Every time a human manually overrides a case (marks it resolved or
escalates it), that action gets logged here. This is what turns the
Playbook page from a static mockup into something backed by real
accumulated history — it grows as the ops team actually uses the system.

Kept in-memory for the hackathon MVP (resets when the server restarts).
In production this would be a table, matching the "Feedback Logger
(updates playbook)" box in the architecture diagram.
"""

from datetime import datetime
from typing import Literal

_log: list[dict] = []


def log_override(finding_id: str, finding_type: str, action: Literal["resolved", "escalated"], note: str = ""):
    _log.append({
        "finding_id": finding_id,
        "finding_type": finding_type,
        "action": action,
        "note": note,
        "timestamp": datetime.utcnow().isoformat(),
    })


def get_log() -> list[dict]:
    return list(reversed(_log))  # most recent first


def get_pattern_summary() -> list[dict]:
    """Group the log by finding_type to show how often each pattern has been handled."""
    counts: dict[str, int] = {}
    for entry in _log:
        counts[entry["finding_type"]] = counts.get(entry["finding_type"], 0) + 1
    return [{"pattern": k, "times_handled": v} for k, v in counts.items()]