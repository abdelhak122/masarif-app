import React, { useEffect, useState } from 'react';
import { Expense, User } from '../types';
import { storageService } from '../services/storage';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [tempBudget, setTempBudget] = useState(user.budget?.toString() || '5000');

  const fetchData = async () => {
    try {
      const data = await storageService.getExpenses(user.email);
      setExpenses(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSaveProfile = async () => {
    const newBudget = parseFloat(tempBudget);
    if (!isNaN(newBudget)) {
      await storageService.updateUser({ ...user, budget: newBudget });
      setShowProfile(false);
    }
  };

  // Stats
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const budget = user.budget || 5000;
  const progress = Math.min((totalSpent / budget) * 100, 100);
  const remaining = budget - totalSpent;

  // Chart Data
  const getChartData = () => {
    const data: Record<string, number> = {};
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      data[dateStr] = 0;
    }

    expenses.forEach(e => {
       if (data[e.date] !== undefined) {
         data[e.date] += e.amount;
       }
    });

    return Object.entries(data).map(([date, amount]) => ({
      name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      amount
    }));
  };

  const chartData = getChartData();

  // Category Breakdown
  const getCategoryData = () => {
    const cats: Record<string, number> = {};
    expenses.forEach(e => {
      cats[e.category] = (cats[e.category] || 0) + e.amount;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  };
  const categoryData = getCategoryData();
  const COLORS = ['#7F3DFF', '#FACC15', '#EC4899', '#3B82F6', '#10B981', '#6366F1'];

  // Icons for categories
  const getCategoryIcon = (cat: string) => {
      const lower = cat.toLowerCase();
      if (lower.includes('food')) return { bg: 'bg-orange-100', text: 'text-orange-600', icon: '🍔' };
      if (lower.includes('transport')) return { bg: 'bg-blue-100', text: 'text-blue-600', icon: '🚕' };
      if (lower.includes('shopping')) return { bg: 'bg-purple-100', text: 'text-purple-600', icon: '🛍️' };
      if (lower.includes('health')) return { bg: 'bg-red-100', text: 'text-red-600', icon: '❤️' };
      if (lower.includes('utility')) return { bg: 'bg-green-100', text: 'text-green-600', icon: '💡' };
      if (lower.includes('entertainment')) return { bg: 'bg-pink-100', text: 'text-pink-600', icon: '🎬' };
      return { bg: 'bg-gray-100', text: 'text-gray-600', icon: '💸' };
  };

  // Group Expenses by Date
  const groupedExpenses = expenses.reduce((groups, expense) => {
    const date = expense.date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(expense);
    return groups;
  }, {} as Record<string, Expense[]>);

  // Sort dates descending
  const sortedDates = Object.keys(groupedExpenses).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#F8F9FD]/90 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b border-gray-200/50">
        <div className="flex items-center gap-3" onClick={() => setShowProfile(true)}>
             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7F3DFF] to-[#EC4899] flex items-center justify-center overflow-hidden border-2 border-white shadow-sm cursor-pointer transform transition-transform hover:scale-105">
                <span className="font-bold text-white text-lg">{user.name.charAt(0).toUpperCase()}</span>
             </div>
             <div className="cursor-pointer">
                 <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">My Wallet</p>
                 <h1 className="font-bold text-slate-800 leading-none text-lg">{user.name}</h1>
             </div>
        </div>
        <button onClick={() => setShowProfile(true)} className="p-2 bg-white rounded-full shadow-sm border border-gray-100 text-gray-500 hover:text-[#7F3DFF] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        </button>
      </header>

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-up">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">My Profile</h2>
                <button onClick={() => setShowProfile(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                   </svg>
                </button>
             </div>
             
             <div className="flex flex-col items-center mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7F3DFF] to-[#EC4899] flex items-center justify-center text-white text-3xl font-bold mb-3 shadow-lg">
                   {user.name.charAt(0).toUpperCase()}
                </div>
                <h3 className="text-lg font-bold text-slate-800">{user.name}</h3>
                <p className="text-sm text-gray-500">{user.email}</p>
             </div>

             <div className="space-y-4">
                <div>
                   <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Monthly Budget (DH)</label>
                   <div className="relative">
                      <span className="absolute left-3 top-3 text-gray-400 font-bold">DH</span>
                      <input 
                        type="number" 
                        value={tempBudget} 
                        onChange={(e) => setTempBudget(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 font-bold text-slate-800 focus:ring-2 focus:ring-[#7F3DFF] outline-none"
                      />
                   </div>
                </div>
             </div>

             <div className="flex gap-3 mt-8">
                <button onClick={onLogout} className="flex-1 py-3 rounded-xl border border-red-100 text-red-500 font-bold text-sm hover:bg-red-50">
                   Log Out
                </button>
                <button onClick={handleSaveProfile} className="flex-1 py-3 rounded-xl bg-[#7F3DFF] text-white font-bold text-sm hover:bg-[#6a2ee3] shadow-lg shadow-purple-200">
                   Save Plan
                </button>
             </div>
          </div>
        </div>
      )}

      <main className="px-6 space-y-8 mt-4">
        
        {/* Main Balance Card - Gradient */}
        <div className="w-full p-6 rounded-[32px] bg-gradient-to-br from-[#8B5CF6] via-[#7F3DFF] to-[#EC4899] shadow-[0_20px_40px_-12px_rgba(127,61,255,0.4)] text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl transform -translate-x-5 translate-y-5"></div>
            
            <div className="relative z-10">
                <div className="text-center mb-6">
                    <p className="text-white/80 text-sm font-medium mb-1">Available Balance</p>
                    <h2 className="text-5xl font-bold tracking-tight">{remaining.toFixed(0)} <span className="text-2xl font-medium opacity-80">DH</span></h2>
                </div>

                <div className="flex items-center gap-3 mb-2">
                   <div className="flex-1 bg-black/20 h-2 rounded-full overflow-hidden backdrop-blur-sm">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${progress > 90 ? 'bg-red-300' : 'bg-white'}`} 
                        style={{ width: `${progress}%` }}
                      ></div>
                   </div>
                   <span className="text-xs font-bold text-white/90">{progress.toFixed(0)}% Used</span>
                </div>
                
                <div className="flex justify-between text-xs text-white/70 font-medium px-1">
                   <span>Spent: {totalSpent.toFixed(0)}</span>
                   <span>Limit: {budget}</span>
                </div>
            </div>
        </div>

        {/* Statistics Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-56 w-full bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800">Weekly Activity</h3>
             </div>
             <div className="flex-1 -ml-2">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartData}>
                   <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                   <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} itemStyle={{ color: '#fff' }} />
                   <Bar dataKey="amount" radius={[4, 4, 4, 4]} barSize={8}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#7F3DFF' : '#E2E8F0'} />
                      ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>

          <div className="h-56 w-full bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
             <h3 className="font-bold text-slate-800 mb-2">Spending Breakdown</h3>
             {categoryData.length > 0 ? (
               <div className="flex-1 flex items-center justify-center relative">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={60}
                          paddingAngle={5}
                          dataKey="value"
                       >
                          {categoryData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                       </Pie>
                       <Tooltip />
                    </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute bottom-0 w-full flex justify-center gap-3 flex-wrap">
                    {categoryData.slice(0, 3).map((entry, index) => (
                       <div key={index} className="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                          {entry.name}
                       </div>
                    ))}
                 </div>
               </div>
             ) : (
               <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">No expenses yet</div>
             )}
          </div>
        </div>

        {/* Grouped Transactions List */}
        <div className="pb-24">
          <div className="flex justify-between items-center px-1 mb-4">
             <h3 className="font-bold text-slate-800 text-lg">Transactions</h3>
             <button className="text-xs font-bold text-[#7F3DFF] bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-full transition-colors">
                See All
             </button>
          </div>

          {loading && expenses.length === 0 ? (
             <div className="text-center py-8 text-gray-400 animate-pulse">Loading transactions...</div>
          ) : expenses.length === 0 ? (
             <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 shadow-sm border-dashed">
               <p className="text-gray-400 font-medium">No transactions yet.</p>
               <p className="text-xs text-gray-300 mt-1">Tell Gemini to add one!</p>
             </div>
          ) : (
            <div className="space-y-6">
              {sortedDates.map(date => {
                const dayExpenses = groupedExpenses[date];
                const dayTotal = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
                
                return (
                  <div key={date} className="animate-fade-in-up">
                    <div className="flex justify-between items-center px-2 mb-3">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{formatDateHeader(date)}</h4>
                      <span className="text-xs font-bold text-slate-600">-{dayTotal.toFixed(0)} DH</span>
                    </div>
                    <div className="space-y-3">
                      {dayExpenses.sort((a, b) => b.createdAt - a.createdAt).map(exp => {
                        const style = getCategoryIcon(exp.category);
                        return (
                          <div key={exp.id} className="bg-white p-4 rounded-2xl border border-gray-50 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow cursor-pointer group">
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-2xl ${style.bg} flex items-center justify-center text-xl group-hover:scale-105 transition-transform`}>
                                  {style.icon}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-800 text-sm">{exp.category}</h4>
                                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[140px]">{exp.description}</p>
                              </div>
                            </div>
                            <div className="text-right">
                                <span className="font-bold text-slate-800 text-sm block">-{exp.amount.toFixed(0)} DH</span>
                                <span className="text-[10px] text-gray-400">{new Date(exp.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;