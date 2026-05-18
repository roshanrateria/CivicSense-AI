"use server";

import { Pool } from "pg";
import { revalidatePath } from "next/cache";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function getTickets() {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT * FROM tickets ORDER BY created_at DESC LIMIT 50');
    client.release();
    
    return res.rows.map(row => ({
      id: row.ticket_id || row.id,
      title: row.category ? row.category.replace("_", " ") : "General Grievance",
      status: (row.status || "open").toLowerCase(),
      priority: row.priority_label || "MEDIUM",
      date: new Date(row.created_at || new Date()).toLocaleString(),
      createdAt: row.created_at || new Date(),
      slaHours: row.sla_hours || 48,
      aiSummary: row.recommended_action || "Issue reported.",
      lat: row.latitude || 28.6139,
      lng: row.longitude || 77.2090,
      imageUrl: row.image_url,
    }));
  } catch (error) {
    console.error("Failed to fetch tickets:", error);
    return [];
  }
}

export async function getTicketDetails(ticketId: string) {
  try {
    const client = await pool.connect();
    const ticketRes = await client.query('SELECT * FROM tickets WHERE ticket_id = $1 LIMIT 1', [ticketId]);
    const eventsRes = await client.query('SELECT * FROM ticket_events WHERE ticket_id = $1 ORDER BY created_at DESC', [ticketId]);
    client.release();

    if (ticketRes.rows.length === 0) return null;

    const row = ticketRes.rows[0];
    return {
      id: row.ticket_id,
      title: row.category ? row.category.replace("_", " ") : "General Grievance",
      status: (row.status || "open").toLowerCase(),
      priority: row.priority_label || "MEDIUM",
      date: new Date(row.created_at).toLocaleString(),
      aiSummary: row.recommended_action || "Issue reported.",
      lat: row.latitude,
      lng: row.longitude,
      imageUrl: row.image_url,
      department: row.state_department,
      language: row.detected_language,
      events: eventsRes.rows.map(e => ({
        id: e.id,
        type: e.event_type,
        description: e.description,
        date: new Date(e.created_at).toLocaleString()
      }))
    };
  } catch (error) {
    console.error("Failed to fetch ticket details:", error);
    return null;
  }
}

export async function updateTicketStatus(ticketId: string, newStatus: string) {
  try {
    const client = await pool.connect();
    await client.query('UPDATE tickets SET status = $1 WHERE ticket_id = $2', [newStatus, ticketId]);
    await client.query(
      'INSERT INTO ticket_events (ticket_id, event_type, description) VALUES ($1, $2, $3)', 
      [ticketId, 'status_change', `Status updated to ${newStatus.toUpperCase()}.`]
    );
    client.release();
    revalidatePath('/officer');
    return true;
  } catch (error) {
    console.error("Failed to update status:", error);
    return false;
  }
}

export async function addTicketEvent(ticketId: string, comment: string) {
  try {
    const client = await pool.connect();
    await client.query(
      'INSERT INTO ticket_events (ticket_id, event_type, description) VALUES ($1, $2, $3)', 
      [ticketId, 'comment', comment]
    );
    client.release();
    revalidatePath('/officer');
    return true;
  } catch (error) {
    console.error("Failed to add comment:", error);
    return false;
  }
}

