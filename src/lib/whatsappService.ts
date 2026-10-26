export interface WhatsAppEmployeeInvite {
  name: string;
  phone?: string;
  email?: string;
  company: string;
  pin?: string;
}

export function sendEmployeeWhatsAppInvite(employee: WhatsAppEmployeeInvite) {
  const phoneRaw = employee.phone || '';
  const digitsOnly = phoneRaw.replace(/[^0-9]/g, '');
  
  // Format phone number with Oman +968 country code if missing
  let formattedPhone = digitsOnly;
  if (digitsOnly.length === 8) {
    formattedPhone = `968${digitsOnly}`;
  }

  const portalUrl = 'https://one.osangroupoman.com';
  const loginCredential = employee.phone || employee.email || 'Registered Phone/Email';
  const securityPin = employee.pin || '123456';

  const messageText = 
`*Osan Group HR & Attendance Portal* 🏢

Dear *${employee.name}*, welcome to *${employee.company}*!

Your Employee Portal credentials have been setup successfully. You can now access your shifts, attendance logs, and leave requests.

🌐 *Portal URL:* ${portalUrl}
📱 *Login ID:* ${loginCredential}
🔑 *Security PIN:* ${securityPin}

*Quick Start Guide:*
1️⃣ Open the Portal link above on Chrome / Safari.
2️⃣ Tap "Install App" to add to your Home Screen.
3️⃣ Log in using your Login ID & Security PIN.

If you have any questions, please contact HR.`;

  const encodedText = encodeURIComponent(messageText);
  const whatsappUrl = formattedPhone 
    ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  window.open(whatsappUrl, '_blank');
}

export interface DocumentExpiryWhatsAppNotice {
  employeeName: string;
  phone?: string;
  companyName: string;
  documentName: string;
  documentType: string;
  expiryDate: string;
  daysRemaining: number;
}

export function sendDocumentExpiryWhatsAppNotice(notice: DocumentExpiryWhatsAppNotice) {
  const phoneRaw = notice.phone || '';
  const digitsOnly = phoneRaw.replace(/[^0-9]/g, '');
  
  let formattedPhone = digitsOnly;
  if (digitsOnly.length === 8) {
    formattedPhone = `968${digitsOnly}`;
  }

  const isExpired = notice.daysRemaining < 0;
  const statusLine = isExpired 
    ? `⚠️ *STATUS: EXPIRED* (Expired ${Math.abs(notice.daysRemaining)} days ago)` 
    : `⏳ *EXPIRING SOON* (Only ${notice.daysRemaining} days remaining)`;

  const messageText = 
`*Osan Group HR — Document Compliance Notice* 📄

Dear *${notice.employeeName}*,

This is an official document renewal notice from *${notice.companyName}* HR Department.

📌 *Document:* ${notice.documentName} (${notice.documentType})
📅 *Expiry Date:* ${new Date(notice.expiryDate).toLocaleDateString('en-GB')}
${statusLine}

⚠️ *Action Required:*
Please submit your renewed official document or passport copy to the HR department as soon as possible to avoid fines or visa delays under Ministry of Labour regulations.

Thank you,
*Osan Group HR Department*`;

  const encodedText = encodeURIComponent(messageText);
  const whatsappUrl = formattedPhone 
    ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  window.open(whatsappUrl, '_blank');
}

export interface LateWarningNotice {
  name: string;
  phone?: string;
  company?: string;
  date?: string;
  occurrence?: number;
  lateMinutes?: number;
  language: 'en' | 'ar';
}

