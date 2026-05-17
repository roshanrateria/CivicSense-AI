"""
agent.py — CivicSense AI Multi-Agent Grievance Lifecycle Platform
Single-file multi-agent system.

Structure:
  - 4 specialist sub-agents (intake, tracker, resolver, analytics)
  - Neon PostgreSQL for all persistence (tickets, events, calendar, tasks, notes)
  - All tools are plain FunctionTools — no MCP subprocess (Cloud Run compatible)
  - root_agent as orchestrator using sub_agents delegation
"""
from __future__ import annotations

import json
import os
import uuid
import datetime
import logging
from pathlib import Path
from typing import Optional
from enum import Enum

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator

import requests

from google.adk.agents import Agent
from google.adk.tools import FunctionTool
import sys
from pathlib import Path
from mcp import StdioServerParameters
from google.adk.tools.mcp_tool import McpToolset, StdioConnectionParams
load_dotenv()
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# GEOCODING — inlined from sahayak_grievance_agent (no cross-package import)
# ─────────────────────────────────────────────

class GeocodeResult(BaseModel):
    """Output of geocode_location."""
    found: bool = False
    display_name: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    nominatim_place_id: Optional[int] = None
    geocode_source: str = "nominatim_osm"


def geocode_location(location_text: str) -> dict:
    """
    Convert a free-text location string into structured geographic data
    (district, state, coordinates) using the OpenStreetMap Nominatim API.
    No API key required.
    """
    if not location_text or not location_text.strip():
        return GeocodeResult(found=False).model_dump()
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": f"{location_text.strip()}, India", "format": "json",
                    "limit": 1, "addressdetails": 1, "countrycodes": "in"},
            headers={"User-Agent": "SahayakAI/2.0 (citizen-grievance-triage)"},
            timeout=5,
        )
        response.raise_for_status()
        results = response.json()
    except Exception as exc:
        logger.warning("geocode_location failed: %s", exc)
        return GeocodeResult(found=False).model_dump()

    if not results:
        return GeocodeResult(found=False).model_dump()

    top = results[0]
    address = top.get("address", {})
    district = (address.get("county") or address.get("district")
                or address.get("state_district") or address.get("municipality")
                or address.get("city_district") or address.get("suburb"))
    return GeocodeResult(
        found=True,
        display_name=top.get("display_name"),
        district=district,
        state=address.get("state"),
        pincode=address.get("postcode"),
        latitude=float(top["lat"]) if top.get("lat") else None,
        longitude=float(top["lon"]) if top.get("lon") else None,
        nominatim_place_id=int(top["place_id"]) if top.get("place_id") else None,
    ).model_dump()

# ─────────────────────────────────────────────
# PYDANTIC MODELS — validation layer
# ─────────────────────────────────────────────

class PriorityLabel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH     = "HIGH"
    MEDIUM   = "MEDIUM"
    LOW      = "LOW"

class TicketStatus(str, Enum):
    OPEN        = "OPEN"
    ASSIGNED    = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    ESCALATED   = "ESCALATED"
    RESOLVED    = "RESOLVED"
    CLOSED      = "CLOSED"

