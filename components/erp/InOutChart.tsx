import { formatNumber } from '@/lib/format';

export interface DailyBucket {
  date: string; // YYYY-MM-DD
  inKg: number;
  outKg: number;
}

interface Props {
  buckets: DailyBucket[]; // 14일치 가정
  height?: number;
}

// SVG 직접 — recharts 의존성 회피, 번들 가벼움
export function InOutChart({ buckets, height = 160 }: Props) {
  const max = Math.max(1, ...buckets.flatMap((b) => [b.inKg, b.outKg]));
  const totalIn = buckets.reduce((s, b) => s + b.inKg, 0);
  const totalOut = buckets.reduce((s, b) => s + b.outKg, 0);

  const W = 600;
  const H = height;
  const padX = 24;
  const padY = 20;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const groupW = innerW / Math.max(1, buckets.length);
  const barW = Math.max(2, (groupW - 4) / 2);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold tracking-tight">최근 14일 반입·반출</span>
          <span className="text-[11px] text-foreground-muted">단위: kg</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-info" />
            반입 <span className="font-mono">{formatNumber(totalIn)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-foreground" />
            반출 <span className="font-mono">{formatNumber(totalOut)}</span>
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        {/* y-axis grid 4 lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((r) => {
          const y = padY + innerH * (1 - r);
          return (
            <line
              key={r}
              x1={padX}
              x2={W - padX}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeWidth="1"
              className="text-foreground"
            />
          );
        })}

        {buckets.map((b, i) => {
          const groupX = padX + i * groupW;
          const inH = innerH * (b.inKg / max);
          const outH = innerH * (b.outKg / max);
          const inX = groupX + (groupW - barW * 2 - 2) / 2;
          const outX = inX + barW + 2;
          const showLabel = i === 0 || i === buckets.length - 1 || i === Math.floor(buckets.length / 2);
          return (
            <g key={b.date}>
              {b.inKg > 0 && (
                <rect
                  x={inX}
                  y={padY + innerH - inH}
                  width={barW}
                  height={inH}
                  className="fill-info"
                  rx="1"
                />
              )}
              {b.outKg > 0 && (
                <rect
                  x={outX}
                  y={padY + innerH - outH}
                  width={barW}
                  height={outH}
                  className="fill-foreground"
                  rx="1"
                />
              )}
              {showLabel && (
                <text
                  x={groupX + groupW / 2}
                  y={H - 4}
                  textAnchor="middle"
                  className="fill-foreground-muted text-[9px]"
                  fontFamily="ui-monospace, monospace"
                >
                  {b.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