export function getLateWarningWhatsAppText(notice: LateWarningNotice): string {
  const occTextEn = notice.occurrence ? ` (Occurrence #${notice.occurrence} this month)` : '';
  const occTextAr = notice.occurrence ? ` (المرة رقم ${notice.occurrence} هذا الشهر)` : '';
  const dateTextEn = notice.date ? ` on ${notice.date}` : '';
  const dateTextAr = notice.date ? ` بتاريخ ${notice.date}` : '';
  const minsTextEn = notice.lateMinutes ? ` (${notice.lateMinutes} mins late)` : '';
  const minsTextAr = notice.lateMinutes ? ` (تأخر ${notice.lateMinutes} دقيقة)` : '';

  if (notice.language === 'ar') {
    return `الموضوع: إنذار رسمي بسبب تكرار التأخر عن العمل${occTextAr}

عزيزي\\ة الموظف\\ة: ${notice.name}،
يُعد هذا الخطاب إنذارًا رسميًا بسبب تكرار تأخرك عن العمل${dateTextAr}${minsTextAr}، حيث تم تجاوز الحد المسموح به شهريًا (3 مرات).
نرجو الالتزام التام بمواعيد الدوام الرسمية والحضور في الوقت المحدد، حيث إن استمرار تكرار التأخير قد يترتب عليه اتخاذ الإجراءات التأديبية والخصومات المقررة قانونًا.

مع التحية،
إدارة الموارد البشرية`;
  }

  return `Subject: Official Warning for Repeated Late Attendance${occTextEn}

Dear ${notice.name},
This letter serves as an official formal warning regarding your repeated lateness to work${dateTextEn}${minsTextEn}, having exceeded the monthly 3-time allowance.
You are strictly required to adhere to official working hours and ensure punctual attendance. Further violations may result in disciplinary action and statutory salary deductions under Omani Labor Law.

Regards,
HR Department`;
}

export function getLateWarningWhatsAppUrl(notice: LateWarningNotice): string {
  const phoneRaw = notice.phone || '';
  const digitsOnly = phoneRaw.replace(/[^0-9]/g, '');
  let formattedPhone = digitsOnly.replace(/^0+/, '');
  if (formattedPhone.length === 8) {
    formattedPhone = `968${formattedPhone}`;
  }

  const messageText = getLateWarningWhatsAppText(notice);
  const encodedText = encodeURIComponent(messageText);
  return formattedPhone 
    ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;
}

export function sendLateWarningWhatsAppNotice(notice: LateWarningNotice) {
  const url = getLateWarningWhatsAppUrl(notice);
  window.open(url, '_blank');
}

export interface LateReminderNotice {
  name: string;
  phone?: string;
  company?: string;
  date?: string;
  occurrence?: number;
  lateMinutes?: number;
  language: 'en' | 'ar';
}

export function getLateReminderWhatsAppText(notice: LateReminderNotice): string {
  const dateTextEn = notice.date ? ` on ${notice.date}` : '';
  const dateTextAr = notice.date ? ` بتاريخ ${notice.date}` : '';
  const minsTextEn = notice.lateMinutes ? ` (${notice.lateMinutes}m)` : '';
  const minsTextAr = notice.lateMinutes ? ` (${notice.lateMinutes} دقيقة)` : '';
  const occTextEn = notice.occurrence ? ` (${notice.occurrence} of 3 allowed per month)` : '';
  const occTextAr = notice.occurrence ? ` (${notice.occurrence} من أصل 3 مرات مسموح بها شهريًا)` : '';

  if (notice.language === 'ar') {
    return `الموضوع: تذكير بمواعيد الدوام الرسمي

عزيزي\\ة الموظف\\ة: ${notice.name}،
نود تذكيركم بلطف بأهمية الالتزام بمواعيد الحضور وبدء الدوام الرسمي. يُرجى العلم بأنه تم تسجيل تأخر${dateTextAr}${minsTextAr}${occTextAr}. نرجو الحرص على الحضور في الموعد المحدد.

مع أطيب التحيات،
إدارة الموارد البشرية`;
  }

  return `Subject: Shift Punctuality Reminder

Dear ${notice.name},
This is a friendly reminder regarding your official shift timing. A late arrival was recorded${dateTextEn}${minsTextEn}${occTextEn}. Please ensure timely arrival for your scheduled shifts.

Best regards,
HR Department`;
}

