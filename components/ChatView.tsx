import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Message, ModelType } from '../types';

interface ChatViewProps {
  apiKey: string;
}

export const ChatView: React.FC<ChatViewProps> = ({ apiKey }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ModelType>(ModelType.PRO);
  const [useThinking, setUseThinking] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [useMaps, setUseMaps] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      let modelToUse = selectedMode;
      const tools: any[] = [];
      let thinkingConfig = undefined;

      // Configuration logic based on switches
      if (useThinking) {
        modelToUse = ModelType.PRO;
        thinkingConfig = { thinkingBudget: 32768 };
      } else if (useSearch) {
        modelToUse = ModelType.FLASH; // Flash for search grounding
        tools.push({ googleSearch: {} });
      } else if (useMaps) {
        modelToUse = ModelType.MAPS_MODEL;
        tools.push({ googleMaps: {} });
      }

      const config: any = {
        tools: tools.length > 0 ? tools : undefined,
      };

      if (thinkingConfig) {
        config.thinkingConfig = thinkingConfig;
      }
      
      // Geo-location for Maps
      if (useMaps && navigator.geolocation) {
         await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition((pos) => {
                config.toolConfig = {
                    retrievalConfig: {
                        latLng: {
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude
                        }
                    }
                };
                resolve();
            }, () => resolve()); // Proceed even if loc fails
         });
      }

      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: messages.concat(userMsg).map(m => ({
           role: m.role,
           parts: [{ text: m.text || '' }]
        })),
        config
      });

      const responseText = response.text || "I couldn't generate a text response.";
      
      // Extract Grounding
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const searchLinks = chunks?.filter((c: any) => c.web).map((c: any) => ({ uri: c.web.uri, title: c.web.title }));
      const mapLinks = chunks?.filter((c: any) => c.maps).map((c: any) => ({ uri: c.maps.uri, title: c.maps.title }));

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        grounding: {
            search: searchLinks,
            maps: mapLinks
        },
        isThinking: useThinking
      };

      setMessages(prev => [...prev, botMsg]);

    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-800">
      
      {/* Header / Controls */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex flex-wrap gap-4 items-center justify-between">
         <div className="flex items-center space-x-2">
            <span className="font-display text-trevelin-400">MODEL:</span>
            <select 
                value={selectedMode} 
                onChange={(e) => {
                    setSelectedMode(e.target.value as ModelType);
                    // Reset toggles if manual override
                    setUseThinking(false);
                    setUseSearch(false);
                    setUseMaps(false);
                }}
                className="bg-slate-800 text-white rounded px-2 py-1 text-sm border border-slate-700 outline-none focus:border-trevelin-500"
            >
                <option value={ModelType.PRO}>Gemini 3 Pro (Reasoning)</option>
                <option value={ModelType.FLASH}>Gemini 3 Flash (Balanced)</option>
                <option value={ModelType.FLASH_LITE}>Gemini 2.5 Flash Lite (Fast)</option>
            </select>
         </div>

         <div className="flex gap-2">
            <Toggle label="Thinking" icon="brain" active={useThinking} onClick={() => { setUseThinking(!useThinking); setUseSearch(false); setUseMaps(false); }} />
            <Toggle label="Search" icon="magnifying-glass" active={useSearch} onClick={() => { setUseSearch(!useSearch); setUseThinking(false); setUseMaps(false); }} />
            <Toggle label="Maps" icon="map-location-dot" active={useMaps} onClick={() => { setUseMaps(!useMaps); setUseThinking(false); setUseSearch(false); }} />
         </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                <i className="fa-solid fa-sparkles text-6xl mb-4 text-trevelin-500"></i>
                <p className="font-display text-xl">TREVELIN AI READY</p>
                <p className="text-sm mt-2">Select a mode and start chatting.</p>
            </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl ${
                msg.role === 'user' 
                ? 'bg-trevelin-500 text-trevelin-900 rounded-tr-none' 
                : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
            }`}>
              {msg.isThinking && (
                  <div className="mb-2 text-xs text-trevelin-400 uppercase tracking-widest flex items-center">
                      <i className="fa-solid fa-microchip mr-2"></i> Deep Thinking Applied
                  </div>
              )}
              <div className="whitespace-pre-wrap">{msg.text}</div>

              {/* Grounding Chips */}
              {(msg.grounding?.search?.length || 0) > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-600/50">
                      <p className="text-xs text-slate-400 mb-2">SOURCES</p>
                      <div className="flex flex-wrap gap-2">
                          {msg.grounding?.search?.map((s, i) => (
                              <a key={i} href={s.uri} target="_blank" rel="noreferrer" className="flex items-center space-x-1 bg-slate-900/50 px-2 py-1 rounded text-xs text-cyan-300 hover:bg-slate-900">
                                  <i className="fa-brands fa-google"></i>
                                  <span className="truncate max-w-[150px]">{s.title || s.uri}</span>
                              </a>
                          ))}
                      </div>
                  </div>
              )}
              {(msg.grounding?.maps?.length || 0) > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-600/50">
                      <p className="text-xs text-slate-400 mb-2">LOCATIONS</p>
                      <div className="flex flex-wrap gap-2">
                          {msg.grounding?.maps?.map((s, i) => (
                              <a key={i} href={s.uri} target="_blank" rel="noreferrer" className="flex items-center space-x-1 bg-slate-900/50 px-2 py-1 rounded text-xs text-green-300 hover:bg-slate-900">
                                  <i className="fa-solid fa-location-dot"></i>
                                  <span className="truncate max-w-[150px]">{s.title || s.uri}</span>
                              </a>
                          ))}
                      </div>
                  </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-700 flex items-center space-x-2">
                    <div className="w-2 h-2 bg-trevelin-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-trevelin-500 rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-trevelin-500 rounded-full animate-bounce delay-150"></div>
                </div>
            </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-slate-900 border-t border-slate-800">
         <div className="relative">
             <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Message Trevelin..."
                className="w-full bg-slate-800 text-white rounded-xl pl-4 pr-12 py-3 outline-none focus:ring-2 focus:ring-trevelin-500 border border-slate-700 placeholder-slate-500"
             />
             <button 
                onClick={handleSend}
                disabled={isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-trevelin-500 hover:text-white p-2 transition-colors disabled:opacity-50"
             >
                <i className="fa-solid fa-paper-plane"></i>
             </button>
         </div>
      </div>
    </div>
  );
};

const Toggle = ({ label, icon, active, onClick }: { label: string, icon: string, active: boolean, onClick: () => void }) => (
    <button 
        onClick={onClick}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            active 
            ? 'bg-trevelin-500 text-trevelin-900 shadow-[0_0_10px_rgba(6,182,212,0.5)]' 
            : 'bg-slate-800 text-slate-400 hover:text-white'
        }`}
    >
        <i className={`fa-solid fa-${icon}`}></i>
        <span>{label}</span>
    </button>
);
