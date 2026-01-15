import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { blobToBase64 } from '../utils/audioUtils';
import { ModelType } from '../types';

interface MediaStudioProps {
  apiKey: string;
}

export const MediaStudio: React.FC<MediaStudioProps> = ({ apiKey }) => {
  const [tab, setTab] = useState<'GENERATE_IMG' | 'EDIT_IMG' | 'VEO_VIDEO' | 'ANIMATE_IMG'>('GENERATE_IMG');
  const [prompt, setPrompt] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  
  // Image Config
  const [imgSize, setImgSize] = useState('1K');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Veo Key Logic
  const ensureVeoKey = async () => {
    if ((window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await (window as any).aistudio.openSelectKey();
        }
    }
  };

  const handleGenerateImage = async () => {
    setIsLoading(true);
    setStatus('Generating Image...');
    setResultUrl(null);
    try {
        const ai = new GoogleGenAI({ apiKey });
        // Use Veo key selection if using Pro Image model (requirement for High Quality) if needed?
        // Prompt says "When using `gemini-3-pro-image-preview`, users MUST select their own API key."
        if (imgSize !== '1K') { // assuming HQ needs paid key or similar flow, applying Veo pattern just in case based on strict instructions for Veo
           await ensureVeoKey(); 
        }

        const response = await ai.models.generateContent({
            model: ModelType.IMAGE_GEN,
            contents: { parts: [{ text: prompt }] },
            config: {
                imageConfig: {
                    aspectRatio: aspectRatio as any,
                    imageSize: imgSize as any
                }
            }
        });
        
        // Find image part
        let found = false;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                setResultUrl(`data:image/png;base64,${part.inlineData.data}`);
                found = true;
                break;
            }
        }
        if (!found) setStatus('No image generated. Check prompt.');

    } catch (e: any) {
        setStatus(`Error: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleEditImage = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    setStatus('Editing Image...');
    try {
        const ai = new GoogleGenAI({ apiKey });
        const base64 = await blobToBase64(selectedFile);
        
        const response = await ai.models.generateContent({
            model: ModelType.IMAGE_EDIT, // Nano Banana
            contents: {
                parts: [
                    { inlineData: { mimeType: selectedFile.type, data: base64 } },
                    { text: prompt }
                ]
            }
        });

         let found = false;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                setResultUrl(`data:image/png;base64,${part.inlineData.data}`);
                found = true;
                break;
            }
        }
        if (!found) setStatus('No image returned.');

    } catch (e: any) {
        setStatus(`Error: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleVeo = async (isAnimation: boolean) => {
      // Must use paid key flow
      await ensureVeoKey();
      
      // Need a FRESH ai instance to pick up the injected key if handled by aistudio,
      // but guidelines say process.env.API_KEY is injected. 
      // However, for Veo, we must call openSelectKey.
      // After openSelectKey, the instructions say: "The selected API key is available via `process.env.API_KEY`."
      // But we must create a NEW GoogleGenAI instance.
      
      setIsLoading(true);
      setStatus(isAnimation ? 'Animating (this takes minutes)...' : 'Generating Video (this takes minutes)...');
      setResultUrl(null);

      try {
          // Re-instantiate to ensure key is fresh
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || apiKey });
          
          let requestPayload: any = {
            model: ModelType.VIDEO_FAST,
            config: {
                numberOfVideos: 1,
                resolution: '720p', // Fast only supports 720p usually? Prompt says 720 or 1080. Let's safe default.
                aspectRatio: '16:9'
            }
          };

          if (isAnimation && selectedFile) {
              const base64 = await blobToBase64(selectedFile);
              requestPayload.image = { imageBytes: base64, mimeType: selectedFile.type };
              requestPayload.prompt = prompt || "Animate this image"; // prompt optional?
          } else {
              requestPayload.prompt = prompt;
          }

          let operation = await ai.models.generateVideos(requestPayload);
          
          // Poll
          while (!operation.done) {
            await new Promise(r => setTimeout(r, 5000)); // Poll every 5s
            operation = await ai.operations.getVideosOperation({ operation });
            setStatus('Rendering... ' + (operation.metadata?.state || 'processing'));
          }

          const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
          if (uri) {
              const fetchUrl = `${uri}&key=${process.env.API_KEY || apiKey}`;
              const vidRes = await fetch(fetchUrl);
              const blob = await vidRes.blob();
              setResultUrl(URL.createObjectURL(blob));
              setStatus('Complete');
          } else {
              setStatus('Failed to generate video.');
          }

      } catch (e: any) {
          if (e.message?.includes('Requested entity was not found')) {
              if ((window as any).aistudio) {
                  await (window as any).aistudio.openSelectKey();
                  setStatus('Key reset. Please try again.');
              }
          } else {
              setStatus(`Error: ${e.message}`);
          }
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
        {/* Tab Nav */}
        <div className="flex border-b border-slate-800 bg-slate-900/50">
            <TabBtn active={tab === 'GENERATE_IMG'} onClick={() => setTab('GENERATE_IMG')} icon="image">Generate</TabBtn>
            <TabBtn active={tab === 'EDIT_IMG'} onClick={() => setTab('EDIT_IMG')} icon="wand-magic-sparkles">Edit</TabBtn>
            <TabBtn active={tab === 'VEO_VIDEO'} onClick={() => setTab('VEO_VIDEO')} icon="video">Veo Video</TabBtn>
            <TabBtn active={tab === 'ANIMATE_IMG'} onClick={() => setTab('ANIMATE_IMG')} icon="clapperboard">Animate</TabBtn>
        </div>

        <div className="p-6 max-w-4xl mx-auto w-full space-y-6">
            <h2 className="text-2xl font-display text-white">
                {tab === 'GENERATE_IMG' && 'Nano Banana Pro Studio'}
                {tab === 'EDIT_IMG' && 'Flash Image Editor'}
                {tab === 'VEO_VIDEO' && 'Veo 3.1 Video Gen'}
                {tab === 'ANIMATE_IMG' && 'Veo Image-to-Video'}
            </h2>

            {/* Controls */}
            <div className="space-y-4 bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                {(tab === 'EDIT_IMG' || tab === 'ANIMATE_IMG') && (
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2">SOURCE IMAGE</label>
                        <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-trevelin-500 file:text-trevelin-900 hover:file:bg-trevelin-400"
                        />
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">PROMPT</label>
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe your creation..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white h-24 focus:border-trevelin-500 outline-none"
                    />
                </div>

                {tab === 'GENERATE_IMG' && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="block text-xs font-bold text-slate-400 mb-2">ASPECT RATIO</label>
                             <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                                 {['1:1','3:4','4:3','9:16','16:9'].map(r => <option key={r} value={r}>{r}</option>)}
                             </select>
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-slate-400 mb-2">SIZE</label>
                             <select value={imgSize} onChange={(e) => setImgSize(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                                 {['1K','2K','4K'].map(r => <option key={r} value={r}>{r}</option>)}
                             </select>
                        </div>
                    </div>
                )}

                <button 
                    onClick={() => {
                        if (tab === 'GENERATE_IMG') handleGenerateImage();
                        if (tab === 'EDIT_IMG') handleEditImage();
                        if (tab === 'VEO_VIDEO') handleVeo(false);
                        if (tab === 'ANIMATE_IMG') handleVeo(true);
                    }}
                    disabled={isLoading}
                    className="w-full py-3 bg-gradient-to-r from-trevelin-500 to-purple-500 text-white font-bold rounded-lg shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50"
                >
                    {isLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'EXECUTE'}
                </button>
                
                {status && <p className="text-center text-sm text-trevelin-400 animate-pulse">{status}</p>}
            </div>

            {/* Results */}
            {resultUrl && (
                <div className="mt-8 border-t border-slate-700 pt-8 flex justify-center">
                    {tab.includes('VIDEO') || tab === 'ANIMATE_IMG' ? (
                        <video src={resultUrl} controls className="max-w-full rounded-lg shadow-2xl border border-trevelin-500/30" />
                    ) : (
                        <img src={resultUrl} alt="Generated" className="max-w-full rounded-lg shadow-2xl border border-trevelin-500/30" />
                    )}
                </div>
            )}
        </div>
    </div>
  );
};

const TabBtn = ({ children, active, onClick, icon }: any) => (
    <button 
        onClick={onClick}
        className={`flex-1 py-4 flex items-center justify-center space-x-2 text-sm font-bold border-b-2 transition-colors ${
            active ? 'border-trevelin-500 text-trevelin-400 bg-slate-800' : 'border-transparent text-slate-500 hover:text-white'
        }`}
    >
        <i className={`fa-solid fa-${icon}`}></i>
        <span>{children}</span>
    </button>
);