export function getLateReminderWhatsAppUrl(notice: LateReminderNotice): string {
  const phoneRaw = notice.phone || '';
  const digitsOnly = phoneRaw.replace(/[^0-9]/g, '');
  let formattedPhone = digitsOnly.replace(/^0+/, '');
  if (formattedPhone.length === 8) {
    formattedPhone = `968${formattedPhone}`;
  }

  const messageText = getLateReminderWhatsAppText(notice);
  const encodedText = encodeURIComponent(messageText);
  return formattedPhone 
    ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;
}

export interface AbsentWarningNotice {
  name: string;
  phone?: string;
  company?: string;
  date?: string;
  language: 'en' | 'ar';
}

export function getAbsentWarningWhatsAppText(notice: AbsentWarningNotice): string {
  const dateTextEn = notice.date ? ` on ${notice.date}` : '';
  const dateTextAr = notice.date ? ` بتاريخ ${notice.date}` : '';

  if (notice.language === 'ar') {
    return `الموضوع: إنذار رسمي بسبب الغياب دون إشعار مسبق

عزيزي\\ة الموظف\\ة: ${notice.name}،
يُعد هذا الخطاب إنذارًا رسميًا بسبب تغيبك عن العمل${dateTextAr} دون إشعار مسبق أو إجازة معتمدة.
نرجو التواصل مع إدارة الموارد البشرية وتقديم ما يبرر الغياب فورًا، لتجنب اتخاذ الإجراءات التأديبية والخصومات المقررة بموجب قانون العمل العُماني.

مع التحية،
إدارة الموارد البشرية`;
  }

  return `Subject: Official Warning for Absence Without Prior Notice

Dear ${notice.name},
This letter serves as a formal warning regarding your absence from work${dateTextEn} without prior notice or approved leave.
You are required to contact HR and submit your justification immediately to avoid disciplinary action and payroll deductions under Omani Labor Law.

Regards,
HR Department`;
}

export function getAbsentWarningWhatsAppUrl(notice: AbsentWarningNotice): string {
  const phoneRaw = notice.phone || '';
  const digitsOnly = phoneRaw.replace(/[^0-9]/g, '');
  let formattedPhone = digitsOnly.replace(/^0+/, '');
  if (formattedPhone.length === 8) {
    formattedPhone = `968${formattedPhone}`;
  }

  const messageText = getAbsentWarningWhatsAppText(notice);
  const encodedText = encodeURIComponent(messageText);
  return formattedPhone 
    ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;
}

export function sendAbsentWarningWhatsAppNotice(notice: AbsentWarningNotice) {
  const url = getAbsentWarningWhatsAppUrl(notice);
  window.open(url, '_blank');
}

export interface LeaveApprovalNotice {
  employeeName: string;
  phone?: string;
  leaveType?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  language: 'en' | 'ar';
}

export function getLeaveApprovalWhatsAppText(notice: LeaveApprovalNotice): string {
  const isAnnual = !notice.leaveType || notice.leaveType.toLowerCase().includes('yearly') || notice.leaveType.toLowerCase().includes('annual');
  const typeEn = isAnnual ? 'annual leave' : `${notice.leaveType} leave`;
  const typeAr = isAnnual ? 'إجازتكم السنوية' : `إجازتكم (${notice.leaveType})`;

  if (notice.language === 'ar') {
    return `الموضوع: الموافقة على طلب الإجازة السنوية
الفاضل\\ة: ${notice.employeeName} المحترم/ة،
نود إفادتكم بأنه قد تمت الموافقة على طلب ${typeAr} للفترة من ${notice.startDate} إلى ${notice.endDate}، لمدة إجمالية قدرها ${notice.totalDays} يومًا، وذلك بناءً على رصيد إجازاتكم المتاح ووفقًا لسياسات الموارد البشرية المعتمدة في الشركة.
يرجى التنسيق مع المسؤول المباشر لضمان تسليم المهام والمسؤوليات بالشكل المناسب، والمحافظة على استمرارية سير العمل خلال فترة غيابكم.

نتمنى لكم إجازة سعيدة ومريحة.

وتفضلوا بقبول فائق الاحترام والتقدير،
إخلاص سعيد النيري
قسم الموارد البشرية`;
  }

  return `Dear Ms.\\ Mr. ${notice.employeeName},
We would like to inform you that your request for ${typeEn} has been approved for the period from ${notice.startDate} to ${notice.endDate}, for a total of ${notice.totalDays} days, based on your available leave balance and in accordance with the company’s HR policies.
Kindly coordinate with your direct supervisor to ensure proper handover of responsibilities and maintain workflow continuity during your absence.

We wish you a pleasant and restful vacation.

Best regards, 
Eklas Said Al Nairi
HR`;
}

