"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, CheckCircle2, Clock, AlertTriangle, ShieldAlert } from "lucide-react";
import { getTicketDetails } from "@/app/actions";

export default function TrackPage() {
  const [ticketId, setTicketId] = useState("");
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketId.trim()) return;
    
    setLoading(true);
    setError("");
    setTicket(null);
    
    try {
      const data = await getTicketDetails(ticketId.trim());
      if (data) {
        setTicket(data);
      } else {
        setError("We couldn't find a ticket with that ID. Please check and try again.");
      }
    } catch (err) {
      setError("An error occurred while tracking your ticket.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col font-sans pb-20">
      <header className="px-6 py-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <ArrowLeft className="w-6 h-6 text-zinc-900 dark:text-zinc-50" />
            </Link>
            <h1 className="text-xl font-bold ml-4 text-zinc-900 dark:text-zinc-50">Track Grievance</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 mt-6">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 lg:p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm text-center mb-8">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Check Ticket Status</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8">Enter your unique grievance ID to track the real-time progress of your complaint.</p>
          
          <form onSubmit={handleSearch} className="relative max-w-md mx-auto">
            <input 
              type="text" 
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="e.g. GRV-CIVIC-101" 
              className="w-full bg-zinc-100 dark:bg-zinc-800 border-2 border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-500 rounded-full py-4 pl-6 pr-32 text-lg font-mono outline-none transition-all shadow-inner"
              required
            />
            <button 
              type="submit" 
              disabled={loading || !ticketId.trim()}
              className="absolute right-2 top-2 bottom-2 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : "Track"}
            </button>
          </form>
          {error && <p className="text-red-500 mt-4 text-sm font-medium">{error}</p>}
        </div>

        {ticket && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500">
            {/* Header info */}
            <div className="p-6 lg:p-8 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Ticket ID</p>
                  <h3 className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">{ticket.id}</h3>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 uppercase tracking-wider ${
                  ticket.status === 'resolved' ? 'bg-green-100 text-green-700 border border-green-200' :
                  ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                  'bg-amber-100 text-amber-700 border border-amber-200'
                }`}>
                  {ticket.status === 'resolved' ? <CheckCircle2 className="w-4 h-4"/> : 
                   ticket.status === 'in_progress' ? <Clock className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4"/>}
                  {ticket.status.replace("_", " ")}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Issue Type</p>
                  <p className="font-bold text-zinc-900 dark:text-zinc-50 uppercase">{ticket.title}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Assigned Dept</p>
                  <p className="font-bold text-zinc-900 dark:text-zinc-50">{ticket.department || "Processing..."}</p>
                </div>
              </div>
            </div>

            {/* AI Summary */}
            <div className="p-6 lg:p-8 border-b border-zinc-200 dark:border-zinc-800">
               <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center gap-2">
                 <ShieldAlert className="w-4 h-4 text-blue-500"/> AI Assessment
               </h3>
               <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                 {ticket.aiSummary}
               </p>
            </div>

            {/* Activity Timeline */}
            <div className="p-6 lg:p-8">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-6">Activity Timeline</h3>
              <div className="space-y-6">
                 {ticket.events.map((e: any, i: number) => (
                   <div key={e.id} className="flex gap-4 relative">
                     {i !== ticket.events.length - 1 && (
                       <div className="absolute top-6 bottom-[-24px] left-2.5 w-px bg-zinc-200 dark:bg-zinc-800" />
                     )}
                     
                     <div className={`mt-1.5 w-5 h-5 rounded-full border-2 border-white dark:border-zinc-950 z-10 flex-shrink-0 flex items-center justify-center ${
                       e.type === 'status_change' ? 'bg-amber-500' : 
                       e.type === 'created' ? 'bg-green-500' : 'bg-blue-500'
                     }`}>
                       {/* Inner dot for styling */}
                       <div className="w-1.5 h-1.5 bg-white rounded-full" />
                     </div>
                     
                     <div className="flex-1">
                       <p className="text-[15px] text-zinc-900 dark:text-zinc-50 font-medium leading-snug mb-1">{e.description}</p>
                       <p className="text-xs font-medium text-zinc-500">{e.date}</p>
                     </div>
                   </div>
                 ))}
                 {ticket.events.length === 0 && <p className="text-sm text-zinc-500 italic">No events logged yet.</p>}
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
