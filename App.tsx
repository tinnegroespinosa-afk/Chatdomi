import React, { useState } from 'react';
import { AppView } from './types';
import { ChatView } from './components/ChatView';
import { LiveView } from './components/LiveView';
import { MediaStudio } from './components/MediaStudio';
import { AudioLab } from './components/AudioLab';
import { VideoAnalysis } from './components/VideoAnalysis';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  // In a real app, you might want to validate this, but prompt says assume valid env
  const apiKey = process.env.API_KEY || ''; 

  if (!apiKey) {
      return <div className="flex h-screen items-center justify-center text-white">Error: API_KEY missing.</div>;
  }

  return (
    <div className="flex h-screen bg-black text-slate-200 font-sans selection:bg-trevelin-500 selection:text-black">
      {/* Sidebar */}
      <nav className="w-20 lg:w-64 border-r border-slate-800 bg-slate-900/50 backdrop-blur flex flex-col items-center lg:items-stretch py-6 z-20">
        <div className="mb-8 px-4 flex items-center justify-center lg:justify-start lg:space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-trevelin-500 to-purple-600"></div>
            <span className="hidden lg:block font-display font-bold text-xl text-white tracking-widest">TREVELIN</span>
        </div>

        <div className="space-y-2 px-2 flex-1">
            <NavButton view={AppView.DASHBOARD} current={currentView} set={setCurrentView} icon="message-bot" label="Chat Intelligence" />
            <NavButton view={AppView.LIVE} current={currentView} set={setCurrentView} icon="tower-broadcast" label="Live Voice" />
            <NavButton view={AppView.STUDIO} current={currentView} set={setCurrentView} icon="wand-sparkles" label="Media Studio" />
            <NavButton view={AppView.AUDIO_LAB} current={currentView} set={setCurrentView} icon="headphones-simple" label="Audio Lab" />
            <NavButton view={AppView.ANALYSIS} current={currentView} set={setCurrentView} icon="eye" label="Video Vision" />
        </div>

        <div className="px-4 text-xs text-slate-600 hidden lg:block text-center">
            v3.0.0 &bull; Gemini Powered
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden bg-slate-950">
         {/* Background Ambient Effects */}
         <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-trevelin-500/10 rounded-full blur-[100px] pointer-events-none"></div>
         <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

         <div className="h-full relative z-10">
             {currentView === AppView.DASHBOARD && <ChatView apiKey={apiKey} />}
             {currentView === AppView.LIVE && <LiveView apiKey={apiKey} />}
             {currentView === AppView.STUDIO && <MediaStudio apiKey={apiKey} />}
             {currentView === AppView.AUDIO_LAB && <AudioLab apiKey={apiKey} />}
             {currentView === AppView.ANALYSIS && <VideoAnalysis apiKey={apiKey} />}
         </div>
      </main>
    </div>
  );
};

const NavButton = ({ view, current, set, icon, label }: any) => (
    <button 
        onClick={() => set(view)}
        className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${
            current === view 
            ? 'bg-trevelin-500/10 text-trevelin-400 border border-trevelin-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
    >
        <i className={`fa-solid fa-${icon} text-lg w-6 text-center ${current === view ? 'text-trevelin-400' : 'group-hover:text-trevelin-500'}`}></i>
        <span className="hidden lg:block ml-3 font-medium text-sm">{label}</span>
        {current === view && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-trevelin-400 shadow-[0_0_5px_#22d3ee] hidden lg:block"></div>}
    </button>
);

export default App;
