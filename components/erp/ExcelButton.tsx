'use client';

import { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onExport: () => void | Promise<void>;
  label?: string;
  className?: string;
}

// 화면 양식과 동일한 구조로 .xlsx 파일을 다운로드 — onExport 안에서 buildXxxWorkbook + writeWorkbookToFile 호출
export function ExcelButton({ onExport, label = '엑셀 저장', className }: Props) {
  const [busy, setBusy] = useState(false);
  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onExport();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={busy}
      className={className}
    >
      {busy ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="mr-1 h-4 w-4" strokeWidth={1.75} />
      )}
      {label}
    </Button>
  );
}
