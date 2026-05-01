'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Loader2, Check, X, Edit, FileText, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/erp/Modal';
import { approveLogAction, rejectLogAction } from '@/actions/waste-logs';
import type { LogStatus } from '@/lib/types/database';

interface Props {
  logId: string;
  status: LogStatus;
  reviewEnabled: boolean;
}

export function LogActions({ logId, status, reviewEnabled }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const r = await approveLogAction(logId);
      if (r?.error) setError(r.error);
      // 성공 시 server 가 redirect — 여기 도달 안 함
    });
  };

  const handleReject = () => {
    setError(null);
    startTransition(async () => {
      const r = await rejectLogAction(logId, rejectReason);
      if (r?.error) {
        setError(r.error);
        return;
      }
      // 성공 시 redirect
    });
  };

  return (
    <div className="space-y-3 rounded-[10px] border border-border bg-surface p-4 shadow-sm">
      <h3 className="text-[13px] font-semibold tracking-tight">액션</h3>

      {status === 'pending_review' && reviewEnabled && (
        <div className="space-y-2">
          <Button onClick={handleApprove} disabled={isPending} className="w-full">
            {isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-1 h-4 w-4" strokeWidth={1.75} />
            )}
            승인
          </Button>
          <Button
            variant="outline"
            onClick={() => setRejectOpen(true)}
            disabled={isPending}
            className="w-full"
          >
            <X className="mr-1 h-4 w-4" strokeWidth={1.75} />반려
          </Button>
        </div>
      )}

      {status === 'pending_review' && !reviewEnabled && (
        <div className="space-y-2">
          <Link href={`/logs/${logId}/edit`} className="block">
            <Button variant="outline" className="w-full">
              <Edit className="mr-1 h-4 w-4" strokeWidth={1.75} />수정
            </Button>
          </Link>
          <p className="text-[11px] text-foreground-muted">
            검토 프로세스가 꺼져 있어 승인/반려는 숨겨져 있습니다.
            <br />
            <span className="text-foreground">설정</span> 에서 켤 수 있습니다.
          </p>
        </div>
      )}

      {status === 'active' && (
        <div className="space-y-2">
          <Link href={`/logs/${logId}/edit`} className="block">
            <Button variant="outline" className="w-full">
              <Edit className="mr-1 h-4 w-4" strokeWidth={1.75} />수정
            </Button>
          </Link>
          <p className="text-[11px] text-foreground-muted">
            수정 시 변경 이력이 audit_logs 에 자동 기록됩니다.
          </p>
        </div>
      )}

      {status === 'archived' && (
        <div className="space-y-2">
          <Link href={`/logs/${logId}/edit`} className="block">
            <Button variant="outline" className="w-full">
              <Edit className="mr-1 h-4 w-4" strokeWidth={1.75} />수정
            </Button>
          </Link>
          <p className="text-[11px] text-foreground-muted">
            보관(반려) 상태입니다. 수정 가능합니다.
          </p>
        </div>
      )}

      {status === 'draft' && (
        <p className="text-xs text-foreground-muted">임시저장 상태입니다.</p>
      )}

      {error && (
        <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">{error}</div>
      )}

      {/* 문서 발급 — pending_review / active 일 때 노출 */}
      {(status === 'active' || status === 'pending_review') && (
        <div className="space-y-1.5 border-t border-divider pt-3">
          <p className="text-[10.5px] font-medium text-foreground-muted">문서 발급</p>
          <Link href={`/logs/${logId}/certificate`} className="block">
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <FileText className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
              처리확인서
            </Button>
          </Link>
          <Link href={`/logs/${logId}/weight-cert`} className="block">
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <Scale className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
              계량증명서 (3부)
            </Button>
          </Link>
        </div>
      )}

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="일보 반려"
        description="반려 사유는 변경 이력에 기록됩니다. 일보는 보관(archived)으로 처리됩니다."
      >
        <div className="space-y-4">
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="예: 사진 누락, 거래처 확인 필요"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectOpen(false)}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleReject}
              disabled={isPending || !rejectReason.trim()}
              className="flex-1"
            >
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}반려 처리
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
