/**
 * ATTENDANCE REPORT SERVICE
 * Generates an executive, classic, print-ready Monthly Attendance & Timesheet Report
 * formatted to Oman Corporate & Ministry of Labour standards.
 */

export interface AttendanceReportOptions {
  employee: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    role?: string;
    job_title?: string;
    department?: string;
    company?: string;
    nationality?: string;
    join_date?: string;
    avatar_url?: string;
  };
  companyName: string;
  companyLogoUrl?: string;
  monthIndex: number; // 0 to 11
  year: number;
  shiftStart?: string;
  shiftEnd?: string;
  isHrAcknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedDate?: string;
  dailyLogs: Array<{
    dayNum: number;
    dateStr: string;
    date: Date;
    clockInText: string;
    clockOutText: string;
    shiftDurationText: string;
    totalMinutesWorked: number;
    lateMinutes?: number;
    status: 'present' | 'late' | 'absent' | 'weekend' | 'leave' | 'holiday' | 'upcoming';
    holidayName?: string;
  }>;
  stats?: {
    onTime?: number;
    late?: number;
    absent?: number;
    leave?: number;
    totalHours?: number;
  };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function generateMonthlyAttendanceReport(options: AttendanceReportOptions) {
  const {
    employee,
    companyName,
    monthIndex,
    year,
    dailyLogs,
    isHrAcknowledged = true,
    acknowledgedBy = 'Eklas Said Al Nairi',
    acknowledgedDate
  } = options;

  const todayDateFormatted = acknowledgedDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const effectiveAckBy = acknowledgedBy || 'Eklas Said Al Nairi';

  const monthName = MONTH_NAMES[monthIndex];
  const refCode = `OSAN-ATT-${year}${String(monthIndex + 1).padStart(2, '0')}-${employee.id.substring(0, 6).toUpperCase()}`;

  // Clean company / entity display (avoid repeating Osan studio • OSAN STUDIO)
  const deptStr = (employee.department || '').trim();
  const compStr = (companyName || employee.company || 'OSAN GROUP').trim();
  const isSameComp = deptStr.toLowerCase() === compStr.toLowerCase();
  const cleanCompanyEntity = (deptStr && !isSameComp) ? `${deptStr} &bull; ${compStr}` : compStr;

  // Calculate detailed summary statistics
  const publicHolidayDays = dailyLogs.filter(d => d.status === 'holiday').length;
  const approvedLeaveDays = dailyLogs.filter(d => d.status === 'leave').length;
  const onTimeDays = dailyLogs.filter(d => d.status === 'present').length;
  const lateDays = dailyLogs.filter(d => d.status === 'late').length;
  const absentDays = dailyLogs.filter(d => d.status === 'absent').length;
  const attendedDays = onTimeDays + lateDays;

  // Expected working days in full month: Total weekdays excluding Friday (and Saturday for 5-day week) and public holidays
  const isExpatShift = (employee.nationality || '').toLowerCase() === 'expat';
  const scheduledWorkDays = dailyLogs.filter(d => {
    const dayOfWeek = d.date.getDay();
    const isWeekendDay = isExpatShift ? (dayOfWeek === 5) : (dayOfWeek === 5 || dayOfWeek === 6);
    return !isWeekendDay && d.status !== 'holiday';
  }).length;

  const totalMinutes = dailyLogs.reduce((sum, d) => sum + (d.totalMinutesWorked || 0), 0);
  const totalHoursWorked = Math.floor(totalMinutes / 60);
  const remMinutesWorked = totalMinutes % 60;
  const formattedTotalWorked = `${totalHoursWorked}h ${remMinutesWorked}m`;

  // Standard target hours (factoring in 7h Thursday shift for ASAS Sanad Center)
  const isAsasComp = (companyName || employee.company || '').toLowerCase().includes('asas');
  const scheduledStandardHours = dailyLogs.filter(d => {
    const dayOfWeek = d.date.getDay();
    const isWeekendDay = isExpatShift ? (dayOfWeek === 5) : (dayOfWeek === 5 || dayOfWeek === 6);
    return !isWeekendDay && d.status !== 'holiday';
  }).reduce((sum, d) => {
    const isThu = d.date.getDay() === 4;
    return sum + (isAsasComp && isThu ? 7 : 8);
  }, 0);

  const totalLateDelayMinutes = dailyLogs
    .filter(d => d.status === 'late')
    .reduce((sum, d) => sum + (d.lateMinutes || 0), 0);

  // Status Badge Helper for Printable HTML
  const getPrintableStatusBadge = (log: typeof dailyLogs[0]) => {
    switch (log.status) {
      case 'present':
        return '<span class="status-badge badge-present">Present (On-Time)</span>';
      case 'late':
        return `<span class="status-badge badge-late">Late (${log.lateMinutes || 1}m delay)</span>`;
      case 'absent':
        return '<span class="status-badge badge-absent">Absent</span>';
      case 'leave':
        return '<span class="status-badge badge-leave">Approved Leave</span>';
      case 'holiday':
        return `<span class="status-badge badge-holiday">Public Holiday${log.holidayName ? `: ${log.holidayName}` : ''}</span>`;
      case 'weekend':
        if (log.totalMinutesWorked > 0) {
          return '<span class="status-badge badge-present">Weekend Overtime</span>';
        }
        return '<span class="status-badge badge-weekend">Weekend Off</span>';
      case 'upcoming':
        return '<span class="status-badge" style="background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1;">Scheduled</span>';
      default:
        return '<span class="status-badge badge-weekend">Off</span>';
    }
  };

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download or print your attendance report.');
    return;
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Attendance Report — ${employee.name} — ${monthName} ${year}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 12mm 10mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      font-size: 11px;
      line-height: 1.4;
    }
    .report-container {
      max-width: 900px;
      margin: 0 auto;
    }
    
    /* Header Section */
    .header-table {
      width: 100%;
      border-bottom: 2.5px solid #059669;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .org-title {
      font-size: 22px;
      font-weight: 900;
      color: #059669;
      letter-spacing: -0.5px;
      margin: 0;
      text-transform: uppercase;
    }
    .doc-type {
      font-size: 13px;
      font-weight: 800;
      color: #1e293b;
      margin-top: 3px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .doc-meta {
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
      margin-top: 2px;
    }
    .header-right {
      text-align: right;
      vertical-align: top;
    }
    .ref-badge {
      display: inline-block;
      font-family: monospace;
      font-size: 10px;
      font-weight: 800;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 3px 8px;
      border-radius: 6px;
      color: #334155;
    }

    /* Employee & Shift Info Card */
    .card-table {
      width: 100%;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 8px;
      border-collapse: separate;
      border-spacing: 0;
      margin-bottom: 14px;
      overflow: hidden;
    }
    .card-table td {
      padding: 8px 12px;
      vertical-align: top;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
    }
    .card-table tr:last-child td {
      border-bottom: none;
    }
    .lbl {
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9.5px;
      margin-bottom: 2px;
    }
    .val {
      font-weight: 800;
      color: #0f172a;
      font-size: 11.5px;
    }
    .val-highlight {
      color: #059669;
    }

    /* Executive KPI Stats Summary */
    .kpi-container {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .kpi-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px;
      text-align: center;
      background: #ffffff;
    }
    .kpi-title {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 4px;
    }
    .kpi-value {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
    }
    .kpi-sub {
      font-size: 8.5px;
      font-weight: 600;
      color: #94a3b8;
      margin-top: 2px;
    }
    .kpi-emerald { border-color: #a7f3d0; background: #ecfdf5; }
    .kpi-emerald .kpi-value { color: #047857; }
    .kpi-amber { border-color: #fde68a; background: #fffbeb; }
    .kpi-amber .kpi-value { color: #b45309; }
    .kpi-rose { border-color: #fecdd3; background: #fff1f2; }
    .kpi-rose .kpi-value { color: #be123c; }

    /* Detailed Daily Logs Table */
    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 10.5px;
    }
    .ledger-table th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 9.5px;
      letter-spacing: 0.5px;
      padding: 6px 8px;
      border: 1px solid #0f172a;
      text-align: left;
    }
    .ledger-table td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    .ledger-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .row-weekend {
      background: #f1f5f9 !important;
      color: #64748b;
    }
    .row-holiday {
      background: #faf5ff !important;
    }
    .row-leave {
      background: #eff6ff !important;
    }
    .row-late {
      background: #fffbeb !important;
    }
    .row-absent {
      background: #fff1f2 !important;
    }
    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 700;
    }

    /* Badges */
    .status-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      border: 1px solid transparent;
    }
    .badge-present { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
    .badge-late { background: #fef3c7; color: #92400e; border-color: #fde68a; }
    .badge-absent { background: #ffe4e6; color: #9f1239; border-color: #fecdd3; }
    .badge-leave { background: #dbeafe; color: #1e40af; border-color: #bfdbfe; }
    .badge-holiday { background: #f3e8ff; color: #6b21a8; border-color: #e9d5ff; }
    .badge-weekend { background: #e2e8f0; color: #475569; }

    /* Signatures Section: 3 Boxes in 1 Row */
    .sig-section {
      page-break-inside: avoid;
      margin-top: 18px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
    }
    .sig-box {
      position: relative;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 12px;
      min-height: 105px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #ffffff;
      overflow: hidden;
    }
    .sig-title {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      color: #334155;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 22px;
      letter-spacing: 0.3px;
    }
    .sig-line {
      border-top: 1px dashed #94a3b8;
      padding-top: 4px;
      font-size: 9px;
      color: #64748b;
      font-weight: 700;
      line-height: 1.35;
    }

    /* 3rd Box: Official Seal & Stamp */
    .stamp-seal-box {
      border: 1.5px dashed #cbd5e1;
      background: #fafafa;
    }
    .seal-inner-area {
      font-size: 8px;
      font-weight: 800;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: center;
      line-height: 1.4;
      padding: 6px 0;
    }
    .seal-inner-area strong {
      color: #64748b;
      display: block;
      margin-top: 2px;
    }

    /* Green Rubber Stamp Approved Styling (Authentic Ink Watermark Touch with Background Text Visible) */
    .hr-stamp-wrapper {
      display: none;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -46%) rotate(-7deg);
      pointer-events: none;
      z-index: 10;
      mix-blend-mode: multiply;
      opacity: 0.90;
    }
    .hr-stamp-wrapper.stamped {
      display: block;
    }
    .rubber-stamp {
      display: inline-block;
      padding: 2.5px;
      border: 3px solid #15803d;
      border-radius: 9px;
      background: transparent;
      box-shadow: inset 0 0 0 1px rgba(21, 128, 61, 0.35), 0 0 0 1px rgba(21, 128, 61, 0.2);
    }
    .rubber-stamp-inner {
      border: 1.5px solid #15803d;
      border-radius: 6px;
      padding: 2px 10px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: transparent;
    }
    .stamp-text-approved {
      font-family: Impact, "Arial Black", "Trebuchet MS", sans-serif;
      font-size: 21px;
      font-weight: 900;
      color: #15803d;
      letter-spacing: 2.5px;
      line-height: 1;
      text-transform: uppercase;
      margin: 1px 0;
      text-shadow: 0 0 0.5px rgba(21, 128, 61, 0.7);
    }
    .stamp-text-sub {
      font-size: 7px;
      font-weight: 900;
      color: #15803d;
      letter-spacing: 1px;
      text-transform: uppercase;
      border-top: 1.5px solid #15803d;
      padding-top: 1.5px;
      margin-top: 1.5px;
      width: 100%;
    }
    .stamp-text-meta {
      font-size: 6.5px;
      font-weight: 800;
      color: #15803d;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      margin-top: 1.5px;
    }
    .stamp-box {
      border: 2px dashed #cbd5e1;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 800;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .report-footer {
      margin-top: 14px;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      color: #94a3b8;
      font-weight: 600;
    }

    /* Print Utilities */
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
    .print-bar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: -24px -24px 20px -24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .print-btn {
      background: #059669;
      color: #ffffff;
      border: none;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 12px;
      cursor: pointer;
    }
    .print-btn:hover {
      background: #10b981;
    }
  </style>
</head>
<body>

  <!-- Top Action Bar (Hidden on print) -->
  <div class="print-bar no-print">
    <div style="display: flex; align-items: center; gap: 10px;">
      <strong style="font-size: 13px;">Monthly Attendance Sheet: ${employee.name}</strong>
      <span style="opacity: 0.75; font-size: 11px;">(${monthName} ${year})</span>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <button 
        id="stampToggleBtn" 
        class="stamp-toggle-btn" 
        onclick="toggleHrStamp()"
        style="background: ${isHrAcknowledged ? '#15803d' : '#0284c7'}; color: #ffffff; border: 1px solid rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 6px; font-weight: 800; font-size: 11.5px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;"
      >
        <span>${isHrAcknowledged ? '✓ HR Stamped (Click to Remove)' : '✓ Acknowledge & Stamp HR'}</span>
      </button>
      <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>
  </div>

  <div class="report-container">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td>
          <h1 class="org-title">${companyName || 'OSAN GROUP LLC'}</h1>
          <div class="doc-type">Monthly Attendance & Timesheet Report</div>
          <div class="doc-meta">
            Sultanate of Oman &bull; Ministry of Labour Compliance Record &bull; Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </td>
        <td class="header-right">
          <div class="ref-badge">${refCode}</div>
          <div style="margin-top: 6px; font-weight: 800; font-size: 12px; color: #059669;">
            ${monthName.toUpperCase()} ${year}
          </div>
        </td>
      </tr>
    </table>

    <!-- Employee & Placement Dossier -->
    <table class="card-table">
      <tr>
        ${employee.avatar_url ? `
        <td style="width: 52px; text-align: center; vertical-align: middle; padding: 6px 10px;">
          <img src="${employee.avatar_url}" style="width: 44px; height: 44px; border-radius: 6px; object-fit: cover; border: 1px solid #cbd5e1;" />
        </td>
        ` : ''}
        <td style="width: 25%;">
          <div class="lbl">Employee Full Name</div>
          <div class="val">${employee.name}</div>
        </td>
        <td style="width: 25%;">
          <div class="lbl">Designation / Role</div>
          <div class="val">${employee.job_title || employee.role || 'Staff Member'}</div>
        </td>
        <td style="width: 25%;">
          <div class="lbl">Company / Entity</div>
          <div class="val">${cleanCompanyEntity}</div>
        </td>
        <td style="width: 25%;">
          <div class="lbl">Contact Number</div>
          <div class="val font-mono">${employee.phone || 'N/A'}</div>
        </td>
      </tr>
    </table>

    <!-- Executive KPI Metrics Summary -->
    <div class="kpi-container">
      <div class="kpi-box">
        <div class="kpi-title">Scheduled Days</div>
        <div class="kpi-value">${scheduledWorkDays}</div>
        <div class="kpi-sub">Target Workdays</div>
      </div>
      <div class="kpi-box kpi-emerald">
        <div class="kpi-title">Days Attended</div>
        <div class="kpi-value">${attendedDays}</div>
        <div class="kpi-sub">${onTimeDays} On-Time &bull; ${lateDays} Late</div>
      </div>
      <div class="kpi-box kpi-amber">
        <div class="kpi-title">Late Warnings</div>
        <div class="kpi-value">${lateDays}</div>
        <div class="kpi-sub">${totalLateDelayMinutes}m Total Delay</div>
      </div>
      <div class="kpi-box kpi-rose">
        <div class="kpi-title">Absences</div>
        <div class="kpi-value">${absentDays}</div>
        <div class="kpi-sub">Unexcused Missed</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-title">Leaves & Off</div>
        <div class="kpi-value">${approvedLeaveDays + publicHolidayDays}</div>
        <div class="kpi-sub">${approvedLeaveDays} Leaves &bull; ${publicHolidayDays} Holidays</div>
      </div>
      <div class="kpi-box kpi-emerald">
        <div class="kpi-title">Total Worked</div>
        <div class="kpi-value font-mono" style="font-size: 14px;">${formattedTotalWorked}</div>
        <div class="kpi-sub">Target: ${scheduledStandardHours}h 00m</div>
      </div>
    </div>

    <!-- Daily Shift Logs Ledger -->
    <table class="ledger-table">
      <thead>
        <tr>
          <th style="width: 32px; text-align: center;">#</th>
          <th style="width: 85px;">Date</th>
          <th style="width: 50px;">Day</th>
          <th style="width: 75px;">Shift In</th>
          <th style="width: 75px;">Shift Out</th>
          <th style="width: 70px;">Duration</th>
          <th>Status / Verification Note</th>
        </tr>
      </thead>
      <tbody>
        ${dailyLogs.map(log => {
          const dayName = log.date.toLocaleDateString('en-GB', { weekday: 'short' });
          const rowClass = log.status === 'weekend' ? 'row-weekend'
            : log.status === 'holiday' ? 'row-holiday'
            : log.status === 'leave' ? 'row-leave'
            : log.status === 'late' ? 'row-late'
            : log.status === 'absent' ? 'row-absent' : '';

          return `
            <tr class="${rowClass}">
              <td style="text-align: center; font-weight: 700; color: #64748b;">${log.dayNum}</td>
              <td style="font-weight: 700;">${log.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td style="color: #64748b; font-weight: 600;">${dayName}</td>
              <td class="font-mono">${log.clockInText}</td>
              <td class="font-mono">${log.clockOutText}</td>
              <td class="font-mono" style="font-weight: 800;">${log.shiftDurationText}</td>
              <td>${getPrintableStatusBadge(log)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <!-- Official Certification & Signatures Section (3 Boxes in 1 Row) -->
    <div class="sig-section">
      <!-- 1. Acknowledged by HR Department -->
      <div class="sig-box" id="hrAckBox">
        <div class="sig-title">1. Acknowledged by HR Department</div>
        
        <!-- Official Green Stamp Watermark Overlay (Transparent Real Ink Effect) -->
        <div id="hrStampOverlay" class="hr-stamp-wrapper ${isHrAcknowledged ? 'stamped' : ''}">
          <div class="rubber-stamp">
            <div class="rubber-stamp-inner">
              <div class="stamp-text-approved">APPROVED</div>
              <div class="stamp-text-sub">HR &bull; LABOUR COMPLIANCE</div>
              <div class="stamp-text-meta">${todayDateFormatted} &bull; ${effectiveAckBy.toUpperCase()}</div>
            </div>
          </div>
        </div>

        <div class="sig-line">
          HR Officer: <strong id="hrSignerText">${effectiveAckBy}</strong><br>
          Date: <span id="hrDateDisplay">${todayDateFormatted}</span>
        </div>
      </div>

      <!-- 2. Head of Dept / GM Approval -->
      <div class="sig-box">
        <div class="sig-title">2. Head of Dept / GM Approval</div>
        <div class="sig-line">
          Approved for Payroll<br>
          Date: ________________________
        </div>
      </div>

      <!-- 3. Official Company Seal & Stamp -->
      <div class="sig-box stamp-seal-box">
        <div class="sig-title" style="color: #64748b; border-bottom-color: #cbd5e1;">3. Official Company Seal</div>
        <div class="seal-inner-area">
          OFFICIAL COMPANY SEAL &amp; STAMP AREA<br>
          <strong>${companyName || 'OSAN STUDIO'}</strong>
        </div>
      </div>
    </div>

    <!-- Report Footer -->
    <div class="report-footer">
      <div>System Ref: Osan HR Automated Biometric Cloud &bull; Confidential Internal Record</div>
      <div>Page 1 of 1 &bull; Document Reference: ${refCode}</div>
    </div>
  </div>

  <script>
    function toggleHrStamp() {
      const stamp = document.getElementById('hrStampOverlay');
      const btn = document.getElementById('stampToggleBtn');
      if (!stamp || !btn) return;
      const isStamped = stamp.classList.contains('stamped');
      if (isStamped) {
        stamp.classList.remove('stamped');
        btn.style.background = '#0284c7';
        btn.innerHTML = '<span>✓ Acknowledge & Stamp HR</span>';
      } else {
        stamp.classList.add('stamped');
        btn.style.background = '#15803d';
        btn.innerHTML = '<span>✓ HR Stamped (Click to Remove)</span>';
      }
    }

    window.onload = function() {
      // Prompt print dialog after page renders
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
