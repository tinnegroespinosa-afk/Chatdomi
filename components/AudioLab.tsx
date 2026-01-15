import React, { useState } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { ModelType } from '../types';
import { decode, decodeAudioData, blobToBase64 } from '../utils/audioUtils';

interface AudioLabProps {
  apiKey: string;
}

export const AudioLab: React.FC<AudioLabProps> = ({ apiKey }) => {
  const [text, setText] = useState('');
  const [transcription, setTranscription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');

  const handleTTS = async () => {
    if (!text) return;
    setIsProcessing(true);
    setStatus('Generating Speech...');
    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: ModelType.TTS,
            contents: { parts: [{ text: `Say cheerfully: ${text}` }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                }
            }
        });

        const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
            const buffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start();
            setStatus('Playing audio...');
        } else {
            setStatus('No audio generated.');
        }

    } catch (e: any) {
        setStatus(`Error: ${e.message}`);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleTranscribe = async (file: File) => {
      setIsProcessing(true);
      setStatus('Transcribing...');
      try {
          const ai = new GoogleGenAI({ apiKey });
          const base64 = await blobToBase64(file);
          
          const response = await ai.models.generateContent({
              model: ModelType.FLASH, // Flash for transcription
              contents: {
                  parts: [
                      { inlineData: { mimeType: file.type, data: base64 } },
                      { text: "Transcribe this audio exactly." }
                  ]
              }
          });
          setTranscription(response.text || 'No transcription.');
          setStatus('Done.');
      } catch (e: any) {
          setStatus(`Error: ${e.message}`);
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="p-8 h-full overflow-y-auto max-w-4xl mx-auto space-y-8">
        <h2 className="text-3xl font-display text-transparent bg-clip-text bg-gradient-to-r from-trevelin-400 to-white">
            Audio Intelligence Lab
        </h2>

        {/* TTS Section */}
        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center">
                <i className="fa-solid fa-volume-high text-trevelin-500 mr-2"></i> Text to Speech
            </h3>
            <div className="flex gap-4">
                <input 
                    type="text" 
                    value={text} 
                    onChange={e => setText(e.target.value)}
                    placeholder="Enter text to speak..." 
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 text-white"
                />
                <button 
                    onClick={handleTTS}
                    disabled={isProcessing}
                    className="px-6 py-3 bg-trevelin-500 text-trevelin-900 font-bold rounded-lg hover:bg-trevelin-400"
                >
                    SPEAK
                </button>
            </div>
        </div>

        {/* Transcription Section */}
        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center">
                <i className="fa-solid fa-microphone-lines-slash text-trevelin-500 mr-2"></i> Transcription
            </h3>
            <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-trevelin-500 transition-colors">
                <input 
                    type="file" 
                    accept="audio/*"
                    onChange={(e) => {
                        if(e.target.files?.[0]) handleTranscribe(e.target.files[0]);
                    }}
                    className="hidden" 
                    id="audio-upload"
                />
                <label htmlFor="audio-upload" className="cursor-pointer block">
                    <i className="fa-solid fa-cloud-arrow-up text-4xl text-slate-500 mb-2"></i>
                    <p className="text-slate-400 font-bold">Upload Audio File to Transcribe</p>
                </label>
            </div>
            {transcription && (
                <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
                    <p className="text-sm text-slate-400 mb-1">RESULT:</p>
                    <p className="text-white whitespace-pre-wrap">{transcription}</p>
                </div>
            )}
        </div>
        
        {status && <p className="text-center text-trevelin-400">{status}</p>}
    </div>
  );
};
