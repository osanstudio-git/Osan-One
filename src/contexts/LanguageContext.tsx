import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type Language = 'en' | 'ar';

export const TRANSLATIONS = {
  en: {
    // Header & User
    hello: 'Hello',
    popOut: 'Pop-out',
    signOut: 'Sign Out',
    requestLeave: 'Request Leave',
    branch: 'Branch',
    geoActive: 'Geo Active',
    
    // Clock & Metrics
    cumulativeWorkedToday: 'Cumulative Worked Hours Today',
    hours: 'h',
    minutes: 'm',
    seconds: 's',
    shiftStart: 'Start',
    shiftEnd: 'End',
    
    // Punch Ring
    checkIn: 'CHECK IN',
    checkOut: 'CHECK OUT',
    pressAndHold: 'Press & Hold (2s)',
    verifying: 'Verifying location...',
    locationFailed: 'Location verification failed',
    
    // Break Actions
    takeBreak: 'Take Break (60m standard)',
    resumeWork: 'Resume Work',
    breakTime: 'Break',
    
    // Document Alerts
    docExpiredTitle: 'Action Required: Document Expired',
    docRenewalTitle: 'Document Renewal Notice',
    expired: 'Expired',
    left: 'Left',
    
    // Modals & Common
    newLeaveRequest: 'New Leave Request',
    leaveType: 'Leave Type',
    annualLeave: 'Annual Leave',
    sickLeave: 'Sick Leave',
    emergencyLeave: 'Emergency Leave',
    startDate: 'Start Date',
    endDate: 'End Date',
    reason: 'Reason / Notes',
    submitRequest: 'Submit Request',
    submitting: 'Submitting...',
    cancel: 'Cancel',
    loading: 'Loading...',
    status: 'Status',
    ready: 'Ready',
    myLeaves: 'My Leaves & Balances',
    leaveBalances: 'Leave Balances',
    remaining: 'Remaining',
    used: 'Used',
    total: 'Total',
    appliedOn: 'Applied On',
    dates: 'Dates',
    pending: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
    viewDocument: 'View Document',
    noLeavesYet: 'No leave applications submitted yet',
    requestNewLeave: 'Apply for Leave',
    days: 'days',
    uploadSuccess: 'Leave request submitted successfully! Pending HR approval.',
    uploadFailed: 'Failed to submit leave request. Please try again.',
  },
  ar: {
    // Header & User
    hello: 'مرحباً',
    popOut: 'نافذة مصغّرة',
    signOut: 'تسجيل الخروج',
    requestLeave: 'طلب إجازة',
    branch: 'الفرع',
    geoActive: 'الموقع نشط',
    
    // Clock & Metrics
    cumulativeWorkedToday: 'ساعات العمل التراكمية اليوم',
    hours: 'ساعة',
    minutes: 'دقيقة',
    seconds: 'ثانية',
    shiftStart: 'البداية',
    shiftEnd: 'النهاية',
    
    // Punch Ring
    checkIn: 'تسجيل حضور',
    checkOut: 'تسجيل انصراف',
    pressAndHold: 'اضغط مطولاً (ثانيتان)',
    verifying: 'جاري التحقق من الموقع...',
    locationFailed: 'فشل التحقق من الموقع',
    
    // Break Actions
    takeBreak: 'بدء استراحة (60 دقيقة)',
    resumeWork: 'استئناف العمل',
    breakTime: 'الاستراحة',
    
    // Document Alerts
    docExpiredTitle: 'إجراء مطلوب: وثيقة منتهية الصلاحية',
    docRenewalTitle: 'إشعار تجديد وثيقة',
    expired: 'منتهية',
    left: 'متبقي',
    
    // Modals & Common
    newLeaveRequest: 'تقديم طلب إجازة جديد',
    leaveType: 'نوع الإجازة',
    annualLeave: 'إجازة سنوية',
    sickLeave: 'إجازة مرضية',
    emergencyLeave: 'إجازة طارئة',
    startDate: 'تاريخ البدء',
    endDate: 'تاريخ الانتهاء',
    reason: 'السبب / الملاحظات',
    submitRequest: 'إرسال الطلب',
    submitting: 'جاري الإرسال...',
    cancel: 'إلغاء',
    loading: 'جاري التحميل...',
    status: 'الحالة',
    ready: 'جاهز',
    myLeaves: 'إجازاتي وأرصدتي',
    leaveBalances: 'أرصدة الإجازات',
    remaining: 'المتبقي',
    used: 'المستخدم',
    total: 'الإجمالي',
    appliedOn: 'تاريخ التقديم',
    dates: 'التواريخ',
    pending: 'قيد المراجعة',
    approved: 'معتمد',
    rejected: 'مرفوض',
    viewDocument: 'عرض المرفق',
    noLeavesYet: 'لم يتم تقديم أي طلبات إجازة حتى الآن',
    requestNewLeave: 'تقديم طلب إجازة جديد',
    days: 'أيام',
    uploadSuccess: 'تم تقديم طلب الإجازة بنجاح! في انتظار موافقة الموارد البشرية.',
    uploadFailed: 'فشل في إرسال طلب الإجازة. يرجى المحاولة مرة أخرى.',
  }
};

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  isRtl: boolean;
  t: (key: keyof typeof TRANSLATIONS['en']) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  toggleLanguage: () => {},
  setLanguage: () => {},
  isRtl: false,
  t: (key) => TRANSLATIONS.en[key] || key,
});

export const useLanguage = () => useContext(LanguageContext);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('osan_language') as Language;
      if (saved === 'en' || saved === 'ar') return saved;
      // Default to Arabic if browser is in Arabic, else English
      if (navigator.language?.startsWith('ar')) return 'ar';
    }
    return 'en';
  });

  const isRtl = language === 'ar';

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', language);
    root.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    localStorage.setItem('osan_language', language);
  }, [language, isRtl]);

  const toggleLanguage = () => {
    setLanguageState(prev => (prev === 'en' ? 'ar' : 'en'));
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: keyof typeof TRANSLATIONS['en']): string => {
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || (key as string);
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage, isRtl, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
