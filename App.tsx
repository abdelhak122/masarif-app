import React, { useEffect, useState, useRef } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Appointments from './components/Appointments';
import ChatBot from './components/ChatBot';
import { storageService } from './services/storage';
import { User, ViewState, Appointment } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [activeAlert, setActiveAlert] = useState<Appointment | null>(null);

  // --- Background Cron Job for Notifications ---
  useEffect(() => {
    if (!user) return;

    const checkAppointments = async () => {
      const appts = await storageService.getAppointments(user.email);
      const now = new Date();
      
      appts.forEach(async (appt) => {
        if (appt.status === 'scheduled' && !appt.notified) {
           const apptTime = new Date(appt.date);
           const diff = apptTime.getTime() - now.getTime();
           
           // Trigger if time is passed or within the next minute
           if (diff <= 60000 && diff > -60000 * 60) { // Trigger if within 1 min or up to 1 hour overdue (if app was closed)
              setActiveAlert(appt);
              
              // Play Sound
              try {
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                
                // Simple "Ding Dong" pattern
                osc.frequency.setValueAtTime(600, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.5);
                gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
                
                osc.start();
                osc.stop(audioCtx.currentTime + 0.5);
              } catch (e) { console.error("Sound play failed", e); }

              // Mark as notified locally
              await storageService.updateAppointment({ ...appt, notified: true });
           }
        }
      });
    };

    // Check every 30 seconds
    const interval = setInterval(checkAppointments, 30000);
    checkAppointments(); // Run immediately

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    // Safely attempt to get user
    const storedUser = storageService.getCurrentUser();
    if (storedUser) {
      setUser(storedUser);
    }
    setInitLoading(false);
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
  };

  const handleLogout = () => {
    storageService.logout();
    setUser(null);
  };

  const dismissAlert = () => {
    setActiveAlert(null);
  };

  if (initLoading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="font-sans antialiased pb-20">
      {!user ? (
        <Auth onLogin={handleLogin} />
      ) : (
        <>
          {/* Main Content Area */}
          {currentView === ViewState.DASHBOARD && (
             <Dashboard user={user} onLogout={handleLogout} />
          )}
          {currentView === ViewState.APPOINTMENTS && (
             <Appointments user={user} />
          )}
          
          <ChatBot user={user} />

          {/* Navigation Bar */}
          <div className="fixed top-0 left-0 w-full z-20 pointer-events-none">
             {/* Placeholder for potential top elements if needed */}
          </div>
          
          <div className="fixed bottom-0 left-0 w-full z-30 pointer-events-none flex justify-center pb-6">
             <div className="bg-white/90 backdrop-blur-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-gray-200/50 rounded-full p-1.5 flex gap-1 pointer-events-auto">
                <button 
                  onClick={() => setCurrentView(ViewState.DASHBOARD)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all ${currentView === ViewState.DASHBOARD ? 'bg-slate-800 text-white shadow-lg transform scale-105' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                   <span>Wallet</span>
                </button>
                <button 
                  onClick={() => setCurrentView(ViewState.APPOINTMENTS)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all ${currentView === ViewState.APPOINTMENTS ? 'bg-[#7F3DFF] text-white shadow-lg transform scale-105' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                   <span>Agenda</span>
                </button>
             </div>
          </div>

          {/* In-App Alarm Notification Modal */}
          {activeAlert && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in-up px-4">
               <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#7F3DFF] to-[#EC4899]"></div>
                  <div className="flex flex-col items-center text-center pt-4">
                     <div className="w-24 h-24 bg-[#F8F9FD] rounded-full flex items-center justify-center mb-5 animate-bounce shadow-inner">
                        <span className="text-5xl">⏰</span>
                     </div>
                     <h3 className="text-2xl font-bold text-slate-800 mb-1">It's time!</h3>
                     <p className="text-slate-500 mb-8 text-sm">You have an appointment scheduled.</p>
                     
                     <div className="bg-slate-50 w-full p-5 rounded-2xl mb-8 border border-slate-100 relative">
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-white px-3 py-1 rounded-full border border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Now</div>
                        <h4 className="font-bold text-xl text-slate-800 mb-1">{activeAlert.title}</h4>
                        <p className="text-sm text-[#7F3DFF] font-bold">{new Date(activeAlert.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                     </div>

                     <button 
                       onClick={dismissAlert}
                       className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all transform active:scale-95 shadow-lg shadow-slate-200"
                     >
                       Got it
                     </button>
                  </div>
               </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;