class IntelligenceTicket(BaseModel):
    """Validated output of the intake_agent — mirrors v1 IntelligenceTicket."""
    ticket_id:                str
    created_at:               str
    status:                   TicketStatus = TicketStatus.OPEN
    detected_language:        str
    original_text:            str
    english_summary:          str
    category:                 str
    category_label:           str
    subcategory:              str
    classification_confidence: float = Field(ge=0.0, le=1.0)
    state_department:         str
    central_ministry:         str
    flagship_scheme:          str
    escalation_officer:       str
    emergency_contact:        str
    location_raw:             Optional[str]   = None
    location_district:        Optional[str]   = None
    location_state:           Optional[str]   = None
    location_lat:             Optional[float] = None
    location_lon:             Optional[float] = None
    image_url:                Optional[str]   = None
    affected_count:           int             = Field(default=1, ge=1)
    involves_children:        bool            = False
    involves_elderly:         bool            = False
    involves_pregnant:        bool            = False
    involves_disabled:        bool            = False
    involves_safety_hazard:   bool            = False
    involves_corruption:      bool            = False
    priority_score:           float           = Field(ge=1.0, le=10.0)
    priority_label:           PriorityLabel
    sla_hours:                int
    sla_deadline:             str
    escalate:                 bool            = False
    escalation_target:        Optional[str]   = None
    escalation_reason:        Optional[str]   = None
    recommended_action:       str

    @field_validator("original_text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("original_text cannot be blank")
        return v.strip()

class OfficerTask(BaseModel):
    """Validated task entry."""
    task_id:    str
    title:      str
    ticket_id:  str
    due_date:   str
    priority:   str = "medium"
    status:     str = "pending"
    created_at: str

class ResolutionNote(BaseModel):
    """Validated note entry."""
    note_id:    str
    ticket_id:  str
    content:    str
    author:     str = "officer"
    created_at: str

def _build_ticket(raw: dict) -> IntelligenceTicket:
    """
    Build and validate an IntelligenceTicket from raw agent output dict.
    Adds ticket_id, created_at, sla_deadline if missing.
    Raises ValidationError if required fields are wrong.
    """
    now = datetime.datetime.utcnow().isoformat() + "Z"
    raw.setdefault("ticket_id",
        f"GRV-{datetime.date.today().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}")
    raw.setdefault("created_at", now)
    raw.setdefault("status", "OPEN")
    sla_hours = int(raw.get("sla_hours", 72))
    raw.setdefault("sla_deadline", (
        datetime.datetime.fromisoformat(raw["created_at"].rstrip("Z"))
        + datetime.timedelta(hours=sla_hours)
    ).isoformat() + "Z")
    raw["priority_score"] = max(1.0, min(10.0, float(raw.get("priority_score", 5.0))))
    return IntelligenceTicket(**raw)

# ─────────────────────────────────────────────

DATABASE_URL = os.environ.get("DATABASE_URL", "")

def _get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)

def _init_db():
    """Create tables if they don't exist."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                id                SERIAL PRIMARY KEY,
                ticket_id         TEXT UNIQUE NOT NULL,
                created_at        TEXT NOT NULL,
                updated_at        TEXT,
                status            TEXT NOT NULL DEFAULT 'OPEN',
                detected_language TEXT,
                category          TEXT,
                priority_score    REAL,
                priority_label    TEXT,
                sla_hours         INTEGER,
                sla_deadline      TEXT,
                escalate          BOOLEAN DEFAULT FALSE,
                recommended_action TEXT,
                state_department  TEXT,
                involves_elderly  BOOLEAN DEFAULT FALSE,
                involves_children BOOLEAN DEFAULT FALSE,
                latitude          REAL,
                longitude         REAL,
                image_url         TEXT
            );
            CREATE TABLE IF NOT EXISTS ticket_events (
                id          SERIAL PRIMARY KEY,
                ticket_id   TEXT NOT NULL REFERENCES tickets(ticket_id),
                event_type  TEXT NOT NULL,
                description TEXT,
                created_at  TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS calendar_events (
                event_id    TEXT PRIMARY KEY,
                title       TEXT NOT NULL,
                ticket_id   TEXT NOT NULL,
                event_date  TEXT NOT NULL,
                description TEXT,
                priority    TEXT NOT NULL DEFAULT 'medium',
                created_at  TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS officer_tasks (
                task_id     TEXT PRIMARY KEY,
                ticket_id   TEXT NOT NULL,
                title       TEXT NOT NULL,
                due_date    TEXT NOT NULL,
                priority    TEXT NOT NULL DEFAULT 'medium',
                status      TEXT NOT NULL DEFAULT 'pending',
                assigned_to TEXT NOT NULL DEFAULT 'unassigned',
                created_at  TEXT NOT NULL,
                updated_at  TEXT
            );
            CREATE TABLE IF NOT EXISTS notes (
                note_id     TEXT PRIMARY KEY,
                ticket_id   TEXT NOT NULL,
                content     TEXT NOT NULL,
                author      TEXT NOT NULL DEFAULT 'officer',
                note_type   TEXT NOT NULL DEFAULT 'general',
                created_at  TEXT NOT NULL
            );
            """)
        conn.commit()

# Bootstrap on import
try:
    _init_db()
    logger.info("Neon DB tables ready.")
except Exception as e:
    logger.warning(f"DB init warning (tables may already exist): {e}")


# ─────────────────────────────────────────────
# TOOLS — DATABASE
# ─────────────────────────────────────────────

