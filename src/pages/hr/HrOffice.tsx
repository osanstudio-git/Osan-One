import { useState, useEffect } from 'react';
import { MapPin, Globe, Loader2, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCompanySettings, updateCompanySettings } from '../../lib/settings';

export function HrOffice() {
  const { profile } = useAuth();
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isFetchingIp, setIsFetchingIp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [ip, setIp] = useState<string>('');

  useEffect(() => {
    if (profile?.company_id) {
      loadSettings();
    }
  }, [profile?.company_id]);

  const loadSettings = async () => {
    if (!profile?.company_id) return;
    const data = await getCompanySettings(profile.company_id);
    if (data) {
      setLat(data.office_latitude?.toString() || '');
      setLng(data.office_longitude?.toString() || '');
      setIp(data.office_ip || '');
    }
  };

  const fetchLocation = () => {
    setIsFetchingLocation(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toString());
          setLng(position.coords.longitude.toString());
          setIsFetchingLocation(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Failed to get location. Please allow location access.");
          setIsFetchingLocation(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
      setIsFetchingLocation(false);
    }
  };

  const fetchIp = async () => {
    setIsFetchingIp(true);
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      setIp(data.ip);
    } catch (error) {
      console.error("Error getting IP:", error);
      alert("Failed to fetch public IP.");
    } finally {
      setIsFetchingIp(false);
    }
  };

  const saveSettings = async () => {
    if (!profile?.company_id) return;
    setIsSaving(true);
    const success = await updateCompanySettings(
      profile.company_id,
      lat ? parseFloat(lat) : null,
      lng ? parseFloat(lng) : null,
      ip || null
    );
    setIsSaving(false);
    if (success) {
      alert("Settings saved successfully!");
      loadSettings();
    } else {
      alert("Failed to save settings.");
    }
  };

  return (
    <div className="max-w-2xl animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-white dark:bg-white/5 p-8 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Office Configuration</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm">
            Set up your official office location and network. Employees must be connected to this network or within 50 meters of this location to check in successfully.
          </p>
        </div>

        {/* GPS Location Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-500" />
              GPS Coordinates
            </h3>
            <button
              onClick={fetchLocation}
              disabled={isFetchingLocation}
              className="px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-xs font-bold transition-colors text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 flex items-center gap-2 disabled:opacity-50"
            >
              {isFetchingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              Fetch My Location
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1">Latitude</label>
              <input
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="e.g. 23.5880"
                className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1">Longitude</label>
              <input
                type="text"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="e.g. 58.3829"
                className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-500"
              />
            </div>
          </div>
        </div>

        <hr className="border-slate-200 dark:border-white/10" />

        {/* IP Address Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              Office Network (IP Address)
            </h3>
            <button
              onClick={fetchIp}
              disabled={isFetchingIp}
              className="px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-xs font-bold transition-colors text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 flex items-center gap-2 disabled:opacity-50"
            >
              {isFetchingIp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              Fetch My IP
            </button>
          </div>
          <div className="text-xs">
            <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1">Public IPv4 Address</label>
            <input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="e.g. 176.12.34.56"
              className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary font-mono placeholder:text-slate-400 dark:placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* Save Action */}
        <div className="pt-4 flex justify-end">
          <button
            onClick={saveSettings}
            disabled={isSaving}
            className="px-6 py-3 bg-primary hover:bg-emerald-600 rounded-xl font-bold text-xs text-white shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
