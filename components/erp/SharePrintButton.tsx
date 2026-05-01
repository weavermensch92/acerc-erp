'use client';

import { useTransition } from 'react';
import { Printer, Loader2 } from 'lucide-react';
import { recordPdfDownloadAction } from '@/actions/invoices';

interface Props {
  companyId: string;
  periodFrom: string;
  periodTo: string;
  shareToken: string;
  label?: string;
}

// share 페이지의 인쇄 버튼 — 다운로드 이력 기록 후 window.print() 호출
export function SharePrintButton({
  companyId,
  periodFrom,
  periodTo,
  shareToken,
  label = '거래명세표 인쇄 / PDF 저장',
}: Props) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      // 기록 실패해도 인쇄는 진행 (사용자 경험 우선)
      try {
        await recordPdfDownloadAction(
          {
            company_id: companyId,
            period_from: periodFrom,
            period_to: periodTo,
            downloaded_by: 'company_self',
            share_token: shareToken,
          },
          true, // useAdmin
        );
      } catch {
        // ignore
      }
      window.print();
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-background-subtle disabled:opacity-60"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
      )}
      {label}
    </button>
  );
}
