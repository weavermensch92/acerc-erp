import { cn } from '@/lib/utils';
import { Pill } from '@/components/erp/Pill';

type Tone = 'neutral' | 'warning' | 'danger' | 'success';

export interface DeltaInfo {
  value: number; // 차이 (절대값) 또는 백분율
  label: string; // "+12.4%" 같이 표시할 텍스트
  tone: 'success' | 'danger' | 'neutral';
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
  delta?: DeltaInfo | null;
  className?: string;
}

const toneClasses: Record<Tone, string> = {
  neutral: 'border-border',
  warning: 'border-warning/40',
  danger: 'border-danger/40',
  success: 'border-success/40',
};

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  delta,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-[10px] border bg-surface p-4 shadow-sm',
        toneClasses[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11.5px] font-medium text-foreground-muted">{label}</span>
        {delta && (
          <Pill tone={delta.tone === 'success' ? 'success' : delta.tone === 'danger' ? 'danger' : 'neutral'}>
            {delta.label}
          </Pill>
        )}
      </div>
      <span className="font-mono text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </span>
      {hint && <span className="text-[11px] text-foreground-muted">{hint}</span>}
    </div>
  );
}
