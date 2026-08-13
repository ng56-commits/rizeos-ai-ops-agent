# Technical Documentation — RizeOS AI Ops Agent

## 1. Overview

A proactive AI operations agent that monitors RizeOS platform activity (payments, verifications, applications), diagnoses the likely cause of anything stuck or anomalous using Groq (Llama 3.1) with evidence-backed reasoning, and either auto-resolves the case or escalates it to a human — with full traceability into why each decision was made.

**Track:** AI Track — built for RizeOS Hackathon Round 2 (MVP Development)

## 2. Architecture

```
Platform Data (payments, verifications, applications)
        |
        v
Monitor Agent — rule-based, flags stuck/anomalous cases
        |
        v
Diagnostic Agent (Groq + LangGraph) — reasons over the case,
        |                             cites specific evidence, scores confidence
        v
Confidence Router
   |-- confidence >= threshold --> Auto-resolve
   |-- confidence < threshold  --> Escalate to human
                                        |
                                        v
                              Human reviews, marks
                              resolved / escalated
                                        |
                                        v
                              Feedback Logger — records the
                              override, grows the Playbook
                                        |
                                        v
                                   Dashboard
```

The Diagnostic Agent is modeled as an explicit LangGraph state machine
(`diagnose -> route`), not a single freeform prompt — each step has a
defined input/output shape, which is what makes the confidence-based
routing and error handling reliable rather than best-effort.

## 3. AI/LLM Pipeline Details

- **Model:** Groq — `llama-3.1-8b-instant`
- **Orchestration:** LangGraph (`diagnose_node` -> `route_node`)
- **Structured output:** the model is required to respond with JSON containing `likely_cause`, `supporting_evidence`, and `confidence` — never freeform prose, so downstream code can reliably parse and route on it
- **Hallucination mitigation:** the system prompt explicitly forbids the model from stating a cause it can't tie to a specific field in the provided data; if the data doesn't clearly support a conclusion, the model is instructed to lower its confidence rather than guess
- **Confidence routing:** cases scoring at or above the threshold (default 70%, adjustable in Settings) are treated as auto-resolved; anything below is escalated to a human

## 4. Error Handling & Latency Management

- Every Groq call goes through a shared retry function (`_call_groq_with_retry`)
- **Retryable failures** (timeouts, dropped connections, 5xx errors) are retried up to 2 additional times with exponential backoff (1.5s, then 3s between attempts)
- **Non-retryable failures** (bad API key, malformed request) fail immediately — retrying these wastes time hitting the same wall
- If every retry is exhausted, the system returns a safe fallback (confidence 0) rather than guessing — this automatically routes to human escalation instead of risking a wrong automated decision
- A separate failure mode is handled for when the API call succeeds but returns unparseable output — distinct from a network failure, with its own honest error message
- Every call tracks and reports its own latency (`latency_ms`) and attempt count (`attempts`), so response time is visible rather than silent

## 5. API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Health check |
| GET | `/data/payments` | Raw mock payment records |
| GET | `/data/verifications` | Raw mock verification records |
| GET | `/data/applications` | Raw mock application records |
| GET | `/findings` | Monitor Agent output — flagged cases only, no diagnosis yet |
| GET | `/cases` | Full pipeline: Monitor -> Diagnose -> Route, for every current finding |
| POST | `/cases/override` | Human marks a case resolved/escalated; logged to the Feedback Logger |
| POST | `/cases/ask` | Ask a grounded follow-up question about a specific case |
| GET | `/playbook` | Real accumulated override history, grouped by pattern |

## 6. Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI |
| Agent orchestration / LLM | LangGraph + Groq (Llama 3.1) |
| Data | Mock in-memory data (see below) |
| Frontend | React |

## 7. Running Locally

**Backend:**
```bash
cd backend
pip install -r requirements.txt
# create backend/.env with: GROQ_API_KEY=your_key_here
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Visit the Vite dev server URL (typically `http://localhost:5173`). The backend must be running at `http://127.0.0.1:8000` for the dashboard to load data.

## 8. What's Real vs. Simulated (Honesty Note)

Being upfront about scope, since this was built solo in a hackathon window:

**Fully real and working:**
- The Monitor Agent's detection rules
- The Diagnostic Agent's Groq/LangGraph pipeline, including retry, timeout, and error handling
- The Confidence Router's routing decisions
- Manual override → Feedback Logger → Playbook (this loop is genuinely live, not mocked)
- The "ask a follow-up" chat — a real second grounded Groq call

**Simulated for the MVP, with a clear path to real:**
- Platform data (payments/verifications/applications) is realistic mock data rather than a live RizeOS database connection — swapping in a real data source would only require changing `mock_data.py`, since every downstream component consumes it through the same `Finding` interface
- The Feedback Logger is in-memory (resets on server restart) rather than a persistent database — the logic is identical to what a database-backed version would do, just without persistence
- The system does not yet automatically apply learned playbook patterns to skip diagnosis on repeat cases — currently every case still goes through the full Diagnostic Agent, and the Playbook page is a visibility/audit layer on top rather than an automation trigger. This is the clearest next step for a v2.

## 9. Known Limitations

- Confidence threshold is currently a single global setting, not per-case-type
- No authentication on the API (fine for a local hackathon demo, not for production)
- Mock data uses a fixed reference timestamp so demo scenarios stay consistent across runs