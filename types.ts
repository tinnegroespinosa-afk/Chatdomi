export enum AppView {
  DASHBOARD = 'DASHBOARD', // Chat, Search, Maps, Thinking
  LIVE = 'LIVE', // Realtime Voice/Video
  STUDIO = 'STUDIO', // Image Gen, Edit, Veo Video
  AUDIO_LAB = 'AUDIO_LAB', // TTS, Transcription
  ANALYSIS = 'ANALYSIS' // Video Understanding
}

export enum ModelType {
  PRO = 'gemini-3-pro-preview',
  FLASH = 'gemini-3-flash-preview',
  FLASH_LITE = 'gemini-2.5-flash-lite',
  MAPS_MODEL = 'gemini-2.5-flash',
  IMAGE_GEN = 'gemini-3-pro-image-preview',
  IMAGE_EDIT = 'gemini-2.5-flash-image',
  VIDEO_FAST = 'veo-3.1-fast-generate-preview',
  TTS = 'gemini-2.5-flash-preview-tts',
  AUDIO_REALTIME = 'gemini-2.5-flash-native-audio-preview-12-2025'
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text?: string;
  image?: string;
  videoUrl?: string;
  audioUrl?: string;
  grounding?: {
    search?: Array<{ uri: string; title: string }>;
    maps?: Array<{ uri: string; title: string }>;
  };
  isThinking?: boolean;
}

export interface VideoConfig {
  resolution: '720p' | '1080p';
  aspectRatio: '16:9' | '9:16';
}

export interface ImageConfig {
  size: '1K' | '2K' | '4K';
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
}