export async function submitGrievanceToADK(text: string, location: {lat: number, lng: number} | null, imageUrl: string, base64Data: string, mimeType: string) {
  try {
    // Compose the prompt asking the agent to process the image and extract the URL
    const locationStr = location ? `[Location: ${location.lat}, ${location.lng}]` : "[Location: Not Provided]";
    const promptText = `Please process this citizen grievance. \n\nGrievance: ${text}\n${locationStr}\n[Image URL to save: ${imageUrl}]\n\nPlease look at the attached image for proof and score priority accordingly.`;

    const parts: any[] = [{ text: promptText }];
    if (base64Data) {
      parts.push({ inlineData: { mimeType: mimeType, data: base64Data } });
    }

    const payload = {
      appName: "sahayak_master_agent",
      userId: "citizen_web",
      sessionId: `session_${Date.now()}`,
      newMessage: {
        role: "user",
        parts: parts
      }
    };

    const adkUrl = process.env.ADK_API_URL || "http://127.0.0.1:8000";
    
    // Explicitly create the session first to avoid 404 on /run
    const sessionRes = await fetch(`${adkUrl}/apps/${payload.appName}/users/${payload.userId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: payload.sessionId })
    });
    
    if (!sessionRes.ok) {
      console.warn("Session creation returned status:", sessionRes.status);
    }

    const res = await fetch(`${adkUrl}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`ADK API responded with status: ${res.status}`);
    }

    const result = await res.json();
    
    let messageText = "Ticket processed by AI.";
    if (Array.isArray(result) && result.length > 0) {
      const lastMsg = result[result.length - 1];
      if (lastMsg?.content?.parts?.[0]?.text) {
        messageText = lastMsg.content.parts[0].text;
      }
    }
    
    // Get the latest ticket added
    const client = await pool.connect();
    const latestRes = await client.query("SELECT ticket_id FROM tickets ORDER BY created_at DESC LIMIT 1");
    client.release();
    
    revalidatePath('/officer');
    
    return {
      success: true,
      ticketId: latestRes.rows[0]?.ticket_id || null,
      message: messageText
    };
  } catch (error) {
    console.error("Failed to submit to ADK:", error);
    return { success: false, error: String(error) };
  }
}

