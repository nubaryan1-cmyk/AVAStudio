"use client";
import React from "react";
import { Activity, Cpu, Database, Zap, Globe, Layers, Command, Play, Terminal } from "lucide-react";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-[#030303] text-white font-mono selection:bg-[#00ff99] selection:text-black">
      
      {/* Background Grid & Effects */}
      <div className="fixed inset-0 bg-grid-pattern bg-[length:40px_40px] opacity-20 pointer-events-none"></div>
      <div className="fixed inset-0 bg-radial-fader pointer-events-none"></div>
      <div className="scanlines"></div>

      {/* TOP NAV / HUD */}
      <header className="relative z-10 flex justify-between items-center px-8 py-6 border-b border-white/10 bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
            <div className="w-2 h-8 bg-[#00ff99] shadow-[0_0_15px_#00ff99]"></div>
            <h1 className="text-2xl font-bold tracking-widest text-white">
              AVA<span className="text-[#00ff99]">STUDIO</span>
            </h1>
        </div>
        <div className="flex gap-6 text-xs tracking-[0.2em] text-white/50">
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                SYSTEM: STABLE
            </div>
            <div>CPU: 12%</div>
            <div>MEM: 42GB</div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="relative z-10 p-8 grid grid-cols-12 gap-6 max-w-[1920px] mx-auto">
        
        {/* LEFT COLUMN: CONTROLS */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
            {/* Control Panel */}
            <div className="glass-panel p-6 rounded-xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00ff99] to-transparent opacity-50"></div>
                <h2 className="text-white/40 text-sm mb-4 tracking-widest flex items-center gap-2"><Command size={14}/> OPERATIONS</h2>
                
                <div className="space-y-3">
                    <button className="w-full py-4 bg-[#00ff99]/10 border border-[#00ff99]/20 hover:bg-[#00ff99] hover:text-black text-[#00ff99] transition-all duration-300 font-bold tracking-wider flex items-center justify-center gap-2 group-hover:shadow-[0_0_20px_rgba(0,255,153,0.2)]">
                        <Play size={16} /> INITIALIZE RUNPOD
                    </button>
                    <button className="w-full py-4 bg-white/5 border border-white/10 hover:border-white/50 transition-all font-bold tracking-wider text-white/60">
                        COMPILE CANON
                    </button>
                </div>
            </div>

            {/* Terminal Output */}
            <div className="glass-panel p-4 rounded-xl h-[400px] flex flex-col font-mono text-xs">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-2 text-white/40">
                    <Terminal size={14} /> LIVE_LOGS
                </div>
                <div className="flex-1 overflow-hidden relative">
                    <div className="absolute inset-0 opacity-70 space-y-1 text-green-400/80">
                        <p>> [SYSTEM] Core initialized.</p>
                        <p>> [GATEWAY] Listening on port 3000...</p>
                        <p>> [WORKER] Probe_01 connected (RTX 4090)</p>
                        <p>> [WORKER] Probe_02 connected (A100)</p>
                        <p className="text-yellow-400">> [WARN] Latency spike detected on Node-4</p>
                        <p>> [CANON] Registry loaded: 142 models.</p>
                        <p className="animate-pulse">_</p>
                    </div>
                </div>
            </div>
        </div>

        {/* CENTER COLUMN: VISUALIZATION */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-6">
            {/* Main Visualizer (The Globe/Map placeholder) */}
            <div className="glass-panel h-[500px] rounded-xl flex items-center justify-center relative overflow-hidden border border-[#00ff99]/20">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,255,153,0.1),_transparent_60%)]"></div>
                
                {/* Center Circle */}
                <div className="relative z-10 w-64 h-64 rounded-full border border-[#00ff99]/30 flex items-center justify-center animate-[spin_10s_linear_infinite]">
                    <div className="w-48 h-48 rounded-full border border-[#00ff99]/50 border-dashed"></div>
                </div>
                <div className="absolute z-20 text-center">
                    <h1 className="text-5xl font-black text-white tracking-tighter neon-text">IDLE STATE</h1>
                    <p className="text-[#00ff99] tracking-[0.5em] text-sm mt-2">WAITING FOR INPUT</p>
                </div>
                
                {/* Nodes decoration */}
                <div className="absolute top-10 left-10 p-2 border border-white/10 bg-black/80 text-xs">NODE_A // ONLINE</div>
                <div className="absolute bottom-10 right-10 p-2 border border-white/10 bg-black/80 text-xs">NODE_B // ONLINE</div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
                <div className="glass-panel p-4 rounded-xl">
                    <div className="text-white/40 text-xs mb-1">ACTIVE JOBS</div>
                    <div className="text-3xl font-bold">0</div>
                </div>
                <div className="glass-panel p-4 rounded-xl">
                    <div className="text-white/40 text-xs mb-1">TOTAL GENERATED</div>
                    <div className="text-3xl font-bold text-[#00ff99]">8,492</div>
                </div>
                <div className="glass-panel p-4 rounded-xl">
                    <div className="text-white/40 text-xs mb-1">GPU COST/HR</div>
                    <div className="text-3xl font-bold">$1.24</div>
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN: ARTIFACTS */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
             <div className="glass-panel p-6 rounded-xl h-full min-h-[600px]">
                <h2 className="text-white/40 text-sm mb-6 tracking-widest flex items-center gap-2"><Layers size={14}/> LATEST ARTIFACTS</h2>
                
                <div className="grid grid-cols-1 gap-4">
                    {[1,2,3].map((i) => (
                        <div key={i} className="group relative aspect-square bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:border-[#00ff99] transition-colors cursor-pointer">
                            <div className="absolute inset-0 flex items-center justify-center text-white/20 group-hover:text-[#00ff99] font-mono text-xs">
                                IMG_GEN_{i}.PNG
                            </div>
                            {/* Hover effect overlay */}
                            <div className="absolute inset-0 bg-[#00ff99]/0 group-hover:bg-[#00ff99]/10 transition-all duration-300"></div>
                        </div>
                    ))}
                </div>
             </div>
        </div>

      </div>
    </main>
  );
}