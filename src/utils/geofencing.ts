// Haversine formula to calculate distance between two coordinates in meters
function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius of the earth in m
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in m
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export interface GeofenceTarget {
  latitude?: number | null;
  longitude?: number | null;
  ip?: string | null;
  radiusMeters?: number;
  officeName?: string | null;
}

export async function verifyLocation(target?: GeofenceTarget | null): Promise<{ success: boolean; error?: string; ip?: string; distance?: number }> {
  const targetIp = target?.ip?.trim() || import.meta.env.VITE_OFFICE_WHITELISTED_IP?.trim();

  // 1. IP Validation Check (if target office has a whitelisted Wi-Fi/IP)
  if (targetIp) {
    try {
      const [resV4, resV6] = await Promise.allSettled([
        fetch('https://api.ipify.org?format=json').then(r => r.json()),
        fetch('https://api64.ipify.org?format=json').then(r => r.json())
      ]);

      const ipV4 = resV4.status === 'fulfilled' ? resV4.value?.ip : null;
      const ipV6 = resV6.status === 'fulfilled' ? resV6.value?.ip : null;

      if ((ipV4 && ipV4 === targetIp) || (ipV6 && ipV6 === targetIp)) {
        return { success: true, ip: ipV4 || ipV6 };
      }
    } catch (error) {
      console.warn("Office Wi-Fi / IP check skipped, falling back to GPS:", error);
    }
  }

  // 2. Resolve Target Office Coordinates (Custom Company Branch settings take top priority)
  const targetLat = (target?.latitude !== null && target?.latitude !== undefined && target?.latitude !== 0)
    ? Number(target.latitude)
    : parseFloat(import.meta.env.VITE_OFFICE_LATITUDE || '0');

  const targetLon = (target?.longitude !== null && target?.longitude !== undefined && target?.longitude !== 0)
    ? Number(target.longitude)
    : parseFloat(import.meta.env.VITE_OFFICE_LONGITUDE || '0');

  // If no office location has been configured by HR anywhere, allow check-in with a soft warning
  if (!targetLat || !targetLon) {
    return { success: true, error: 'Office coordinates not configured yet by HR.' };
  }

  // 3. HTML5 Geolocation Check
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ success: false, error: 'Geolocation is not supported by your browser.' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const distance = getDistanceFromLatLonInMeters(
          position.coords.latitude,
          position.coords.longitude,
          targetLat,
          targetLon
        );

        // 60-meter radius threshold allows for indoor GPS drift and mobile antenna tolerance
        const allowedRadius = target?.radiusMeters || 60;

        if (distance <= allowedRadius) {
          resolve({ success: true, distance: Math.round(distance) });
        } else {
          const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(target?.officeName || '');
          const officeLabel = (!target?.officeName || isUuid) ? 'the ASAS office' : `the ${target.officeName} office`;
          resolve({ 
            success: false, 
            distance: Math.round(distance),
            error: `You are ${Math.round(distance)}m away from ${officeLabel}. Must be within ${allowedRadius}m.` 
          });
        }
      },
      (error) => {
        let msg = error.message;
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location access denied. Please allow location permissions in your browser settings.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'GPS signal unavailable. Please ensure GPS/Location is enabled on your device.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Location request timed out. Please try again.';
        }
        resolve({ success: false, error: msg });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}
