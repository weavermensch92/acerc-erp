import Link from 'next/link';
import { formatKRW } from '@/lib/format';

export interface CompanyRanking {
  id: string;
  name: string;
  amount: number;
  count: number;
}

interface Props {
  items: CompanyRanking[];
  title?: string;
}

export function TopCompaniesCard({ items, title = '거래처 Top 5' }: Props) {
  const max = Math.max(1, ...items.map((i) => i.amount));
  return (
    <div className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-foreground-muted">집계할 거래가 없습니다.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((c, idx) => {
            const pct = (c.amount / max) * 100;
            return (
              <li key={c.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <Link
                    href={`/companies/${c.id}`}
                    className="flex flex-1 items-center gap-1.5 hover:underline"
                  >
                    <span className="w-4 font-mono text-foreground-muted">
                      {idx + 1}
                    </span>
                    <span className="font-medium">{c.name}</span>
                    <span className="text-[10.5px] text-foreground-muted">
                      ({c.count}건)
                    </span>
                  </Link>
                  <span className="font-mono">{formatKRW(c.amount)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-background-subtle">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
