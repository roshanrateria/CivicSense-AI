# CivicSense AI

Multi-agent citizen grievance lifecycle platform for India â€” multilingual, AI-powered, SLA-enforced.

## Repository Structure

```
CivicSense-AI/
â”œâ”€â”€ agent/                        # Python multi-agent backend (Google ADK)
â”‚   â”œâ”€â”€ agent.py                  # Root orchestrator + 4 sub-agents
â”‚   â”œâ”€â”€ sahayak_mcp_server.py     # MCP stdio server (calendar, tasks, notes)
â”‚   â”œâ”€â”€ sahayak_mcp_data.json     # Sample MCP data
â”‚   â”œâ”€â”€ mcp_data.json             # MCP data template
â”‚   â”œâ”€â”€ requirements.txt          # Python dependencies
â”‚   â””â”€â”€ __init__.py
â”‚
â””â”€â”€ web/                          # Next.js 16 frontend (TypeScript + Tailwind)
    â”œâ”€â”€ src/app/
    â”‚   â”œâ”€â”€ page.tsx              # Landing page
    â”‚   â”œâ”€â”€ report/page.tsx       # Citizen grievance submission
    â”‚   â”œâ”€â”€ track/page.tsx        # Ticket status tracker
    â”‚   â”œâ”€â”€ officer/page.tsx      # Officer dashboard (Kanban + Map)
    â”‚   â”œâ”€â”€ eco/page.tsx          # Eco-Impact dashboard
    â”‚   â””â”€â”€ actions.ts            # Server actions (DB + ADK + AI)
    â”œâ”€â”€ src/components/Map.tsx    # Leaflet map component
    â”œâ”€â”€ .env.example              # Environment variable template
    â””â”€â”€ package.json
```

## Agent Architecture

- **intake_agent** â€” Classifies grievances in 22+ Indian languages, geocodes, scores priority, saves to DB
- **tracker_agent** â€” SLA watchdog, auto-escalates overdue CRITICAL tickets
- **resolver_agent** â€” Verifies and closes resolved tickets with evidence logging
- **analytics_agent** â€” Dashboard stats, geographic hotspots, filtered queries
- **MCP server** â€” Exposes calendar events, officer tasks, and notes via stdio protocol

## Web Features

- Citizen grievance submission with image upload and map pin
- Real-time ticket tracking by ID
- Officer Kanban board with AI-generated action plan
- Live heatmap of active issues
- Eco-Impact dashboard â€” water saved, emissions avoided, energy conserved

## Setup

### Agent
```bash
cd agent
pip install -r requirements.txt
cp .env.example .env
adk web
```

### Web
```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

## Environment Variables

See web/.env.example for the full list. Key variables:

| Variable | Description |
|---|---|
| DATABASE_URL | Neon PostgreSQL connection string |
| GOOGLE_API_KEY | Google Gemini API key |
| ADK_API_URL | Deployed ADK agent URL |
| GOOGLE_CLOUD_PROJECT | GCP project ID (agent only) |
