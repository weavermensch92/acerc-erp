import Link from 'next/link';
import { PageHeader } from '@/components/erp/PageHeader';
import { Button } from '@/components/ui/button';
import { InvoiceForm } from './_form';
import { InvoiceEditorPreview } from '@/components/erp/InvoiceEditorPreview';
import {
  InvoicePreview,
  type InvoiceLog,
  type InvoiceCompanyInfo,
} from '@/components/erp/InvoicePreview';
import type { EditableLog } from '@/components/erp/EditableInvoiceTable';
import { createClient } from '@/lib/supabase/server';
import { getSelfCompanyInfo } from '@/lib/settings';
import type { SelfCompanyInfo } from '@/lib/company-info';

export const dynamic = 'force-dynamic';

interface SearchParams {
  company?: string;
  site?: string;
  from?: string;
  to?: string;
  // 하위 호환 — 기존 `?period=YYYY-MM` 진입점도 계속 동작
  period?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function resolvePeriod(sp: SearchParams) {
  // 1) from/to 둘 다 유효하면 그대로
  if (sp.from && sp.to && DATE_RE.test(sp.from) && DATE_RE.test(sp.to)) {
    const [from, to] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
    return { from, to };
  }
  // 2) period=YYYY-MM 호환
  if (sp.period && /^\d{4}-\d{2}$/.test(sp.period)) {
    const [y, m] = sp.period.split('-').map(Number);
    return {
      from: new Date(y, m - 1, 1).toISOString().slice(0, 10),
      to: new Date(y, m, 0).toISOString().slice(0, 10),
    };
  }
  // 3) 기본: 이번 달
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  };
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const selfCompany = await getSelfCompanyInfo(supabase);

  const [{ data: companiesData }, { data: sitesData }] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name')
      .eq('is_internal', false)
      .eq('is_deleted', false)
      .order('name'),
    supabase
      .from('sites')
      .select('id, name, company_id')
      .eq('is_active', true)
      .order('name'),
  ]);
  const companies = (companiesData ?? []) as Array<{ id: string; name: string }>;
  const sites = (sitesData ?? []) as Array<{
    id: string;
    name: string;
    company_id: string;
  }>;

  let preview: {
    company: InvoiceCompanyInfo;
    selfCompany: SelfCompanyInfo;
    period: { from: string; to: string };
    logs: InvoiceLog[];
    siteName: string | null;
  } | null = null;

  const { from, to } = resolvePeriod(searchParams);

  if (searchParams.company) {

    let logsQuery = supabase
      .from('waste_logs')
      .select(
        `id, log_date, direction, vehicle_no, weight_kg, unit_price, transport_fee,
         billing_type, supply_amount, vat, total_amount, is_invoiced, is_paid, note,
         sites(name), waste_types(name)`,
      )
      .eq('company_id', searchParams.company)
      .neq('status', 'archived')
      .gte('log_date', from)
      .lte('log_date', to)
      .order('log_date', { ascending: true });

    if (searchParams.site) {
      logsQuery = logsQuery.eq('site_id', searchParams.site);
    }

    const [companyRes, logsRes] = await Promise.all([
      supabase
        .from('companies')
        .select('*')
        .eq('id', searchParams.company)
        .maybeSingle(),
      logsQuery,
    ]);

    if (companyRes.data) {
      const siteName =
        searchParams.site
          ? sites.find((s) => s.id === searchParams.site)?.name ?? null
          : null;
      preview = {
        company: companyRes.data as InvoiceCompanyInfo,
        selfCompany,
        period: { from, to },
        logs: (logsRes.data ?? []) as unknown as InvoiceLog[],
        siteName,
      };
    }
  }

  return (
    <>
      <PageHeader
        title="거래명세표"
        subtitle="거래처·현장·기간별 명세표 조회 + 인쇄 (단건은 여기, 일괄은 [+ 일괄 발급])"
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
            sites={sites}
            defaultCompany={searchParams.company}
            defaultSite={searchParams.site}
            defaultFrom={from}
            defaultTo={to}
            hasPreview={!!preview}
          />
        </div>

        {preview ? (
          <>
            {preview.siteName && (
              <p className="mb-3 text-[11.5px] text-foreground-muted print:hidden">
                현장 필터:{' '}
                <span className="font-medium text-foreground">{preview.siteName}</span>
              </p>
            )}
            {preview.logs.length === 0 ? (
              <>
                <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-center print:hidden">
                  <p className="text-sm text-foreground-muted">
                    <strong className="text-foreground">{preview.company.name}</strong>
                    {preview.siteName && (
                      <>
                        {' / '}
                        <strong className="text-foreground">{preview.siteName}</strong>
                      </>
                    )}
                    {' '}의{' '}
                    <span className="font-mono">{preview.period.from}</span>
                    {' ~ '}
                    <span className="font-mono">{preview.period.to}</span>
                    {' '}기간에 거래가 없습니다.
                  </p>
                  <p className="mt-1.5 text-[11px] text-foreground-muted">
                    다른 기간·현장을 선택하거나 새 일보를 입력해주세요.
                  </p>
                </div>
                <div className="mt-4">
                  <InvoicePreview
                    company={preview.company}
                    selfCompany={preview.selfCompany}
                    period={preview.period}
                    logs={preview.logs}
                    siteName={preview.siteName}
                  />
                </div>
              </>
            ) : (
              <InvoiceEditorPreview
                company={preview.company}
                selfCompany={preview.selfCompany}
                period={preview.period}
                logs={preview.logs as unknown as EditableLog[]}
                siteName={preview.siteName}
              />
            )}
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center print:hidden">
            <p className="text-sm text-foreground-muted">
              거래처와 기간을 선택한 뒤 [조회] 를 눌러주세요. 현장은 선택하지 않으면 거래처의 모든 현장 거래가 포함됩니다.
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
