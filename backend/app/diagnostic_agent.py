"""
Diagnostic Agent (Day 2 — the real AI/LLM pipeline).

Takes a Finding from the Monitor Agent and reasons about *why* it
happened, using Groq (Llama 3.1). The model is required to:
  1. Cite which specific field in the raw data supports its conclusion
     (this is the hallucination mitigation strategy — no explanation is
     allowed unless it's tied to something actually in the data)
  2. Output a confidence score

The Confidence Router then decides: auto-resolve, or escalate to a
human. This whole flow is modeled as an explicit LangGraph state
machine (diagnose -> route), not a single freeform prompt.

Basic error handling lives here for Day 2; Day 3 hardens it further
(retries, timeouts, latency logging).
"""

import os
import json
from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END
from groq import Groq
from dotenv import load_dotenv

load_dotenv()  # reads GROQ_API_KEY from backend/.env into the environment

GROQ_MODEL = "llama-3.1-8b-instant"
CONFIDENCE_THRESHOLD = 70

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

SYSTEM_PROMPT = """You are a diagnostic agent for RizeOS, a hiring/freelance/payments platform.

You will be given a "Finding" — a case flagged as stuck or anomalous — along with
the raw underlying data. Your job is to diagnose the most likely cause.

Rules you MUST follow:
- You may only state a cause if you can point to a specific field in the raw data
  that supports it. Never invent a reason that isn't backed by the data given.
- If the data doesn't clearly support any single explanation, say so honestly
  and lower your confidence score instead of guessing.
- Respond with ONLY valid JSON in this exact shape, nothing else:

{
  "likely_cause": "short plain-English explanation",
  "supporting_evidence": "the specific field(s)/values from raw_data that support this",
  "confidence": <integer 0-100>
}
"""


class DiagnosticState(TypedDict):
    finding: dict
    diagnosis: Optional[dict]
    decision: Optional[str]
    error: Optional[str]


def diagnose_node(state: DiagnosticState) -> DiagnosticState:
    finding = state["finding"]
    user_prompt = (
        f"Finding type: {finding['type']}\n"
        f"Summary: {finding['summary']}\n"
        f"Raw data: {json.dumps(finding['raw_data'])}\n\n"
        "Diagnose this."
    )

    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
            timeout=10,
        )
        raw_output = response.choices[0].message.content
        diagnosis = json.loads(raw_output)

        # sanity-check the shape before trusting it
        assert "likely_cause" in diagnosis
        assert "confidence" in diagnosis
        assert 0 <= int(diagnosis["confidence"]) <= 100

        state["diagnosis"] = diagnosis
        state["error"] = None

    except Exception as e:
        # Model call failed, timed out, or returned malformed output.
        # Fail safe: no diagnosis, confidence 0 -> router will escalate.
        state["diagnosis"] = {
            "likely_cause": "Unable to confidently diagnose — model call failed or returned invalid output.",
            "supporting_evidence": "none (error during diagnosis)",
            "confidence": 0,
        }
        state["error"] = str(e)

    return state


def route_node(state: DiagnosticState) -> DiagnosticState:
    confidence = state["diagnosis"]["confidence"]
    state["decision"] = "auto_resolve" if confidence >= CONFIDENCE_THRESHOLD else "escalate"
    return state


def build_graph():
    graph = StateGraph(DiagnosticState)
    graph.add_node("diagnose", diagnose_node)
    graph.add_node("route", route_node)
    graph.set_entry_point("diagnose")
    graph.add_edge("diagnose", "route")
    graph.add_edge("route", END)
    return graph.compile()


_diagnostic_graph = build_graph()


def diagnose_finding(finding: dict) -> dict:
    """Run a single Finding through the full diagnose -> route pipeline."""
    result = _diagnostic_graph.invoke({
        "finding": finding, "diagnosis": None, "decision": None, "error": None
    })
    return {
        "finding_id": finding["id"],
        "diagnosis": result["diagnosis"],
        "decision": result["decision"],
        "error": result["error"],
    }