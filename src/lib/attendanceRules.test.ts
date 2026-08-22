import { isRestDay, evaluateArrival, evaluateDeparture, evaluateBreak } from './attendanceRules';

/**
 * Self-contained Automated Test Suite for Omani Labor Rules
 */
export function runAttendanceRulesTests(): { passed: number; total: number } {
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, description: string) {
    total++;
    if (condition) {
      passed++;
    } else {
      console.error(`❌ Test Failed: ${description}`);
    }
  }

  // Test 1: Omani Weekend Rest Days (Fri/Sat)
  const friday = new Date('2026-08-14T10:00:00');
  const saturday = new Date('2026-08-15T10:00:00');
  const sunday = new Date('2026-08-16T10:00:00');

  assert(isRestDay(friday, 'Omani') === true, 'Omani Friday is Rest Day');
  assert(isRestDay(saturday, 'Omani') === true, 'Omani Saturday is Rest Day');
  assert(isRestDay(sunday, 'Omani') === false, 'Omani Sunday is Working Day');

  // Test 2: Expat Weekend Rest Day (Fri only)
  assert(isRestDay(friday, 'Expat') === true, 'Expat Friday is Rest Day');
  assert(isRestDay(saturday, 'Expat') === false, 'Expat Saturday is Working Day');

  // Test 3: Arrival Punctuality Evaluation
  const clockInOnTime = new Date('2026-08-17T08:30:00');
  const clockInGrace = new Date('2026-08-17T08:42:00');
  const clockInLate = new Date('2026-08-17T08:50:00');
  const clockInSevere = new Date('2026-08-17T09:15:00');

  assert(evaluateArrival(clockInOnTime, '08:30') === 'On-Time', 'Arrival on time');
  assert(evaluateArrival(clockInGrace, '08:30') === 'Grace Period', 'Arrival within 15 mins grace');
  assert(evaluateArrival(clockInLate, '08:30') === 'Late Warning', 'Arrival 16-30 mins late');
  assert(evaluateArrival(clockInSevere, '08:30') === 'Severe Late', 'Arrival >30 mins late');

  // Test 4: Departure Evaluation
  const clockOutNormal = new Date('2026-08-17T17:05:00');
  const clockOutEarly = new Date('2026-08-17T16:45:00');

  assert(evaluateDeparture(clockOutNormal, '17:00') === 'Normal', 'Departure after shift end');
  assert(evaluateDeparture(clockOutEarly, '17:00') === 'Early Warning', 'Departure before shift end');

  // Test 5: Break Evaluation
  assert(evaluateBreak(45) === 'Normal', '45 min break is Normal');
  assert(evaluateBreak(70) === 'Grace Period', '70 min break is Grace Period');
  assert(evaluateBreak(90) === 'Over-Break', '90 min break is Over-Break');

  return { passed, total };
}
