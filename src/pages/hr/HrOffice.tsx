import { useState, useEffect } from 'react';
import { MapPin, Globe, Loader2, Save, Building2, CheckCircle2, ShieldAlert, Compass, LayoutGrid, List, ArrowRight, ExternalLink, X, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCompanies } from '../../lib/databaseService';
import { getCompanySettings, updateCompanySettings } from '../../lib/settings';
import type { Company } from '../../types';

export function HrOffice() {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [branchStatusMap, setBranchStatusMap] = useState<Record<string, { lat?: number | null; lng?: number | null; ip?: string | null; isCustom?: boolean }>>({});
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024 ? 'cards' : 'table';
    }
    return 'table';
  });
  
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isFetchingIp, setIsFetchingIp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [ip, setIp] = useState<string>('');
  const [radius, setRadius] = useState<number>(50);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [recentlySavedCompId, setRecentlySavedCompId] = useState<string | null>(null);
  const [selectedIsCustom, setSelectedIsCustom] = useState<boolean>(false);

  // Load all companies and pre-fetch settings for every branch
  const loadAllCompaniesAndSettings = async () => {
    try {
      const compList = await getCompanies();
      setCompanies(compList);

      if (compList.length > 0) {
        // Default to user's assigned company or first company in list
        const defaultComp = compList.find(c => c.id === profile?.company_id || c.name === profile?.company_id || c.name === profile?.company) || compList[0];
        if (!selectedCompanyId) {
          setSelectedCompanyId(defaultComp.id || defaultComp.name);
        }

        // Fetch settings status for all companies in parallel
        const statusEntries = await Promise.all(
          compList.map(async (c) => {
            const key = c.id || c.name;
            const settings = await getCompanySettings(key);
            return [key, {
              lat: settings?.office_latitude,
              lng: settings?.office_longitude,
              ip: settings?.office_ip,
              isCustom: Boolean(settings?.isCustom)
            }];
          })
        );

        setBranchStatusMap(Object.fromEntries(statusEntries));
      }
    } catch (err) {
      console.error('Error loading companies and office settings:', err);
    }
  };

  useEffect(() => {
    loadAllCompaniesAndSettings();
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
    setAccuracyMeters(null);
    setSavedSuccess(false);

    const data = await getCompanySettings(companyId);
    if (data) {
      setLat(data.office_latitude?.toString() || '');
      setLng(data.office_longitude?.toString() || '');
      setIp(data.office_ip || '');
      setSelectedIsCustom(Boolean(data.isCustom));
    } else {
      setSelectedIsCustom(false);
    }
  };

  const fetchLocation = () => {
    setIsFetchingLocation(true);
    setAccuracyMeters(null);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toString());
          setLng(position.coords.longitude.toString());
          if (position.coords.accuracy) {
            setAccuracyMeters(Math.round(position.coords.accuracy));
          }
          setIsFetchingLocation(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Failed to get location. Please allow browser location permissions.");
          setIsFetchingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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

  // Open confirmation modal
  const handleOpenConfirmModal = () => {
    if (!selectedCompanyId) return;
    setIsConfirmModalOpen(true);
  };

  // Execute actual save
  const executeSaveSettings = async () => {
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
    setIsConfirmModalOpen(false);

    if (success) {
      setSavedSuccess(true);
      setSelectedIsCustom(true);
      setRecentlySavedCompId(selectedCompanyId);

      setTimeout(() => {
        setSavedSuccess(false);
      }, 5000);

      setTimeout(() => {
        setRecentlySavedCompId(null);
      }, 3500);

      await loadAllCompaniesAndSettings();
    } else {
      alert("Failed to save company office settings.");
    }
  };

  const currentCompObj = companies.find(c => c.id === selectedCompanyId || c.name === selectedCompanyId);

  return (
    <div className="max-w-5xl space-y-8 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Header Info */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">Multi-Company Office Setup</h2>
        <p className="text-slate-500 dark:text-gray-400 text-sm">
          Configure unique GPS coordinates, Wi-Fi IP address whitelists, and Geofence boundaries for each company office branch.
        </p>
      </div>

      {/* Prominent Floating Success Alert */}
      {savedSuccess && (
        <div className="p-4 bg-emerald-500/10 dark:bg-emerald-500/15 border-2 border-emerald-500/40 rounded-2xl flex items-center justify-between gap-3 text-emerald-900 dark:text-emerald-100 shadow-lg shadow-emerald-500/10 animate-in slide-in-from-top-3 fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-extrabold flex items-center gap-2">
                <span>Office Location Saved Successfully!</span>
                <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">Live in Database</span>
              </div>
              <div className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                Branch <strong>{currentCompObj?.name}</strong> is now officially locked with custom GPS & Geofence.
              </div>
            </div>
          </div>
          <button
            onClick={() => setSavedSuccess(false)}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-white text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Branch Office Setup Directory Table / Cards */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Branch Office Setup Overview
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Clear breakdown of custom-fixed locations vs. default headquarters fallbacks
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* View Switcher: Table vs Cards */}
            <div className="flex items-center bg-slate-100 dark:bg-white/5 p-0.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs">
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-800 text-primary shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                }`}
                title="Table View"
              >
                <List className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-slate-800 text-primary shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                }`}
                title="Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
            </div>

            <span className="text-xs font-bold text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-white/10">
              {companies.length} Branches
            </span>
          </div>
        </div>

        {viewMode === 'table' ? (
          <div>
            <div className="sm:hidden px-3.5 py-1.5 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-[10px] text-slate-500 dark:text-gray-400 flex items-center justify-between">
              <span>← Swipe table or switch to Cards view →</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3 sm:py-3.5 sm:px-4 pl-4 sm:pl-5">Company / Branch</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-4">GPS Location & Source</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-4">Wi-Fi IPv4 Network</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-4">Attendance Status</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-4 pr-4 sm:pr-5 text-right min-w-[120px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                  {companies.map((comp) => {
                    const key = comp.id || comp.name;
                    const status = branchStatusMap[key] || {};
                    const hasGps = Boolean(status.lat && status.lng);
                    const isCustom = Boolean(status.isCustom);
                    const hasWifi = Boolean(status.ip);
                    const isSelected = selectedCompanyId === key;
                    const isRecentlySaved = recentlySavedCompId === key;

                    return (
                      <tr 
                        key={key} 
                        className={`transition-all ${
                          isRecentlySaved 
                            ? 'bg-emerald-500/15 dark:bg-emerald-500/20 ring-2 ring-emerald-500/40' 
                            : isSelected 
                              ? 'bg-primary/5 dark:bg-primary/10' 
                              : 'hover:bg-slate-50/80 dark:hover:bg-white/5'
                        }`}
                      >
                        <td className="py-3.5 px-3 sm:px-4 pl-4 sm:pl-5">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>🏢</span>
                            <span>{comp.name}</span>
                            {isSelected && <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-md font-extrabold">Editing</span>}
                            {isRecentlySaved && <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-md font-extrabold animate-pulse">Updated</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-gray-400">{comp.location || 'Headquarters'}</div>
                        </td>

                        <td className="py-3.5 px-3 sm:px-4">
                          {hasGps ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 font-bold font-mono">
                                <span className={isCustom ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300"}>
                                  {status.lat?.toFixed(4)}, {status.lng?.toFixed(4)}
                                </span>
                                <a
                                  href={`https://www.google.com/maps?q=${status.lat},${status.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-400 hover:text-primary transition-colors p-0.5"
                                  title="View on Google Maps"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                              <div>
                                {isCustom ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md font-extrabold border border-emerald-500/20">
                                    <Sparkles className="w-2.5 h-2.5" /> Custom Branch GPS
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-300 px-2 py-0.5 rounded-md font-semibold border border-slate-200 dark:border-white/10" title="Using global headquarters coordinates until customized">
                                    ⚡ HQ Default Fallback
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md font-bold text-[11px]">
                              <ShieldAlert className="w-3 h-3" /> GPS Pending
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 sm:px-4">
                          {hasWifi ? (
                            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold font-mono">
                              <Globe className="w-3.5 h-3.5 shrink-0" />
                              <span>{status.ip}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-gray-500 font-normal">Optional</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 sm:px-4">
                          {isCustom ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-xs">
                              🟢 Custom Fixed
                            </span>
                          ) : hasGps || hasWifi ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-white/10" title="Employees punch via headquarters default coordinates">
                              ⚡ Using HQ Default
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              🟡 Setup Needed
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 sm:px-4 pr-4 sm:pr-5 text-right">
                          <button
                            onClick={() => setSelectedCompanyId(key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-primary text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white'
                            }`}
                          >
                            {isSelected ? 'Editing Now' : 'Configure →'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Cards View for Mobile & Tablet */
          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 bg-slate-50/50 dark:bg-transparent">
            {companies.map((comp) => {
              const key = comp.id || comp.name;
              const status = branchStatusMap[key] || {};
              const hasGps = Boolean(status.lat && status.lng);
              const isCustom = Boolean(status.isCustom);
              const hasWifi = Boolean(status.ip);
              const isSelected = selectedCompanyId === key;
              const isRecentlySaved = recentlySavedCompId === key;

              return (
                <div
                  key={key}
                  className={`bg-white dark:bg-white/5 rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3 group ${
                    isRecentlySaved
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                      : isSelected
                        ? 'border-primary ring-2 ring-primary/20 dark:border-primary'
                        : 'border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-extrabold text-slate-900 dark:text-white text-sm truncate">
                        <span className="text-base">🏢</span>
                        <span className="truncate group-hover:text-primary transition-colors">{comp.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5 truncate">
                        {comp.location || 'Headquarters'}
                      </p>
                    </div>

                    {isRecentlySaved ? (
                      <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-extrabold shrink-0">
                        Updated
                      </span>
                    ) : isSelected ? (
                      <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full font-extrabold shrink-0 shadow-xs">
                        Editing Now
                      </span>
                    ) : isCustom ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                        🟢 Custom Fixed
                      </span>
                    ) : hasGps || hasWifi ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-white/10 shrink-0">
                        ⚡ HQ Default
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                        🟡 Setup Needed
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 dark:text-gray-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> GPS Location:
                      </span>
                      {hasGps ? (
                        <div className="flex items-center gap-1">
                          <span className={`font-bold font-mono text-[11px] ${isCustom ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                            {status.lat?.toFixed(4)}, {status.lng?.toFixed(4)}
                          </span>
                          <a
                            href={`https://www.google.com/maps?q=${status.lat},${status.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-primary"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-[10px] font-bold">
                          <ShieldAlert className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/5">
                      <span className="text-[11px] text-slate-500 dark:text-gray-400 flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-slate-400" /> Wi-Fi Network:
                      </span>
                      {hasWifi ? (
                        <span className="font-bold text-blue-600 dark:text-blue-400 font-mono text-[11px]">
                          {status.ip}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-gray-500 text-[11px]">Optional</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedCompanyId(key)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                        : 'bg-slate-100 hover:bg-primary/10 hover:text-primary dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white'
                    }`}
                  >
                    <span>{isSelected ? 'Currently Selected' : 'Configure Geofence & Wi-Fi'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Target Company Selector Bar */}
      <div className="bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#1D70B8] mb-1 flex items-center gap-1.5">
              <Building2 className="w-4 h-4" /> Select Office Branch / Company
            </label>
            <p className="text-xs text-slate-500 dark:text-gray-400">Choose which company office settings you are currently editing</p>
          </div>

          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="w-full sm:w-auto bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm font-bold outline-none focus:border-[#1D70B8] min-w-[240px] cursor-pointer"
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
              {selectedIsCustom ? (
                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-extrabold bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Custom Branch GPS Active
                </span>
              ) : lat && lng ? (
                <span className="flex items-center gap-1 text-slate-700 dark:text-gray-300 font-semibold bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 px-2.5 py-1 rounded-lg">
                  ⚡ Inheriting HQ Default Fallback
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg">
                  <ShieldAlert className="w-3.5 h-3.5" /> Setup Needed
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
      <div className="bg-white dark:bg-white/5 p-5 sm:p-8 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-8">
        
        {/* GPS Location Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-rose-500 shrink-0" />
                Branch GPS Coordinates & Geofence
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                Set satellite pin for {currentCompObj?.name || 'this branch'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng)) && (
                <a
                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all border border-emerald-500/20 flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Preview on Google Maps</span>
                </a>
              )}

              <button
                type="button"
                onClick={fetchLocation}
                disabled={isFetchingLocation}
                className="px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-xs font-bold transition-colors text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
              >
                {isFetchingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                Fetch Current Coordinates
              </button>
            </div>
          </div>

          {/* Accuracy indicator if available */}
          {accuracyMeters !== null && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span>
                Detected GPS Accuracy: <strong>±{accuracyMeters} meters</strong> {accuracyMeters <= 20 ? '(High precision satellite fix)' : '(Standard tolerance)'}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1">Latitude *</label>
              <input
                type="text"
                value={lat}
                onChange={(e) => {
                  setLat(e.target.value);
                  setSavedSuccess(false);
                }}
                placeholder="e.g. 23.5880"
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-[#1D70B8] placeholder:text-slate-400 dark:placeholder:text-gray-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1">Longitude *</label>
              <input
                type="text"
                value={lng}
                onChange={(e) => {
                  setLng(e.target.value);
                  setSavedSuccess(false);
                }}
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-500 shrink-0" />
                Office Network (Public Wi-Fi IPv4 Whitelist)
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                Optional: Whitelist office router public IP for instant laptop punch
              </p>
            </div>

            <button
              type="button"
              onClick={fetchIp}
              disabled={isFetchingIp}
              className="px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-xs font-bold transition-colors text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
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
              onChange={(e) => {
                setIp(e.target.value);
                setSavedSuccess(false);
              }}
              placeholder="e.g. 176.12.34.56"
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-[#1D70B8] font-mono placeholder:text-slate-400 dark:placeholder:text-gray-500"
            />
            <p className="text-[11px] text-slate-500 dark:text-gray-400">
              Employees connected to this branch Wi-Fi network will be automatically verified even if GPS signal is weak inside the building.
            </p>
          </div>
        </div>

        {/* Save Action & Feedback */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-200 dark:border-white/10">
          <div>
            {savedSuccess ? (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4" />
                Office settings saved successfully for {currentCompObj?.name}!
              </span>
            ) : (
              <span className="text-xs text-slate-500 dark:text-gray-400">
                Clicking save will ask for confirmation before locking this branch's location.
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenConfirmModal}
            disabled={isSaving || !selectedCompanyId}
            className="w-full sm:w-auto px-6 py-3 bg-[#1D70B8] hover:bg-[#155994] active:scale-95 rounded-xl font-bold text-xs text-white shadow-lg shadow-[#1D70B8]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Branch Settings
          </button>
        </div>
      </div>

      {/* Confirmation Modal Asking Permission Before Updating Location */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Confirm Office Location Update
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Please confirm before updating this branch
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-gray-300">
              Are you sure you want to update the official attendance location settings for <strong>{currentCompObj?.name}</strong>?
            </p>

            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-gray-400">Company Branch:</span>
                <span className="font-extrabold text-slate-900 dark:text-white">{currentCompObj?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-gray-400">GPS Coordinates:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {lat && lng ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : 'Not Set (Cleared)'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-gray-400">Geofence Radius:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{radius} meters</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-gray-400">Whitelisted Wi-Fi IP:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {ip || 'Optional (None)'}
                </span>
              </div>
            </div>

            {lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng)) && (
              <a
                href={`https://www.google.com/maps?q=${lat},${lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-primary font-bold hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Preview exact pin on Google Maps ↗
              </a>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeSaveSettings}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#1D70B8] hover:bg-[#155994] text-xs font-bold text-white shadow-md shadow-[#1D70B8]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Yes, Update Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
