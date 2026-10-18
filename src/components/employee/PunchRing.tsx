import { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { verifyLocation } from '../../utils/geofencing';
import { getCompanySettings, type CompanySettings } from '../../lib/settings';
import { X, MapPin } from 'lucide-react';

interface PunchRingProps {
  isCheckedIn: boolean;
  onPunch: (ip?: string) => Promise<void>;
  disabledMessage?: string | null;
  companySettings?: CompanySettings | null;
  companyName?: string | null;
  companyId?: string | null;
}

export function PunchRing({
  isCheckedIn,
  onPunch,
  disabledMessage,
  companySettings,
  companyName,
  companyId
}: PunchRingProps) {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  
  const pressTimer = useRef<number | null>(null);
  const progressInterval = useRef<number | null>(null);
  const controls = useAnimation();

  const HOLD_DURATION = 2000; // 2 seconds

  const startPress = async () => {
    if (disabledMessage) return;
    
    setError(null);
    controls.start({ scale: 0.95 });

    let startTime = Date.now();
    
    progressInterval.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
      setProgress(newProgress);
    }, 16); // ~60fps

    pressTimer.current = window.setTimeout(async () => {
      // 2 seconds held successfully
      handleSuccessfulHold();
    }, HOLD_DURATION);
  };

  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (progressInterval.current) clearInterval(progressInterval.current);
    
    setProgress(0);
    controls.start({ scale: 1 });
  };

  const handleSuccessfulHold = async () => {
    cancelPress(); // Reset UI state
    setVerifying(true);
    
    try {
      let activeSettings = companySettings;
      if (!activeSettings && companyId) {
        activeSettings = await getCompanySettings(companyId);
      }

      const locationRes = await verifyLocation({
        latitude: activeSettings?.office_latitude,
        longitude: activeSettings?.office_longitude,
        ip: activeSettings?.office_ip,
        officeName: companyName,
      });

      if (!locationRes.success) {
        setError(locationRes.error || "Location verification failed");
        return;
      }
      
      await onPunch(locationRes.ip);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during verification");
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    return () => cancelPress();
  }, []);

  const ringColor = isCheckedIn ? 'border-primary' : 'border-slate-300 dark:border-gray-700';
  const innerColor = isCheckedIn ? 'bg-primary/10 dark:bg-primary/20' : 'bg-white dark:bg-slate-900/90';
  
  return (
    <div className="flex flex-col items-center justify-center gap-6 select-none touch-none">
      <div className="relative w-64 h-64 flex items-center justify-center">
        {/* Background pulsing ring for active state */}
        {isCheckedIn && (
          <div className="absolute inset-0 rounded-full border border-primary/30 animate-pulse scale-110" />
        )}

        {/* Progress SVG Ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
          <circle
            cx="128"
            cy="128"
            r="124"
            fill="none"
            className="stroke-slate-200 dark:stroke-white/10"
            strokeWidth="4"
          />
          <circle
            cx="128"
            cy="128"
            r="124"
            fill="none"
            stroke={isCheckedIn ? '#ef4444' : '#10B981'} // Red for checkout progress, Green for checkin progress
            strokeWidth="4"
            strokeDasharray="779" // 2 * PI * 124
            strokeDashoffset={779 - (779 * progress) / 100}
            className="transition-all duration-75"
          />
        </svg>

        {/* Interactive Center Button */}
        <motion.div
          animate={controls}
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          onContextMenu={(e) => e.preventDefault()}
          className={`relative w-56 h-56 rounded-full border-4 ${ringColor} ${innerColor} shadow-xl dark:shadow-none flex flex-col items-center justify-center cursor-pointer overflow-hidden group`}
        >
          {verifying ? (
            <div className="flex flex-col items-center animate-pulse">
              <MapPin className="w-8 h-8 mb-2 text-primary" />
              <span className="text-sm font-medium text-slate-800 dark:text-white">Verifying Location...</span>
            </div>
          ) : (
            <>
              <span className="text-2xl font-bold tracking-wider uppercase mb-1 text-slate-900 dark:text-white">
                {isCheckedIn ? 'Check Out' : 'Check In'}
              </span>
              <span className="text-xs text-slate-500 dark:text-gray-400 group-hover:text-primary transition-colors font-medium">
                Press & Hold (2s)
              </span>
            </>
          )}
        </motion.div>
      </div>

      {/* Messages */}
      {disabledMessage && (
        <div className="text-amber-500 bg-amber-500/10 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          {disabledMessage}
        </div>
      )}
      
      {error && (
        <div className="text-red-400 bg-red-400/10 px-4 py-3 rounded-lg text-sm font-medium flex items-start max-w-sm text-center">
          <X className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
