'use client';

import { useState, useTransition } from 'react';
import { Loader2, Copy, Link2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/erp/Modal';
import {
  regenerateShareTokenAction,
  revokeShareTokenAction,
} from '@/actions/companies';

interface Props {
  companyId: string;
  initialToken: string | null;
  appUrl: string;
}

export function ShareTokenPanel({ companyId, initialToken, appUrl }: Props) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const fullUrl = token ? `${appUrl}/share/${token}` : '';

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      const r = await regenerateShareTokenAction(companyId);
      if (!r.ok) {
        setError(r.error ?? '실패');
        return;
      }
      setToken(r.token ?? null);
    });
  };

  const handleRevoke = () => {
    setError(null);
    startTransition(async () => {
      const r = await revokeShareTokenAction(companyId);
      if (!r.ok) {
        setError(r.error ?? '실패');
        return;
      }
      setToken(null);
      setConfirmRevoke(false);
    });
  };

  const handleCopy = async () => {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('복사 실패 — 수동으로 복사해주세요');
    }
  };

  return (
    <div className="space-y-3 rounded-[10px] border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight">거래처 공유 링크</h3>
        <Link2 className="h-3.5 w-3.5 text-foreground-muted" strokeWidth={1.75} />
      </div>

      {token ? (
        <>
          <p className="text-[11px] text-foreground-muted">
            이 거래처가 본인 거래내역을 셀프 조회할 수 있는 링크 (인증 없음).
          </p>
          <div className="rounded-md border border-border bg-background-subtle px-3 py-2 font-mono text-[11px] break-all">
            {fullUrl}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              disabled={isPending}
              className="flex-1"
            >
              <Copy className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />
              {copied ? '복사됨' : '링크 복사'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerate}
              disabled={isPending}
              title="새 토큰 발급 — 기존 링크는 즉시 무효화됨"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmRevoke(true)}
              disabled={isPending}
              title="공유 링크 회수 (토큰 삭제)"
            >
              <Trash2 className="h-3.5 w-3.5 text-danger" strokeWidth={1.75} />
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] text-foreground-muted">
            공유 링크가 없습니다. 발급하면 거래처에 카톡 / 문자로 보낼 수 있습니다.
          </p>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-1 h-4 w-4" strokeWidth={1.75} />
            )}
            공유 링크 발급
          </Button>
        </>
      )}

      {error && (
        <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">{error}</div>
      )}

      <Modal
        open={confirmRevoke}
        onClose={() => setConfirmRevoke(false)}
        title="공유 링크 회수"
        description="기존 링크는 즉시 무효화됩니다. 거래처가 더 이상 셀프 조회 페이지에 접근할 수 없게 됩니다."
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground-secondary">
            정말 회수하시겠습니까? 다시 발급하려면 새 토큰을 생성해야 합니다.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmRevoke(false)}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRevoke}
              disabled={isPending}
              className="flex-1"
            >
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}회수
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
