'use client';

import { Printer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  label?: string;
  className?: string;
}

export function PrintButton({ label = '인쇄 / PDF 저장', className }: Props) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-background-subtle',
        className,
      )}
    >
      <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
      {label}
    </button>
  );
}
