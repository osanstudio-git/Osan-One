export interface PublicHoliday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  daysCount: number;
  type: 'National' | 'Religious' | 'Company';
  notes?: string;
}

export const DEFAULT_OMAN_HOLIDAYS: PublicHoliday[] = [
  { id: 'hol-1', name: "New Year's Day", date: '2026-01-01', daysCount: 1, type: 'National', notes: 'Official Omani Public Holiday' },
  { id: 'hol-2', name: "Sultan's Accession Day", date: '2026-01-11', daysCount: 1, type: 'National', notes: 'His Majesty Accession to Throne' },
  { id: 'hol-3', name: 'Eid Al Fitr (End of Ramadan)', date: '2026-03-20', daysCount: 3, type: 'Religious', notes: 'Paid Government Holiday' },
  { id: 'hol-4', name: 'Arafat Day & Eid Al Adha', date: '2026-05-27', daysCount: 4, type: 'Religious', notes: 'Paid Government Holiday' },
  { id: 'hol-5', name: 'Islamic New Year (Hijri 1448)', date: '2026-06-16', daysCount: 1, type: 'Religious', notes: '1st Muharram' },
  { id: 'hol-6', name: "Prophet Muhammad's Birthday", date: '2026-08-25', daysCount: 1, type: 'Religious', notes: '12th Rabi-al-Awwal' },
  { id: 'hol-7', name: '56th Oman National Day', date: '2026-11-18', daysCount: 2, type: 'National', notes: 'Official National Celebration' },
];

const STORAGE_KEY = 'osan_public_holidays';

export function getPublicHolidays(): PublicHoliday[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (err) {
    console.error('Failed to read public holidays:', err);
  }
  return DEFAULT_OMAN_HOLIDAYS;
}

export function savePublicHolidays(holidays: PublicHoliday[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holidays));
  } catch (err) {
    console.error('Failed to save public holidays:', err);
  }
}

import { createPublicHolidayInDb, deletePublicHolidayInDb, getPublicHolidaysFromDb } from './databaseService';

export async function syncPublicHolidaysFromDb(): Promise<PublicHoliday[]> {
  try {
    const dbHolidays = await getPublicHolidaysFromDb();
    if (dbHolidays && dbHolidays.length > 0) {
      savePublicHolidays(dbHolidays);
      return dbHolidays;
    }
  } catch (err) {
    console.error('Failed to sync public holidays from DB:', err);
  }
  return getPublicHolidays();
}

export async function addPublicHoliday(holiday: Omit<PublicHoliday, 'id'>): Promise<PublicHoliday> {
  const tempId = `hol-${Date.now()}`;
  const tempHoliday: PublicHoliday = { ...holiday, id: tempId };
  const list = getPublicHolidays();
  const updated = [...list, tempHoliday].sort((a, b) => a.date.localeCompare(b.date));
  savePublicHolidays(updated);

  try {
    const dbResult = await createPublicHolidayInDb(holiday);
    if (dbResult && dbResult.id) {
      const refreshed = updated.map(h => h.id === tempId ? { ...h, id: dbResult.id } : h);
      savePublicHolidays(refreshed);
      return { ...holiday, id: dbResult.id };
    }
  } catch (err) {
    console.error('Failed to save holiday to DB:', err);
  }
  return tempHoliday;
}

export async function deletePublicHoliday(id: string): Promise<PublicHoliday[]> {
  const list = getPublicHolidays();
  const updated = list.filter(h => h.id !== id);
  savePublicHolidays(updated);
  try {
    await deletePublicHolidayInDb(id);
  } catch (err) {
    console.error('Failed to delete holiday from DB:', err);
  }
  return updated;
}

export function isDatePublicHoliday(dateStr: string): PublicHoliday | undefined {
  const holidays = getPublicHolidays();
  return holidays.find(h => {
    if (h.date === dateStr) return true;
    // Check multi-day holiday ranges
    if (h.daysCount > 1) {
      const startDate = new Date(h.date);
      const targetDate = new Date(dateStr);
      const diffTime = targetDate.getTime() - startDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays < h.daysCount;
    }
    return false;
  });
}
