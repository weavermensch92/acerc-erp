import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

interface PillProps {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}

const toneClasses: Record<Tone, { container: string; dot: string }> = {
  neutral: { container: 'bg-background-subtle text-foreground-secondary', dot: 'bg-foreground-muted' },
  success: { container: 'bg-success-bg text-success', dot: 'bg-success' },
  warning: { container: 'bg-warning-bg text-warning', dot: 'bg-warning' },
  danger: { container: 'bg-danger-bg text-danger', dot: 'bg-danger' },
  info: { container: 'bg-info-bg text-info', dot: 'bg-info' },
  primary: { container: 'bg-foreground/[0.06] text-foreground', dot: 'bg-foreground' },
};

export function Pill({ children, tone = 'neutral', dot = false, className }: PillProps) {
  const c = toneClasses[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-px text-[10.5px] font-medium leading-relaxed',
        c.container,
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />}
      {children}
    </span>
  );
}
