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
  language: 'en' | 'ar';
}

export function getLateWarningWhatsAppText(notice: LateWarningNotice): string {
  if (notice.language === 'ar') {
    return `الموضوع: إنذار بسبب التأخر عن العمل

عزيزي الموظف،
يُعد هذا الخطاب إنذارًا رسميًا بسبب تأخرك عن العمل. نرجو الالتزام بمواعيد الدوام الرسمية والحضور في الوقت المحدد.
وفي حال تكرار المخالفة، قد يتم اتخاذ الإجراءات التأديبية اللازمة.

مع التحية،
مسؤول الموارد البشرية`;
  }

  return `Subject: Warning for Late Attendance

Dear Employee,
This letter serves as a formal warning regarding your repeated lateness to work. You are required to adhere to the official working hours and ensure punctual attendance.
Further violations may result in disciplinary action.

Regards,
HR Officer`;
}

export function sendLateWarningWhatsAppNotice(notice: LateWarningNotice) {
  const phoneRaw = notice.phone || '';
  const digitsOnly = phoneRaw.replace(/[^0-9]/g, '');
  let formattedPhone = digitsOnly.replace(/^0+/, '');
  if (formattedPhone.length === 8) {
    formattedPhone = `968${formattedPhone}`;
  }

  const messageText = getLateWarningWhatsAppText(notice);
  const encodedText = encodeURIComponent(messageText);
  const whatsappUrl = formattedPhone 
    ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  window.open(whatsappUrl, '_blank');
}

