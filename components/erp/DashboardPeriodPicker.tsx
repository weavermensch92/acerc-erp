'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Calendar, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  mode: 'daily' | 'monthly';
  date: string; // YYYY-MM-DD (daily) — daily 일 때만 의미
  month: string; // YYYY-MM (monthly) — monthly 일 때만 의미
}

export function DashboardPeriodPicker({ mode, date, month }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const update = (next: { mode: 'daily' | 'monthly'; date?: string; month?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('mode', next.mode);
    if (next.mode === 'daily') {
      params.delete('month');
      if (next.date) params.set('date', next.date);
    } else {
      params.delete('date');
      if (next.month) params.set('month', next.month);
    }
    startTransition(() => router.push(`/dashboard?${params.toString()}`));
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const thisMonthStr = todayStr.slice(0, 7);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 모드 토글 */}
      <div className="inline-flex rounded-md border border-border bg-surface p-0.5 shadow-sm">
        <button
          type="button"
          onClick={() => update({ mode: 'daily', date: date || todayStr })}
          className={cn(
            'inline-flex items-center gap-1 rounded px-3 py-1 text-[11.5px] font-medium transition-colors',
            mode === 'daily'
              ? 'bg-foreground text-background'
              : 'text-foreground-secondary hover:bg-background-subtle',
          )}
          disabled={isPending}
        >
          <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
          일간
        </button>
        <button
          type="button"
          onClick={() => update({ mode: 'monthly', month: month || thisMonthStr })}
          className={cn(
            'inline-flex items-center gap-1 rounded px-3 py-1 text-[11.5px] font-medium transition-colors',
            mode === 'monthly'
              ? 'bg-foreground text-background'
              : 'text-foreground-secondary hover:bg-background-subtle',
          )}
          disabled={isPending}
        >
          <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
          월간
        </button>
      </div>

      {/* 날짜/월 선택 */}
      {mode === 'daily' ? (
        <input
          type="date"
          value={date}
          max={todayStr}
          onChange={(e) => update({ mode: 'daily', date: e.target.value })}
          disabled={isPending}
          className="h-7 rounded-md border border-border bg-surface px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        />
      ) : (
        <input
          type="month"
          value={month}
          max={thisMonthStr}
          onChange={(e) => update({ mode: 'monthly', month: e.target.value })}
          disabled={isPending}
          className="h-7 rounded-md border border-border bg-surface px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        />
      )}

      {/* 빠른 이동 */}
      <button
        type="button"
        onClick={() =>
          update(
            mode === 'daily'
              ? { mode: 'daily', date: todayStr }
              : { mode: 'monthly', month: thisMonthStr },
          )
        }
        disabled={isPending}
        className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground-secondary hover:bg-background-subtle"
      >
        {mode === 'daily' ? '오늘' : '이번달'}
      </button>
    </div>
  );
}
