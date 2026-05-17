# CivicSense AI

Multi-agent citizen grievance lifecycle platform for India.

## Overview

CivicSense AI is a multilingual grievance management system that processes citizen complaints in 22+ Indian languages, classifies them, routes them to the correct government department, and tracks resolution through SLA enforcement.

## Architecture

- **intake_agent** — Classifies grievances, geocodes locations, scores priority, saves to DB
- **tracker_agent** — SLA watchdog, overdue ticket escalation, status checks
- **resolver_agent** — Verifies and closes resolved tickets with evidence logging
- **analytics_agent** — Dashboard stats, geographic hotspots, filtered queries
- **sahayak_mcp_server** — MCP stdio server exposing calendar, task, and note tools

## Setup

1. Copy `.env.example` to `.env` and fill in your credentials
2. Install dependencies: `pip install -r requirements.txt`
3. Run: `adk web`

## Environment Variables

```
GOOGLE_GENAI_USE_VERTEXAI=1
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
DATABASE_URL=your-neon-postgresql-url
```
