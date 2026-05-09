'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  EditableInvoiceTable,
  type EditableLog,
  type SortKey,
} from '@/components/erp/EditableInvoiceTable';
import {
  InvoicePreview,
  type InvoiceLog,
  type InvoiceCompanyInfo,
} from '@/components/erp/InvoicePreview';
import { ExcelButton } from '@/components/erp/ExcelButton';
import { HometaxExcelButton } from '@/components/erp/HometaxExcelButton';
import { downloadInvoiceExcel } from '@/lib/excel/invoice';
import type { SelfCompanyInfo } from '@/lib/company-info';

interface Props {
  company: InvoiceCompanyInfo;
  selfCompany: SelfCompanyInfo;
  period: { from: string; to: string };
  logs: EditableLog[];
}

const directionRank: Record<string, number> = { in: 0, out: 1 };

// 거래명세표 (인쇄 양식) 정렬: 일자 오름차순 → 반입→반출 → 현장 가나다순
function sortForInvoice(logs: EditableLog[]): EditableLog[] {
  return [...logs].sort((a, b) => {
    if (a.log_date !== b.log_date) return a.log_date < b.log_date ? -1 : 1;
    const da = directionRank[a.direction] ?? 99;
    const db = directionRank[b.direction] ?? 99;
    if (da !== db) return da - db;
    return (a.sites?.name ?? '').localeCompare(b.sites?.name ?? '', 'ko');
  });
}

export function InvoiceEditorPreview({ company, selfCompany, period, logs }: Props) {
  // 디폴트: 최근→예전 (log_date desc), 전체 선택
  const [sortKey, setSortKey] = useState<SortKey>('log_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(logs.map((l) => l.id)),
  );

  // logs prop 이 바뀌면 선택 상태 재초기화 (다른 거래처/기간/현장 조회 시)
  const logsKey = useMemo(() => logs.map((l) => l.id).join('|'), [logs]);
  useEffect(() => {
    setSelectedIds(new Set(logs.map((l) => l.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logsKey]);

  const previewLogs = useMemo(
    () => sortForInvoice(logs.filter((l) => selectedIds.has(l.id))),
    [logs, selectedIds],
  );

  const onToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onToggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(logs.map((l) => l.id)) : new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <HometaxExcelButton
          base={{
            company,
            selfCompany,
            period,
            logs: previewLogs as unknown as InvoiceLog[],
          }}
        />
        <ExcelButton
          label="엑셀 저장"
          onExport={() =>
            downloadInvoiceExcel({
              company,
              selfCompany,
              period,
              logs: previewLogs as unknown as InvoiceLog[],
            })
          }
        />
      </div>

      <EditableInvoiceTable
        logs={logs}
        selection={{ selectedIds, onToggle, onToggleAll }}
        sort={{
          sortKey,
          sortDir,
          onSort: (key, dir) => {
            setSortKey(key);
            setSortDir(dir);
          },
        }}
      />

      <InvoicePreview
        company={company}
        selfCompany={selfCompany}
        period={period}
        logs={previewLogs as unknown as InvoiceLog[]}
      />
    </div>
  );
}
