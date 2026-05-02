'use client';

import { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { recordPdfDownloadAction } from '@/actions/invoices';
import { downloadInvoiceExcel } from '@/lib/excel/invoice';
import type { InvoiceLog, InvoiceCompanyInfo } from '@/components/erp/InvoicePreview';
import type { SelfCompanyInfo } from '@/lib/company-info';

interface Props {
  company: InvoiceCompanyInfo;
  selfCompany: SelfCompanyInfo;
  period: { from: string; to: string };
  logs: InvoiceLog[];
  shareToken: string;
}

export function ShareExcelButton({
  company,
  selfCompany,
  period,
  logs,
  shareToken,
}: Props) {
  const [busy, setBusy] = useState(false);
  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await recordPdfDownloadAction(
        {
          company_id: company.id,
          period_from: period.from,
          period_to: period.to,
          downloaded_by: 'company_self',
          share_token: shareToken,
        },
        true,
      ).catch(() => {});
      downloadInvoiceExcel({ company, selfCompany, period, logs });
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-background-subtle disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
      )}
      엑셀 저장
    </button>
  );
}
