'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Props {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
const display = (d: string) => format(new Date(d), 'yyyy.MM.dd', { locale: ko });

interface Preset {
  label: string;
  range: () => { from: Date; to: Date };
}

function buildPresets(): Preset[] {
  const today = new Date();
  return [
    { label: '오늘', range: () => ({ from: today, to: today }) },
    { label: '어제', range: () => ({ from: subDays(today, 1), to: subDays(today, 1) }) },
    { label: '최근 7일', range: () => ({ from: subDays(today, 6), to: today }) },
    { label: '최근 30일', range: () => ({ from: subDays(today, 29), to: today }) },
    {
      label: '이번달',
      range: () => ({ from: startOfMonth(today), to: endOfMonth(today) }),
    },
    {
      label: '지난달',
      range: () => {
        const prev = subMonths(today, 1);
        return { from: startOfMonth(prev), to: endOfMonth(prev) };
      },
    },
    {
      label: '최근 3개월',
      range: () => ({ from: startOfMonth(subMonths(today, 2)), to: today }),
    },
  ];
}

export function DateRangePicker({ from, to }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 캘린더 좌측 month (우측은 +1)
  const [leftMonth, setLeftMonth] = useState<Date>(() => {
    const d = new Date(from);
    return startOfMonth(d);
  });

  // 선택 진행 상태: pending 시작은 있는데 끝이 안 정해졌을 때
  const [pendingStart, setPendingStart] = useState<Date | null>(null);
  const [hover, setHover] = useState<Date | null>(null);

  const fromDate = new Date(from);
  const toDate = new Date(to);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const apply = (a: Date, b: Date) => {
    const [start, end] = isAfter(a, b) ? [b, a] : [a, b];
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', fmt(start));
    params.set('to', fmt(end));
    setOpen(false);
    setPendingStart(null);
    setHover(null);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const handleDayClick = (day: Date) => {
    if (!pendingStart) {
      setPendingStart(day);
      setHover(day);
      return;
    }
    apply(pendingStart, day);
  };

  const handlePreset = (p: Preset) => {
    const r = p.range();
    apply(r.from, r.to);
  };

  // 표시 hover range 결정
  const previewStart = pendingStart ?? fromDate;
  const previewEnd = pendingStart ? hover ?? pendingStart : toDate;
  const [rangeStart, rangeEnd] = (() => {
    if (!previewStart || !previewEnd) return [null, null];
    return isAfter(previewStart, previewEnd)
      ? [previewEnd, previewStart]
      : [previewStart, previewEnd];
  })();

  const triggerLabel = isSameDay(fromDate, toDate)
    ? display(from)
    : `${display(from)} ~ ${display(to)}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-medium shadow-sm hover:bg-background-subtle"
      >
        <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span className="font-mono">{triggerLabel}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 flex w-[680px] min-w-[680px] rounded-lg border border-border bg-surface shadow-lg">
          {/* 프리셋 패널 */}
          <div className="flex w-28 flex-shrink-0 flex-col gap-0.5 border-r border-border p-2">
            {buildPresets().map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handlePreset(p)}
                className="whitespace-nowrap rounded px-3 py-1.5 text-left text-[12px] font-medium text-foreground-secondary hover:bg-background-subtle"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 캘린더 패널 */}
          <div className="min-w-0 flex-1 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setLeftMonth((m) => subMonths(m, 1))}
                className="flex-shrink-0 rounded p-1 hover:bg-background-subtle"
                aria-label="이전 달"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <div className="flex flex-1 items-center justify-around whitespace-nowrap text-[12.5px] font-semibold">
                <span>{format(leftMonth, 'yyyy년 M월', { locale: ko })}</span>
                <span>{format(addMonths(leftMonth, 1), 'yyyy년 M월', { locale: ko })}</span>
              </div>
              <button
                type="button"
                onClick={() => setLeftMonth((m) => addMonths(m, 1))}
                className="flex-shrink-0 rounded p-1 hover:bg-background-subtle"
                aria-label="다음 달"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="flex justify-between gap-4">
              <MonthGrid
                month={leftMonth}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                pendingStart={pendingStart}
                onDayClick={handleDayClick}
                onDayHover={(d) => pendingStart && setHover(d)}
              />
              <MonthGrid
                month={addMonths(leftMonth, 1)}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                pendingStart={pendingStart}
                onDayClick={handleDayClick}
                onDayHover={(d) => pendingStart && setHover(d)}
              />
            </div>

            {/* 안내 + 닫기 */}
            <div className="mt-2 flex items-center justify-between border-t border-divider pt-2 text-[11px]">
              <span className="whitespace-nowrap text-foreground-muted">
                {pendingStart
                  ? `시작: ${format(pendingStart, 'yyyy.MM.dd')} — 종료일을 선택하세요`
                  : '시작일 → 종료일 순으로 클릭'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setPendingStart(null);
                  setHover(null);
                }}
                className="whitespace-nowrap rounded px-2 py-0.5 text-foreground-muted hover:bg-background-subtle"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface MonthGridProps {
  month: Date;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  pendingStart: Date | null;
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date) => void;
}

const WEEK_HEADERS = ['일', '월', '화', '수', '목', '금', '토'];

function MonthGrid({
  month,
  rangeStart,
  rangeEnd,
  pendingStart,
  onDayClick,
  onDayHover,
}: MonthGridProps) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  // 일요일 시작 (getDay: 0=일)
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay());
  const today = new Date();

  const days: Date[] = [];
  for (let d = gridStart; !isAfter(d, gridEnd); d = addDays(d, 1)) {
    days.push(d);
  }

  return (
    <div className="flex-shrink-0 space-y-1">
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-foreground-muted">
        {WEEK_HEADERS.map((w) => (
          <div key={w} className="w-8 py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d) => {
          const inMonth = isSameMonth(d, month);
          const isToday = isSameDay(d, today);
          const isInRange =
            rangeStart && rangeEnd && !isBefore(d, rangeStart) && !isAfter(d, rangeEnd);
          const isStart = rangeStart && isSameDay(d, rangeStart);
          const isEnd = rangeEnd && isSameDay(d, rangeEnd);
          const isPendingStart = pendingStart && isSameDay(d, pendingStart);

          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onDayClick(d)}
              onMouseEnter={() => onDayHover(d)}
              className={cn(
                'flex h-8 w-8 flex-shrink-0 items-center justify-center text-[11.5px] font-medium transition-colors',
                inMonth ? 'text-foreground' : 'text-foreground-dim',
                isInRange && !isStart && !isEnd && 'bg-info-bg/60',
                (isStart || isEnd || isPendingStart) &&
                  'rounded-md bg-foreground text-background',
                !isInRange && !isStart && !isEnd && !isPendingStart &&
                  'rounded-md hover:bg-background-subtle',
                isToday && !isInRange && !isStart && !isEnd && 'ring-1 ring-foreground/40',
              )}
            >
              {format(d, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
