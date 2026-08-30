import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Augment the window object for beforeinstallprompt event
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

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the prompt
    await deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    
    // Clear the deferredPrompt so it can only be used once.
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  // Only show if we have a prompt and it hasn't been dismissed
  const showPrompt = deferredPrompt !== null && !isDismissed;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          className="fixed bottom-4 right-4 z-[90] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-white/10 shadow-xl shadow-slate-900/10 rounded-full px-3.5 py-1.5 flex items-center gap-3 backdrop-blur-md"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#1D70B8]/10 text-[#1D70B8] flex items-center justify-center shrink-0">
              <Smartphone className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs text-slate-700 dark:text-gray-300 font-bold whitespace-nowrap">
              Install Osan HR
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleInstallClick}
              className="bg-[#1D70B8] hover:bg-[#155994] text-white px-3 py-1 rounded-full font-bold transition-all text-xs flex items-center gap-1 shadow-xs active:scale-95 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              Install
            </button>
            
            <button
              onClick={handleDismiss}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-white/10"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
