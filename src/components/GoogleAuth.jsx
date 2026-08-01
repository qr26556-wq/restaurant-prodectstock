import React, { useState, useEffect } from 'react';
import { LogIn, LogOut, ChevronDown, User, Settings, Check, RefreshCw } from 'lucide-react';

export default function GoogleAuth({ user, setUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [popupStep, setPopupStep] = useState('accounts'); // 'accounts' | 'loading' | 'success'
  const [selectedAcc, setSelectedAcc] = useState(null);

  const mockAccounts = [
    {
      name: "Muhammad Ali",
      email: "m.ali.designer.2026@gmail.com",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
    },
    {
      name: "Ayesha Khan",
      email: "ayesha.k.creative@gmail.com",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80"
    },
    {
      name: "Guest Explorer",
      email: "guest.printcraft@gmail.com",
      avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80"
    }
  ];

  useEffect(() => {
    // Persist session
    const savedUser = localStorage.getItem('google_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, [setUser]);

  const handleSignInClick = () => {
    setIsPopupOpen(true);
    setPopupStep('accounts');
    setSelectedAcc(null);
  };

  const selectAccount = (acc) => {
    setSelectedAcc(acc);
    setPopupStep('loading');
    setTimeout(() => {
      setPopupStep('success');
      setTimeout(() => {
        setUser(acc);
        localStorage.setItem('google_user', JSON.stringify(acc));
        setIsPopupOpen(false);
      }, 1000);
    }, 1500);
  };

  const handleSignOut = () => {
    setUser(null);
    localStorage.removeItem('google_user');
    setIsOpen(false);
  };

  return (
    <div className="relative z-50">
      {/* Auth Status & Action Trigger */}
      {!user ? (
        <button
          onClick={handleSignInClick}
          className="flex items-center gap-2.5 px-4 py-2 bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 active:scale-95 transition-all text-sm"
        >
          <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24">
            <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.71 0 3.27.614 4.5 1.74l2.4-2.4C17.38 1.83 14.96 1 12.24 1 6.58 1 2 5.58 2 11.24s4.58 10.24 10.24 10.24c5.795 0 10.24-4.11 10.24-10.24 0-.64-.06-1.22-.16-1.74H12.24z"/>
          </svg>
          Sign In with Google
        </button>
      ) : (
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-sm"
          >
            <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full object-cover ring-2 ring-brand-500/50" />
            <span className="hidden sm:inline-block font-medium text-slate-200">{user.name}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && (
            <>
              {/* Overlay backdrop to dismiss dropdown */}
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              
              <div className="absolute right-0 mt-2 w-72 glass-panel-heavy rounded-2xl p-4 shadow-2xl border border-white/15 z-50 animate-slide-up">
                <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                  <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-brand-500" />
                  <div className="overflow-hidden">
                    <p className="font-bold text-white text-sm truncate">{user.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  </div>
                </div>

                <div className="py-2.5 space-y-1">
                  <div className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-400">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Google Account Linked</span>
                  </div>
                  <button
                    onClick={() => { alert("Account settings option is simulated. You are logged into a Premium developer workspace."); setIsOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    Profile Studio
                  </button>
                  <button
                    onClick={() => { alert("Simulated System Preferences loaded successfully."); setIsOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    Design Preferences
                  </button>
                </div>

                <div className="pt-2.5 border-t border-white/10">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Realistic Simulated Google Sign-In Popup */}
      {isPopupOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="w-full max-w-[440px] bg-white text-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-slide-up border border-slate-200">
            {/* Header: Google branding */}
            <div className="px-8 pt-8 pb-6 flex flex-col items-center border-b border-slate-100">
              <div className="flex items-center gap-1.5 mb-4">
                {/* Clean inline SVG of Google colored logo */}
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.71 0 3.27.614 4.5 1.74l2.4-2.4C17.38 1.83 14.96 1 12.24 1 6.58 1 2 5.58 2 11.24s4.58 10.24 10.24 10.24c5.795 0 10.24-4.11 10.24-10.24 0-.64-.06-1.22-.16-1.74H12.24z"/>
                </svg>
                <span className="font-semibold text-slate-700 text-lg tracking-tight">Sign in with Google</span>
              </div>
              <p className="text-center text-slate-500 text-sm">
                to continue to <span className="font-semibold text-brand-600">PrintCraft Studio Pro</span>
              </p>
            </div>

            {/* Popup content */}
            <div className="p-8">
              {popupStep === 'accounts' && (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Choose an account
                  </p>
                  <div className="space-y-2.5">
                    {mockAccounts.map((acc, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectAccount(acc)}
                        className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all text-left group"
                      >
                        <img src={acc.avatar} alt={acc.name} className="w-10 h-10 rounded-full object-cover group-hover:scale-105 transition-transform ring-1 ring-slate-100" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-sm">{acc.name}</p>
                          <p className="text-xs text-slate-500 truncate">{acc.email}</p>
                        </div>
                        <div className="w-5 h-5 rounded-full border border-slate-200 flex items-center justify-center group-hover:border-brand-500 group-hover:bg-brand-50 transition-all">
                          <span className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-brand-500 transition-all" />
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="pt-4 flex items-center justify-between text-xs text-slate-400">
                    <button onClick={() => setIsPopupOpen(false)} className="hover:text-slate-600 font-medium transition-all">
                      Cancel
                    </button>
                    <a href="#privacy" className="hover:underline hover:text-slate-600">Privacy & Terms</a>
                  </div>
                </div>
              )}

              {popupStep === 'loading' && (
                <div className="flex flex-col items-center py-10 text-center">
                  <RefreshCw className="w-10 h-10 text-brand-600 animate-spin mb-4" />
                  <h4 className="font-bold text-slate-800 mb-1">Authenticating...</h4>
                  <p className="text-xs text-slate-400">Verifying secure 2026 OAuth token with Google services</p>
                </div>
              )}

              {popupStep === 'success' && (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 mb-4 animate-bounce">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-emerald-600 mb-1">Access Granted!</h4>
                  <p className="text-xs text-slate-500">Welcome, {selectedAcc?.name}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
