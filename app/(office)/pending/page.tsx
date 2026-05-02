import Link from 'next/link';
import { PageHeader } from '@/components/erp/PageHeader';
import { DateRangePicker } from '@/components/erp/DateRangePicker';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { format, subDays } from 'date-fns';
import type { Direction } from '@/lib/types/database';
import { PendingClient, type CompanyGroup } from './_client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  type?: string;
  from?: string;
  to?: string;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

function resolvePeriod(sp: SearchParams) {
  if (sp.from && sp.to && ISO_RE.test(sp.from) && ISO_RE.test(sp.to)) {
    const [from, to] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
    return { from, to };
  }
  // 기본 — 오늘 기준 90일 전 ~ 오늘 (미처리는 보통 더 오래된 것까지 봐야 함)
  const today = new Date();
  return { from: fmt(subDays(today, 90)), to: fmt(today) };
}

export default async function PendingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const direction: Direction = searchParams.type === 'out' ? 'out' : 'in';
  const { from, to } = resolvePeriod(searchParams);

  const isInbound = direction === 'in';
  const title = isInbound ? '미청구 처리' : '미정산 처리';
  const subtitle = isInbound
    ? '반입(매출) — 거래명세표 미발급된 거래처 / 일보 처리'
    : '반출(매입) — 청구서 미수령된 처리 거래 처리';

  // 미처리 (is_invoiced=false) active 일보 조회 + 거래처 정보
  const { data: logsData } = await supabase
    .from('waste_logs')
    .select(
      `id, log_date, weight_kg, total_amount, vehicle_no, is_invoiced, is_paid,
       company_id, companies(id, name),
       sites(name), waste_types(name)`,
    )
    .eq('direction', direction)
    .eq('is_invoiced', false)
    .eq('status', 'active')
    .gte('log_date', from)
    .lte('log_date', to)
    .order('log_date', { ascending: true });

  type Row = {
    id: string;
    log_date: string;
    weight_kg: number | null;
    total_amount: number | null;
    vehicle_no: string | null;
    is_invoiced: boolean;
    is_paid: boolean;
    company_id: string;
    companies: { id: string; name: string } | null;
    sites: { name: string } | null;
    waste_types: { name: string } | null;
  };
  const rows = (logsData ?? []) as unknown as Row[];

  // 거래처별 그룹핑
  const groupMap = new Map<string, CompanyGroup>();
  for (const r of rows) {
    if (!r.companies) continue;
    const key = r.company_id;
    let g = groupMap.get(key);
    if (!g) {
      g = {
        companyId: r.company_id,
        companyName: r.companies.name,
        oldestDate: r.log_date,
        latestDate: r.log_date,
        count: 0,
        totalAmount: 0,
        unpaidAmount: 0,
        logs: [],
      };
      groupMap.set(key, g);
    }
    if (r.log_date < g.oldestDate) g.oldestDate = r.log_date;
    if (r.log_date > g.latestDate) g.latestDate = r.log_date;
    g.count += 1;
    g.totalAmount += r.total_amount ?? 0;
    if (!r.is_paid) g.unpaidAmount += r.total_amount ?? 0;
    g.logs.push({
      id: r.id,
      log_date: r.log_date,
      weight_kg: r.weight_kg,
      total_amount: r.total_amount,
      vehicle_no: r.vehicle_no,
      is_paid: r.is_paid,
      site_name: r.sites?.name ?? null,
      waste_type_name: r.waste_types?.name ?? null,
    });
  }
  const groups = [...groupMap.values()].sort((a, b) => b.totalAmount - a.totalAmount);

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '대시보드', href: '/dashboard' },
          { label: title },
        ]}
        actions={<DateRangePicker from={from} to={to} />}
      />
      <div className="flex-1 overflow-y-auto p-7 space-y-4">
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Link
            href={`/pending?type=in&from=${from}&to=${to}`}
            scroll={false}
          >
            <Button size="sm" variant={isInbound ? 'default' : 'outline'}>
              미청구 (반입)
            </Button>
          </Link>
          <Link
            href={`/pending?type=out&from=${from}&to=${to}`}
            scroll={false}
          >
            <Button size="sm" variant={!isInbound ? 'default' : 'outline'}>
              미정산 (반출)
            </Button>
          </Link>
          <span className="ml-auto text-[11.5px] text-foreground-muted">
            기간 {from} ~ {to} · 거래처 {groups.length}곳 · 총 미처리 {rows.length}건
          </span>
        </div>

        <PendingClient direction={direction} groups={groups} period={{ from, to }} />
      </div>
    </>
  );
}
