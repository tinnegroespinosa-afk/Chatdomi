import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { ModelType } from '../types';
import { blobToBase64 } from '../utils/audioUtils';

interface VideoAnalysisProps {
  apiKey: string;
}

export const VideoAnalysis: React.FC<VideoAnalysisProps> = ({ apiKey }) => {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const analyze = async () => {
    if (!file) return;
    setIsLoading(true);
    try {
        const ai = new GoogleGenAI({ apiKey });
        const base64 = await blobToBase64(file);
        
        const response = await ai.models.generateContent({
            model: ModelType.PRO, // Pro for video understanding
            contents: {
                parts: [
                    { inlineData: { mimeType: file.type, data: base64 } },
                    { text: "Analyze this video in detail. Describe the key events, visual style, and any text present." }
                ]
            }
        });
        setAnalysis(response.text || 'No analysis generated.');
    } catch (e: any) {
        setAnalysis(`Error: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="p-8 h-full max-w-4xl mx-auto">
        <h2 className="text-2xl font-display text-white mb-6">Video Intelligence</h2>
        
        <div className="flex flex-col gap-6">
            <input 
                type="file" 
                accept="video/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-trevelin-500 file:text-trevelin-900 hover:file:bg-trevelin-400"
            />
            
            {file && (
                <video 
                    src={URL.createObjectURL(file)} 
                    controls 
                    className="w-full max-h-64 object-contain bg-black rounded-lg"
                />
            )}

            <button 
                onClick={analyze}
                disabled={!file || isLoading}
                className="bg-trevelin-500 text-trevelin-900 py-3 rounded-lg font-bold hover:bg-trevelin-400 disabled:opacity-50"
            >
                {isLoading ? 'ANALYZING...' : 'ANALYZE VIDEO'}
            </button>

            {analysis && (
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="font-bold text-trevelin-400 mb-2">Analysis Report</h3>
                    <p className="whitespace-pre-wrap">{analysis}</p>
                </div>
            )}
        </div>
    </div>
  );
};
