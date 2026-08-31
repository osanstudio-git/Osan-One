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

import { createPublicHolidayInDb, deletePublicHolidayInDb } from './databaseService';

export function addPublicHoliday(holiday: Omit<PublicHoliday, 'id'>): PublicHoliday {
  const list = getPublicHolidays();
  const newHoliday: PublicHoliday = {
    ...holiday,
    id: `hol-${Date.now()}`
  };
  const updated = [...list, newHoliday].sort((a, b) => a.date.localeCompare(b.date));
  savePublicHolidays(updated);
  createPublicHolidayInDb(holiday).catch(err => console.error(err));
  return newHoliday;
}

export function deletePublicHoliday(id: string): PublicHoliday[] {
  const list = getPublicHolidays();
  const updated = list.filter(h => h.id !== id);
  savePublicHolidays(updated);
  deletePublicHolidayInDb(id).catch(err => console.error(err));
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
