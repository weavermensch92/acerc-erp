import Link from 'next/link';
import { PageHeader } from '@/components/erp/PageHeader';
import { Button } from '@/components/ui/button';
import { InvoiceForm } from './_form';
import {
  InvoicePreview,
  type InvoiceLog,
  type InvoiceCompanyInfo,
} from '@/components/erp/InvoicePreview';
import {
  EditableInvoiceTable,
  type EditableLog,
} from '@/components/erp/EditableInvoiceTable';
import { createClient } from '@/lib/supabase/server';
import { getSelfCompanyInfo } from '@/lib/settings';
import type { SelfCompanyInfo } from '@/lib/company-info';

export const dynamic = 'force-dynamic';

interface SearchParams {
  company?: string;
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

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const selfCompany = await getSelfCompanyInfo(supabase);

  const { data: companiesData } = await supabase
    .from('companies')
    .select('id, name')
    .eq('is_internal', false)
    .eq('is_deleted', false)
    .order('name');
  const companies = (companiesData ?? []) as Array<{ id: string; name: string }>;

  let preview: {
    company: InvoiceCompanyInfo;
    selfCompany: SelfCompanyInfo;
    period: { from: string; to: string };
    logs: InvoiceLog[];
  } | null = null;

  if (searchParams.company) {
    const { from, to } = parsePeriod(searchParams.period);
    const [companyRes, logsRes] = await Promise.all([
      supabase
        .from('companies')
        .select('id, name, business_no, address, contact_name, contact_phone')
        .eq('id', searchParams.company)
        .maybeSingle(),
      supabase
        .from('waste_logs')
        .select(
          `id, log_date, direction, vehicle_no, weight_kg, unit_price, transport_fee,
           supply_amount, vat, total_amount, is_paid,
           sites(name), waste_types(name)`,
        )
        .eq('company_id', searchParams.company)
        .neq('status', 'archived')
        .gte('log_date', from)
        .lte('log_date', to)
        .order('log_date', { ascending: true }),
    ]);

    if (companyRes.data) {
      preview = {
        company: companyRes.data as InvoiceCompanyInfo,
        selfCompany,
        period: { from, to },
        logs: (logsRes.data ?? []) as unknown as InvoiceLog[],
      };
    }
  }

  return (
    <>
      <PageHeader
        title="거래명세표"
        subtitle="거래처별 / 기간별 명세표 조회 + 인쇄 (단건은 여기, 일괄은 [+ 일괄 발급])"
        breadcrumb={[{ label: '에이스알앤씨' }, { label: '거래명세표' }]}
        actions={
          <>
            <Link href="/invoices/batches">
              <Button size="sm" variant="outline">
                발급 이력
              </Button>
            </Link>
            <Link href="/invoices/new">
              <Button size="sm">+ 일괄 발급</Button>
            </Link>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto p-7 print:p-0">
        <div className="mb-5">
          <InvoiceForm
            companies={companies}
            defaultCompany={searchParams.company}
            defaultPeriod={searchParams.period}
            hasPreview={!!preview}
          />
        </div>

        {preview ? (
          <div className="space-y-4">
            {/* 화면 편집 (인쇄에서 hidden) */}
            <EditableInvoiceTable logs={preview.logs as unknown as EditableLog[]} />

            {/* 인쇄 양식 (화면에서도 보이지만 인쇄 시 이 부분만 출력) */}
            <InvoicePreview
              company={preview.company}
              selfCompany={preview.selfCompany}
              period={preview.period}
              logs={preview.logs}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center print:hidden">
            <p className="text-sm text-foreground-muted">
              거래처와 월을 선택한 뒤 [조회] 를 눌러주세요.
            </p>
            <p className="mt-2 text-xs text-foreground-muted">
              조회된 명세표는 [인쇄 / PDF 저장] 버튼으로 그대로 인쇄하거나 PDF 로 저장할 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
