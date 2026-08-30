import { useState, useEffect } from 'react';
import { MapPin, Globe, Loader2, Save, Building2, CheckCircle2, ShieldAlert, Compass } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCompanies } from '../../lib/databaseService';
import { getCompanySettings, updateCompanySettings } from '../../lib/settings';
import type { Company } from '../../types';

export function HrOffice() {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isFetchingIp, setIsFetchingIp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [ip, setIp] = useState<string>('');
  const [radius, setRadius] = useState<number>(50);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load all companies for dropdown selection
  useEffect(() => {
    getCompanies().then((compList) => {
      setCompanies(compList);
      if (compList.length > 0) {
        // Default to user's assigned company or first company in list
        const defaultComp = compList.find(c => c.id === profile?.company_id || c.name === profile?.company_id || c.name === profile?.company) || compList[0];
        setSelectedCompanyId(defaultComp.id || defaultComp.name);
      }
    }).catch(err => console.error('Error loading companies:', err));
  }, [profile]);

  // Load settings whenever selected company changes
  useEffect(() => {
    if (selectedCompanyId) {
      loadSettingsForCompany(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const loadSettingsForCompany = async (companyId: string) => {
    setLat('');
    setLng('');
    setIp('');
    setSavedSuccess(false);

    const data = await getCompanySettings(companyId);
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
          alert("Failed to get location. Please allow browser location permissions.");
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
    if (!selectedCompanyId) return;
    setIsSaving(true);
    setSavedSuccess(false);

    const success = await updateCompanySettings(
      selectedCompanyId,
      lat ? parseFloat(lat) : null,
      lng ? parseFloat(lng) : null,
      ip || null
    );

    setIsSaving(false);
    if (success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
      loadSettingsForCompany(selectedCompanyId);
    } else {
      alert("Failed to save company office settings.");
    }
  };

  const currentCompObj = companies.find(c => c.id === selectedCompanyId || c.name === selectedCompanyId);

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Header Info */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">Multi-Company Office Setup</h2>
        <p className="text-slate-500 dark:text-gray-400 text-sm">
          Configure unique GPS coordinates, Wi-Fi IP address whitelists, and Geofence boundaries for each company office branch.
        </p>
      </div>

      {/* Target Company Selector Bar */}
      <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#1D70B8] mb-1 flex items-center gap-1.5">
              <Building2 className="w-4 h-4" /> Select Office Branch / Company
            </label>
            <p className="text-xs text-slate-500 dark:text-gray-400">Choose which company office settings you are currently editing</p>
          </div>

          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm font-bold outline-none focus:border-[#1D70B8] min-w-[240px] cursor-pointer"
          >
            {companies.map(c => (
              <option key={c.id || c.name} value={c.id || c.name} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                🏢 {c.name} {c.location ? `(${c.location})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Selected Company Status Badge */}
        {currentCompObj && (
          <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white">Active Branch:</span>
              <span className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full font-extrabold">
                {currentCompObj.name}
              </span>
              {currentCompObj.location && (
                <span className="text-slate-500 dark:text-gray-400 text-xs font-medium">
                  📍 {currentCompObj.location}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              {lat && lng ? (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" /> GPS Active
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg">
                  <ShieldAlert className="w-3.5 h-3.5" /> GPS Pending
                </span>
              )}

              {ip ? (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10 px-2.5 py-1 rounded-lg">
                  <Globe className="w-3.5 h-3.5" /> Wi-Fi Whitelisted
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-500 dark:text-gray-400 font-bold bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-lg">
                  Wi-Fi Optional
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Configuration Form Card */}
      <div className="bg-white dark:bg-white/5 p-8 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-8">
        
        {/* GPS Location Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-500" />
              Branch GPS Coordinates & Geofence
            </h3>
            <button
              type="button"
              onClick={fetchLocation}
              disabled={isFetchingLocation}
              className="px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-xs font-bold transition-colors text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isFetchingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              Fetch Current Coordinates
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1">Latitude *</label>
              <input
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="e.g. 23.5880"
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-[#1D70B8] placeholder:text-slate-400 dark:placeholder:text-gray-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1">Longitude *</label>
              <input
                type="text"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="e.g. 58.3829"
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-[#1D70B8] placeholder:text-slate-400 dark:placeholder:text-gray-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-amber-500" /> Geofence Radius
              </label>
              <select
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-[#1D70B8] cursor-pointer"
              >
                <option value={30} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">30 Meters (Strict Office)</option>
                <option value={50} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">50 Meters (Standard)</option>
                <option value={100} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">100 Meters (Large Campus)</option>
                <option value={200} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">200 Meters (Industrial Site)</option>
              </select>
            </div>
          </div>
        </div>

        <hr className="border-slate-200 dark:border-white/10" />

        {/* IP Address Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              Office Network (Public Wi-Fi IPv4 Whitelist)
            </h3>
            <button
              type="button"
              onClick={fetchIp}
              disabled={isFetchingIp}
              className="px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-xs font-bold transition-colors text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isFetchingIp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              Fetch My Wi-Fi Public IP
            </button>
          </div>

          <div className="text-xs space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-gray-400">Public IPv4 Address</label>
            <input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="e.g. 176.12.34.56"
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-[#1D70B8] font-mono placeholder:text-slate-400 dark:placeholder:text-gray-500"
            />
            <p className="text-[11px] text-slate-500 dark:text-gray-400">
              Employees connected to this branch Wi-Fi network will be automatically verified even if GPS signal is weak inside the building.
            </p>
          </div>
        </div>

        {/* Save Action & Feedback */}
        <div className="pt-4 flex items-center justify-between border-t border-slate-200 dark:border-white/10">
          <div>
            {savedSuccess && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4" />
                Office settings saved successfully for {currentCompObj?.name}!
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={saveSettings}
            disabled={isSaving || !selectedCompanyId}
            className="px-6 py-3 bg-[#1D70B8] hover:bg-[#155994] active:scale-95 rounded-xl font-bold text-xs text-white shadow-lg shadow-[#1D70B8]/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Branch Settings
          </button>
        </div>
      </div>
    </div>
  );
}