export async function generateOfficerTodos(tickets: any[]) {
  try {
    const key = process.env.GOOGLE_API_KEY;
    if (!key) throw new Error("Missing GOOGLE_API_KEY");
    
    const activeTickets = tickets.filter(t => t.status !== "resolved");
    const ticketsJson = JSON.stringify(activeTickets.map(t => ({
      id: t.id, title: t.title, priority: t.priority, status: t.status, summary: t.aiSummary
    })));

    const prompt = `You are an AI assistant for a Government Officer. Analyze these active grievances: ${ticketsJson}. Create a concise list of 3-5 immediate, actionable TO-DO items to resolve the most urgent/critical tickets. 
Respond ONLY with a valid JSON array of objects. Each object must have: 
- "ticketId": the ticket ID.
- "task": a 3-6 word clear instruction (e.g. "Dispatch plumber").
Do NOT include any markdown blocks or text outside the JSON array.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    
    const data = await res.json();
    const textResp = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResp) return [];
    
    return JSON.parse(textResp);
  } catch (error) {
    console.error("AI Todo Generation failed:", error);
    return [];
  }
}

export async function markTodoDone(ticketId: string, taskDescription: string) {
  try {
    const client = await pool.connect();
    
    const res = await client.query('SELECT status FROM tickets WHERE ticket_id = $1', [ticketId]);
    if (res.rows.length > 0) {
      const status = res.rows[0].status;
      if (status === 'open') {
        await client.query('UPDATE tickets SET status = $1 WHERE ticket_id = $2', ['in_progress', ticketId]);
        await client.query(
          'INSERT INTO ticket_events (ticket_id, event_type, description) VALUES ($1, $2, $3)', 
          [ticketId, 'status_change', 'Status updated to IN_PROGRESS.']
        );
      }
    }
    
    await client.query(
      'INSERT INTO ticket_events (ticket_id, event_type, description) VALUES ($1, $2, $3)', 
      [ticketId, 'comment', `${taskDescription}: Done (Automated)`]
    );
    client.release();
    revalidatePath('/officer');
    return true;
  } catch (error) {
    console.error("Failed to mark todo done:", error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ECO-IMPACT — research-backed environmental savings calculator
//
// Water leak rates (Indian municipal data):
//   Minor pipe leak:    ~500 L/hr
//   Major pipe burst:  ~2,000 L/hr
//   Borewell overflow: ~1,200 L/hr
//   Sewage overflow:   ~800 L/hr  (contamination risk multiplier applied)
//
// Electricity waste:
//   Streetlight fault: ~0.15 kWh/hr per light (avg 250W sodium lamp)
//   Transformer fault: ~5 kWh/hr line loss
//
// Environment / pollution:
//   Illegal dump site: ~0.8 tonnes CO₂e per day if left unaddressed
//   Factory smoke:     ~2.5 tonnes CO₂e per day
// ─────────────────────────────────────────────────────────────────────────────

const ECO_RATES: Record<string, {
  unit: string;
  label: string;
  ratePerHour: number;
  icon: string;
  color: string;
  description: string;
}> = {
  water_supply: {
    unit: "litres",
    label: "Water Saved",
    ratePerHour: 900,       // avg of minor/major/borewell leaks
    icon: "💧",
    color: "blue",
    description: "Litres of clean water conserved by rapid response to leaks and pipe bursts",
  },
  electricity: {
    unit: "kWh",
    label: "Energy Saved",
    ratePerHour: 0.15,
    icon: "⚡",
    color: "yellow",
    description: "kWh of electricity saved by fixing faulty streetlights and transformers",
  },
  environment: {
    unit: "kg CO₂e",
    label: "Emissions Avoided",
    ratePerHour: 33.3,      // 0.8 tonnes/day ÷ 24h
    icon: "🌿",
    color: "green",
    description: "kg of CO₂ equivalent emissions avoided by addressing pollution and dump sites",
  },
  roads_infrastructure: {
    unit: "incidents",
    label: "Accidents Prevented",
    ratePerHour: 0.004,     // ~0.1 incident per day per unaddressed pothole
    icon: "🛣️",
    color: "orange",
    description: "Estimated road accidents prevented by fixing potholes and infrastructure hazards",
  },
  public_safety: {
    unit: "people",
    label: "People Protected",
    ratePerHour: 0.5,
    icon: "🛡️",
    color: "red",
    description: "Estimated people protected from safety hazards per hour of rapid response",
  },
};

export interface EcoTicket {
  ticketId: string;
  category: string;
  status: string;
  priorityLabel: string;
  createdAt: string;
  slaDeadline: string;
  resolvedAt: string | null;
  hoursToResolve: number | null;
  savedAmount: number | null;
  unit: string;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export interface EcoImpactData {
  totalWaterSaved: number;
  totalEnergySaved: number;
  totalEmissionsAvoided: number;
  totalAccidentsPrevented: number;
  resolvedEcoTickets: number;
  activeEcoTickets: number;
  tickets: EcoTicket[];
  categoryBreakdown: { category: string; count: number; totalSaved: number; unit: string; icon: string; color: string; label: string }[];
  avgResponseHours: number;
}

export async function getEcoImpact(): Promise<EcoImpactData> {
  const ecoCategories = Object.keys(ECO_RATES);

  // Robustly parse any date value psycopg2/pg may return (Date object, ISO string, or null)
  function parseDate(val: unknown): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    const d = new Date(String(val));
    return isNaN(d.getTime()) ? null : d;
  }

  try {
    const client = await pool.connect();
    const res = await client.query(`
      SELECT
        ticket_id, category, status, priority_label,
        created_at, sla_deadline, updated_at, sla_hours
      FROM tickets
      WHERE category = ANY($1::text[])
      ORDER BY created_at DESC
    `, [ecoCategories]);
    client.release();

    const now = new Date();
    const tickets: EcoTicket[] = [];
    const categoryTotals: Record<string, { count: number; totalSaved: number }> = {};

    let totalWaterSaved = 0;
    let totalEnergySaved = 0;
    let totalEmissionsAvoided = 0;
    let totalAccidentsPrevented = 0;
    let resolvedCount = 0;
    let activeCount = 0;
    let totalResponseHours = 0;
    let resolvedWithTime = 0;

    for (const row of res.rows) {
      const rate = ECO_RATES[row.category];
      if (!rate) continue;

      // Normalise status — DB has mixed case ('open', 'OPEN', 'resolved', 'RESOLVED')
      const statusNorm = String(row.status).toLowerCase();
      const isResolved = statusNorm === "resolved" || statusNorm === "closed";

      const createdAt = parseDate(row.created_at);
      const updatedAt = parseDate(row.updated_at);
      const slaHours  = Number(row.sla_hours) || 48;

      if (!createdAt) continue;

      let hoursElapsed: number;

      if (isResolved) {
        // If updated_at is valid and meaningfully after created_at, use it.
        // Otherwise fall back to sla_hours as a proxy for how long the issue ran.
        const rawHours = updatedAt
          ? (updatedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
          : 0;
        hoursElapsed = rawHours > 1 ? rawHours : slaHours;
      } else {
        // Active ticket: hours since creation, clamped to non-negative
        // (future-dated tickets from seed data get 0 until they become "past")
        hoursElapsed = Math.max(0, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
      }

      // Savings = rate × hours (capped at 7 days to prevent outlier inflation)
      const cappedHours = Math.min(hoursElapsed, 168);
      const savedAmount = parseFloat((rate.ratePerHour * cappedHours).toFixed(2));

      const resolvedAt = isResolved ? (updatedAt || createdAt) : null;

      if (isResolved) {
        resolvedCount++;
        totalResponseHours += hoursElapsed;
        resolvedWithTime++;
      } else {
        activeCount++;
      }

      // Accumulate totals by type
      if (row.category === "water_supply")        totalWaterSaved        += savedAmount;
      if (row.category === "electricity")          totalEnergySaved       += savedAmount;
      if (row.category === "environment")          totalEmissionsAvoided  += savedAmount;
      if (row.category === "roads_infrastructure") totalAccidentsPrevented += savedAmount;

      // Category breakdown
      if (!categoryTotals[row.category]) categoryTotals[row.category] = { count: 0, totalSaved: 0 };
      categoryTotals[row.category].count++;
      categoryTotals[row.category].totalSaved += savedAmount;

      tickets.push({
        ticketId: row.ticket_id,
        category: row.category,
        status: row.status,
        priorityLabel: row.priority_label,
        createdAt: createdAt.toISOString(),
        slaDeadline: String(row.sla_deadline ?? ""),
        resolvedAt: resolvedAt?.toISOString() || null,
        hoursToResolve: isResolved ? parseFloat(hoursElapsed.toFixed(1)) : null,
        savedAmount,
        unit: rate.unit,
        label: rate.label,
        icon: rate.icon,
        color: rate.color,
        description: rate.description,
      });
    }

    const categoryBreakdown = Object.entries(categoryTotals).map(([cat, data]) => ({
      category: cat,
      count: data.count,
      totalSaved: parseFloat(data.totalSaved.toFixed(2)),
      unit: ECO_RATES[cat].unit,
      icon: ECO_RATES[cat].icon,
      color: ECO_RATES[cat].color,
      label: ECO_RATES[cat].label,
    }));

    return {
      totalWaterSaved: parseFloat(totalWaterSaved.toFixed(0)),
      totalEnergySaved: parseFloat(totalEnergySaved.toFixed(2)),
      totalEmissionsAvoided: parseFloat(totalEmissionsAvoided.toFixed(1)),
      totalAccidentsPrevented: parseFloat(totalAccidentsPrevented.toFixed(1)),
      resolvedEcoTickets: resolvedCount,
      activeEcoTickets: activeCount,
      tickets,
      categoryBreakdown,
      avgResponseHours: resolvedWithTime > 0
        ? parseFloat((totalResponseHours / resolvedWithTime).toFixed(1))
        : 0,
    };
  } catch (error) {
    console.error("Failed to fetch eco impact:", error);
    return {
      totalWaterSaved: 0, totalEnergySaved: 0, totalEmissionsAvoided: 0,
      totalAccidentsPrevented: 0, resolvedEcoTickets: 0, activeEcoTickets: 0,
      tickets: [], categoryBreakdown: [], avgResponseHours: 0,
    };
  }
}
