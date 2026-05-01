import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Pill } from '@/components/erp/Pill';
import { formatKRW, formatKg, formatDate } from '@/lib/format';
import type { Direction } from '@/lib/types/database';

export interface RecentLog {
  id: string;
  log_date: string;
  direction: Direction;
  total_amount: number | null;
  weight_kg: number | null;
  is_paid: boolean;
  companies: { name: string } | null;
  waste_types: { name: string } | null;
}

interface Props {
  logs: RecentLog[];
}

const directionLabel: Record<Direction, string> = { in: '반입', out: '반출' };

export function RecentLogsCard({ logs }: Props) {
  return (
    <div className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight">최근 거래</h3>
        <Link
          href="/logs"
          className="flex items-center gap-1 text-[11px] text-foreground-muted hover:text-foreground"
        >
          전체 목록
          <ChevronRight className="h-3 w-3" strokeWidth={1.75} />
        </Link>
      </div>
      {logs.length === 0 ? (
        <p className="mt-3 text-xs text-foreground-muted">최근 거래가 없습니다.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {logs.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 border-b border-divider pb-1.5 text-xs last:border-0"
            >
              <Link
                href={`/logs/${row.id}`}
                className="flex flex-1 items-center gap-2 hover:underline"
              >
                <span className="w-16 font-mono text-foreground-muted">
                  {formatDate(row.log_date)}
                </span>
                <Pill tone={row.direction === 'in' ? 'info' : 'primary'}>
                  {directionLabel[row.direction]}
                </Pill>
                <span className="font-medium">{row.companies?.name ?? '—'}</span>
                <span className="text-foreground-muted">{row.waste_types?.name ?? '—'}</span>
                <span className="font-mono text-foreground-muted">
                  {formatKg(row.weight_kg)}
                </span>
              </Link>
              <div className="flex items-center gap-2">
                <span className="font-mono">{formatKRW(row.total_amount)}</span>
                <Pill tone={row.is_paid ? 'success' : 'warning'}>
                  {row.is_paid ? '완료' : '대기'}
                </Pill>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