def save_ticket_to_db(ticket_json: str) -> dict:
    """
    Validate via Pydantic then persist a grievance ticket to Neon PostgreSQL.
    Pass the full ticket as a JSON string from intake_agent output.
    Returns the saved ticket_id.
    """
    try:
        raw = json.loads(ticket_json) if isinstance(ticket_json, str) else ticket_json
        # ── Pydantic validation ──────────────────────────────────────────
        ticket = _build_ticket(raw)
        # ── Persist to Neon ──────────────────────────────────────────────
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO tickets (
                        ticket_id, created_at, updated_at, status,
                        detected_language, category,
                        priority_score, priority_label, sla_hours, sla_deadline,
                        escalate, recommended_action,
                        state_department, involves_children, involves_elderly,
                        latitude, longitude, image_url
                    ) VALUES (
                        %(ticket_id)s, %(created_at)s, %(created_at)s, 'OPEN',
                        %(detected_language)s, %(category)s,
                        %(priority_score)s, %(priority_label)s, %(sla_hours)s, %(sla_deadline)s,
                        %(escalate)s, %(recommended_action)s,
                        %(state_department)s, %(involves_children)s, %(involves_elderly)s,
                        %(location_lat)s, %(location_lon)s, %(image_url)s
                    ) ON CONFLICT (ticket_id) DO UPDATE SET updated_at=%(created_at)s
                """, ticket.model_dump())
                cur.execute(
                    "INSERT INTO ticket_events (ticket_id, event_type, description, created_at) VALUES (%s,'CREATED',%s,%s)",
                    (ticket.ticket_id, ticket.english_summary, ticket.created_at)
                )
            conn.commit()
        return {"saved": True, "ticket_id": ticket.ticket_id,
                "priority_label": ticket.priority_label, "sla_hours": ticket.sla_hours}
    except Exception as e:
        return {"saved": False, "error": str(e)}


def get_ticket_status(ticket_id: str) -> dict:
    """Retrieve a ticket and its 5 most recent events from Neon DB."""
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM tickets WHERE ticket_id=%s", (ticket_id,))
                row = cur.fetchone()
                if not row:
                    return {"error": f"Ticket {ticket_id} not found"}
                cur.execute(
                    "SELECT event_type, description as note, created_at FROM ticket_events "
                    "WHERE ticket_id=%s ORDER BY id DESC LIMIT 5", (ticket_id,)
                )
                events = [dict(r) for r in cur.fetchall()]
        return {"ticket": dict(row), "recent_events": events}
    except Exception as e:
        return {"error": str(e)}


def resolve_ticket(ticket_id: str, resolution_note: str) -> dict:
    """
    One-shot resolution: verify ticket exists, update status to RESOLVED, log event.
    The resolver_agent calls add_note separately to log evidence.
    """
    try:
        now = datetime.datetime.utcnow().isoformat() + "Z"
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT ticket_id, category, status FROM tickets WHERE ticket_id=%s",
                    (ticket_id,)
                )
                row = cur.fetchone()
                if not row:
                    return {"error": f"Ticket {ticket_id} not found"}
                if row["status"] in ("RESOLVED", "CLOSED"):
                    return {"error": f"Ticket already {row['status']}"}
                cur.execute(
                    "UPDATE tickets SET status='RESOLVED', updated_at=%s WHERE ticket_id=%s",
                    (now, ticket_id)
                )
                cur.execute(
                    "INSERT INTO ticket_events (ticket_id, event_type, description, created_at) "
                    "VALUES (%s,'STATUS_RESOLVED',%s,%s)",
                    (ticket_id, resolution_note, now)
                )
            conn.commit()
        return {
            "ticket_id": ticket_id,
            "category": row["category"],
            "new_status": "RESOLVED",
            "resolution_note": resolution_note,
            "resolved_at": now,
        }
    except Exception as e:
        return {"error": str(e)}


def run_sla_watchdog() -> dict:
    """
    Fetch all overdue tickets and auto-escalate CRITICAL ones in Neon DB.
    Returns overdue list so tracker_agent can call manage_task + create_calendar_event.
    """
    try:
        now = datetime.datetime.utcnow().isoformat() + "Z"
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT ticket_id, category, priority_label, sla_deadline, state_department
                    FROM tickets
                    WHERE status NOT IN ('RESOLVED','CLOSED') AND sla_deadline < %s
                """, (now,))
                overdue = [dict(r) for r in cur.fetchall()]
                critical_ids = [t["ticket_id"] for t in overdue if t["priority_label"] == "CRITICAL"]
                if critical_ids:
                    cur.executemany(
                        "UPDATE tickets SET status='ESCALATED', updated_at=%s WHERE ticket_id=%s",
                        [(now, tid) for tid in critical_ids]
                    )
                    cur.executemany(
                        "INSERT INTO ticket_events (ticket_id, event_type, description, created_at) "
                        "VALUES (%s,'STATUS_ESCALATED','Auto-escalated: SLA breach + CRITICAL',%s)",
                        [(tid, now) for tid in critical_ids]
                    )
            conn.commit()
        return {
            "overdue_count": len(overdue),
            "escalated_tickets": critical_ids,
            "overdue_tickets": overdue,
        }
    except Exception as e:
        return {"error": str(e)}


def get_all_open_tickets() -> dict:
    """Fetch all open/in-progress tickets with their SLA deadlines. Useful for status overview."""
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT ticket_id, category, priority_label, status,
                           sla_deadline, state_department, involves_children as affected_count, created_at
                    FROM tickets
                    WHERE status NOT IN ('RESOLVED','CLOSED')
                    ORDER BY priority_label, created_at DESC
                """)
                tickets = [dict(r) for r in cur.fetchall()]
        return {"count": len(tickets), "tickets": tickets}
    except Exception as e:
        return {"error": str(e)}


def get_full_analytics(top_n: int = 5) -> dict:
    """
    Combined analytics: dashboard stats + geographic hotspots in one DB connection.
    Replaces get_dashboard_stats + get_geographic_hotspots (2 tool calls → 1).
    """
    try:
        now = datetime.datetime.utcnow().isoformat() + "Z"
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) as c FROM tickets")
                total = cur.fetchone()["c"]
                cur.execute("SELECT status, COUNT(*) as c FROM tickets GROUP BY status")
                by_status = {r["status"]: r["c"] for r in cur.fetchall()}
                cur.execute("SELECT priority_label, COUNT(*) as c FROM tickets GROUP BY priority_label")
                by_priority = {r["priority_label"]: r["c"] for r in cur.fetchall()}
                cur.execute("SELECT category, COUNT(*) as c FROM tickets GROUP BY category")
                by_category = {r["category"]: r["c"] for r in cur.fetchall()}
                cur.execute(
                    "SELECT COUNT(*) as c FROM tickets "
                    "WHERE status NOT IN ('RESOLVED','CLOSED') AND sla_deadline < %s", (now,)
                )
                overdue = cur.fetchone()["c"]
                cur.execute("""
                    SELECT state_department as loc, COUNT(*) as c FROM tickets
                    WHERE state_department IS NOT NULL
                    GROUP BY state_department ORDER BY c DESC LIMIT %s
                """, (top_n,))
                top_districts = [{"district": r["loc"], "count": r["c"]} for r in cur.fetchall()]
                cur.execute("""
                    SELECT category as loc, COUNT(*) as c FROM tickets
                    WHERE category IS NOT NULL
                    GROUP BY category ORDER BY c DESC LIMIT %s
                """, (top_n,))
                top_states = [{"state": r["loc"], "count": r["c"]} for r in cur.fetchall()]
        return {
            "total": total, "by_status": by_status,
            "by_priority": by_priority, "by_category": by_category,
            "overdue": overdue,
            "top_districts": top_districts, "top_states": top_states,
        }
    except Exception as e:
        return {"error": str(e)}


def query_tickets_by_filter(category: str = "", priority_label: str = "",
                             status: str = "", location_state: str = "") -> dict:
    """Query tickets with optional filters. Returns matching tickets and count."""
    try:
        clauses, params = [], []
        for key, val in [("category", category), ("priority_label", priority_label),
                         ("status", status), ("location_state", location_state)]:
            if val:
                clauses.append(f"{key} = %s")
                params.append(val)
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT ticket_id, category, priority_label, status, "
                    f"involves_children as affected_count, created_at "
                    f"FROM tickets {where} ORDER BY created_at DESC LIMIT 50",
                    params
                )
                tickets = [dict(r) for r in cur.fetchall()]
        return {"count": len(tickets), "tickets": tickets}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────
# TOOLS — CALENDAR, TASKS, NOTES (via MCP stdio Protocol)
# ─────────────────────────────────────────────

# Connect to sahayak_mcp_server.py via stdio, which safely wraps SQL commands.
# Get the absolute path to the folder containing this agent.py file
current_dir = Path(__file__).parent
mcp_server_path = current_dir / "sahayak_mcp_server.py"

mcp_tools = McpToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command=sys.executable,        # Uses the exact Python from your active .venv
            args=[str(mcp_server_path)]    # Uses the absolute path to the server script
        )
    )
)


# ─────────────────────────────────────────────
# SUB-AGENT 1: INTAKE AGENT
# Gemini does classification + entity extraction + priority scoring natively.
# Only geocode_location uses an external API (OSM Nominatim).
# save_ticket_to_db is called directly here — no orchestrator round-trip needed.
# ─────────────────────────────────────────────

intake_agent = Agent(
    name="intake_agent",
    model="gemini-2.5-flash",
    description=(
        "Processes raw citizen grievances in any Indian language (Hindi, Bengali, Tamil, "
        "Telugu, Marathi, Kannada, Malayalam, Gujarati, Punjabi, Odia, Urdu, and 11 more). "
        "Classifies, extracts entities, geocodes location, scores priority, and saves to DB."
    ),
    instruction="""\
