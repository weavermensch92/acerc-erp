'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toggleReviewProcessAction } from '@/actions/settings';

interface Props {
  initialEnabled: boolean;
}

export function ReviewProcessToggle({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    const next = !enabled;
    setError(null);
    setEnabled(next); // optimistic
    startTransition(async () => {
      const r = await toggleReviewProcessAction(next);
      if (!r.ok) {
        setEnabled(!next); // rollback
        setError(r.error ?? '저장 실패');
      }
    });
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        aria-pressed={enabled}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          enabled ? 'bg-foreground' : 'bg-border-strong',
          isPending && 'opacity-60',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow ring-0 transition-transform',
            enabled ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-medium">
          {enabled ? '활성 (ON)' : '비활성 (OFF · 기본)'}
        </span>
        <span className="text-[11px] text-foreground-muted">
          {enabled
            ? '검토 대기 배너 / 승인·반려 버튼 / "검토 대기" 필터가 표시됩니다.'
            : '모든 일보가 바로 정식 등록 됩니다.'}
        </span>
      </div>
      {isPending && <Loader2 className="h-4 w-4 animate-spin text-foreground-muted" />}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
