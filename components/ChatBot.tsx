import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat, Part, Modality } from '@google/genai';
import { User, Expense, Appointment } from '../types';
import { expenseTools, executeExpenseTool } from '../services/tools';
import LiveAssistant from './LiveAssistant';
import { blobToBase64, playBase64Audio } from '../utils/audioUtils';

interface ChatBotProps {
  user: User;
}

interface Message {
  role: 'user' | 'model';
  text?: string;
  audio?: string; // base64
  duration?: number; // Duration in seconds
  isForm?: boolean;
  prefilledDescription?: string;
  expenseData?: Expense;
  appointmentData?: Appointment;
  isError?: boolean;
}

const categories = ['Food', 'Transport', 'Shopping', 'Utilities', 'Health', 'Entertainment', 'Other'];

// --- Helper Component for Audio Visualization ---
const AudioMessageBubble: React.FC<{ base64: string, isUser: boolean, duration?: number }> = ({ base64, isUser, duration }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationText, setDurationText] = useState('0:00');
  const [durationSec, setDurationSec] = useState(0);

  useEffect(() => {
    const calculateDuration = async () => {
      if (!base64) return;

      const formatTime = (sec: number) => {
        if (!isFinite(sec) || isNaN(sec) || sec < 0) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
      };

      if (duration) {
        setDurationText(formatTime(duration));
        setDurationSec(duration);
        return;
      }

      if (isUser) {
        // User audio: WebM format - fallback if no duration provided
        const audio = new Audio(`data:audio/webm;base64,${base64}`);
        audio.onloadedmetadata = () => {
          const d = audio.duration;
          if (d !== Infinity && !isNaN(d)) {
            setDurationText(formatTime(d));
            setDurationSec(d);
          }
        };
      } else {
        // Model audio: Raw PCM 24kHz 16-bit mono
        try {
          const byteLength = window.atob(base64).length;
          const seconds = byteLength / 2 / 24000;
          setDurationText(formatTime(seconds));
          setDurationSec(seconds);
        } catch (e) {
          console.error('Error calculating duration:', e);
        }
      }
    };

    calculateDuration();
  }, [base64, isUser, duration]);

  const handlePlay = async () => {
    if (isPlaying) return;
    setIsPlaying(true);

    if (isUser) {
      // Play WebM directly
      const audio = new Audio(`data:audio/webm;base64,${base64}`);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      await audio.play().catch(e => {
        console.error("Playback failed", e);
        setIsPlaying(false);
      });
    } else {
      // Play PCM using utility
      await playBase64Audio(base64);
      setIsPlaying(false);
    }
  };

  return (
    <div 
      onClick={handlePlay}
      className={`flex items-center gap-3 p-2 min-w-[160px] cursor-pointer hover:opacity-90 transition-opacity`}
    >
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${isUser ? 'bg-white/20 text-white' : 'bg-[#7F3DFF]/10 text-[#7F3DFF]'}`}>
        {isPlaying ? (
          <span className="flex gap-0.5 items-end h-3">
            <span className="w-0.5 h-full bg-current animate-[pulse_0.5s_infinite]"></span>
            <span className="w-0.5 h-2/3 bg-current animate-[pulse_0.6s_infinite]"></span>
            <span className="w-0.5 h-full bg-current animate-[pulse_0.4s_infinite]"></span>
          </span>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 fill-current" viewBox="0 0 20 20">
             <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      
      <span className={`text-[10px] font-mono font-medium min-w-[32px] text-center ${isUser ? 'text-white/90' : 'text-gray-500'}`}>
        {durationText}
      </span>

      <div className="flex flex-col gap-0.5 flex-1 min-w-[60px]">
        <div className={`h-1 w-full rounded-full overflow-hidden ${isUser ? 'bg-white/30' : 'bg-gray-200'}`}>
           {isPlaying && (
             <div 
               className={`h-full ${isUser ? 'bg-white' : 'bg-[#7F3DFF]'} animate-[width_linear]`} 
               style={{
                 width: '100%', 
                 animationDuration: `${durationSec || 2}s`
               }}
             ></div>
           )}
        </div>
      </div>
    </div>
  );
};

const ChatBot: React.FC<ChatBotProps> = ({ user }) => {
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: `Ahlan ${user.name}! Ana hna bach n3awnek f lmasarif w lmawa3id.` }
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [processingText, setProcessingText] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const chatSessionRef = useRef<Chat | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldSendRef = useRef(true);

  useEffect(() => {
    if (showHistory) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showHistory]);

  useEffect(() => {
      if (messages.length > 1) {
          setShowHistory(true);
      }
  }, [messages.length]);

  useEffect(() => {
    // Update instruction with precise local time on every init
    const now = new Date();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    chatSessionRef.current = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `You are an intelligent assistant for specific tasks: Expenses (Masarif) and Appointments (Mawa3id).
        
        **User Context:**
        - Name: ${user.name}
        - Language: **Moroccan Darija** (speak casually).
        - **Current Local Date/Time**: ${now.toString()} (Use this to calculate dates accurately).
        
        **Sections Logic:**
        1. **Expenses (Masarif)**:
           - Words like: chrit, khsart, flous, budget, tqdia.
           - Action: Use 'addExpense', 'getExpenses', 'setBudget'.
           - ALWAYS confirm adding expenses first.

        2. **Appointments (Mawa3id)**:
           - Words like: fakarni, maw3id, rdv, meeting, ntasel, 3ayet, ghadi nmchi.
           - Action: Use 'addAppointment', 'getAppointments'.
           - **Important**: Calculate the ISO date based on "daba 30 min" or "ghda m3a 5". 
           - If user says "Fakarni men daba 30 min", calculate the time and call 'addAppointment'.
        
        **General Rules:**
        - Be helpful and brief.
        - If adding an appointment, confirm the time you calculated. e.g., "Safi, qiyedt maw3id m3a [Time]".
        `,
        tools: [{ functionDeclarations: expenseTools }],
      },
    });
  }, [user]);

  const generateAndPlayAudio = async (text: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });
      
      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        await playBase64Audio(audioData);
      }
    } catch (e) {
      console.error("TTS Error", e);
    }
  };

  const handleSend = async (text: string, audioBlob?: Blob, duration?: number) => {
    if ((!text && !audioBlob) || !chatSessionRef.current) return;

    const newUserMsg: Message = { role: 'user', text, duration };
    if (audioBlob) {
        const base64 = await blobToBase64(audioBlob);
        newUserMsg.audio = base64;
        newUserMsg.text = '';
    }

    setMessages(prev => [...prev, newUserMsg]);
    
    setIsThinking(true);
    setProcessingText(audioBlob ? 'Ki sma3...' : 'Ki fakar...');
    const shouldRespondWithAudio = !!audioBlob;

    const sendMessageWithRetry = async (payload: any) => {
      let lastError;
      for (let i = 0; i < 3; i++) {
        try {
          if (!chatSessionRef.current) throw new Error("Chat session lost");
          return await chatSessionRef.current.sendMessage(payload);
        } catch (e: any) {
          console.warn(`Attempt ${i + 1} failed:`, e);
          lastError = e;
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
      throw lastError;
    };

    try {
      let result;
      if (audioBlob) {
        if (audioBlob.size < 100) throw new Error("Tasjil qsir. 3awd.");
        const base64Audio = await blobToBase64(audioBlob);
        const audioPart = {
            inlineData: {
                mimeType: audioBlob.type || 'audio/webm',
                data: base64Audio
            }
        };
        result = await sendMessageWithRetry({
             message: text ? [audioPart, { text }] : [audioPart]
        });
      } else {
        result = await sendMessageWithRetry({ message: text });
      }

      let responseText = result.text || '';
      let msgExtra: Partial<Message> = {};
      
      const functionCalls = result.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
          const functionResponses: Part[] = [];
          for (const fc of functionCalls) {
              if (fc.name === 'requestManualEntry') {
                 setMessages(prev => [...prev, { 
                   role: 'model', 
                   isForm: true, 
                   prefilledDescription: fc.args.prefilledDescription 
                 }]);
                 functionResponses.push({
                   functionResponse: { id: fc.id, name: fc.name, response: { result: 'Form shown' } }
                 });
                 continue;
              }

              const toolResult = await executeExpenseTool(fc.name, fc.args, user);
              
              if (fc.name === 'addExpense' && toolResult.expense) {
                msgExtra = { expenseData: toolResult.expense };
              }
              if (fc.name === 'addAppointment' && toolResult.appointment) {
                msgExtra = { appointmentData: toolResult.appointment };
              }

              functionResponses.push({
                  functionResponse: { id: fc.id, name: fc.name, response: { result: toolResult } }
              });
          }
          
          const toolResponseResult = await sendMessageWithRetry({ message: functionResponses });
          responseText = toolResponseResult.text || '';
      }

      if (responseText) {
        setMessages(prev => [...prev, { role: 'model', text: responseText, ...msgExtra }]);
        if (shouldRespondWithAudio && responseText) {
            generateAndPlayAudio(responseText);
        }
      } else if (msgExtra.expenseData || msgExtra.appointmentData) {
         const confirmText = 'Safi tqiyed.';
         setMessages(prev => [...prev, { role: 'model', text: confirmText, ...msgExtra }]);
         if (shouldRespondWithAudio) generateAndPlayAudio(confirmText);
      }

    } catch (error: any) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: `Mochkil: ${error.message}`, isError: true }]);
    } finally {
      setIsThinking(false);
      setProcessingText('');
    }
  };

  // ... (Recording logic same as before) ...
  const startRecording = async () => {
    try {
      shouldSendRef.current = true; 
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (!shouldSendRef.current) return;
        if (audioChunksRef.current.length === 0) return;

        // Calculate Duration
        const durationMs = Date.now() - startTimeRef.current;
        const durationSec = durationMs / 1000;
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleSend('', audioBlob, durationSec);
      };

      mediaRecorderRef.current.start();
      startTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (e) {
      console.error("Mic Error", e);
      alert("Mochkil f l-micro. 3afak 3ti l-permission.");
    }
  };

  const stopAndSend = () => {
    if (mediaRecorderRef.current && isRecording) {
      shouldSendRef.current = true;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      shouldSendRef.current = false;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(inputText);
    setInputText('');
  };

  const ManualExpenseForm: React.FC<{ prefill?: string, onSubmit: (d: any) => void }> = ({ prefill, onSubmit }) => {
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('Food');
    const [desc, setDesc] = useState(prefill || '');

    return (
      <div className="bg-gray-50 p-4 rounded-2xl mt-2 border border-gray-200 shadow-sm">
        <div className="space-y-3">
          <input 
            type="number" 
            placeholder="Price (Dh)" 
            value={amount} 
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-slate-800 text-sm focus:ring-2 focus:ring-[#7F3DFF] outline-none"
          />
          <select 
             value={category} 
             onChange={e => setCategory(e.target.value)}
             className="w-full bg-white border border-gray-200 rounded-xl p-3 text-slate-800 text-sm focus:ring-2 focus:ring-[#7F3DFF] outline-none"
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input 
            type="text" 
            placeholder="Description" 
            value={desc} 
            onChange={e => setDesc(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-slate-800 text-sm focus:ring-2 focus:ring-[#7F3DFF] outline-none"
          />
          <button 
            onClick={() => {
              if(!amount || !desc) return;
              onSubmit({ amount: parseFloat(amount), category, description: desc, date: new Date().toISOString().split('T')[0] });
            }}
            className="w-full bg-[#7F3DFF] hover:bg-[#6a2ee3] text-white py-3 rounded-xl text-sm font-bold shadow-md transition-all"
          >
            Save Expense
          </button>
        </div>
      </div>
    );
  };

  const ExpenseCard: React.FC<{ data: Expense }> = ({ data }) => (
    <div className="bg-[#EEE5FF] border border-[#7F3DFF]/20 p-4 rounded-2xl mt-2">
      <div className="flex justify-between items-center">
          <div>
            <div className="text-[#7F3DFF] font-bold text-lg">-{data.amount} DH</div>
            <div className="text-xs text-slate-500 font-medium">{data.description}</div>
          </div>
          <div className="bg-white p-2 rounded-full text-[#7F3DFF]">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
          </div>
      </div>
    </div>
  );

  const AppointmentCard: React.FC<{ data: Appointment }> = ({ data }) => (
    <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl mt-2">
      <div className="flex justify-between items-center">
          <div>
            <div className="text-blue-600 font-bold text-sm">{new Date(data.date).toLocaleString()}</div>
            <div className="text-xs text-slate-600 font-bold mt-0.5">{data.title}</div>
          </div>
          <div className="bg-white p-2 rounded-full text-blue-500">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
          </div>
      </div>
    </div>
  );

  if (isLiveMode) {
    return <LiveAssistant user={user} onClose={() => setIsLiveMode(false)} />;
  }

  return (
    <>
      {/* Message History Overlay */}
      {showHistory && (
        <div className="fixed bottom-[84px] left-0 w-full max-h-[65vh] overflow-y-auto bg-white/95 backdrop-blur-xl border-t border-gray-100 z-40 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] rounded-t-[32px]">
           <div className="p-6 space-y-6 pb-10">
              <div className="flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-sm py-2 z-10">
                  <span className="text-xs text-gray-400 uppercase font-bold tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#7F3DFF] rounded-full"></span>
                    Assistant
                  </span>
                  <button onClick={() => setShowHistory(false)} className="text-gray-400 text-xs hover:text-slate-800 font-medium bg-gray-100 px-3 py-1 rounded-full">Hide</button>
              </div>
              
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                  <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-gradient-to-br from-[#7F3DFF] to-[#6a2ee3] text-white rounded-br-none' : 'bg-white border border-gray-100 text-slate-700 rounded-bl-none'} ${msg.isError ? 'bg-red-50 text-red-500 border-red-100' : ''}`}>
                     {msg.audio ? (
                       <AudioMessageBubble base64={msg.audio} isUser={msg.role === 'user'} duration={msg.duration} />
                     ) : (
                       <p className="leading-relaxed">{msg.text}</p>
                     )}
                  </div>
                  
                  <span className="text-[10px] text-gray-400 mt-1 px-1">
                    {msg.role === 'user' ? 'You' : 'Gemini'}
                  </span>

                  {msg.isForm && (
                    <div className="max-w-[85%] w-full mt-2">
                       <ManualExpenseForm 
                         prefill={msg.prefilledDescription} 
                         onSubmit={(data) => executeExpenseTool('addExpense', data, user).then(res => {
                           setMessages(prev => [...prev, { role: 'model', text: 'Tqiyed.', expenseData: res.expense }]);
                         })} 
                       />
                    </div>
                  )}
                  {msg.expenseData && <div className="max-w-[85%] w-full mt-2"><ExpenseCard data={msg.expenseData} /></div>}
                  {msg.appointmentData && <div className="max-w-[85%] w-full mt-2"><AppointmentCard data={msg.appointmentData} /></div>}
                </div>
              ))}
              <div ref={messagesEndRef} />
           </div>
        </div>
      )}

      {/* Fixed Bottom Input Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-white/20 px-4 py-4 z-50 flex gap-3 items-center shadow-[0_-4px_30px_rgba(0,0,0,0.03)]">
          <button onClick={() => setIsLiveMode(true)} className="relative group flex-shrink-0" title="Live Mode">
             <div className="absolute inset-0 bg-gradient-to-r from-[#7F3DFF] to-[#EC4899] rounded-full blur opacity-40 group-hover:opacity-70 transition-opacity"></div>
             <div className="relative bg-gradient-to-r from-[#7F3DFF] to-[#EC4899] text-white p-3.5 rounded-full shadow-lg transform group-hover:scale-105 transition-transform">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
               </svg>
             </div>
          </button>
          <div className="flex-1 relative">
              <form onSubmit={handleFormSubmit} className="w-full">
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onFocus={() => setShowHistory(true)}
                    placeholder="Talk about expenses or mawa3id..."
                    className="w-full bg-gray-100/80 border border-transparent focus:border-[#7F3DFF]/30 rounded-full pl-5 pr-12 py-3.5 text-slate-800 text-sm focus:ring-4 focus:ring-[#7F3DFF]/10 outline-none transition-all shadow-inner"
                  />
              </form>
              <div className="absolute right-2 top-1.5">
                 {inputText ? (
                   <button onClick={handleFormSubmit} className="p-2 bg-[#7F3DFF] rounded-full text-white hover:bg-[#6a2ee3] shadow-md transform transition-transform active:scale-90">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                   </button>
                 ) : (
                    <button onClick={startRecording} className="p-2 rounded-full transition-all bg-transparent text-gray-400 hover:text-[#7F3DFF] hover:bg-white">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </button>
                 )}
              </div>
          </div>
      </div>
      
      {/* Recording Overlay */}
      {isRecording && (
        <div className="fixed inset-0 z-[60] bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-fade-in-up">
            <div className="text-center mb-12">
              <div className="relative mb-8">
                 <div className="flex items-center justify-center gap-1.5 h-16">
                    {[...Array(7)].map((_, i) => <div key={i} className="w-1.5 bg-gradient-to-t from-red-500 to-pink-500 rounded-full animate-[bounce_1s_infinite]" style={{animationDuration: `${0.8 + Math.random()*0.5}s`}}></div>)}
                 </div>
                 <div className="absolute -bottom-6 left-0 w-full text-center">
                    <span className="px-3 py-1 bg-red-50 text-red-500 text-xs font-bold rounded-full border border-red-100">REC</span>
                 </div>
              </div>
              <h2 className="text-slate-800 font-bold text-3xl mb-2 tracking-tight">Listening...</h2>
              <p className="text-slate-500 font-medium">Click <span className="text-[#7F3DFF]">Send</span> when you're done.</p>
            </div>
            <div className="flex gap-10 items-center">
               <button onClick={cancelRecording} className="group flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-gray-100 group-hover:bg-red-50 border border-gray-200 group-hover:border-red-200 flex items-center justify-center transition-all transform group-hover:scale-110">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 group-hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                  <span className="text-gray-400 text-xs font-bold uppercase tracking-wider group-hover:text-red-400">Cancel</span>
               </button>
               <button onClick={stopAndSend} className="group flex flex-col items-center gap-3">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#7F3DFF] to-[#EC4899] shadow-[0_20px_50px_-10px_rgba(127,61,255,0.5)] flex items-center justify-center transition-all transform group-hover:scale-105">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </div>
                  <span className="text-[#7F3DFF] text-xs font-bold uppercase tracking-wider">Send</span>
               </button>
            </div>
        </div>
      )}
    </>
  );
};

export default ChatBot;