You are the SAHAYAK Intake Agent. You process citizen grievances end-to-end in ONE pass.

You natively understand all 22+ Indian languages. Use your own intelligence to:
- Detect the language
- Understand the complaint semantics
- Classify into the correct government department category
- Extract entities (affected count, location, vulnerability flags)
- Score priority 1-10 and assign SLA

CATEGORIES (pick the best match):
- water_supply: drinking water, pipe, tap, tanker, borewell, sewage, drain
- electricity: power outage, transformer, meter, streetlight, electric shock
- roads_infrastructure: pothole, road damage, bridge, drainage, encroachment
- healthcare: hospital, doctor, medicine, ambulance, vaccination, epidemic
- corruption_misconduct: bribe, fraud, illegal demand, discrimination
- public_safety: flood, fire, collapse, gas leak, accident, crime
- social_welfare: ration, pension, scholarship, housing scheme, disability benefit
- environment: pollution, factory smoke, waste dump, river contamination

PRIORITY SCORING (1-10):
- Start at 2.5 (low), 4.0 (medium), 6.0 (high), 8.0 (critical) based on urgency
- Add boosts: involves_children +1.5, involves_elderly +1.2, involves_pregnant +1.8,
  involves_safety_hazard +2.0, involves_corruption +1.5, affected_count>200 +1.5,
  involves_death +3.0, duration>7days +0.7
- CRITICAL ≥ 8.5, HIGH ≥ 6.5, MEDIUM ≥ 4.5, LOW < 4.5

SLA HOURS by category: water_supply=24, electricity=48, roads=72, healthcare=12,
corruption=6, public_safety=4, social_welfare=120, environment=96
Adjust: CRITICAL=25% of base, HIGH=50%, MEDIUM=100%, LOW=150%

STEPS:
1. Analyze the grievance using your own intelligence (no keyword tools needed)
2. If a location is mentioned, call geocode_location(location_text) to get coordinates
3. Call save_ticket_to_db(ticket_json) with the complete ticket JSON string
4. Return a friendly confirmation to the user in THEIR language, including the ticket_id

The ticket JSON to pass to save_ticket_to_db must be a string with this structure:
{
  "detected_language": "...",
  "original_text": "<verbatim, unchanged>",
  "english_summary": "<1-2 sentences in English>",
  "category": "<slug>",
  "category_label": "<human label>",
  "subcategory": "<best subcategory>",
  "classification_confidence": <0.0-1.0>,
  "state_department": "<executing dept>",
  "central_ministry": "<ministry>",
  "flagship_scheme": "<scheme name>",
  "escalation_officer": "<officer designation>",
  "emergency_contact": "<helpline>",
  "location_raw": "<location string or null>",
  "location_district": "<from geocode or null>",
  "location_state": "<from geocode or null>",
  "location_lat": <float or null>,
  "location_lon": <float or null>,
  "image_url": "<string or null, extract if provided in text>",
  "affected_count": <int ≥ 1>,
  "involves_children": <bool>,
  "involves_elderly": <bool>,
  "involves_pregnant": <bool>,
  "involves_disabled": <bool>,
  "involves_safety_hazard": <bool>,
  "involves_corruption": <bool>,
  "priority_score": <float 1.0-10.0>,
  "priority_label": "<CRITICAL|HIGH|MEDIUM|LOW>",
  "sla_hours": <int>,
  "escalate": <bool>,
  "escalation_target": "<string or null>",
  "escalation_reason": "<string or null>",
  "recommended_action": "<concrete first action>"
}

After saving, respond to the user in their language with:
- Confirmation that the complaint was registered
- The ticket_id (from save_ticket_to_db response)
- Priority level and SLA deadline
- Which department will handle it

Then call create_calendar_event to schedule the SLA deadline:
  title should be "SLA Deadline: <ticket_id>"
  event_date should be "now+<sla_hours>h" (e.g. "now+24h" for a 24-hour SLA)
  priority should match the ticket's priority_label in lowercase
