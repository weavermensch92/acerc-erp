import { PageHeader } from '@/components/erp/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { BatchForm } from './_form';

export const dynamic = 'force-dynamic';

interface SearchParams {
  period?: string;
}

function parsePeriod(period: string | undefined) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
      monthKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    };
  }
  const [y, m] = period.split('-').map(Number);
  return {
    from: new Date(y, m - 1, 1).toISOString().slice(0, 10),
    to: new Date(y, m, 0).toISOString().slice(0, 10),
    monthKey: period,
  };
}

interface CompanyAgg {
  id: string;
  name: string;
  share_token: string | null;
  count: number;
  total: number;
  unpaid: number;
  unpaidCount: number;
}

export default async function NewBatchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const { from, to, monthKey } = parsePeriod(searchParams.period);

  // 거래처 + 해당 기간 active 거래 집계 (활성 거래처만)
  const { data: companiesData } = await supabase
    .from('companies')
    .select('id, name, share_token, is_internal')
    .eq('is_deleted', false)
    .order('name');
  const companies = (companiesData ?? []) as Array<{
    id: string;
    name: string;
    share_token: string | null;
    is_internal: boolean;
  }>;

  const { data: logsData } = await supabase
    .from('waste_logs')
    .select('company_id, total_amount, is_paid, is_invoiced')
    .gte('log_date', from)
    .lte('log_date', to)
    .eq('status', 'active');

  type Log = {
    company_id: string;
    total_amount: number | null;
    is_paid: boolean;
    is_invoiced: boolean;
  };
  const logs = (logsData ?? []) as Log[];

  const aggMap = new Map<string, CompanyAgg>();
  for (const c of companies) {
    if (c.is_internal) continue;
    aggMap.set(c.id, {
      id: c.id,
      name: c.name,
      share_token: c.share_token,
      count: 0,
      total: 0,
      unpaid: 0,
      unpaidCount: 0,
    });
  }
  for (const l of logs) {
    const agg = aggMap.get(l.company_id);
    if (!agg) continue;
    agg.count += 1;
    agg.total += l.total_amount ?? 0;
    if (!l.is_paid) {
      agg.unpaid += l.total_amount ?? 0;
      agg.unpaidCount += 1;
    }
  }
  const aggList = [...aggMap.values()]
    .filter((a) => a.count > 0) // 해당 기간 거래 있는 거래처만
    .sort((a, b) => b.total - a.total);

  return (
    <>
      <PageHeader
        title="거래명세표 일괄 발급"
        subtitle="기간 + 다중 거래처 — 시나리오 4"
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '거래명세표', href: '/invoices' },
          { label: '일괄 발급' },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-7">
        <BatchForm
          aggList={aggList}
          monthKey={monthKey}
          from={from}
          to={to}
        />
      </div>
    </>
  );
}
