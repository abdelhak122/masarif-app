import React, { useEffect, useState } from 'react';
import { User, Appointment } from '../types';
import { storageService } from '../services/storage';

interface AppointmentsProps {
  user: User;
}

const Appointments: React.FC<AppointmentsProps> = ({ user }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<'upcoming' | 'history'>('upcoming');

  const loadData = async () => {
    const data = await storageService.getAppointments(user.email);
    setAppointments(data);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Refresh periodically
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const now = new Date().getTime();
  
  const upcoming = appointments.filter(a => 
    a.status === 'scheduled' && new Date(a.date).getTime() > now
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const history = appointments.filter(a => 
    a.status !== 'scheduled' || new Date(a.date).getTime() <= now
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const displayed = filter === 'upcoming' ? upcoming : history;

  // Grouping Logic
  const groupedAppointments = displayed.reduce((groups, appt) => {
    const dateObj = new Date(appt.date);
    const dateKey = dateObj.toDateString();
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(appt);
    return groups;
  }, {} as Record<string, Appointment[]>);

  const sortedGroupKeys = Object.keys(groupedAppointments).sort((a, b) => {
      // If upcoming, sort ascending (soonest first). If history, sort descending (newest first).
      const dateA = new Date(a).getTime();
      const dateB = new Date(b).getTime();
      return filter === 'upcoming' ? dateA - dateB : dateB - dateA;
  });

  const handleDelete = async (id: string) => {
    if(confirm('Delete this appointment?')) {
      await storageService.deleteAppointment(id);
      loadData();
    }
  };

  const handleStatusChange = async (appt: Appointment, status: 'completed' | 'cancelled') => {
     await storageService.updateAppointment({ ...appt, status });
     loadData();
  };

  const getTypeStyle = (type: string) => {
    switch(type) {
      case 'meeting': return { icon: '👥', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' };
      case 'call': return { icon: '📞', bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-100' };
      case 'reminder': return { icon: '⏰', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' };
      default: return { icon: '📅', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-100' };
    }
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] pb-32">
      <header className="sticky top-0 z-30 bg-[#F8F9FD]/95 backdrop-blur-md px-6 py-4 border-b border-gray-200/50">
        <div className="flex justify-between items-center">
           <div>
              <h1 className="text-2xl font-bold text-slate-800">My Agenda</h1>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mt-1">Planner & Appointments</p>
           </div>
           <div className="bg-white p-2 rounded-full shadow-sm border border-gray-100">
             <span className="text-xl">📅</span>
           </div>
        </div>
      </header>

      <main className="px-6 mt-6">
        {/* Filter Toggle */}
        <div className="flex bg-gray-100/80 p-1 rounded-xl mb-8 w-full max-w-xs mx-auto">
           <button 
             onClick={() => setFilter('upcoming')}
             className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'upcoming' ? 'bg-white text-slate-800 shadow-sm' : 'text-gray-400 hover:text-slate-600'}`}
           >
             Upcoming
           </button>
           <button 
             onClick={() => setFilter('history')}
             className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-gray-400 hover:text-slate-600'}`}
           >
             Past & Cancelled
           </button>
        </div>

        {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
               <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-3xl mb-4 grayscale">
                  📭
               </div>
               <p className="text-slate-500 font-medium">No {filter} appointments</p>
            </div>
        ) : (
           <div className="relative space-y-8">
              {/* Continuous Timeline Line */}
              <div className="absolute top-4 bottom-0 left-[19px] w-0.5 bg-gray-200 z-0 hidden md:block"></div>

              {sortedGroupKeys.map((dateKey, dateIndex) => (
                 <div key={dateKey} className="relative z-10 animate-fade-in-up" style={{ animationDelay: `${dateIndex * 0.1}s` }}>
                    
                    {/* Date Header */}
                    <div className="flex items-center mb-4 sticky top-20 z-20 bg-[#F8F9FD]/90 backdrop-blur-sm py-2 w-fit pr-4 rounded-r-full">
                       <div className={`w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm mr-3 ${filter === 'upcoming' && dateIndex === 0 ? 'bg-[#7F3DFF]' : 'bg-gray-300'}`}></div>
                       <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                          {formatDateHeader(dateKey)}
                       </h3>
                    </div>

                    {/* Cards Grid */}
                    <div className="pl-6 space-y-4 border-l-2 border-gray-200/50 ml-1.5 md:border-none md:ml-0">
                       {groupedAppointments[dateKey].map((appt) => {
                          const style = getTypeStyle(appt.type);
                          const time = new Date(appt.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                          const isDone = appt.status === 'completed';
                          const isCancelled = appt.status === 'cancelled';

                          return (
                             <div key={appt.id} className={`bg-white rounded-2xl p-5 shadow-sm border ${style.border} relative overflow-hidden group transition-all hover:shadow-md ${isCancelled ? 'opacity-60' : ''}`}>
                                
                                {isCancelled && <div className="absolute inset-0 bg-gray-50/50 z-10 pointer-events-none"></div>}
                                
                                <div className="flex gap-4 relative z-0">
                                   {/* Time Column */}
                                   <div className="flex flex-col items-center pt-1 min-w-[60px]">
                                      <span className="text-sm font-bold text-slate-700">{time}</span>
                                      <div className={`mt-2 w-8 h-8 rounded-full ${style.bg} flex items-center justify-center text-sm`}>
                                         {style.icon}
                                      </div>
                                   </div>

                                   {/* Content Column */}
                                   <div className="flex-1 border-l border-gray-100 pl-4">
                                      <h4 className={`font-bold text-slate-800 text-base mb-1 ${isDone ? 'line-through text-slate-400' : ''} ${isCancelled ? 'line-through text-gray-400' : ''}`}>
                                         {appt.title}
                                      </h4>
                                      <span className={`text-xs font-medium px-2 py-1 rounded-md inline-block mb-3 ${style.bg} ${style.text}`}>
                                         {appt.type.charAt(0).toUpperCase() + appt.type.slice(1)}
                                      </span>
                                      
                                      {/* Actions */}
                                      {filter === 'upcoming' && !isCancelled && (
                                        <div className="flex gap-2 mt-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                            <button 
                                              onClick={() => handleStatusChange(appt, 'completed')}
                                              className="flex-1 bg-green-50 hover:bg-green-100 text-green-600 text-xs font-bold py-2 rounded-lg border border-green-100 transition-colors"
                                            >
                                              Complete
                                            </button>
                                            <button 
                                              onClick={() => handleStatusChange(appt, 'cancelled')}
                                              className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-500 text-xs font-bold py-2 rounded-lg border border-gray-200 transition-colors"
                                            >
                                              Cancel
                                            </button>
                                        </div>
                                      )}
                                      
                                      {filter === 'upcoming' && (
                                         <button onClick={() => handleDelete(appt.id)} className="absolute top-4 right-4 text-gray-300 hover:text-red-400 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                         </button>
                                      )}
                                   </div>
                                </div>
                                
                                {isDone && <div className="absolute top-3 right-3 text-green-500 font-bold text-xs bg-white px-2 py-1 rounded-full shadow-sm border border-green-100">✓ Done</div>}
                                {isCancelled && <div className="absolute top-3 right-3 text-red-400 font-bold text-xs bg-white px-2 py-1 rounded-full shadow-sm border border-red-100">Cancelled</div>}

                             </div>
                          );
                       })}
                    </div>
                 </div>
              ))}
           </div>
        )}
      </main>
    </div>
  );
};

export default Appointments;