""",
    tools=[
        FunctionTool(geocode_location),
        FunctionTool(save_ticket_to_db),
        mcp_tools,
    ],
)


# ─────────────────────────────────────────────
# SUB-AGENT 2: TRACKER AGENT
# ─────────────────────────────────────────────

tracker_agent = Agent(
    name="tracker_agent",
    model="gemini-2.5-flash",
    description=(
        "SLA watchdog — checks overdue tickets, creates officer tasks, escalates CRITICAL ones. "
        "Use for: 'check overdue', 'run SLA check', 'status of GRV-xxx', 'show open tickets'."
    ),
    instruction="""\
You are the SAHAYAK Tracker Agent — the SLA watchdog.

For SLA checks or overdue ticket requests, call run_sla_watchdog() to get overdue tickets.
For each overdue ticket returned, call manage_task with action="create" to create an officer follow-up task.
For any CRITICAL priority ticket, also call create_calendar_event to schedule an urgent follow-up.
Summarize: how many overdue tickets found, tasks created, events scheduled.

For "show open tickets" or "what tickets are active", call get_all_open_tickets() for a full overview.

For status check on a specific ticket, call get_ticket_status with the ticket_id and return the details.
""",
    tools=[
        FunctionTool(run_sla_watchdog),
        FunctionTool(get_all_open_tickets),
        FunctionTool(get_ticket_status),
        mcp_tools,
    ],
)


# ─────────────────────────────────────────────
# SUB-AGENT 3: RESOLVER AGENT
# ─────────────────────────────────────────────

resolver_agent = Agent(
    name="resolver_agent",
    model="gemini-2.5-flash",
    description=(
        "Verifies and closes resolved grievance tickets with evidence logging. "
        "Use for: 'resolve GRV-xxx', 'mark ticket as resolved', 'close ticket GRV-xxx'."
    ),
    instruction="""\
You are the SAHAYAK Resolver Agent.

When asked to resolve a ticket, call resolve_ticket with the ticket_id and resolution note.
Then call add_note to log the resolution as evidence.
Return a confirmation with the ticket_id, category, and resolved timestamp.

If the resolution note seems completely unrelated to the grievance category, mention that before proceeding.
""",
    tools=[
        FunctionTool(resolve_ticket),
        FunctionTool(get_ticket_status),
        mcp_tools,
    ],
)


# ─────────────────────────────────────────────
# SUB-AGENT 4: ANALYTICS AGENT
# ─────────────────────────────────────────────

analytics_agent = Agent(
    name="analytics_agent",
    model="gemini-2.5-flash",
    description=(
        "Answers analytics queries about grievance patterns, hotspots, and SLA performance. "
        "Use for: 'show stats', 'dashboard', 'hotspots', 'CRITICAL tickets in Maharashtra', "
        "'how many water supply complaints', 'which district has most grievances'."
    ),
    instruction="""\
You are the SAHAYAK Analytics Agent.

Use tools to answer questions about grievance data:
- get_full_analytics(top_n): dashboard stats + geographic hotspots in one call — use this for general queries
- query_tickets_by_filter(category, priority_label, status, location_state): filtered ticket list for specific queries

Always return structured JSON with clear labels and a brief natural language summary.
""",
    tools=[
        FunctionTool(get_full_analytics),
        FunctionTool(query_tickets_by_filter),
    ],
)


# ─────────────────────────────────────────────
# ROOT AGENT — ORCHESTRATOR
# ─────────────────────────────────────────────

root_agent = Agent(
    name="sahayak_orchestrator",
    model="gemini-2.5-flash",
    description="SAHAYAK v2 — Multi-agent citizen grievance lifecycle platform for India.",
    instruction="""\
You are SAHAYAK Orchestrator, the primary coordinator for India's multilingual citizen grievance platform.

Route every request to the right specialist sub-agent:

- intake_agent     → NEW GRIEVANCES in any Indian language. It classifies, saves to DB,
                     and returns a ticket_id to the user — all in one step.
- tracker_agent    → SLA checks, overdue tickets, status of a specific ticket (GRV-xxx)
- resolver_agent   → Resolving/closing a ticket ("resolve GRV-xxx, water restored")
- analytics_agent  → Stats, dashboards, hotspots, filtered queries

Always respond in the same language the user writes in.
""",
    sub_agents=[intake_agent, tracker_agent, resolver_agent, analytics_agent],
)
