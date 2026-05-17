"""
sahayak_mcp_server.py — MCP Server for CivicSense AI
Exposes 3 tools via the MCP stdio protocol backed by Neon PostgreSQL:
  - create_calendar_event : schedule SLA deadlines / follow-up dates
  - manage_task           : create / update / list officer action tasks
  - add_note              : log resolution evidence or field notes
"""
from __future__ import annotations

import os
import asyncio
import json
import uuid
import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

import mcp.server.stdio
import mcp.types as types
from mcp.server.lowlevel import Server, NotificationOptions
from mcp.server.models import InitializationOptions

# ── Data store ───────────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

def _get_conn():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is required for MCP Server.")
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

# ── MCP Server ────────────────────────────────────────────────────────────────
app = Server("sahayak-mcp-server")

@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="create_calendar_event",
            description=(
                "Schedule a calendar event for a grievance SLA deadline or officer follow-up. "
                "For event_date, pass an ISO string like '2026-04-09T10:00:00Z', "
                "or pass 'now' to use the current time, or 'now+Nh' for N hours from now (e.g. 'now+24h')."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "title":       {"type": "string", "description": "Event title"},
                    "ticket_id":   {"type": "string", "description": "Associated grievance ticket ID"},
                    "event_date":  {"type": "string", "description": "ISO date string, 'now', or 'now+Nh' (e.g. 'now+24h')"},
                    "description": {"type": "string", "description": "Optional event details"},
                    "priority":    {"type": "string", "enum": ["low", "medium", "high", "critical"], "default": "medium"},
                },
                "required": ["title", "ticket_id"],
            },
        ),
        types.Tool(
            name="manage_task",
            description=(
                "Create, update, or list officer action tasks linked to grievance tickets. "
                "Use action='create' to add a task, 'update' to change status, 'list' to retrieve. "
                "For due_date, pass an ISO string or 'now+Nh' (e.g. 'now+24h'), or omit for tomorrow."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "action":    {"type": "string", "enum": ["create", "update", "list"]},
                    "ticket_id": {"type": "string"},
                    "task_id":   {"type": "string", "description": "Required for update"},
                    "title":     {"type": "string", "description": "Required for create"},
                    "due_date":  {"type": "string", "description": "ISO string, 'now+Nh', or omit for +24h"},
                    "priority":  {"type": "string", "enum": ["low", "medium", "high"], "default": "medium"},
                    "status":    {"type": "string", "enum": ["pending", "in_progress", "done"]},
                    "assigned_to": {"type": "string"},
                },
                "required": ["action"],
            },
        ),
        types.Tool(
            name="add_note",
            description=(
                "Add a resolution note, field observation, or evidence log to a grievance ticket. "
                "Returns the created note with its note_id."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string", "description": "Grievance ticket ID"},
                    "content":   {"type": "string", "description": "Note content / evidence description"},
                    "author":    {"type": "string", "description": "Author name or role", "default": "officer"},
                    "note_type": {"type": "string", "enum": ["resolution", "field_observation", "escalation", "general"], "default": "general"},
                },
                "required": ["ticket_id", "content"],
            },
        ),
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    try:
        now = datetime.datetime.utcnow().isoformat() + "Z"
        
        if name == "create_calendar_event":
            title = arguments.get("title")
            ticket_id = arguments.get("ticket_id")
            event_date = arguments.get("event_date", "now+24h")
            description = arguments.get("description", "")
            priority = arguments.get("priority", "medium")

            if event_date == "now":
                event_date = now
            elif event_date.startswith("now+") and event_date.endswith("h"):
                try:
                    hours = int(event_date[4:-1])
                    event_date = (datetime.datetime.utcnow() + datetime.timedelta(hours=hours)).isoformat() + "Z"
                except ValueError:
                    pass
            
            event_id = uuid.uuid4().hex[:8]
            
            # Secure parameterized insert
            with _get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO calendar_events (event_id, title, ticket_id, event_date, description, priority, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (event_id, title, ticket_id, event_date, description, priority, now))
                conn.commit()

            result = {
                "success": True, 
                "event_id": event_id, 
                "title": title, 
                "ticket_id": ticket_id, 
                "event_date": event_date
            }
            return [types.TextContent(type="text", text=json.dumps(result, indent=2))]

        elif name == "manage_task":
            action = arguments.get("action")
            ticket_id = arguments.get("ticket_id")
            
            with _get_conn() as conn:
                with conn.cursor() as cur:
                    if action == "create":
                        title = arguments.get("title", f"Task for {ticket_id}")
                        due_date = arguments.get("due_date", "now+24h")
                        if due_date == "now":
                            due_date = now
                        elif due_date.startswith("now+") and due_date.endswith("h"):
                            hours = int(due_date[4:-1])
                            due_date = (datetime.datetime.utcnow() + datetime.timedelta(hours=hours)).isoformat() + "Z"

                        priority = arguments.get("priority", "medium")
                        assigned_to = arguments.get("assigned_to", "unassigned")
                        new_id = uuid.uuid4().hex[:8]
                        
                        cur.execute("""
                            INSERT INTO officer_tasks (task_id, ticket_id, title, due_date, priority, status, assigned_to, created_at)
                            VALUES (%s, %s, %s, %s, %s, 'pending', %s, %s)
                        """, (new_id, ticket_id, title, due_date, priority, assigned_to, now))
                        conn.commit()
                        
                        return [types.TextContent(type="text", text=json.dumps({"success": True, "task_id": new_id, "status": "pending"}, indent=2))]
                        
                    elif action == "update":
                        task_id = arguments.get("task_id")
                        status = arguments.get("status", "done")
                        if not task_id:
                            return [types.TextContent(type="text", text=json.dumps({"error": "task_id required"}, indent=2))]
                            
                        cur.execute("UPDATE officer_tasks SET status=%s, updated_at=%s WHERE task_id=%s", (status, now, task_id))
                        conn.commit()
                        return [types.TextContent(type="text", text=json.dumps({"success": True, "task_id": task_id, "new_status": status}, indent=2))]
                        
                    elif action == "list":
                        q = "SELECT * FROM officer_tasks"
                        params = []
                        if ticket_id:
                            q += " WHERE ticket_id = %s"
                            params.append(ticket_id)
                        
                        cur.execute(q + " ORDER BY created_at DESC LIMIT 50", params)
                        tasks = [dict(r) for r in cur.fetchall()]
                        
                        return [types.TextContent(type="text", text=json.dumps({"success": True, "count": len(tasks), "tasks": tasks}, default=str))]

        elif name == "add_note":
            ticket_id = arguments.get("ticket_id")
            content = arguments.get("content")
            author = arguments.get("author", "officer")
            note_type = arguments.get("note_type", "general")
            
            note_id = uuid.uuid4().hex[:8]
            
            with _get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO notes (note_id, ticket_id, content, author, note_type, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (note_id, ticket_id, content, author, note_type, now))
                    
                    # Also log to ticket_events for timeline view
                    event_type = "STATUS_RESOLVED" if note_type == "resolution" else "NOTE_ADDED"
                    cur.execute("""
                        INSERT INTO ticket_events (ticket_id, event_type, description)
                        VALUES (%s, %s, %s)
                    """, (ticket_id, event_type, content[:200]))
                    
                conn.commit()
                
            return [types.TextContent(type="text", text=json.dumps({
                "success": True,
                "note_id": note_id,
                "ticket_id": ticket_id,
                "content": content
            }, indent=2))]
            
        else:
            return [types.TextContent(type="text", text=json.dumps({"error": f"Unknown tool: {name}"}))]
            
    except Exception as e:
        return [types.TextContent(type="text", text=json.dumps({"error": str(e)}))]

async def main():
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, InitializationOptions(
            server_name="sahayak-mcp-server",
            server_version="1.0.0",
            capabilities=app.get_capabilities(
                notification_options=NotificationOptions(),
                experimental_capabilities={},
            )
        ))

if __name__ == "__main__":
    asyncio.run(main())
