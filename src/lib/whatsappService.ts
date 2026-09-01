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
