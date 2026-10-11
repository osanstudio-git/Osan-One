import { useState } from 'react';
import { AlertCircle, Clock, FileCheck, RefreshCw, MessageSquare } from 'lucide-react';
import type { User } from '../../types';
import { DocumentRenewalModal } from './DocumentRenewalModal';
import { sendDocumentExpiryWhatsAppNotice } from '../../lib/whatsappService';

interface ComplianceItem {
  employeeId: string;
  employeeName: string;
  employeePhone?: string;
  employeeCompany: string;
  documentId: string;
  documentName: string;
  documentType: string;
  visaType?: string;
  documentNumber?: string;
  expiryDate: string;
  daysRemaining: number;
}

interface DocumentComplianceWidgetProps {
  employees: User[];
  onEmployeeUpdate?: (updatedEmployees: User[]) => void;
}

export function DocumentComplianceWidget({ employees, onEmployeeUpdate }: DocumentComplianceWidgetProps) {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'expired' | 'expiring' | 'visit'>('all');
  const [renewalTarget, setRenewalTarget] = useState<{
    employeeName: string;
    employeeId: string;
    documentItem: { id: string; name: string; type: string; expiryDate?: string; number?: string };
  } | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Scan employees and calculate expiring/expired items
  const items: ComplianceItem[] = [];
  let expiredCount = 0;
  let expiringSoonCount = 0;
  let visitVisaCount = 0;
  let workVisaCount = 0;

  employees.forEach(emp => {
    emp.documents?.forEach(doc => {
      if (doc.visaType === 'Visit Visa') visitVisaCount++;
      if (doc.visaType === 'Work Visa') workVisaCount++;

      if (doc.expiryDate) {
        const expDate = new Date(doc.expiryDate);
        expDate.setHours(0, 0, 0, 0);
        const diffTime = expDate.getTime() - today.getTime();
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining <= 30) {
          if (daysRemaining < 0) expiredCount++;
          else expiringSoonCount++;

          items.push({
            employeeId: emp.id,
            employeeName: emp.name,
            employeePhone: emp.phone,
            employeeCompany: emp.company || emp.company_id || 'Company',
            documentId: doc.id,
            documentName: doc.name,
            documentType: doc.type,
            visaType: doc.visaType,
            documentNumber: doc.number,
            expiryDate: doc.expiryDate,
            daysRemaining
          });
        }
      }
    });
  });

  const filteredItems = items.filter(item => {
    if (selectedFilter === 'expired') return item.daysRemaining < 0;
    if (selectedFilter === 'expiring') return item.daysRemaining >= 0 && item.daysRemaining <= 30;
    if (selectedFilter === 'visit') return item.visaType === 'Visit Visa';
    return true;
  });

  const handleWidgetRenew = (docId: string, newExpiryDate: string, newNumber?: string) => {
    if (!renewalTarget) return;

    const updatedEmployees = employees.map(emp => {
      if (emp.id === renewalTarget.employeeId) {
        const updatedDocs = (emp.documents || []).map(d => {
          if (d.id === docId) {
            return { ...d, expiryDate: newExpiryDate, number: newNumber || d.number };
          }
          return d;
        });
        return { ...emp, documents: updatedDocs };
      }
      return emp;
    });

    if (onEmployeeUpdate) {
      onEmployeeUpdate(updatedEmployees);
    }
  };

  return (
    <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Document & Visa Compliance Dashboard
              {expiredCount > 0 && (
                <span className="px-2 py-0.5 text-xs bg-red-500 text-white font-black rounded-full animate-pulse">
                  {expiredCount} Critical
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Automated tracking for passports, labor cards, resident IDs, and visit visa expirations.
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-black/20 p-1 rounded-xl border border-slate-200 dark:border-white/5 text-xs">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors ${selectedFilter === 'all' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'}`}
          >
            All Action Required ({items.length})
          </button>
          <button
            onClick={() => setSelectedFilter('expired')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors ${selectedFilter === 'expired' ? 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 border border-red-500/30' : 'text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'}`}
          >
            🔴 Expired ({expiredCount})
          </button>
          <button
            onClick={() => setSelectedFilter('expiring')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors ${selectedFilter === 'expiring' ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30' : 'text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'}`}
          >
            ⚠️ Expiring Soon ({expiringSoonCount})
          </button>
          <button
            onClick={() => setSelectedFilter('visit')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors ${selectedFilter === 'visit' ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/30' : 'text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'}`}
          >
            🛂 Visit Visas ({visitVisaCount})
          </button>
        </div>
      </div>

      {/* Stats Overview Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1">
          <span className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider block">Expired Documents</span>
          <div className="text-2xl font-black text-red-600 dark:text-red-400">{expiredCount}</div>
          <span className="text-[10px] text-red-600 dark:text-red-300 font-semibold block">Immediate renewal required</span>
        </div>

        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
          <span className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider block">Expiring in 30 Days</span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{expiringSoonCount}</div>
          <span className="text-[10px] text-amber-600 dark:text-amber-300 font-semibold block">Upcoming compliance alerts</span>
        </div>

        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-1">
          <span className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider block">Monitored Visit Visas</span>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{visitVisaCount}</div>
          <span className="text-[10px] text-blue-600 dark:text-blue-300 font-semibold block">Short-term stay tracking</span>
        </div>

        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1">
          <span className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider block">Active Work Visas</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{workVisaCount}</div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-300 font-semibold block">2-Year Residency Permits</span>
        </div>
      </div>

      {/* Document Items List */}
      <div className="space-y-3">
        {filteredItems.length > 0 ? (
          filteredItems.map((item, idx) => (
            <div
              key={`${item.employeeId}-${item.documentId}-${idx}`}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 rounded-xl gap-4 transition-all"
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-xl ${item.daysRemaining < 0 ? 'bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'}`}>
                  {item.daysRemaining < 0 ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>

                <div className="space-y-0.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900 dark:text-white font-bold text-sm">{item.employeeName}</span>
                    <span className="text-slate-500 dark:text-gray-400 text-[11px]">({item.employeeCompany})</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-600 dark:text-gray-300">
                    <span className="font-semibold">{item.documentName}</span>
                    {item.documentNumber && <span className="text-slate-400 dark:text-gray-500 font-mono">#{item.documentNumber}</span>}
                    {item.visaType && (
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded text-[10px] font-bold uppercase">
                        {item.visaType}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Badge & Action */}
              <div className="flex items-center gap-3 self-end md:self-center">
                <div className="text-right">
                  <span className="text-slate-500 dark:text-gray-400 text-[10px] block font-medium">Expiry Date: {item.expiryDate}</span>
                  <span className={`text-xs font-bold ${item.daysRemaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {item.daysRemaining < 0
                      ? `Expired ${Math.abs(item.daysRemaining)} days ago`
                      : `Expires in ${item.daysRemaining} days`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => sendDocumentExpiryWhatsAppNotice({
                      employeeName: item.employeeName,
                      phone: item.employeePhone,
                      companyName: item.employeeCompany,
                      documentName: item.documentName,
                      documentType: item.documentType,
                      expiryDate: item.expiryDate,
                      daysRemaining: item.daysRemaining
                    })}
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                    title="Send WhatsApp Expiry Reminder"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    onClick={() => setRenewalTarget({
                      employeeName: item.employeeName,
                      employeeId: item.employeeId,
                      documentItem: {
                        id: item.documentId,
                        name: item.documentName,
                        type: item.documentType,
                        expiryDate: item.expiryDate,
                        number: item.documentNumber
                      }
                    })}
                    className="px-3.5 py-2 bg-primary hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md shadow-primary/20 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Renew Now
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 rounded-xl text-slate-500 dark:text-gray-400 text-xs flex flex-col items-center justify-center gap-2">
            <FileCheck className="w-8 h-8 text-emerald-500" />
            <span className="font-semibold text-slate-800 dark:text-white">All Documents Compliant</span>
            <span>No documents or visas require immediate renewal under selected filter.</span>
          </div>
        )}
      </div>

      {/* Document Renewal Drawer Modal */}
      <DocumentRenewalModal
        isOpen={!!renewalTarget}
        onClose={() => setRenewalTarget(null)}
        employeeName={renewalTarget?.employeeName || ''}
        documentItem={renewalTarget?.documentItem || null}
        onRenew={handleWidgetRenew}
      />
    </div>
  );
}
