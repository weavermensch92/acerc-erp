'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Send, AlertTriangle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { formatKRW, formatNumber, formatMonth } from '@/lib/format';
import { cn } from '@/lib/utils';
import { createInvoiceBatchAction } from '@/actions/invoices';

interface CompanyAgg {
  id: string;
  name: string;
  share_token: string | null;
  count: number;
  total: number;
  unpaid: number;
  unpaidCount: number;
}

interface Props {
  aggList: CompanyAgg[];
  monthKey: string;
  from: string;
  to: string;
}

function buildMonthOptions() {
  const now = new Date();
  const out: Array<{ value: string; label: string }> = [];
  for (let i = -12; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ value, label: formatMonth(d) });
  }
  return out.reverse();
}

export function BatchForm({ aggList, monthKey, from, to }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [period, setPeriod] = useState(monthKey);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handlePeriodChange = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', period);
    router.push(`/invoices/new?${params.toString()}`);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(aggList.map((a) => a.id)));
  const selectUnpaidOnly = () =>
    setSelected(new Set(aggList.filter((a) => a.unpaidCount > 0).map((a) => a.id)));
  const clearAll = () => setSelected(new Set());

  const summary = useMemo(() => {
    const sel = aggList.filter((a) => selected.has(a.id));
    return {
      count: sel.length,
      total: sel.reduce((s, a) => s + a.total, 0),
      logCount: sel.reduce((s, a) => s + a.count, 0),
    };
  }, [aggList, selected]);

  const handleSubmit = () => {
    if (selected.size === 0) {
      setError('거래처를 1개 이상 선택하세요');
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await createInvoiceBatchAction({
        period_from: from,
        period_to: to,
        company_ids: [...selected],
        note: note.trim() || null,
      });
      if (!r.ok) setError(r.error ?? '실패');
      // 성공 시 server redirect
    });
  };

  const monthOptions = buildMonthOptions();

  return (
    <div className="space-y-5">
      {/* 기간 + 일괄 액션 */}
      <section className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
        <h3 className="text-[13px] font-semibold tracking-tight">1. 기간</h3>
        <form onSubmit={handlePeriodChange} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="bf-period">대상 월</Label>
            <Select
              id="bf-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="min-w-[160px]"
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="outline" size="sm">
            <Search className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />적용
          </Button>
          <span className="text-[11.5px] text-foreground-muted">
            {from} ~ {to} · 거래 있는 거래처 {aggList.length}곳
          </span>
        </form>
      </section>

      {/* 거래처 선택 */}
      <section className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold tracking-tight">
            2. 대상 거래처 선택
          </h3>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={selectAll}>
              전체
            </Button>
            <Button size="sm" variant="ghost" onClick={selectUnpaidOnly}>
              미결제만
            </Button>
            <Button size="sm" variant="ghost" onClick={clearAll}>
              해제
            </Button>
          </div>
        </div>

        {aggList.length === 0 ? (
          <p className="mt-3 text-xs text-foreground-muted">
            해당 월에 거래가 있는 거래처가 없습니다.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-divider">
            {aggList.map((a) => {
              const checked = selected.has(a.id);
              return (
                <li key={a.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-3 px-2 py-2.5 text-sm transition-colors',
                      checked ? 'bg-foreground/5' : 'hover:bg-background-subtle',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(a.id)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <div className="flex flex-1 items-center gap-3">
                      <span className="font-medium">{a.name}</span>
                      {a.unpaidCount > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-danger-bg px-1.5 py-px text-[10px] font-semibold text-danger">
                          <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                          미결제 {a.unpaidCount}건
                        </span>
                      )}
                      {!a.share_token && (
                        <span className="text-[10.5px] text-foreground-muted">
                          공유링크 미발급
                        </span>
                      )}
                    </div>
                    <span className="text-[11.5px] text-foreground-muted">
                      {a.count}건
                    </span>
                    <span className="w-32 text-right font-mono text-sm">
                      {formatKRW(a.total)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 비고 */}
      <section className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
        <h3 className="text-[13px] font-semibold tracking-tight">3. 비고 (선택)</h3>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="예: 4월 정기 발송"
          className="mt-3"
        />
      </section>

      {/* 합계 + 발급 */}
      <section className="sticky bottom-4 flex items-center justify-between gap-4 rounded-[10px] border border-foreground bg-surface p-4 shadow-md">
        <div className="text-sm">
          <div className="text-[11px] text-foreground-muted">선택 합계</div>
          <div className="mt-0.5 flex items-baseline gap-3">
            <span className="font-mono text-lg font-semibold">{summary.count}</span>
            <span className="text-[11.5px] text-foreground-muted">거래처</span>
            <span className="font-mono text-lg font-semibold">{summary.logCount}</span>
            <span className="text-[11.5px] text-foreground-muted">건</span>
            <span className="font-mono text-lg font-semibold">
              {formatKRW(summary.total)}
            </span>
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-danger">
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
            {error}
          </div>
        )}
        <Button
          onClick={handleSubmit}
          disabled={isPending || selected.size === 0}
          size="lg"
        >
          {isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1 h-4 w-4" strokeWidth={1.75} />
          )}
          {summary.count}곳 발급
        </Button>
      </section>
    </div>
  );
}
