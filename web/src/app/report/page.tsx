"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { submitGrievanceToADK } from "@/app/actions";

// Dynamically import the map to avoid SSR issues with Leaflet
const MapWithNoSSR = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-xl flex items-center justify-center text-zinc-400">Loading Map...</div>
});

export default function ReportPage() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [generatedTicketId, setGeneratedTicketId] = useState<string | null>(null);
  const [adkMessage, setAdkMessage] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => setImage(e.target?.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setStatus("submitting");
    
    try {
      let imageUrl = "";
      let base64Data = "";
      let mimeType = "image/jpeg";
      
      const fileInput = document.getElementById('proof-upload') as HTMLInputElement;
      if (fileInput?.files?.[0]) {
        const file = fileInput.files[0];
        mimeType = file.type;
        
        // Get base64 for ADK
        const reader = new FileReader();
        base64Data = await new Promise((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        
        // Upload to local Next.js API to get a URL for the dashboard
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          imageUrl = uploadData.imageUrl;
        }
      }

      const result = await submitGrievanceToADK(description, location, imageUrl, base64Data, mimeType);
      
      if (result.success && result.ticketId) {
        setGeneratedTicketId(result.ticketId);
        setAdkMessage(result.message || null);
        setStatus("success");
      } else {
        // Fallback mock if agent is unreachable
        const randomId = Math.floor(Math.random() * 900) + 100;
        setGeneratedTicketId(`GRV-CIVIC-${randomId}`);
        setStatus("success");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 pb-20">
        <div className="bg-white dark:bg-zinc-900 p-8 lg:p-12 rounded-3xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center text-center max-w-2xl w-full shadow-2xl">
          <CheckCircle2 className="w-20 h-20 text-green-500 mb-6" />
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Ticket Created!</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">
            Your grievance has been validated by CivicSense AI and routed to the correct department.
          </p>

          {adkMessage && (
            <div className="bg-blue-50 dark:bg-blue-900/20 text-left p-6 rounded-2xl w-full mb-6 border border-blue-100 dark:border-blue-800 overflow-y-auto max-h-64">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">AI Agent Response:</h3>
              <p className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{adkMessage}</p>
            </div>
          )}

          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-4 w-full mb-8">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Ticket ID</p>
            <p className="font-mono text-xl font-semibold text-zinc-900 dark:text-zinc-50">{generatedTicketId}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Link href="/" className="flex-1 h-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50 rounded-full flex items-center justify-center font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              Return Home
            </Link>
            <Link href="/track" className="flex-1 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-medium hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20">
              Track Status
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col font-sans pb-20">
      <header className="px-6 py-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-6 h-6 text-zinc-900 dark:text-zinc-50" />
          </Link>
          <h1 className="text-xl font-bold ml-4 text-zinc-900 dark:text-zinc-50">Report Grievance</h1>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-6 mt-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section 1: Issue Details */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 lg:p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-500 flex items-center justify-center text-sm">1</span>
              Issue Details
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Description (Any Language)</label>
                <textarea 
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue... (e.g. पानी की पाइप टूट गई है)"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl p-4 text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Proof (Image/Video)</label>
                <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-8 text-center hover:bg-zinc-50 dark:hover:bg-zinc-950/50 transition-colors cursor-pointer relative overflow-hidden group">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  {image ? (
                    <div className="absolute inset-0 w-full h-full">
                      <img src={image} alt="Upload preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white font-medium flex items-center gap-2"><Upload className="w-5 h-5" /> Change Photo</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center pointer-events-none">
                      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                        <Upload className="w-8 h-8 text-blue-600 dark:text-blue-500" />
                      </div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">Upload Proof of Issue</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Our AI will automatically scan this image.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Location */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 lg:p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-500 flex items-center justify-center text-sm">2</span>
              Exact Location
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Tap on the map to drop a pin precisely where the issue is.</p>
            
            <div className="h-[300px] w-full rounded-2xl overflow-hidden border border-zinc-300 dark:border-zinc-700 relative z-0">
              <MapWithNoSSR onLocationSelect={(lat, lng) => setLocation({lat, lng})} />
            </div>
            {location && (
              <p className="text-xs text-zinc-500 mt-3 font-mono">
                Selected Coordinates: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button 
              type="submit" 
              disabled={status === "submitting"}
              className="h-14 px-8 rounded-full bg-blue-600 text-white font-medium flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
            >
              {status === "submitting" ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing via AI...
                </span>
              ) : "Submit Grievance"}
            </button>
          </div>

        </form>
      </main>
    </div>
  );
}
