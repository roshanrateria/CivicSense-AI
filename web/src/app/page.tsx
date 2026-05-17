import Link from "next/link";
import { ArrowRight, ShieldAlert, Activity, MapPin, Leaf } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col font-sans">
      <header className="px-6 lg:px-8 py-6 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-8 h-8 text-blue-600 dark:text-blue-500" />
          <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">CivicSense AI</span>
        </div>
        <nav className="flex gap-4">
          <Link href="/eco" className="text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors flex items-center gap-1">
            <Leaf className="w-4 h-4" /> Eco-Impact
          </Link>
          <Link href="/officer" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors">
            Officer Portal
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 lg:p-24">
        <div className="max-w-4xl w-full text-center space-y-8">
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 text-balance leading-tight">
            Report Civic Issues. <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">Fast & Resolved.</span>
          </h1>
          <p className="text-lg lg:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto text-balance">
            CivicSense AI instantly routes your complaints to the right department in any Indian language. Upload a photo, and we'll take care of the rest.
          </p>
          
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/report" 
              className="group flex h-14 items-center justify-center gap-2 rounded-full bg-blue-600 px-8 text-white font-medium transition-all hover:bg-blue-700 hover:scale-105 active:scale-95 w-full sm:w-auto shadow-lg shadow-blue-500/25"
            >
              Report a Grievance
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link 
              href="/track" 
              className="flex h-14 items-center justify-center gap-2 rounded-full border-2 border-zinc-200 dark:border-zinc-800 px-8 text-zinc-900 dark:text-zinc-50 font-medium transition-all hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 w-full sm:w-auto"
            >
              Track Status
            </Link>
          </div>
        </div>

        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full">
          <FeatureCard 
            icon={<MapPin className="w-8 h-8 text-blue-500" />}
            title="Auto-Location"
            description="Our AI extracts exact coordinates from your uploaded images and text."
          />
          <FeatureCard 
            icon={<Activity className="w-8 h-8 text-green-500" />}
            title="SLA Tracking"
            description="Departments are bound by strict SLAs. If they miss it, tickets auto-escalate."
          />
          <FeatureCard 
            icon={<ShieldAlert className="w-8 h-8 text-purple-500" />}
            title="Spam Protection"
            description="Advanced computer vision automatically rejects fake or irrelevant complaints."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-start gap-4 transition-transform hover:-translate-y-1 hover:shadow-xl hover:shadow-zinc-200/50 dark:hover:shadow-black/50">
      <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
