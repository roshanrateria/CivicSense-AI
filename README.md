# CivicSense AI

> **Hack the Tech 2026 Submission** · Track: Smart Cities & Sustainability + Artificial Intelligence & Machine Learning

---

## The Problem

India receives millions of civic grievances every year — broken water pipes, power outages, road hazards, pollution — but most go unresolved for weeks. Citizens don't know which department to contact, officers are overwhelmed with unstructured complaints in dozens of languages, and there is no accountability mechanism to enforce resolution timelines.

## The Solution

**CivicSense AI** is a multilingual, AI-powered citizen grievance lifecycle platform that:

- Accepts complaints in **22+ Indian languages** (Hindi, Tamil, Bengali, Telugu, Marathi, and more)
- **Classifies, prioritises, and routes** each complaint to the correct government department in seconds
- Enforces **SLA deadlines** with automatic escalation for critical issues
- Gives officers a **real-time Kanban dashboard** with AI-generated action plans
- Tracks the **environmental impact** of rapid civic response — water saved, emissions avoided, energy conserved

---

## Live Demo

| Service | URL |
|---|---|
| Web App | https://sahayak-web-916360154519.europe-west1.run.app |
| AI Agent API | https://sahayak-final-916360154519.europe-west1.run.app |

---

## Repository Structure

```
CivicSense-AI/
│
├── agent/                        # Python multi-agent backend (Google ADK)
│   ├── agent.py                  # Root orchestrator + 4 specialist sub-agents
│   ├── sahayak_mcp_server.py     # MCP stdio server — calendar, tasks, notes
│   ├── sahayak_mcp_data.json     # Sample MCP data
│   ├── mcp_data.json             # MCP data template
│   ├── requirements.txt          # Python dependencies
│   └── __init__.py
│
└── web/                          # Next.js 16 frontend (TypeScript + Tailwind CSS)
    ├── src/app/
    │   ├── page.tsx              # Landing page
    │   ├── report/page.tsx       # Citizen grievance submission
    │   ├── track/page.tsx        # Real-time ticket status tracker
    │   ├── officer/page.tsx      # Officer dashboard — Kanban + heatmap
    │   ├── eco/page.tsx          # Eco-Impact dashboard
    │   └── actions.ts            # Server actions — DB, ADK agent, Gemini AI
    ├── src/components/Map.tsx    # Interactive Leaflet map
    ├── .env.example              # Environment variable template
    └── package.json
```

---

## Architecture

```
Citizen (Web)
     │
     ▼
Next.js 16 Frontend  ──────────────────────────────────────────────────────┐
  • Report grievance (text + image + map pin)                               │
  • Track ticket by ID                                                      │
  • Officer Kanban + heatmap                                                │
  • Eco-Impact dashboard                                                    │
     │                                                                      │
     │  Server Actions (actions.ts)                                         │
     ▼                                                                      │
Google ADK Agent (Cloud Run)                                    Neon PostgreSQL
  sahayak_orchestrator                                          • tickets
     ├── intake_agent        ← classify + geocode + save        • ticket_events
     ├── tracker_agent       ← SLA watchdog + escalation        • calendar_events
     ├── resolver_agent      ← close + evidence logging         • officer_tasks
     └── analytics_agent     ← stats + hotspots                 • notes
              │
              ▼
     MCP stdio Server (sahayak_mcp_server.py)
       • create_calendar_event
       • manage_task
       • add_note
              │
              ▼
     External APIs
       • OpenStreetMap Nominatim  (geocoding)
       • Google Gemini 2.5 Flash  (classification + AI todos)
       • Google Vertex AI         (agent runtime)
```

---

## Agent Sub-System

| Agent | Role |
|---|---|
| `intake_agent` | Detects language, classifies category, geocodes location, scores priority 1–10, calculates SLA, saves to DB |
| `tracker_agent` | Runs SLA watchdog, auto-escalates overdue CRITICAL tickets, creates officer tasks |
| `resolver_agent` | Verifies resolution, updates status, logs evidence notes |
| `analytics_agent` | Returns dashboard stats, geographic hotspots, filtered ticket queries |

**Priority scoring** accounts for: affected count, vulnerable groups (children, elderly, pregnant, disabled), safety hazards, corruption, and issue duration.

**SLA by category:** Public Safety = 4h · Healthcare = 12h · Water Supply = 24h · Electricity = 48h · Roads = 72h · Environment = 96h · Social Welfare = 120h

---

## Eco-Impact Dashboard

One of CivicSense AI's unique features is quantifying the **environmental benefit** of rapid civic response using published Indian municipal data:

| Category | Metric | Rate |
|---|---|---|
| Water Supply | Litres conserved | 900 L/hr avg (pipe leaks) |
| Electricity | kWh saved | 0.15 kWh/hr (faulty streetlights) |
| Environment | kg CO₂e avoided | 33.3 kg/hr (dump sites / pollution) |
| Roads | Accidents prevented | 0.004 incidents/hr per hazard |

For example: a water pipe burst reported and resolved in **6 hours** saves an estimated **5,400 litres** of clean drinking water.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Leaflet |
| AI Agent | Google ADK (Agent Development Kit), Gemini 2.5 Flash |
| Agent Tools | MCP (Model Context Protocol) stdio server |
| Database | Neon PostgreSQL (serverless) |
| Geocoding | OpenStreetMap Nominatim API |
| Deployment | Google Cloud Run (europe-west1) |

---

## Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- A [Neon](https://neon.tech) PostgreSQL database
- Google Cloud project with Vertex AI enabled

### Agent

```bash
cd agent
pip install -r requirements.txt
cp .env.example .env   # fill in your credentials
adk web
```

### Web

```bash
cd web
npm install
cp .env.example .env.local   # fill in your credentials
npm run dev
```

### Environment Variables

See `web/.env.example`. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `GOOGLE_API_KEY` | Google Gemini API key |
| `ADK_API_URL` | Deployed ADK agent URL |
| `GOOGLE_GENAI_USE_VERTEXAI` | Set to `1` for Vertex AI |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID |
| `GOOGLE_CLOUD_LOCATION` | GCP region (e.g. `us-central1`) |

---

## Hackathon Track Alignment

**Primary Track:** Smart Cities & Sustainability
- Addresses urban civic infrastructure failures
- Quantifies real environmental savings from faster resolution
- Geo-tagged issue heatmap for city planners

**Secondary Track:** Artificial Intelligence & Machine Learning
- Multilingual NLP classification across 22+ Indian languages
- AI-generated officer action plans via Gemini 2.5 Flash
- Priority scoring with vulnerability and urgency signals
- Multi-agent orchestration with specialist sub-agents

---

## Judging Criteria Alignment

| Criterion | How CivicSense AI addresses it |
|---|---|
| **Creativity & Uniqueness** | Eco-Impact calculator quantifying civic response in litres/kWh/CO₂ — not seen in existing grievance platforms |
| **Functionality** | End-to-end working system: submit → classify → route → track → resolve → measure impact |
| **Technical Implementation** | Multi-agent ADK system, MCP protocol integration, real Neon DB, Cloud Run deployment |
| **Real-world Problem** | 1.4 billion people, millions of unresolved civic complaints annually |
| **Innovation** | Multilingual AI triage in 22+ languages with SLA enforcement and environmental accounting |
| **Scalability** | Serverless Cloud Run + Neon PostgreSQL — scales to zero, handles spikes |

---

## Team

Built for **Hack the Tech 2026** — *Build the Future, One Innovation at a Time*

---

*CivicSense AI — Because every civic complaint deserves a response, and every response has an impact.*
