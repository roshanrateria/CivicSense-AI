"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Search, Filter, ShieldAlert, Clock, CheckCircle2, AlertTriangle, ArrowLeft, X, Send, Sparkles, Leaf } from "lucide-react";
import { getTickets, getTicketDetails, updateTicketStatus, addTicketEvent, generateOfficerTodos, markTodoDone } from "@/app/actions";

const MapWithNoSSR = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-xl flex items-center justify-center text-zinc-400">Loading Heatmap...</div>
});

export default function OfficerDashboard() {
  const [activeTab, setActiveTab] = useState<"list" | "map">("list");
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [syncActive, setSyncActive] = useState(true);
  
  const [todos, setTodos] = useState<{ticketId: string, task: string, done: boolean}[]>([]);
  const [generatingTodos, setGeneratingTodos] = useState(false);
  const todosGeneratedRef = useRef(false);

  const fetchTickets = () => {
    getTickets().then((data) => {
      setTickets(data);
      setLoading(false);
      // Auto-generate To-Dos only once on first load
      if (data.length > 0 && !todosGeneratedRef.current) {
        todosGeneratedRef.current = true;
        setGeneratingTodos(true);
        generateOfficerTodos(data).then(aiTodos => {
           setTodos(aiTodos.map((t: any) => ({ ...t, done: false })));
           setGeneratingTodos(false);
        });
      }
    });
  };

  useEffect(() => {
    fetchTickets();
    // Real polling every 30 seconds — keeps "Live Sync" badge honest
    const interval = setInterval(() => {
      setSyncActive(false);
      setTimeout(() => {
        fetchTickets();
        setSyncActive(true);
      }, 400);
    }, 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col font-sans relative">
      {/* Modal Overlay */}
      {selectedTicketId && (
        <TicketModal 
          ticketId={selectedTicketId} 
          onClose={() => {
            setSelectedTicketId(null);
            fetchTickets(); // refresh main board to reflect status changes
          }} 
        />
      )}

      <header className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-zinc-900 dark:text-zinc-50" />
          </Link>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-blue-600 dark:text-blue-500" />
            <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">CivicSense AI <span className="font-medium text-zinc-500">| Officer Portal</span></span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/eco" className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
            <Leaf className="w-4 h-4" /> Eco-Impact
          </Link>
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-sm font-medium">
            <div className={`w-2 h-2 rounded-full ${syncActive ? "bg-green-500 animate-pulse" : "bg-zinc-400"}`} />
            {syncActive ? "Live Sync Active" : "Syncing..."}
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold">
            JD
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-73px)] overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full lg:w-80 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 flex flex-col gap-6 lg:overflow-y-auto">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">Overview</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 p-4 rounded-2xl">
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{tickets.filter(t => t.priority === "CRITICAL").length}</p>
                <p className="text-sm font-medium text-red-700 dark:text-red-500 mt-1">SLA Breach Risk</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 p-4 rounded-2xl">
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{tickets.filter(t => t.status === "open").length}</p>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-500 mt-1">Open Tickets</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">Filters</h2>
            <div className="space-y-2">
              <button className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-medium">
                All Departments
                <Filter className="w-4 h-4 text-zinc-500" />
              </button>
              <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-sm font-medium transition-colors">
                Priority: Critical Only
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-[200px]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" /> AI Action Plan
              </h2>
            </div>
            <div className="space-y-2 bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30">
              {generatingTodos ? (
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 p-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  Generating To-Dos...
                </div>
              ) : todos.length > 0 ? (
                todos.map((todo, idx) => (
                  <div key={idx} className={`flex items-start gap-2.5 p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm transition-all ${todo.done ? 'opacity-50 grayscale' : ''}`}>
                    <input 
                      type="checkbox" 
                      checked={todo.done}
                      onChange={async () => {
                        if (todo.done) return;
                        // Optimistic update
                        setTodos(prev => prev.map((t, i) => i === idx ? { ...t, done: true } : t));
                        await markTodoDone(todo.ticketId, todo.task);
                        fetchTickets(); // refresh board
                      }}
                      className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium leading-snug ${todo.done ? 'line-through text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'}`}>{todo.task}</p>
                      <p className="text-[10px] font-mono text-zinc-500 mt-1">{todo.ticketId}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-500 italic p-2">No urgent actions pending.</p>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <section className="flex-1 flex flex-col min-w-0 bg-zinc-50 dark:bg-zinc-950">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900">
            <div className="relative max-w-md w-full">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Search ticket ID or AI summary..." 
                className="w-full bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-900 border focus:border-blue-500 rounded-full py-2.5 pl-10 pr-4 text-sm outline-none transition-all"
              />
            </div>
            
            <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-full p-1">
              <button 
                onClick={() => setActiveTab("list")}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeTab === "list" ? "bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
              >
                Kanban
              </button>
              <button 
                onClick={() => setActiveTab("map")}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeTab === "map" ? "bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
              >
                Map View
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {loading ? (
               <div className="w-full h-full flex items-center justify-center text-zinc-500">
                 <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
               </div>
            ) : activeTab === "list" ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full items-start">
                {/* To Do Column */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500"/> Open</h3>
                    <span className="bg-zinc-200 dark:bg-zinc-800 text-xs px-2 py-0.5 rounded-full font-medium">{tickets.filter(t => t.status === "open").length}</span>
                  </div>
                  {tickets.filter(t => t.status === "open").map(ticket => (
                    <TicketCard key={ticket.id} ticket={ticket} onClick={() => setSelectedTicketId(ticket.id)} />
                  ))}
                  {tickets.filter(t => t.status === "open").length === 0 && <p className="text-sm text-zinc-500 italic">No open tickets.</p>}
                </div>
                
                {/* In Progress Column */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-bold flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500"/> In Progress</h3>
                    <span className="bg-zinc-200 dark:bg-zinc-800 text-xs px-2 py-0.5 rounded-full font-medium">{tickets.filter(t => t.status === "in_progress").length}</span>
                  </div>
                  {tickets.filter(t => t.status === "in_progress").map(ticket => (
                    <TicketCard key={ticket.id} ticket={ticket} onClick={() => setSelectedTicketId(ticket.id)} />
                  ))}
                </div>

                {/* Resolved Column */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Resolved</h3>
                    <span className="bg-zinc-200 dark:bg-zinc-800 text-xs px-2 py-0.5 rounded-full font-medium">{tickets.filter(t => t.status === "resolved").length}</span>
                  </div>
                  {tickets.filter(t => t.status === "resolved").map(ticket => (
                    <TicketCard key={ticket.id} ticket={ticket} onClick={() => setSelectedTicketId(ticket.id)} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-inner relative z-0">
                <MapWithNoSSR 
                  readOnly={true} 
                  markers={tickets.map(t => {
                    let color = "#3b82f6"; // default blue
                    if (t.priority === "CRITICAL") color = "#ef4444"; // red
                    else if (t.priority === "HIGH") color = "#f59e0b"; // amber
                    
                    return {
                      lat: t.lat,
                      lng: t.lng,
                      color: color,
                      popup: `<div style="font-family: sans-serif; min-width: 150px;"><strong style="color: ${color}; display: block; margin-bottom: 4px; font-size: 12px;">${t.id}</strong><b style="font-size: 14px; display: block; margin-bottom: 4px;">${t.title}</b><span style="font-size: 11px; background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${t.priority}</span></div>`
                    };
                  })}
                />
                <div className="absolute top-4 left-4 z-[400] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-lg pointer-events-none">
                  <p className="text-sm font-semibold mb-2">Issue Heatmap</p>
                  <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400"><div className="w-3 h-3 rounded-full bg-red-500"/> Critical</div>
                  <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 mt-1"><div className="w-3 h-3 rounded-full bg-amber-500"/> High</div>
                  <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 mt-1"><div className="w-3 h-3 rounded-full bg-blue-500"/> Medium / Low</div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function TicketCard({ ticket, onClick }: { ticket: any, onClick: () => void }) {
  const isCritical = ticket.priority === "CRITICAL";
  const createdDate = new Date(ticket.createdAt);
  const slaDeadline = new Date(createdDate.getTime() + (ticket.slaHours || 48) * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = slaDeadline.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const isOverdue = diffHours < 0;
  
  const badgeClass = isOverdue ? "bg-red-500 text-white animate-pulse" : (diffHours <= 12 ? "bg-amber-500 text-white" : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400");
  const badgeText = isOverdue ? `🚨 Overdue by ${Math.abs(diffHours)}h` : `⏳ Deadline in ${diffHours}h`;

  return (
    <div onClick={onClick} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-mono text-zinc-500">{ticket.id}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
          isCritical ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" : 
          ticket.priority === "HIGH" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
          "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
        }`}>
          {ticket.priority}
        </span>
      </div>
      <h4 className="font-bold text-zinc-900 dark:text-zinc-50 mb-1 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase">{ticket.title}</h4>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-4">
        <span className="font-semibold text-blue-600 dark:text-blue-400">AI Note:</span> {ticket.aiSummary}
      </p>
      {ticket.imageUrl && (
        <div className="mb-4 h-24 w-full rounded-xl overflow-hidden relative">
          <img src={ticket.imageUrl} alt="Proof thumbnail" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/10"></div>
        </div>
      )}
      <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800/50">
        <div className="flex flex-col gap-1.5">
          {ticket.status !== 'resolved' && (
             <span className={`text-[10px] font-bold px-2 py-0.5 rounded w-fit tracking-wider ${badgeClass}`}>{badgeText}</span>
          )}
          <span className="text-[10px] text-zinc-400 flex items-center gap-1"><Clock className="w-3 h-3"/> {ticket.date}</span>
        </div>
        <button className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline group-hover:text-blue-700">View Details</button>
      </div>
    </div>
  );
}

function TicketModal({ ticketId, onClose }: { ticketId: string, onClose: () => void }) {
  const [details, setDetails] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchDetails = () => {
    getTicketDetails(ticketId).then(setDetails);
  };

  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  if (!details) {
    return (
      <div className="fixed inset-0 z-[1000] bg-zinc-900/50 backdrop-blur-sm flex justify-end">
        <div className="w-full max-w-lg h-full bg-white dark:bg-zinc-950 shadow-2xl flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIsUpdating(true);
    await updateTicketStatus(ticketId, e.target.value);
    await fetchDetails();
    setIsUpdating(false);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setIsUpdating(true);
    await addTicketEvent(ticketId, comment);
    setComment("");
    await fetchDetails();
    setIsUpdating(false);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-zinc-900/50 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-lg h-full bg-white dark:bg-zinc-950 shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
           <div>
             <h2 className="text-xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-50">{details.id}</h2>
             <p className="text-sm text-zinc-500 dark:text-zinc-400 uppercase font-semibold mt-1">{details.title}</p>
           </div>
           <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
             <X className="w-5 h-5 text-zinc-500"/>
           </button>
        </div>

        <div className="flex-1 overflow-y-auto">
           {/* Image proof */}
           {details.imageUrl && (
             <div className="w-full h-64 relative border-b border-zinc-200 dark:border-zinc-800">
               <img src={details.imageUrl} alt="Grievance Proof" className="w-full h-full object-cover" />
               <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium text-white shadow-lg">
                 AI Verified Proof
               </div>
             </div>
           )}
           
           <div className="p-6 space-y-8">
             {/* Key Info */}
             <div className="grid grid-cols-2 gap-4">
               <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                 <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Priority</p>
                 <p className={`font-bold ${details.priority === 'CRITICAL' ? 'text-red-600' : 'text-zinc-900 dark:text-zinc-50'}`}>{details.priority}</p>
               </div>
               <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                 <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Department</p>
                 <p className="font-bold text-zinc-900 dark:text-zinc-50">{details.department || "N/A"}</p>
               </div>
             </div>

             {/* AI Summary */}
             <div>
               <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center gap-2">
                 <ShieldAlert className="w-4 h-4 text-blue-500"/> AI Recommended Action
               </h3>
               <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 p-4 rounded-2xl text-sm leading-relaxed border border-blue-100 dark:border-blue-900/50">
                 {details.aiSummary}
               </div>
             </div>

             {/* Status Dropdown */}
             <div>
               <label className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 block">Current Status</label>
               <select 
                 value={details.status} 
                 onChange={handleStatusChange} 
                 disabled={isUpdating}
                 className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
               >
                 <option value="open">⚠️ Open</option>
                 <option value="in_progress">⏳ In Progress</option>
                 <option value="resolved">✅ Resolved</option>
               </select>
             </div>

             {/* Timeline */}
             <div>
               <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-4">Activity Timeline</h3>
               <div className="space-y-5">
                 {details.events.map((e: any, i: number) => (
                   <div key={e.id} className="flex gap-4 relative">
                     {/* Timeline line connecting dots */}
                     {i !== details.events.length - 1 && (
                       <div className="absolute top-6 bottom-[-20px] left-2 w-px bg-zinc-200 dark:bg-zinc-800" />
                     )}
                     
                     {/* Timeline dot */}
                     <div className={`mt-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-zinc-950 z-10 flex-shrink-0 ${
                       e.type === 'status_change' ? 'bg-amber-500' : 
                       e.type === 'created' ? 'bg-green-500' : 'bg-blue-500'
                     }`} />
                     
                     <div className="flex-1 bg-zinc-50 dark:bg-zinc-900 p-3 rounded-2xl rounded-tl-none border border-zinc-200 dark:border-zinc-800 shadow-sm">
                       <p className="text-sm text-zinc-900 dark:text-zinc-50 mb-1 leading-snug">{e.description}</p>
                       <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{e.date}</p>
                     </div>
                   </div>
                 ))}
                 {details.events.length === 0 && <p className="text-sm text-zinc-500 italic">No events logged yet.</p>}
               </div>
             </div>
           </div>
        </div>
        
        {/* Comment Input */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          <form onSubmit={handleCommentSubmit} className="flex gap-2">
            <input 
              type="text" 
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a comment or update..."
              disabled={isUpdating}
              className="flex-1 rounded-full px-5 py-3 text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
            />
            <button 
              type="submit" 
              disabled={isUpdating || !comment.trim()} 
              className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20"
            >
              {isUpdating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Send className="w-5 h-5 ml-0.5"/>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
