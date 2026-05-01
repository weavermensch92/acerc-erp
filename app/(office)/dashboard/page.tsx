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
import { createClient } from '@/lib/supabase/server';
import { getReviewProcessEnabled } from '@/lib/settings';
import { formatKRW, formatNumber, formatMonth } from '@/lib/format';
import type { Direction } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

function getMonthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end), label: formatMonth(start) };
}

function getLast14Days(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
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

export default async function DashboardPage() {
  const supabase = createClient();
  const { start: thisStart, end: thisEnd, label: monthLabel } = getMonthRange(0);
  const { start: prevStart, end: prevEnd } = getMonthRange(-1);

  // 이번달 active 일보
  const { data: thisMonth } = await supabase
    .from('waste_logs')
    .select(
      `total_amount, is_invoiced, is_paid, company_id,
       companies(name)`,
    )
    .gte('log_date', thisStart)
    .lte('log_date', thisEnd)
    .eq('status', 'active');

  // 전월 (delta 계산용 — count + total_amount 만)
  const { data: prevMonth } = await supabase
    .from('waste_logs')
    .select('total_amount, is_invoiced, is_paid')
    .gte('log_date', prevStart)
    .lte('log_date', prevEnd)
    .eq('status', 'active');

  // 14일 일별 in/out
  const { data: last14 } = await supabase
    .from('waste_logs')
    .select('log_date, direction, weight_kg')
    .gte('log_date', getLast14Days()[0])
    .neq('status', 'archived');

  // 최근 5건
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

  // 검토 대기 (review on 일 때만)
  const reviewEnabled = await getReviewProcessEnabled();
  let pendingCount: number | null = null;
  if (reviewEnabled) {
    const { count } = await supabase
      .from('waste_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_review');
    pendingCount = count ?? 0;
  }

  // ========== 집계 ==========
  type ThisRow = {
    total_amount: number | null;
    is_invoiced: boolean;
    is_paid: boolean;
    company_id: string;
    companies: { name: string } | null;
  };
  const thisRows = (thisMonth ?? []) as unknown as ThisRow[];
  const prevRows = (prevMonth ?? []) as Array<{
    total_amount: number | null;
    is_invoiced: boolean;
    is_paid: boolean;
  }>;

  const stats = {
    count: thisRows.length,
    totalAmount: thisRows.reduce((s, r) => s + (r.total_amount ?? 0), 0),
    uninvoiced: thisRows.filter((r) => !r.is_invoiced).length,
    unpaid: thisRows.filter((r) => !r.is_paid).length,
  };
  const prevStats = {
    count: prevRows.length,
    totalAmount: prevRows.reduce((s, r) => s + (r.total_amount ?? 0), 0),
    uninvoiced: prevRows.filter((r) => !r.is_invoiced).length,
    unpaid: prevRows.filter((r) => !r.is_paid).length,
  };

  // 14일 일별
  type DayRow = { log_date: string; direction: Direction; weight_kg: number | null };
  const last14Rows = (last14 ?? []) as DayRow[];
  const dayMap = new Map<string, { inKg: number; outKg: number }>();
  for (const d of getLast14Days()) dayMap.set(d, { inKg: 0, outKg: 0 });
  for (const r of last14Rows) {
    const bucket = dayMap.get(r.log_date);
    if (!bucket) continue;
    const w = Number(r.weight_kg ?? 0);
    if (r.direction === 'in') bucket.inKg += w;
    else bucket.outKg += w;
  }
  const buckets: DailyBucket[] = getLast14Days().map((date) => ({
    date,
    inKg: dayMap.get(date)!.inKg,
    outKg: dayMap.get(date)!.outKg,
  }));

  // Top5 거래처 (이번달, total_amount 합 기준)
  const companyAgg = new Map<string, { name: string; amount: number; count: number }>();
  for (const r of thisRows) {
    const id = r.company_id;
    const name = r.companies?.name ?? '—';
    const cur = companyAgg.get(id) ?? { name, amount: 0, count: 0 };
    cur.amount += r.total_amount ?? 0;
    cur.count += 1;
    companyAgg.set(id, cur);
  }
  const top5: CompanyRanking[] = [...companyAgg.entries()]
    .map(([id, v]) => ({ id, name: v.name, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="대시보드"
        subtitle={`${monthLabel} 운영 요약`}
        breadcrumb={[{ label: '에이스알앤씨' }, { label: '대시보드' }]}
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

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="이번달 건수"
            value={formatNumber(stats.count)}
            hint={monthLabel}
            delta={calcDelta(stats.count, prevStats.count)}
          />
          <StatCard
            label="청구 합계"
            value={formatKRW(stats.totalAmount)}
            hint="VAT 포함"
            delta={calcDelta(stats.totalAmount, prevStats.totalAmount)}
          />
          <StatCard
            label="미청구"
            value={formatNumber(stats.uninvoiced)}
            hint="명세표 미발급"
            tone={stats.uninvoiced > 0 ? 'warning' : 'neutral'}
            delta={calcDelta(stats.uninvoiced, prevStats.uninvoiced)}
          />
          <StatCard
            label="미결제"
            value={formatNumber(stats.unpaid)}
            hint="입금 미확인"
            tone={stats.unpaid > 0 ? 'danger' : 'neutral'}
            delta={calcDelta(stats.unpaid, prevStats.unpaid)}
          />
        </div>

        {/* 차트 + Top5 */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
          <div className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
            <InOutChart buckets={buckets} />
          </div>
          <TopCompaniesCard items={top5} />
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
