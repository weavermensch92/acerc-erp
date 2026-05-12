'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  List,
  Users,
  MapPin,
  Receipt,
  CreditCard,
  Database,
  Calendar,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOutAction } from '@/actions/auth';

interface ShellProps {
  user?: { email?: string | null };
  pendingCount?: number;
  children: React.ReactNode;
}

const navItems = [
  { id: 'dashboard', label: '대시보드', href: '/dashboard', icon: Home, enabled: true },
  { id: 'logs', label: '폐기물일보', href: '/logs', icon: List, enabled: true, hasBadge: true },
  { id: 'companies', label: '거래처', href: '/companies', icon: Users, enabled: true },
  { id: 'sites', label: '현장 관리', href: '/sites', icon: MapPin, enabled: true },
  { id: 'invoices', label: '거래명세표', href: '/invoices', icon: Receipt, enabled: true },
  { id: 'payouts', label: '지급관리', href: '/payouts', icon: CreditCard, enabled: true },
  { id: 'masters', label: '마스터', href: '/masters', icon: Database, enabled: true },
  { id: 'snapshots', label: '스냅샷', href: '/snapshots', icon: Calendar, enabled: true },
  { id: 'settings', label: '설정', href: '/settings', icon: Settings, enabled: true },
] as const;

function detectActive(pathname: string): string | null {
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/invoices')) return 'invoices';
  if (pathname.startsWith('/payouts')) return 'payouts';
  if (pathname.startsWith('/companies')) return 'companies';
  if (pathname.startsWith('/sites')) return 'sites';
  if (pathname.startsWith('/masters')) return 'masters';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/logs')) return 'logs';
  if (pathname.startsWith('/snapshots')) return 'snapshots';
  return null;
}

export function Shell({ user, pendingCount = 0, children }: ShellProps) {
  const pathname = usePathname();
  const active = detectActive(pathname);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-border bg-surface-muted print:hidden">
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold tracking-tight text-primary-foreground">
            A
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-semibold tracking-tight">에이스알앤씨</span>
            <span className="text-[10px] text-foreground-muted">폐기물일보 ERP</span>
          </div>
        </div>
        <div className="mx-3 my-2 h-px bg-border" />
        <nav className="flex flex-col gap-px px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === active;
            const showBadge = 'hasBadge' in item && item.hasBadge && pendingCount > 0;
            const baseClass = cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors',
              isActive
                ? 'border border-border bg-surface font-medium text-foreground shadow-sm'
                : 'border border-transparent text-foreground-secondary hover:bg-background-subtle',
              !item.enabled && 'pointer-events-none opacity-40',
            );
            const inner = (
              <>
                <Icon
                  className={cn(
                    'h-[15px] w-[15px]',
                    isActive ? 'text-foreground' : 'text-foreground-muted',
                  )}
                  strokeWidth={1.75}
                />
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold leading-relaxed text-primary-foreground">
                    {pendingCount}
                  </span>
                )}
              </>
            );
            if (!item.enabled) {
              return (
                <div key={item.id} className={baseClass} aria-disabled="true">
                  {inner}
                </div>
              );
            }
            return (
              <Link key={item.id} href={item.href} className={baseClass}>
                {inner}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        <div className="border-t border-border p-2.5">
          <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5">
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-background-subtle text-[11px] font-semibold text-foreground-secondary">
              공
            </div>
            <div className="flex flex-1 flex-col overflow-hidden leading-tight">
              <span className="text-[11.5px] font-medium">공용 계정</span>
              <span className="truncate text-[10px] text-foreground-muted">
                {user?.email ?? '—'}
              </span>
            </div>
            <Link
              href="/settings"
              className="rounded p-1 text-foreground-muted hover:bg-background-subtle hover:text-foreground"
              title="설정"
            >
              <Settings className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded p-1 text-foreground-muted hover:bg-danger-bg hover:text-danger"
                title="로그아웃"
                aria-label="로그아웃"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
