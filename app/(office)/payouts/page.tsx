import { PageHeader } from '@/components/erp/PageHeader';
import {
  EditableInvoiceTable,
  type EditableLog,
} from '@/components/erp/EditableInvoiceTable';
import { createClient } from '@/lib/supabase/server';
import { formatKRW } from '@/lib/format';
import { PayoutForm } from './_form';

export const dynamic = 'force-dynamic';

interface SearchParams {
  plant?: string;
  period?: string;
}

function parsePeriod(period: string | undefined) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
    };
  }
  const [y, m] = period.split('-').map(Number);
  return {
    from: new Date(y, m - 1, 1).toISOString().slice(0, 10),
    to: new Date(y, m, 0).toISOString().slice(0, 10),
  };
}

interface PayoutLog {
  id: string;
  log_date: string;
  direction: 'in' | 'out';
  vehicle_no: string | null;
  weight_kg: number | null;
  unit_price: number | null;
  transport_fee: number | null;
  billing_type: 'weight_based' | 'flat_rate' | 'internal' | 'tax_exempt';
  supply_amount: number | null;
  vat: number | null;
  total_amount: number | null;
  is_invoiced: boolean;
  is_paid: boolean;
  note: string | null;
  sites: { name: string } | null;
  waste_types: { name: string } | null;
}

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();

  const { data: plantsData } = await supabase
    .from('treatment_plants')
    .select('id, name')
    .order('name');
  const plants = (plantsData ?? []) as Array<{ id: string; name: string }>;

  let preview: {
    plant: { id: string; name: string };
    period: { from: string; to: string };
    logs: PayoutLog[];
  } | null = null;

  if (searchParams.plant) {
    const { from, to } = parsePeriod(searchParams.period);
    const [plantRes, logsRes] = await Promise.all([
      supabase
        .from('treatment_plants')
        .select('id, name')
        .eq('id', searchParams.plant)
        .maybeSingle(),
      supabase
        .from('waste_logs')
        .select(
          `id, log_date, direction, vehicle_no, weight_kg, unit_price, transport_fee,
           billing_type, supply_amount, vat, total_amount, is_invoiced, is_paid, note,
           site_id, waste_type_id,
           sites(id, name), waste_types(id, name)`,
        )
        .eq('treatment_plant_id', searchParams.plant)
        .eq('direction', 'out')
        .neq('status', 'archived')
        .gte('log_date', from)
        .lte('log_date', to)
        .order('log_date', { ascending: true }),
    ]);

    if (plantRes.data) {
      preview = {
        plant: plantRes.data as { id: string; name: string },
        period: { from, to },
        logs: (logsRes.data ?? []) as unknown as PayoutLog[],
      };
    }
  }

  const totals = preview
    ? preview.logs.reduce(
        (acc, l) => {
          acc.count += 1;
          acc.amount += l.total_amount ?? 0;
          if (!l.is_paid) {
            acc.unpaidCount += 1;
            acc.unpaidAmount += l.total_amount ?? 0;
          }
          return acc;
        },
        { count: 0, amount: 0, unpaidCount: 0, unpaidAmount: 0 },
      )
    : null;

  return (
    <>
      <PageHeader
        title="처리장 지급관리"
        subtitle="반출(매입) — 처리장별 청구서 수령 / 지급 체크"
        breadcrumb={[{ label: '에이스알앤씨' }, { label: '지급관리' }]}
      />
      <div className="flex-1 overflow-y-auto p-7">
        <div className="mb-5">
          <PayoutForm
            plants={plants}
            defaultPlant={searchParams.plant}
            defaultPeriod={searchParams.period}
            hasPreview={!!preview}
          />
        </div>

        {preview ? (
          <div className="space-y-4">
            {totals && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <SummaryStat label="건수" value={`${totals.count}건`} />
                <SummaryStat label="매입 합계" value={formatKRW(totals.amount)} />
                <SummaryStat
                  label="미지급 건수"
                  value={`${totals.unpaidCount}건`}
                  tone={totals.unpaidCount > 0 ? 'danger' : 'neutral'}
                />
                <SummaryStat
                  label="미지급 금액"
                  value={formatKRW(totals.unpaidAmount)}
                  tone={totals.unpaidAmount > 0 ? 'danger' : 'neutral'}
                />
              </div>
            )}

            {preview.logs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-center">
                <p className="text-sm text-foreground-muted">
                  <strong className="text-foreground">{preview.plant.name}</strong>
                  {' '}의{' '}
                  <span className="font-mono">{preview.period.from}</span>
                  {' ~ '}
                  <span className="font-mono">{preview.period.to}</span>
                  {' '}기간에 반출(매입) 거래가 없습니다.
                </p>
              </div>
            ) : (
              <EditableInvoiceTable
                logs={preview.logs as unknown as EditableLog[]}
                invoicedLabel="청구서수령"
                paidLabel="지급"
                amountLabel="지급금액"
              />
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
            <p className="text-sm text-foreground-muted">
              처리장과 월을 선택한 뒤 [조회] 를 눌러주세요.
            </p>
            <p className="mt-2 text-xs text-foreground-muted">
              조회된 반출 일보 표에서 청구서 수령 / 지급 체크박스로 일괄 표시 + 저장 가능합니다.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function SummaryStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <div
      className={`rounded-[10px] border bg-surface p-4 shadow-sm ${
        tone === 'danger' ? 'border-danger/40' : 'border-border'
      }`}
    >
      <div className="text-[11.5px] font-medium text-foreground-muted">{label}</div>
      <div className="mt-1.5 font-mono text-lg font-semibold tracking-tight">{value}</div>
    </div>
  );
}
