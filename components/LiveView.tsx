import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decode, decodeAudioData } from '../utils/audioUtils';

interface LiveViewProps {
  apiKey: string;
}

export const LiveView: React.FC<LiveViewProps> = ({ apiKey }) => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('Ready to connect');
  const [error, setError] = useState<string | null>(null);

  // Refs for audio handling to avoid re-renders
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Canvas for visualization
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startSession = async () => {
    try {
      setError(null);
      setStatus('Initializing...');
      
      const ai = new GoogleGenAI({ apiKey });
      
      // Setup Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputCtx;
      audioContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      // Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Connect to Live API
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are Trevelin, a helpful and futuristic AI assistant. Keep responses concise and engaging.',
        },
        callbacks: {
          onopen: () => {
            setStatus('Connected');
            setIsActive(true);
            
            // Process Input Audio
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
              
              // Simple visualizer update based on input volume
              updateVisualizer(inputData);
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
               const ctx = audioContextRef.current;
               // Ensure time is moving forward
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
               
               const audioBuffer = await decodeAudioData(
                 decode(base64Audio),
                 ctx,
                 24000,
                 1
               );

               const source = ctx.createBufferSource();
               source.buffer = audioBuffer;
               source.connect(ctx.destination);
               source.start(nextStartTimeRef.current);
               
               nextStartTimeRef.current += audioBuffer.duration;
               sourcesRef.current.add(source);
               
               source.onended = () => {
                 sourcesRef.current.delete(source);
               };
            }
            
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              if (audioContextRef.current) {
                  nextStartTimeRef.current = audioContextRef.current.currentTime;
              }
            }
          },
          onclose: () => {
            setStatus('Disconnected');
            setIsActive(false);
          },
          onerror: (e) => {
            console.error(e);
            setError('Connection error occurred.');
            stopSession();
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to start session');
      setIsActive(false);
    }
  };

  const stopSession = () => {
    if (sessionPromiseRef.current) {
       sessionPromiseRef.current.then(session => session.close());
    }
    
    streamRef.current?.getTracks().forEach(track => track.stop());
    inputAudioContextRef.current?.close();
    audioContextRef.current?.close();
    
    setIsActive(false);
    setStatus('Ready to connect');
    sessionPromiseRef.current = null;
  };

  // Simple visualizer
  const updateVisualizer = (data: Float32Array) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    
    let sum = 0;
    for(let i=0; i<data.length; i++) sum += Math.abs(data[i]);
    const avg = sum / data.length;
    
    // Draw a "breathing" circle
    const radius = 50 + (avg * 500); // Scale based on volume
    
    const gradient = ctx.createRadialGradient(width/2, height/2, radius * 0.2, width/2, height/2, radius);
    gradient.addColorStop(0, '#06b6d4');
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0)');
    
    ctx.fillStyle = gradient;
    ctx.arc(width/2, height/2, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-trevelin-900 to-black z-0"></div>
        
        {/* Holographic Circle Background */}
        <div className="absolute z-0 w-96 h-96 border border-trevelin-500/30 rounded-full animate-spin-slow"></div>
        <div className="absolute z-0 w-[500px] h-[500px] border border-trevelin-400/10 rounded-full"></div>

        <div className="z-10 flex flex-col items-center space-y-8">
            <h2 className="text-4xl font-display text-transparent bg-clip-text bg-gradient-to-r from-trevelin-400 to-white">
                Trevelin Live
            </h2>
            
            <div className="relative w-80 h-80 flex items-center justify-center">
                <canvas 
                    ref={canvasRef} 
                    width={320} 
                    height={320}
                    className="absolute inset-0 rounded-full backdrop-blur-sm bg-trevelin-900/50 border border-trevelin-500/30 shadow-[0_0_50px_rgba(6,182,212,0.3)]"
                />
                {!isActive && (
                    <i className="fa-solid fa-microphone-lines text-6xl text-trevelin-500 opacity-50 absolute"></i>
                )}
            </div>

            <div className="flex flex-col items-center space-y-4">
                <p className={`text-lg font-mono ${isActive ? 'text-green-400 animate-pulse' : 'text-slate-400'}`}>
                   STATUS: {status.toUpperCase()}
                </p>
                {error && <p className="text-red-400 bg-red-900/20 px-4 py-2 rounded">{error}</p>}
                
                <button
                    onClick={isActive ? stopSession : startSession}
                    className={`px-8 py-3 rounded-full font-bold text-lg tracking-wider transition-all duration-300 transform hover:scale-105 shadow-lg ${
                        isActive 
                        ? 'bg-red-500/20 text-red-400 border border-red-500 hover:bg-red-500 hover:text-white'
                        : 'bg-trevelin-500 text-trevelin-900 hover:bg-trevelin-400 hover:shadow-cyan-500/50'
                    }`}
                >
                    {isActive ? 'DISCONNECT' : 'INITIALIZE CONNECTION'}
                </button>
            </div>
        </div>
    </div>
  );
};
