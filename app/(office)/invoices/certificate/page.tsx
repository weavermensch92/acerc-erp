import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/erp/PageHeader';
import { Button } from '@/components/ui/button';
import { PrintButton } from '@/components/erp/PrintButton';
import {
  PeriodCertificatePreview,
  type PeriodCertLog,
} from '@/components/erp/PeriodCertificatePreview';
import { createClient } from '@/lib/supabase/server';
import { getSelfCompanyInfo } from '@/lib/settings';

export const dynamic = 'force-dynamic';

interface SearchParams {
  company?: string;
  site?: string;
  from?: string;
  to?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function resolvePeriod(sp: SearchParams): { from: string; to: string } | null {
  if (!sp.from || !sp.to || !DATE_RE.test(sp.from) || !DATE_RE.test(sp.to)) {
    return null;
  }
  return sp.from <= sp.to
    ? { from: sp.from, to: sp.to }
    : { from: sp.to, to: sp.from };
}

interface LogRow {
  id: string;
  log_date: string;
  weight_kg: number | null;
  note: string | null;
  site_id: string | null;
  sites: { name: string | null; address: string | null } | null;
  waste_types: { name: string } | null;
}

export default async function PeriodCertificatePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const companyId = searchParams.company;
  if (!companyId) notFound();
  const period = resolvePeriod(searchParams);
  if (!period) notFound();

  const supabase = createClient();
  const selfCompany = await getSelfCompanyInfo(supabase);

  let logsQuery = supabase
    .from('waste_logs')
    .select(
      `id, log_date, weight_kg, note, site_id,
       sites(name, address),
       waste_types(name)`,
    )
    .eq('company_id', companyId)
    .eq('direction', 'in')
    .neq('status', 'archived')
    .gte('log_date', period.from)
    .lte('log_date', period.to)
    .order('log_date', { ascending: true });

  if (searchParams.site) {
    logsQuery = logsQuery.eq('site_id', searchParams.site);
  }

  const [companyRes, logsRes] = await Promise.all([
    supabase
      .from('companies')
      .select('name, representative, address')
      .eq('id', companyId)
      .maybeSingle(),
    logsQuery,
  ]);

  if (!companyRes.data) notFound();
  const company = companyRes.data as {
    name: string;
    representative: string | null;
    address: string | null;
  };

  const rows = (logsRes.data ?? []) as unknown as LogRow[];

  // 현장별 그룹화 — site_id null 은 '미지정' 으로 묶음.
  const groups = new Map<
    string,
    {
      siteId: string | null;
      siteName: string | null;
      siteAddress: string | null;
      logs: Array<PeriodCertLog>;
    }
  >();
  for (const r of rows) {
    const key = r.site_id ?? '__none__';
    if (!groups.has(key)) {
      groups.set(key, {
        siteId: r.site_id,
        siteName: r.sites?.name ?? null,
        siteAddress: r.sites?.address ?? null,
        logs: [],
      });
    }
    groups.get(key)!.logs.push({
      log_date: r.log_date,
      weight_kg: r.weight_kg,
      waste_type_name: r.waste_types?.name ?? '—',
      note: r.note,
    });
  }
  const siteGroups = Array.from(groups.values()).sort((a, b) =>
    (a.siteName ?? '').localeCompare(b.siteName ?? '', 'ko'),
  );

  const backHref = `/invoices?company=${companyId}${
    searchParams.site ? `&site=${searchParams.site}` : ''
  }&from=${period.from}&to=${period.to}`;

  return (
    <>
      <PageHeader
        title="처리확인서 (기간·현장별)"
        subtitle={`${period.from} ~ ${period.to} · ${
          siteGroups.length
        }개 현장 · 총 ${rows.length}건`}
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '거래명세표', href: '/invoices' },
          { label: '처리확인서' },
        ]}
        actions={
          <>
            <PrintButton label="인쇄 / PDF 저장" />
            <Link href={backHref}>
              <Button size="sm" variant="outline">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
                돌아가기
              </Button>
            </Link>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto p-7 print:p-0">
        {siteGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-center print:hidden">
            <p className="text-sm text-foreground-muted">
              해당 기간에 반입 건이 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-6 print:space-y-0">
            {siteGroups.map((g, idx) => (
              <PeriodCertificatePreview
                key={g.siteId ?? `none-${idx}`}
                serial={
                  companyId.slice(0, 6).toUpperCase() +
                  '-' +
                  String(idx + 1).padStart(2, '0')
                }
                company={company}
                site={{ name: g.siteName, address: g.siteAddress }}
                selfCompany={selfCompany}
                period={period}
                logs={g.logs}
                pageBreakAfter={idx < siteGroups.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
