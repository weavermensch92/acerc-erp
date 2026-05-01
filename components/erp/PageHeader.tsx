import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-shrink-0 items-end justify-between gap-4 border-b border-border bg-surface px-7 pb-4 pt-5 print:hidden',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-foreground-muted">
            {breadcrumb.map((b, i) => {
              const isLast = i === breadcrumb.length - 1;
              const labelClass = isLast ? 'text-foreground-secondary' : '';
              return (
                <span key={`${b.label}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" strokeWidth={1.75} />}
                  {b.href && !isLast ? (
                    <Link href={b.href} className={cn('hover:text-foreground', labelClass)}>
                      {b.label}
                    </Link>
                  ) : (
                    <span className={labelClass}>{b.label}</span>
                  )}
                </span>
              );
            })}
          </div>
        )}
        <h1 className="text-[19px] font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-foreground-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