export function getLeaveApprovalWhatsAppUrl(notice: LeaveApprovalNotice): string {
  const phoneRaw = notice.phone || '';
  const digitsOnly = phoneRaw.replace(/[^0-9]/g, '');
  let formattedPhone = digitsOnly.replace(/^0+/, '');
  if (formattedPhone.length === 8) {
    formattedPhone = `968${formattedPhone}`;
  }

  const messageText = getLeaveApprovalWhatsAppText(notice);
  const encodedText = encodeURIComponent(messageText);
  return formattedPhone 
    ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;
}

export interface LeaveRejectionNotice {
  employeeName: string;
  phone?: string;
  leaveType?: string;
  startDate: string;
  endDate: string;
  language: 'en' | 'ar';
}

export function getLeaveRejectionWhatsAppText(notice: LeaveRejectionNotice): string {
  const isAnnual = !notice.leaveType || notice.leaveType.toLowerCase().includes('yearly') || notice.leaveType.toLowerCase().includes('annual');
  const typeEn = isAnnual ? 'annual leave' : `${notice.leaveType} leave`;
  const typeAr = isAnnual ? 'إجازتكم السنوية' : `إجازتكم (${notice.leaveType})`;

  if (notice.language === 'ar') {
    return `الموضوع: رفض طلب الإجازة السنوية
الفاضل\\ة: ${notice.employeeName} المحترم/ة،
نود إفادتكم بأنه، وبعد مراجعة طلب ${typeAr} للفترة من ${notice.startDate} إلى ${notice.endDate}، يؤسفنا إبلاغكم بأنه لم تتم الموافقة على الطلب، وذلك وفقًا لمتطلبات العمل وسياسات الموارد البشرية المعتمدة في الشركة.
يرجى التنسيق مع المسؤول المباشر في حال الرغبة في تقديم طلب إجازة بديل، بما يضمن تلبية متطلبات العمل والمحافظة على استمرارية سيره.

نشكركم على تفهمكم وتعاونكم.

وتفضلوا بقبول فائق الاحترام والتقدير،
إخلاص سعيد النعيري
قسم الموارد البشرية`;
  }

  return `Subject: Annual Leave Request Rejection
Dear Mr./Ms. ${notice.employeeName},
We regret to inform you that your ${typeEn} request for the period from ${notice.startDate} to ${notice.endDate} has not been approved, due to operational requirements and in accordance with the company’s HR policies.
Kindly coordinate with your direct supervisor if you wish to submit an alternative leave request, ensuring that business needs are met and workflow continuity is maintained.

Thank you for your understanding and cooperation.

Best regards,
Eklas Said Al Nairi
HR Department`;
}

export function getLeaveRejectionWhatsAppUrl(notice: LeaveRejectionNotice): string {
  const phoneRaw = notice.phone || '';
  const digitsOnly = phoneRaw.replace(/[^0-9]/g, '');
  let formattedPhone = digitsOnly.replace(/^0+/, '');
  if (formattedPhone.length === 8) {
    formattedPhone = `968${formattedPhone}`;
  }

  const messageText = getLeaveRejectionWhatsAppText(notice);
  const encodedText = encodeURIComponent(messageText);
  return formattedPhone 
    ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;
}

