import Link from 'next/link';
import { Plus, Receipt, Users, Camera } from 'lucide-react';

const actions = [
  { href: '/logs/new', label: '새 일보 입력', hint: '시나리오 2', Icon: Plus },
  { href: '/invoices', label: '거래명세표 발급', hint: '시나리오 4', Icon: Receipt },
  { href: '/companies', label: '거래처 관리', hint: 'CRUD + 공유링크', Icon: Users },
  { href: '/snapshots', label: '스냅샷', hint: '과거 시점 조회', Icon: Camera },
] as const;

export function QuickActions() {
  return (
    <div className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-[13px] font-semibold tracking-tight">빠른 작업</h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {actions.map((a) => {
          const Icon = a.Icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group flex flex-col gap-1.5 rounded-md border border-border bg-background-subtle p-3 transition-colors hover:bg-surface"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface group-hover:bg-background-subtle">
                <Icon
                  className="h-4 w-4 text-foreground-secondary"
                  strokeWidth={1.75}
                />
              </div>
              <div>
                <div className="text-xs font-semibold">{a.label}</div>
                <div className="mt-0.5 text-[10.5px] text-foreground-muted">{a.hint}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
