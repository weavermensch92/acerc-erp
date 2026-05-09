import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/erp/PageHeader';
import { StatCard, type DeltaInfo } from '@/components/erp/StatCard';
import { InOutChart, type DailyBucket } from '@/components/erp/InOutChart';
import {
  TopCompaniesCard,
  type CompanyRanking,
} from '@/components/erp/TopCompaniesCard';
import { RecentLogsCard, type RecentLog } from '@/components/erp/RecentLogsCard';
import { QuickActions } from '@/components/erp/QuickActions';
import { DateRangePicker } from '@/components/erp/DateRangePicker';
import { createClient } from '@/lib/supabase/server';
import { getReviewProcessEnabled } from '@/lib/settings';
import { formatKRW, formatNumber } from '@/lib/format';
import type { Direction } from '@/lib/types/database';
import { format, addDays, differenceInCalendarDays, parseISO, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

interface PeriodRange {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  label: string;
  days: number;
}

function parsePeriod(searchParams: { from?: string; to?: string }): PeriodRange {
  const today = new Date();
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  // 기본값: 오늘 기준 30일 전 ~ 오늘 (총 31일)
  const defTo = today;
  const defFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);

  const fromStr =
    searchParams.from && isoRe.test(searchParams.from) ? searchParams.from : fmt(defFrom);
  const toStr =
    searchParams.to && isoRe.test(searchParams.to) ? searchParams.to : fmt(defTo);

  // 잘못된 순서 보정
  let from = parseISO(fromStr);
  let to = parseISO(toStr);
  if (to < from) [from, to] = [to, from];

  const days = differenceInCalendarDays(to, from) + 1;
  // 직전 동일 길이 기간
  const prevTo = subDays(from, 1);
  const prevFrom = subDays(prevTo, days - 1);

  const sameDay = days === 1;
  const label = sameDay
    ? format(from, 'yyyy.MM.dd', { locale: ko })
    : `${format(from, 'yyyy.MM.dd', { locale: ko })} ~ ${format(to, 'yyyy.MM.dd', { locale: ko })}`;

  return {
    from: fmt(from),
    to: fmt(to),
    prevFrom: fmt(prevFrom),
    prevTo: fmt(prevTo),
    label,
    days,
  };
}

function calcDelta(current: number, previous: number): DeltaInfo | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) {
    return { value: current, label: 'NEW', tone: 'success' };
  }
  const diff = current - previous;
  const pct = (diff / previous) * 100;
  const sign = diff > 0 ? '+' : '';
  return {
    value: pct,
    label: `${sign}${pct.toFixed(1)}%`,
    tone: diff >= 0 ? 'success' : 'danger',
  };
}

type Row = {
  total_amount: number | null;
  is_invoiced: boolean;
  is_paid: boolean;
  direction: Direction;
  company_id: string;
  companies: { name: string } | null;
};

type PrevRow = {
  total_amount: number | null;
  is_invoiced: boolean;
  is_paid: boolean;
  direction: Direction;
};

interface DirectionStats {
  count: number;
  totalAmount: number;
  uninvoiced: number;
  unpaid: number;
  unpaidAmount: number;
}

function aggregate(
  rows: Array<{ total_amount: number | null; is_invoiced: boolean; is_paid: boolean; direction: Direction }>,
  dir: Direction,
): DirectionStats {
  const filtered = rows.filter((r) => r.direction === dir);
  return {
    count: filtered.length,
    totalAmount: filtered.reduce((s, r) => s + (r.total_amount ?? 0), 0),
    uninvoiced: filtered.filter((r) => !r.is_invoiced).length,
    unpaid: filtered.filter((r) => !r.is_paid).length,
    unpaidAmount: filtered
      .filter((r) => !r.is_paid)
      .reduce((s, r) => s + (r.total_amount ?? 0), 0),
  };
}

