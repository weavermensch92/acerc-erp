import Link from 'next/link';
import { PageHeader } from '@/components/erp/PageHeader';
import { DateRangePicker } from '@/components/erp/DateRangePicker';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { format, subDays } from 'date-fns';
import type { Direction } from '@/lib/types/database';
import { PendingClient, type CompanyGroup, type Kind } from './_client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  type?: string;
  kind?: string;
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

interface ModeMeta {
  title: string;
  subtitle: string;
  filterField: 'is_invoiced' | 'is_paid';
}

function modeMeta(kind: Kind, direction: Direction): ModeMeta {
  if (kind === 'invoice') {
    return direction === 'in'
      ? {
          title: '미청구 처리',
          subtitle: '반입(매출) — 거래명세표 미발급된 거래처 / 일보 처리',
          filterField: 'is_invoiced',
        }
      : {
          title: '미정산 처리',
          subtitle: '반출(매입) — 청구서 미수령된 처리 거래 처리',
          filterField: 'is_invoiced',
        };
  }
  return direction === 'in'
    ? {
        title: '미수금 처리',
        subtitle: '반입(매출) — 입금 미완료 거래처 / 일보 정리',
        filterField: 'is_paid',
      }
    : {
        title: '미지급 처리',
        subtitle: '반출(매입) — 처리장 지급 미완료 정리',
        filterField: 'is_paid',
      };
}

export default async function PendingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const direction: Direction = searchParams.type === 'out' ? 'out' : 'in';
  const kind: Kind = searchParams.kind === 'payment' ? 'payment' : 'invoice';
  const { from, to } = resolvePeriod(searchParams);

  const meta = modeMeta(kind, direction);

  const { data: logsData } = await supabase
    .from('waste_logs')
    .select(
      `id, log_date, weight_kg, total_amount, vehicle_no, is_invoiced, is_paid,
       company_id, companies(id, name),
       sites(name), waste_types(name)`,
    )
    .eq('direction', direction)
    .eq(meta.filterField, false)
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
      is_invoiced: r.is_invoiced,
      site_name: r.sites?.name ?? null,
      waste_type_name: r.waste_types?.name ?? null,
    });
  }
  const groups = [...groupMap.values()].sort((a, b) => b.totalAmount - a.totalAmount);

  const tabs: Array<{ type: Direction; kind: Kind; label: string }> = [
    { type: 'in', kind: 'invoice', label: '미청구 (반입)' },
    { type: 'out', kind: 'invoice', label: '미정산 (반출)' },
    { type: 'in', kind: 'payment', label: '미수금 (반입)' },
    { type: 'out', kind: 'payment', label: '미지급 (반출)' },
  ];

  return (
    <>
      <PageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '대시보드', href: '/dashboard' },
          { label: meta.title },
        ]}
        actions={<DateRangePicker from={from} to={to} />}
      />
      <div className="flex-1 overflow-y-auto p-7 space-y-4">
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {tabs.map((t) => {
            const isActive = t.type === direction && t.kind === kind;
            return (
              <Link
                key={`${t.type}-${t.kind}`}
                href={`/pending?type=${t.type}&kind=${t.kind}&from=${from}&to=${to}`}
                scroll={false}
              >
                <Button size="sm" variant={isActive ? 'default' : 'outline'}>
                  {t.label}
                </Button>
              </Link>
            );
          })}
          <span className="ml-auto text-[11.5px] text-foreground-muted">
            기간 {from} ~ {to} · 거래처 {groups.length}곳 · 총 미처리 {rows.length}건
          </span>
        </div>

        <PendingClient
          direction={direction}
          kind={kind}
          groups={groups}
          period={{ from, to }}
        />
      </div>
    </>
  );
}
