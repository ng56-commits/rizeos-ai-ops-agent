# RizeOS AI Ops Agent

A proactive AI operations agent for [RizeOS](https://www.rizeos.com) — built for the RizeOS Hackathon (AI Track).

## Problem

RizeOS runs hiring, freelancing, payments, and identity verification through a small team. As the platform grows, issues like stuck payments, delayed verifications, or unreviewed applications go unnoticed until a user complains — a lean team can't staff a support desk that scales with user growth.

## Solution

An AI agent that continuously monitors platform activity, diagnoses likely causes using available data (with evidence-backed reasoning, not guesses), and either resolves issues automatically or escalates them to a human with a clear summary. Every human resolution feeds back into a real, growing playbook of what the agent can handle on its own next time.

**Flow:** Monitor → Diagnose (with evidence citation) → Confidence Router → Resolve / Escalate → Feedback Logger

Full write-up of the architecture, AI pipeline, and error handling: [`docs/TECHNICAL_DOCUMENTATION.md`](docs/TECHNICAL_DOCUMENTATION.md)

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI |
| Agent orchestration / LLM | LangGraph + Groq (Llama 3.1) |
| Data | Mock in-memory data |
| Frontend | React |

## Project Structure

```
.
├── backend/     # FastAPI app, LangGraph diagnostic pipeline, mock data
├── frontend/    # React dashboard (Overview, Case Queue, Playbook, Settings)
└── docs/        # Technical documentation
```

## Running Locally

**Backend:**
```bash
cd backend
pip install -r requirements.txt
```
Create a `backend/.env` file with:
```
GROQ_API_KEY=your_key_here
```
Then:
```bash
uvicorn app.main:app --reload
```
API available at `http://127.0.0.1:8000` (docs at `/docs`).

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
Open the printed local URL (typically `http://localhost:5173`).

## Status

Working MVP — built for RizeOS Hackathon Round 2 (MVP Development).

## Author

Neelima Gundugari — [LinkedIn](https://linkedin.com/in/neelimagundugari)