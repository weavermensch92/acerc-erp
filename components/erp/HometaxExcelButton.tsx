'use client';

import { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/erp/Modal';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  downloadHometaxSalesExcel,
  type HometaxSalesInput,
} from '@/lib/excel/hometax';

interface Props {
  base: Omit<HometaxSalesInput, 'issuedAt' | 'billingType'>;
}

export function HometaxExcelButton({ base }: Props) {
  const [open, setOpen] = useState(false);
  const [issuedAt, setIssuedAt] = useState(base.period.to);
  const [billingType, setBillingType] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);

  const onConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      downloadHometaxSalesExcel({
        ...base,
        issuedAt,
        billingType,
      });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <FileSpreadsheet className="mr-1 h-4 w-4" strokeWidth={1.75} />
        홈택스 일괄발행 엑셀
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="홈택스 전자세금계산서 일괄발행 엑셀"
        description="다운로드 후 홈택스 → 전자(세금)계산서 → 일괄발행 메뉴에서 업로드"
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ht-issued">작성일자 (발행일)</Label>
            <Input
              id="ht-issued"
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ht-billing">청구구분</Label>
            <Select
              id="ht-billing"
              value={String(billingType)}
              onChange={(e) => setBillingType(Number(e.target.value) as 1 | 2)}
            >
              <option value="1">청구</option>
              <option value="2">영수</option>
            </Select>
          </div>
          <div className="rounded-md bg-background-subtle/40 px-3 py-2 text-[11px] text-foreground-muted">
            한 행 = 한 장의 세금계산서. 자재 분과 운반비 분이 한 세금계산서의 품목 1·2 로 분리되어 출력됩니다.
            거래처 폼의 대표자/업태/종목/이메일을 채워두시면 빈칸 없이 발행됩니다.
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button type="button" size="sm" onClick={onConfirm} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              엑셀 다운로드
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
