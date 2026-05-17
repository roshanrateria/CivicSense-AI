# CivicSense AI

Multi-agent citizen grievance lifecycle platform for India.

## Overview

CivicSense AI is a multilingual grievance management system that processes citizen complaints in 22+ Indian languages, classifies them, routes them to the correct government department, and tracks resolution through SLA enforcement.

## Repository Structure

```
CivicSense-AI/
└── agent/
    ├── agent.py              # Root agent + 4 sub-agents (intake, tracker, resolver, analytics)
    ├── sahayak_mcp_server.py # MCP stdio server (calendar, tasks, notes tools)
    ├── sahayak_mcp_data.json # Sample MCP data
    ├── mcp_data.json         # MCP data template
    ├── requirements.txt      # Python dependencies
    └── __init__.py           # Package init
```

## Agent Architecture

- **intake_agent** — Classifies grievances, geocodes locations, scores priority, saves to DB
- **tracker_agent** — SLA watchdog, overdue ticket escalation, status checks
- **resolver_agent** — Verifies and closes resolved tickets with evidence logging
- **analytics_agent** — Dashboard stats, geographic hotspots, filtered queries
- **sahayak_mcp_server** — MCP stdio server exposing calendar, task, and note tools

## Setup

```bash
cd agent
pip install -r requirements.txt
cp .env.example .env   # fill in your credentials
adk web
```

## Environment Variables

```
GOOGLE_GENAI_USE_VERTEXAI=1
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
DATABASE_URL=your-neon-postgresql-url
```
