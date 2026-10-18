import { supabase } from './supabase';

export interface CompanySettings {
  id?: string;
  company_id: string;
  office_latitude: number | null;
  office_longitude: number | null;
  office_ip: string | null;
  updated_at: string;
}

export async function getCompanySettings(companyId: string): Promise<CompanySettings | null> {
  if (!companyId) return null;

  const trimmedId = companyId.trim();

  // 1. Check LocalStorage first for instant performance
  const localSaved = localStorage.getItem(`osan_office_setting_${trimmedId}`);
  let localData: CompanySettings | null = null;
  if (localSaved) {
    try {
      localData = JSON.parse(localSaved);
    } catch (e) {
      // ignore
    }
  }

  try {
    // 2. Query Supabase company_settings table by company_id directly
    let { data, error } = await supabase
      .from('company_settings')
      .select('id, company_id, office_latitude, office_longitude, office_ip, updated_at')
      .eq('company_id', trimmedId)
      .maybeSingle();

    // 2b. If not found and trimmedId is a UUID, find company name and check if settings are stored by name
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmedId);
    if (!data && isUuid) {
      const { data: comp } = await supabase
        .from('companies')
        .select('name')
        .eq('id', trimmedId)
        .maybeSingle();

      if (comp?.name) {
        const { data: namedData } = await supabase
          .from('company_settings')
          .select('id, company_id, office_latitude, office_longitude, office_ip, updated_at')
          .eq('company_id', comp.name)
          .maybeSingle();
        if (namedData) data = namedData;
      }
    }

    // 2c. If not found and trimmedId is a Name, find company UUID and check if settings are stored by UUID
    if (!data && !isUuid) {
      const { data: comp } = await supabase
        .from('companies')
        .select('id')
        .ilike('name', trimmedId)
        .maybeSingle();

      if (comp?.id) {
        const { data: uuidData } = await supabase
          .from('company_settings')
          .select('id, company_id, office_latitude, office_longitude, office_ip, updated_at')
          .eq('company_id', comp.id)
          .maybeSingle();
        if (uuidData) data = uuidData;
      }
    }

    if (!error && data) {
      const dbSettings: CompanySettings = {
        id: data.id,
        company_id: data.company_id,
        office_latitude: data.office_latitude !== null ? Number(data.office_latitude) : null,
        office_longitude: data.office_longitude !== null ? Number(data.office_longitude) : null,
        office_ip: data.office_ip || null,
        updated_at: data.updated_at || new Date().toISOString(),
      };
      localStorage.setItem(`osan_office_setting_${trimmedId}`, JSON.stringify(dbSettings));
      return dbSettings;
    }

    if (localData) {
      return localData;
    }

    // 3. Fallback to default Headquarters office coordinates from environment variables
    const fallbackLat = parseFloat(import.meta.env.VITE_OFFICE_LATITUDE || '0');
    const fallbackLng = parseFloat(import.meta.env.VITE_OFFICE_LONGITUDE || '0');
    const fallbackIp = import.meta.env.VITE_OFFICE_WHITELISTED_IP || null;

    if (fallbackLat || fallbackLng || fallbackIp) {
      return {
        company_id: trimmedId,
        office_latitude: fallbackLat || null,
        office_longitude: fallbackLng || null,
        office_ip: fallbackIp,
        updated_at: new Date().toISOString()
      };
    }

    return null;
  } catch (error) {
    return localData;
  }
}

export async function updateCompanySettings(
  companyId: string, 
  latitude: number | null, 
  longitude: number | null, 
  ip: string | null
): Promise<boolean> {
  if (!companyId) return false;

  const trimmedId = companyId.trim();

  const payload: CompanySettings = {
    company_id: trimmedId,
    office_latitude: latitude,
    office_longitude: longitude,
    office_ip: ip,
    updated_at: new Date().toISOString()
  };

  // 1. Always save to LocalStorage for immediate offline/online reliability
  localStorage.setItem(`osan_office_setting_${trimmedId}`, JSON.stringify(payload));

  // 2. Persist to Supabase company_settings table
  try {
    const { error: settingsErr } = await supabase
      .from('company_settings')
      .upsert(
        {
          company_id: trimmedId,
          office_latitude: latitude,
          office_longitude: longitude,
          office_ip: ip,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'company_id' }
      );

    if (settingsErr) {
      console.info('Notice: company_settings table update skipped (saved locally):', settingsErr.message);
    }

    // If companyId is a UUID, also cache under the company name (or vice versa) in localStorage
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmedId);
    if (isUuid) {
      const { data: comp } = await supabase.from('companies').select('name').eq('id', trimmedId).maybeSingle();
      if (comp?.name) {
        localStorage.setItem(`osan_office_setting_${comp.name}`, JSON.stringify(payload));
      }
    } else {
      const { data: comp } = await supabase.from('companies').select('id').ilike('name', trimmedId).maybeSingle();
      if (comp?.id) {
        localStorage.setItem(`osan_office_setting_${comp.id}`, JSON.stringify(payload));
      }
    }

    return true;
  } catch (err) {
    return true;
  }
}

// Haversine formula to calculate distance in meters between two coordinates
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
