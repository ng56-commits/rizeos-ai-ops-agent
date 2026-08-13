"""
Diagnostic Agent.

Takes a Finding from the Monitor Agent and reasons about *why* it
happened, using Groq (Llama 3.1). The model is required to:
  1. Cite which specific field in the raw data supports its conclusion
     (this is the hallucination mitigation strategy — no explanation is
     allowed unless it's tied to something actually in the data)
  2. Output a confidence score

The Confidence Router then decides: auto-resolve, or escalate to a
human. This whole flow is modeled as an explicit LangGraph state
machine (diagnose -> route), not a single freeform prompt.

Day 3 hardening (this file): retry with exponential backoff on
transient failures, a hard timeout so one slow call can't hang the
pipeline, and latency tracking on every call so slowness is visible
instead of silent.
"""

import os
import json
import time
import logging
from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END
from groq import Groq, APIError, APITimeoutError, APIConnectionError
from dotenv import load_dotenv

load_dotenv()  # reads GROQ_API_KEY from backend/.env into the environment

logger = logging.getLogger("diagnostic_agent")
logging.basicConfig(level=logging.INFO)

GROQ_MODEL = "llama-3.1-8b-instant"
CONFIDENCE_THRESHOLD = 70
REQUEST_TIMEOUT_SECONDS = 10
MAX_RETRIES = 2  # total attempts = 1 + MAX_RETRIES
BACKOFF_BASE_SECONDS = 1.5  # attempt 1 waits ~1.5s, attempt 2 waits ~3s

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def _call_groq_with_retry(messages: list, **kwargs) -> tuple[Optional[str], float, int, Optional[str]]:
    """
    Shared retry-with-backoff wrapper around a Groq chat completion call.

    Returns (content, latency_ms, attempts_used, error_message).
    content is None if every attempt failed — caller decides the fallback.

    Retries only on transient failures (timeout, connection issues, 5xx).
    Does NOT retry on things like a bad API key or malformed request —
    retrying those just wastes time and hits the same wall again.
    """
    last_error = None
    start = time.perf_counter()

    for attempt in range(1, MAX_RETRIES + 2):  # e.g. MAX_RETRIES=2 -> attempts 1,2,3
        try:
            response = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                timeout=REQUEST_TIMEOUT_SECONDS,
                **kwargs,
            )
            latency_ms = round((time.perf_counter() - start) * 1000, 1)
            return response.choices[0].message.content, latency_ms, attempt, None

        except (APITimeoutError, APIConnectionError) as e:
            # Transient — worth retrying
            last_error = str(e)
            logger.warning(f"Groq call attempt {attempt} failed (transient): {last_error}")
            if attempt <= MAX_RETRIES:
                wait = BACKOFF_BASE_SECONDS * (2 ** (attempt - 1))
                time.sleep(wait)
                continue

        except APIError as e:
            # Could be a 5xx (retry) or a 4xx like bad auth (don't bother retrying)
            status = getattr(e, "status_code", None)
            last_error = str(e)
            logger.warning(f"Groq call attempt {attempt} failed (APIError {status}): {last_error}")
            if status and 500 <= status < 600 and attempt <= MAX_RETRIES:
                wait = BACKOFF_BASE_SECONDS * (2 ** (attempt - 1))
                time.sleep(wait)
                continue
            break  # non-retryable error (e.g. 401 bad key, 400 bad request)

        except Exception as e:
            # Unexpected — don't retry blindly on something we don't understand
            last_error = str(e)
            logger.error(f"Groq call attempt {attempt} failed (unexpected): {last_error}")
            break

    latency_ms = round((time.perf_counter() - start) * 1000, 1)
    return None, latency_ms, attempt, last_error

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
    latency_ms: Optional[float]
    attempts: Optional[int]


def diagnose_node(state: DiagnosticState) -> DiagnosticState:
    finding = state["finding"]
    user_prompt = (
        f"Finding type: {finding['type']}\n"
        f"Summary: {finding['summary']}\n"
        f"Raw data: {json.dumps(finding['raw_data'])}\n\n"
        "Diagnose this."
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    raw_output, latency_ms, attempts, call_error = _call_groq_with_retry(
        messages, temperature=0.2, response_format={"type": "json_object"}
    )

    state["latency_ms"] = latency_ms
    state["attempts"] = attempts

    if raw_output is None:
        # Every retry exhausted — fail safe, don't guess.
        state["diagnosis"] = {
            "likely_cause": "Unable to confidently diagnose — model call failed after retries.",
            "supporting_evidence": "none (error during diagnosis)",
            "confidence": 0,
        }
        state["error"] = call_error
        return state

    try:
        diagnosis = json.loads(raw_output)
        assert "likely_cause" in diagnosis
        assert "confidence" in diagnosis
        assert 0 <= int(diagnosis["confidence"]) <= 100

        state["diagnosis"] = diagnosis
        state["error"] = None

    except Exception as e:
        # Call succeeded but the output was malformed/unparseable — a
        # different failure mode from a network error, still handled safely.
        state["diagnosis"] = {
            "likely_cause": "Unable to confidently diagnose — model returned invalid output.",
            "supporting_evidence": "none (malformed response)",
            "confidence": 0,
        }
        state["error"] = f"Malformed response: {e}"

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
        "finding": finding, "diagnosis": None, "decision": None, "error": None,
        "latency_ms": None, "attempts": None,
    })
    return {
        "finding_id": finding["id"],
        "diagnosis": result["diagnosis"],
        "decision": result["decision"],
        "error": result["error"],
        "latency_ms": result["latency_ms"],
        "attempts": result["attempts"],
    }


ASK_SYSTEM_PROMPT = """You are the same diagnostic agent, now answering a follow-up
question from a human ops team member about a case you already diagnosed.

Rules:
- Only use information present in the finding data and your original diagnosis.
- If the question asks something the data can't answer, say so honestly instead
  of guessing.
- Keep answers short (2-4 sentences) and plain — this is being read by a person
  working through a queue of cases, not written for a report.
"""


def ask_about_case(finding: dict, diagnosis: dict, question: str) -> dict:
    """
    A second, grounded Groq call for a human asking a follow-up question about
    a specific case. Uses the same retry-with-backoff and latency tracking as
    the main diagnosis call.
    """
    user_prompt = (
        f"Finding: {json.dumps(finding)}\n"
        f"Original diagnosis: {json.dumps(diagnosis)}\n\n"
        f"Question: {question}"
    )
    messages = [
        {"role": "system", "content": ASK_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    answer, latency_ms, attempts, call_error = _call_groq_with_retry(messages, temperature=0.3)

    if answer is None:
        return {
            "answer": "Couldn't reach the agent right now — the model call failed after retries. Try again in a moment.",
            "error": call_error,
            "latency_ms": latency_ms,
            "attempts": attempts,
        }

    return {"answer": answer, "error": None, "latency_ms": latency_ms, "attempts": attempts}