function buildTop5(rows: Row[], dir: Direction): CompanyRanking[] {
  const agg = new Map<string, { name: string; amount: number; count: number }>();
  for (const r of rows) {
    if (r.direction !== dir) continue;
    const id = r.company_id;
    const name = r.companies?.name ?? '—';
    const cur = agg.get(id) ?? { name, amount: 0, count: 0 };
    cur.amount += r.total_amount ?? 0;
    cur.count += 1;
    agg.set(id, cur);
  }
  return [...agg.entries()]
    .map(([id, v]) => ({ id, name: v.name, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

// 일별 차트용 — 너무 긴 기간(예: '전체 기간' 1900~2099) 은 메모리 폭발 방지를 위해 스킵.
const MAX_DAILY_BUCKETS = 366;
function enumerateDays(fromStr: string, toStr: string): string[] {
  const result: string[] = [];
  const start = parseISO(fromStr);
  const end = parseISO(toStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return result;
  for (let d = start, i = 0; d <= end && i < MAX_DAILY_BUCKETS; d = addDays(d, 1), i++) {
    result.push(fmt(d));
  }
  return result;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const supabase = createClient();
  const period = parsePeriod(searchParams);

  const { data: thisData } = await supabase
    .from('waste_logs')
    .select(
      `total_amount, is_invoiced, is_paid, direction, company_id,
       companies(name)`,
    )
    .gte('log_date', period.from)
    .lte('log_date', period.to)
    .eq('status', 'active');

  const { data: prevData } = await supabase
    .from('waste_logs')
    .select('total_amount, is_invoiced, is_paid, direction')
    .gte('log_date', period.prevFrom)
    .lte('log_date', period.prevTo)
    .eq('status', 'active');

  const { data: chartData } = await supabase
    .from('waste_logs')
    .select('log_date, direction, weight_kg')
    .gte('log_date', period.from)
    .lte('log_date', period.to)
    .neq('status', 'archived');

  const { data: recent } = await supabase
    .from('waste_logs')
    .select(
      `id, log_date, direction, total_amount, weight_kg, is_paid,
       companies(name), waste_types(name)`,
    )
    .neq('status', 'archived')
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5);

  const reviewEnabled = await getReviewProcessEnabled();
  let pendingCount: number | null = null;
  if (reviewEnabled) {
    const { count } = await supabase
      .from('waste_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_review');
    pendingCount = count ?? 0;
  }

  const thisRows = (thisData ?? []) as unknown as Row[];
  const prevRows = (prevData ?? []) as PrevRow[];

  const inStats = aggregate(thisRows, 'in');
  const outStats = aggregate(thisRows, 'out');
  const prevInStats = aggregate(prevRows, 'in');
  const prevOutStats = aggregate(prevRows, 'out');

  type DayRow = { log_date: string; direction: Direction; weight_kg: number | null };
  const chartTooLong = period.days > MAX_DAILY_BUCKETS;
  const chartRows = (chartData ?? []) as DayRow[];
  const dayMap = new Map<string, { inKg: number; outKg: number }>();
  let buckets: DailyBucket[] = [];
  if (!chartTooLong) {
    for (const d of enumerateDays(period.from, period.to)) {
      dayMap.set(d, { inKg: 0, outKg: 0 });
    }
    for (const r of chartRows) {
      const bucket = dayMap.get(r.log_date);
      if (!bucket) continue;
      const w = Number(r.weight_kg ?? 0);
      if (r.direction === 'in') bucket.inKg += w;
      else bucket.outKg += w;
    }
    buckets = enumerateDays(period.from, period.to).map((date) => ({
      date,
      inKg: dayMap.get(date)!.inKg,
      outKg: dayMap.get(date)!.outKg,
    }));
  }

  const topInCompanies = buildTop5(thisRows, 'in');
  const topOutCompanies = buildTop5(thisRows, 'out');

  const subtitle = `${period.label} (${period.days}일) · 직전 ${period.days}일 대비`;

  return (
    <>
      <PageHeader
        title="대시보드"
        subtitle={subtitle}
        breadcrumb={[{ label: '에이스알앤씨' }, { label: '대시보드' }]}
        actions={<DateRangePicker from={period.from} to={period.to} />}
      />
      <div className="flex-1 space-y-5 overflow-y-auto p-7">
        {pendingCount !== null && pendingCount > 0 && (
          <Link
            href="/logs?status=pending_review"
            className="flex items-center justify-between rounded-[10px] border border-warning/40 bg-warning-bg/60 px-4 py-3 text-warning transition-colors hover:bg-warning-bg"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
              <div className="flex flex-col leading-tight">
                <span className="text-[13px] font-semibold">
                  검토 대기 {pendingCount}건
                </span>
                <span className="text-[11.5px]">
                  현장에서 입력된 일보가 사무직원 검토를 기다리고 있습니다.
                </span>
              </div>
            </div>
            <span className="flex items-center gap-1 text-[12.5px] font-medium">
              검토 시작 <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
          </Link>
        )}

        {/* 반입 (매출) */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold tracking-tight">
              반입 <span className="text-foreground-muted">(매출 · 거래처 청구)</span>
            </h2>
            <Link
              href={`/logs?direction=in&from=${period.from}&to=${period.to}`}
              className="text-[11.5px] text-foreground-muted hover:underline"
            >
              반입 일보 보기 →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="반입 건수"
              value={formatNumber(inStats.count)}
              hint={period.label}
              delta={calcDelta(inStats.count, prevInStats.count)}
            />
            <StatCard
              label="매출 합계"
              value={formatKRW(inStats.totalAmount)}
              hint="VAT 포함"
              delta={calcDelta(inStats.totalAmount, prevInStats.totalAmount)}
            />
            <StatCard
              label="미청구"
              value={formatNumber(inStats.uninvoiced)}
              hint="명세표 미발급 — 클릭 시 처리"
              tone={inStats.uninvoiced > 0 ? 'warning' : 'neutral'}
              delta={calcDelta(inStats.uninvoiced, prevInStats.uninvoiced)}
              href={`/pending?type=in&kind=invoice&from=${period.from}&to=${period.to}`}
            />
            <StatCard
              label="미수금"
              value={formatKRW(inStats.unpaidAmount)}
              hint={`${inStats.unpaid}건 미입금 — 클릭 시 처리`}
              tone={inStats.unpaid > 0 ? 'danger' : 'neutral'}
              delta={calcDelta(inStats.unpaidAmount, prevInStats.unpaidAmount)}
              href={`/pending?type=in&kind=payment&from=${period.from}&to=${period.to}`}
            />
          </div>
        </section>

        {/* 반출 (매입) */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold tracking-tight">
              반출 <span className="text-foreground-muted">(매입 · 처리장 지급)</span>
            </h2>
            <Link
              href={`/logs?direction=out&from=${period.from}&to=${period.to}`}
              className="text-[11.5px] text-foreground-muted hover:underline"
            >
              반출 일보 보기 →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="반출 건수"
              value={formatNumber(outStats.count)}
              hint={period.label}
              delta={calcDelta(outStats.count, prevOutStats.count)}
            />
            <StatCard
              label="매입 합계"
              value={formatKRW(outStats.totalAmount)}
              hint="VAT 포함"
              delta={calcDelta(outStats.totalAmount, prevOutStats.totalAmount)}
            />
            <StatCard
              label="미정산"
              value={formatNumber(outStats.uninvoiced)}
              hint="청구서 미수령 — 클릭 시 처리"
              tone={outStats.uninvoiced > 0 ? 'warning' : 'neutral'}
              delta={calcDelta(outStats.uninvoiced, prevOutStats.uninvoiced)}
              href={`/pending?type=out&kind=invoice&from=${period.from}&to=${period.to}`}
            />
            <StatCard
              label="미지급"
              value={formatKRW(outStats.unpaidAmount)}
              hint={`${outStats.unpaid}건 미지급 — 클릭 시 처리`}
              tone={outStats.unpaid > 0 ? 'danger' : 'neutral'}
              delta={calcDelta(outStats.unpaidAmount, prevOutStats.unpaidAmount)}
              href={`/pending?type=out&kind=payment&from=${period.from}&to=${period.to}`}
            />
          </div>
        </section>

        {/* 차트 + Top5 */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
          <div className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
            {chartTooLong ? (
              <div className="flex h-40 items-center justify-center text-center text-[12px] text-foreground-muted">
                선택 기간이 너무 길어 일별 차트를 생략합니다 ({period.days}일).
                <br />
                기간을 366일 이하로 좁히면 차트가 표시됩니다.
              </div>
            ) : (
              <InOutChart
                buckets={buckets}
                title={`${period.label} 일별 반입·반출`}
              />
            )}
          </div>
          <div className="space-y-3">
            <TopCompaniesCard items={topInCompanies} title="매출 Top 5 (반입)" />
            <TopCompaniesCard items={topOutCompanies} title="매입 Top 5 (반출)" />
          </div>
        </div>

        {/* 최근 거래 + 빠른작업 */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
          <RecentLogsCard logs={(recent ?? []) as unknown as RecentLog[]} />
          <QuickActions />
        </div>
      </div>
    </>
  );
}
