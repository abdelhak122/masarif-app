import React, { useState } from 'react';
import { storageService } from '../services/storage';
import { User } from '../types';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let user: User;
      if (isRegister) {
        if (!name) throw new Error("3afak dkhl smitek (Name is required)");
        user = await storageService.register({ email, name, password: 'dummy' });
      } else {
        user = await storageService.login(email);
      }
      onLogin(user);
    } catch (err: any) {
      if (err.message === 'User not found') {
        setError('Had l-compte ma-kaynach. 3afak dkhl smitek bach tsajjel.');
        setIsRegister(true);
      } else if (err.message === 'User already exists') {
        setError('Had l-email deja msajjel. Dir Dkhoul.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFFFF] p-6 relative overflow-hidden">
      {/* Decorative Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-80 h-80 bg-purple-100 rounded-full blur-3xl opacity-60"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-60"></div>

      <div className="w-full max-w-md z-10 flex flex-col items-center animate-fade-in-up">
        {/* 3D Wallet Illustration Placeholder */}
        <div className="relative w-72 h-72 mb-8 flex items-center justify-center">
           <div className="w-56 h-40 bg-gradient-to-br from-[#7F3DFF] to-[#5E2DB3] rounded-[32px] shadow-[0_20px_50px_-12px_rgba(127,61,255,0.5)] transform -rotate-12 relative z-10 border-b-4 border-[#4a228a]">
              {/* Wallet Flap */}
              <div className="absolute top-0 left-0 w-full h-full rounded-[32px] overflow-hidden">
                  <div className="w-full h-1/2 bg-white/10 skew-y-6 transform origin-top-left"></div>
              </div>
              {/* Clasp */}
              <div className="w-16 h-12 bg-[#9D6BFF] rounded-l-xl absolute -right-2 top-1/2 transform -translate-y-1/2 flex items-center justify-center shadow-lg">
                 <div className="w-4 h-4 bg-[#FACC15] rounded-full shadow-inner"></div>
              </div>
              {/* Money/Coins */}
              <div className="absolute -top-6 right-12 w-12 h-12 bg-[#FACC15] rounded-full border-4 border-white shadow-lg flex items-center justify-center text-yellow-700 font-bold">$</div>
              <div className="absolute -top-2 right-4 w-10 h-10 bg-[#FACC15] rounded-full border-4 border-white shadow-lg z-0"></div>
           </div>
           {/* Decorative Elements */}
           <div className="absolute top-10 left-4 w-4 h-4 bg-pink-400 rounded-full animate-bounce"></div>
           <div className="absolute bottom-10 right-10 w-6 h-6 bg-blue-400 rounded-full animate-bounce delay-150"></div>
        </div>

        <h1 className="text-3xl font-extrabold text-slate-800 text-center mb-3 leading-tight">
          Save your money with <br/><span className="text-[#7F3DFF]">Expense Tracker</span>
        </h1>
        <p className="text-slate-500 text-center text-sm px-4 mb-10 font-medium">
          Suivi dial lmasarif b'Darija. The more your money works for you, the less you have to work for money.
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {isRegister && (
            <div className="animate-fade-in-up">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#7F3DFF] focus:border-transparent outline-none transition-all"
                placeholder="Smiya (Name)"
              />
            </div>
          )}
          
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#7F3DFF] focus:border-transparent outline-none transition-all"
              placeholder="Email Address"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-500 text-sm p-3 rounded-xl text-center font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#7F3DFF] hover:bg-[#6a2ee3] text-white font-bold py-4 rounded-2xl shadow-[0_10px_20px_-5px_rgba(127,61,255,0.4)] transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed text-lg"
          >
            {loading ? 'Loading...' : isRegister ? 'Start Now' : 'Let\'s Start'}
          </button>
        </form>

        <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="mt-6 text-slate-400 hover:text-[#7F3DFF] text-sm font-medium transition-colors"
        >
            {isRegister ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
        </button>
      </div>
    </div>
  );
};

export default Auth;