'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GitMerge, Loader2, AlertTriangle, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/erp/Modal';
import { cn } from '@/lib/utils';
import { mergeCompaniesAction } from '@/actions/companies';

export interface MergeCandidate {
  id: string;
  name: string;
  business_no: string | null;
}

interface Props {
  companyId: string;
  companyName: string;
  /** 대상으로 선택 가능한 활성 거래처 (자기 자신 제외) */
  candidates: MergeCandidate[];
}

const norm = (s: string) => s.trim().toLowerCase();

export function MergeCompanyButton({ companyId, companyName, candidates }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 같은 이름의 거래처를 맨 위로 (중복 정리 시 바로 선택하도록)
  const sameName = useMemo(
    () => candidates.filter((c) => norm(c.name) === norm(companyName)),
    [candidates, companyName],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.business_no ?? '').toLowerCase().includes(q),
    );
  }, [candidates, query]);

  const target = candidates.find((c) => c.id === targetId) ?? null;

  const reset = () => {
    setQuery('');
    setTargetId(null);
    setError(null);
  };

  const handleConfirm = () => {
    if (!targetId) return;
    setError(null);
    startTransition(async () => {
      const r = await mergeCompaniesAction(companyId, targetId);
      if (!r.ok) {
        setError(r.error ?? '병합 실패');
        return;
      }
      setOpen(false);
      reset();
      // 원본은 병합 후 삭제되므로 대상 거래처로 이동
      router.push(`/companies/${targetId}`);
      router.refresh();
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full"
        disabled={candidates.length === 0}
        title={
          candidates.length === 0
            ? '병합할 다른 거래처가 없습니다'
            : '이 거래처를 다른 거래처로 합칩니다'
        }
      >
        <GitMerge className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />
        거래처 병합
      </Button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title="거래처 병합"
        description={`"${companyName}" 의 모든 거래·현장을 다른 거래처로 옮기고, 이 거래처는 삭제(보관) 처리합니다.`}
      >
        <div className="space-y-4">
          <div className="rounded-md border border-warning/40 bg-warning-bg/40 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" strokeWidth={1.75} />
            병합 후 <strong>되돌리려면 옮겨진 일보를 다시 분리</strong>해야 합니다.
            같은 거래처가 중복 등록된 경우에만 사용하세요.
          </div>

          {/* 같은 이름 추천 */}
          {sameName.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-foreground-secondary">
                같은 이름의 거래처 (추천)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sameName.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setTargetId(c.id)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                      targetId === c.id
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-surface hover:bg-background-subtle',
                    )}
                  >
                    {c.name}
                    {c.business_no ? ` · ${c.business_no}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 검색 + 목록 */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-foreground-secondary">
              남길(대상) 거래처 선택
            </p>
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted"
                strokeWidth={1.75}
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="거래처명 · 사업자번호 검색"
                autoComplete="off"
                className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-[13px] placeholder:text-foreground-muted focus:border-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
            <div className="max-h-52 overflow-y-auto rounded-md border border-border">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-foreground-muted">
                  검색 결과가 없습니다.
                </p>
              ) : (
                <ul>
                  {filtered.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setTargetId(c.id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-background-subtle',
                          targetId === c.id && 'bg-info-bg/50',
                        )}
                      >
                        <span>
                          <span className="font-medium">{c.name}</span>
                          {c.business_no && (
                            <span className="ml-1.5 font-mono text-[11px] text-foreground-muted">
                              {c.business_no}
                            </span>
                          )}
                        </span>
                        {targetId === c.id && (
                          <Check className="h-3.5 w-3.5 text-info" strokeWidth={2} />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {target && (
            <p className="text-xs text-foreground-secondary">
              <strong>{companyName}</strong> →{' '}
              <strong className="text-foreground">{target.name}</strong> 로 합칩니다.
            </p>
          )}

          {error && (
            <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isPending || !targetId}
              className="flex-1"
            >
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              병합
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
