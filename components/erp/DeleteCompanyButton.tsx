'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/erp/Modal';
import {
  deleteCompanyAction,
  restoreCompanyAction,
} from '@/actions/companies';

interface Props {
  companyId: string;
  companyName: string;
  isDeleted: boolean;
  hasShareToken: boolean;
  logCount: number;
}

export function DeleteCompanyButton({
  companyId,
  companyName,
  isDeleted,
  hasShareToken,
  logCount,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const r = isDeleted
        ? await restoreCompanyAction(companyId)
        : await deleteCompanyAction(companyId);
      if (!r.ok) {
        setError(r.error ?? '실패');
        return;
      }
      setOpen(false);
      router.push('/companies');
      router.refresh();
    });
  };

  if (isDeleted) {
    return (
      <>
        <div className="rounded-[10px] border border-warning/40 bg-warning-bg/40 p-4">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
            <span className="text-sm font-semibold">삭제된 거래처</span>
          </div>
          <p className="mt-1 text-[11px] text-warning/90">
            기존 일보 / 명세표에는 이름이 그대로 보존되고 있습니다.
            새로 입력 / 자동완성에서는 제외 상태.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpen(true)}
            className="mt-3 w-full"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />
            복원
          </Button>
        </div>

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="거래처 복원"
          description={`"${companyName}" 을 다시 활성 상태로 되돌립니다.`}
        >
          <div className="space-y-4">
            <p className="text-xs text-foreground-muted">
              새 일보 입력·자동완성에 다시 표시됩니다. 공유링크는 자동 재발급되지
              않으니 필요 시 별도로 발급하세요.
            </p>
            {error && (
              <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                취소
              </Button>
              <Button onClick={handleConfirm} disabled={isPending} className="flex-1">
                {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}복원
              </Button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full text-danger hover:bg-danger-bg"
      >
        <Trash2 className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />
        거래처 삭제
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="거래처 삭제"
        description={`"${companyName}" 을 신규 입력 / 자동완성에서 제외합니다.`}
      >
        <div className="space-y-4">
          <div className="rounded-md border border-warning/40 bg-warning-bg/40 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" strokeWidth={1.75} />
            <strong>기존 일보 {logCount}건 / 명세표 / 통계는 그대로 유지</strong>
            됩니다. 거래처명도 보존돼서 과거 자료에 정상 표시됩니다.
          </div>
          <ul className="space-y-1 text-[11.5px] text-foreground-muted">
            <li>✓ 신규 일보 입력 시 자동완성·드롭다운에서 사라짐</li>
            <li>✓ 거래처 마스터 목록에서 사라짐 (필요 시 [삭제된 거래처] 에서 복원)</li>
            <li>✓ 거래명세표 일괄 발급 대상에서 제외</li>
            {hasShareToken && (
              <li className="text-danger">
                ⚠ 셀프 공유 링크가 즉시 무효화됩니다 (거래처가 더 이상 자기 페이지 접근 불가)
              </li>
            )}
            <li>✓ 변경 이력에 기록 + 언제든 복원 가능 (DB에 데이터 보존)</li>
          </ul>
          {error && (
            <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending}
              className="flex-1"
            >
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}삭제
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
