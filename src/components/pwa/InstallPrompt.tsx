import { useState, useEffect } from 'react';
import { Download, X, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setShowDetailModal(false);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User installed Osan Group PWA App');
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setShowDetailModal(false);
  };

  const showPrompt = deferredPrompt !== null && !isDismissed;

  return (
    <AnimatePresence>
      {showPrompt && (
        <>
          {/* Floating Pill Prompt at Bottom Right */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-5 right-5 z-[90] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/15 shadow-2xl shadow-slate-900/20 rounded-2xl p-3 flex items-center gap-3 backdrop-blur-md max-w-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-1 flex items-center justify-center shrink-0">
              <img src="/osan-logo.png" alt="Osan Group Logo" className="w-full h-full object-contain" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                Install Osan Group HR App
              </div>
              <div className="text-[10px] text-slate-500 dark:text-gray-400 truncate">
                one.osangroupoman.com
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowDetailModal(true)}
                className="bg-primary hover:bg-emerald-600 text-white px-3 py-1.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                Install
              </button>
              
              <button
                onClick={handleDismiss}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>

          {/* Premium Osan Group PWA Install Dialog Modal */}
          {showDetailModal && (
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl max-w-md w-full p-6 text-center space-y-6 animate-in zoom-in-95 duration-200">
                <div className="relative">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="absolute top-0 right-0 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="w-20 h-20 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-2 mx-auto mb-4 flex items-center justify-center shadow-lg">
                    <img src="/osan-logo.png" alt="Osan Group" className="w-full h-full object-contain" />
                  </div>

                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Osan Group HR & Attendance
                  </h3>
                  <p className="text-xs font-semibold text-primary mt-1">
                    one.osangroupoman.com
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 text-left space-y-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300 font-medium">
                    <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Instant 1-Tap Home Screen & Desktop Access</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300 font-medium">
                    <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>Geofence GPS & Office Wi-Fi Attendance Verification</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span>Offline Shift Logging & Fast Performance</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 pt-2">
                  <button
                    onClick={handleInstallClick}
                    className="w-full py-3 bg-primary hover:bg-emerald-600 text-white font-extrabold rounded-2xl text-xs transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    Install Osan Group App
                  </button>

                  <button
                    onClick={handleDismiss}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-gray-400 font-semibold rounded-2xl text-xs transition-colors cursor-pointer"
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
