import type { Nationality } from '../types';

// Omani Labor Law standards
export const GRACE_PERIOD_LATE_MINUTES = 15; // 15-minute grace period
export const SEVERE_LATE_MINUTES = 30; // After 30 minutes, it's a severe delay
export const STANDARD_BREAK_MINUTES = 60;
export const GRACE_BREAK_MINUTES = 75;
export const SEVERE_EARLY_MINUTES = 30;

/**
 * Checks if a given date is a weekend rest day based on Omani labor law policies.
 * Omani Nationals rest Friday & Saturday.
 * Expat Nationals rest Friday only.
 */
export function isRestDay(date: Date, nationality: Nationality | string): boolean {
  const day = date.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
  const isOmani = nationality === 'Omani';
  
  if (isOmani) {
    return day === 5 || day === 6; // Friday & Saturday
  } else {
    return day === 5; // Friday only
  }
}

/**
 * Parses time string (e.g. "08:30") and sets it on a copy of the target Date object.
 */
export function parseTimeToDate(date: Date, timeStr: string): Date {
  const [hrs, mins] = timeStr.split(':').map(Number);
  const newDate = new Date(date);
  newDate.setHours(hrs || 8, mins || 30, 0, 0);
  return newDate;
}

/**
 * Evaluates arrival punctuality based on company's shift start time.
 */
export function evaluateArrival(
  clockInTime: Date, 
  shiftStartStr: string = "08:30"
): 'On-Time' | 'Grace Period' | 'Late Warning' | 'Severe Late' {
  const shiftStart = parseTimeToDate(clockInTime, shiftStartStr);
  const diffMs = clockInTime.getTime() - shiftStart.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes <= 0) return 'On-Time';
  if (diffMinutes <= GRACE_PERIOD_LATE_MINUTES) return 'Grace Period';
  if (diffMinutes <= SEVERE_LATE_MINUTES) return 'Late Warning';
  return 'Severe Late';
}

/**
 * Evaluates break durations.
 */
export function evaluateBreak(durationInMinutes: number): 'Normal' | 'Grace Period' | 'Over-Break' {
  if (durationInMinutes <= STANDARD_BREAK_MINUTES) return 'Normal';
  if (durationInMinutes <= GRACE_BREAK_MINUTES) return 'Grace Period';
  return 'Over-Break';
}

/**
 * Evaluates departure compliance based on company's shift end time.
 */
export function evaluateDeparture(
  clockOutTime: Date, 
  shiftEndStr: string = "17:00"
): 'Normal' | 'Early Warning' | 'Severe Early' {
  const expectedEnd = parseTimeToDate(clockOutTime, shiftEndStr);
  const diffMs = expectedEnd.getTime() - clockOutTime.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes <= 0) return 'Normal';
  if (diffMinutes <= SEVERE_EARLY_MINUTES) return 'Early Warning';
  return 'Severe Early';
}
