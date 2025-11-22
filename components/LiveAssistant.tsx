import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { base64ToUint8Array, decodeAudioData, createPcmBlob } from '../utils/audioUtils';
import { expenseTools, executeExpenseTool } from '../services/tools';
import { User } from '../types';

interface LiveAssistantProps {
  user: User;
  onClose: () => void;
}

const LiveAssistant: React.FC<LiveAssistantProps> = ({ user, onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  const [visualizerData, setVisualizerData] = useState<number[]>(new Array(5).fill(10));

  // Audio Context Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Gemini Session Refs
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const closingRef = useRef(false);

  // Visualizer Animation
  const animateVisualizer = useCallback(() => {
    if (!isConnected || isMuted) {
      setVisualizerData([10, 10, 10, 10, 10]);
      return;
    }
    // Generate smoother random data for visualization
    const newData = Array.from({ length: 5 }, () => Math.floor(Math.random() * 50) + 20);
    setVisualizerData(newData);
  }, [isConnected, isMuted]);

  useEffect(() => {
    const interval = setInterval(animateVisualizer, 100);
    return () => clearInterval(interval);
  }, [animateVisualizer]);

  const connect = async () => {
    try {
      setStatusMessage('Connecting to microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const inputCtx = inputAudioContextRef.current;
      const outputCtx = outputAudioContextRef.current;
      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      setStatusMessage('Connecting to Gemini...');

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: expenseTools }],
          systemInstruction: `You are an advanced financial assistant for ${user.name}.
          
          CORE LANGUAGES:
          - **Moroccan Darija**: This is your primary language. Speak it naturally.
          - **Egyptian Arabic & MSA**: You understand these perfectly.
          - **Translation**: You can translate between these dialects 100% effectively.
          
          BEHAVIOR:
          - Act like a helpful Moroccan assistant.
          - Currency: **Moroccan Dirham (DH)**.
          - Keep responses concise for voice interaction.
          
          RULES:
          1. Before calling 'addExpense', YOU MUST ASK FOR CONFIRMATION in Darija.
             (e.g., "Wesh nqiyed lik 50 DH essence?")
          2. Only record after user says "Yes/Ah/Yeh".
          3. If you don't understand a word, repeat what you heard phonetically.
          
          Today: ${new Date().toISOString().split('T')[0]}.`,
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setStatusMessage('Knasme3 (Listening)...');
            
            sourceRef.current = inputCtx.createMediaStreamSource(stream);
            processorRef.current = inputCtx.createScriptProcessor(4096, 1, 1);
            
            processorRef.current.onaudioprocess = (e) => {
              if (isMuted || closingRef.current) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            sourceRef.current.connect(processorRef.current);
            processorRef.current.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
             if (closingRef.current) return;

             if (msg.toolCall) {
                for (const fc of msg.toolCall.functionCalls) {
                   const result = await executeExpenseTool(fc.name, fc.args, user);
                   sessionPromiseRef.current?.then((session) => {
                     session.sendToolResponse({
                       functionResponses: {
                         id: fc.id,
                         name: fc.name,
                         response: { result: result }
                       }
                     });
                   });
                }
             }

             const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
             if (base64Audio) {
                const audioData = base64ToUint8Array(base64Audio);
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const audioBuffer = await decodeAudioData(audioData, outputCtx, 24000, 1);
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputNode);
                source.addEventListener('ended', () => sourcesRef.current.delete(source));
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
             }

             if (msg.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
             }
          },
          onclose: () => setIsConnected(false),
          onerror: () => setStatusMessage('Error. Retrying...'),
        }
      });

    } catch (e: any) {
      console.error('Connection failed', e);
      setStatusMessage(`Error: ${e.message}`);
    }
  };

  useEffect(() => {
    connect();
    return () => {
      closingRef.current = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (processorRef.current) processorRef.current.disconnect();
      if (inputAudioContextRef.current) inputAudioContextRef.current.close();
      if (outputAudioContextRef.current) outputAudioContextRef.current.close();
      if (sessionPromiseRef.current) sessionPromiseRef.current.then(session => session.close());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-xl">
      {/* Background Glows */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#7F3DFF]/20 rounded-full blur-[100px] animate-pulse-slow"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#EC4899]/20 rounded-full blur-[100px] animate-pulse-slow" style={{animationDelay: '1s'}}></div>
      </div>

      <div className="flex flex-col items-center w-full max-w-md p-8 z-10 relative">
        
        {/* Live Badge */}
        <div className="absolute top-4 left-6 flex items-center gap-2 bg-black/30 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></span>
            <span className="text-white text-xs font-bold tracking-widest">LIVE</span>
        </div>

        {/* Main Visualizer Orb */}
        <div className="relative w-72 h-72 mb-12 flex items-center justify-center">
             {/* Outer Glow Rings */}
             <div className={`absolute inset-0 border border-[#7F3DFF]/30 rounded-full scale-125 transition-transform duration-1000 ${isConnected && !isMuted ? 'scale-150 opacity-50' : 'scale-100 opacity-20'}`}></div>
             <div className={`absolute inset-0 border border-[#EC4899]/30 rounded-full scale-110 transition-transform duration-1000 delay-100 ${isConnected && !isMuted ? 'scale-125 opacity-60' : 'scale-100 opacity-30'}`}></div>
             
             {/* Core Orb */}
             <div className={`w-40 h-40 rounded-full bg-gradient-to-br from-[#7F3DFF] to-[#EC4899] shadow-[0_0_60px_rgba(127,61,255,0.6)] transition-all duration-200 relative z-10 flex items-center justify-center ${isConnected && !isMuted ? 'animate-pulse scale-105' : 'scale-100 grayscale-[50%]'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
             </div>

             {/* Audio Bars Overlay */}
             <div className="absolute flex items-center justify-center gap-2 h-32 w-full pointer-events-none z-20">
                {visualizerData.map((h, i) => (
                  <div 
                    key={i} 
                    className="w-2 bg-white/80 rounded-full transition-all duration-150 ease-out shadow-[0_0_10px_white]" 
                    style={{ height: `${h}%`, minHeight: '10%', opacity: isConnected && !isMuted ? 1 : 0.3 }} 
                  />
                ))}
             </div>
        </div>

        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Gemini Live</h2>
        <p className="text-slate-300 text-sm mb-10 bg-white/5 px-4 py-2 rounded-full border border-white/10">
           {statusMessage}
        </p>

        <div className="flex gap-6">
          <button 
            onClick={() => setIsMuted(!isMuted)} 
            className={`h-16 w-16 rounded-full flex items-center justify-center transition-all transform hover:scale-105 border border-white/10 backdrop-blur-md shadow-lg ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {isMuted ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            )}
          </button>
          
          <button 
             onClick={onClose} 
             className="h-16 w-16 rounded-full flex items-center justify-center bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500 hover:text-white transition-all transform hover:scale-105 backdrop-blur-md shadow-lg"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveAssistant;