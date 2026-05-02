import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/erp/PageHeader';
import { Pill } from '@/components/erp/Pill';
import { Button } from '@/components/ui/button';
import { CompanyForm } from '@/components/erp/CompanyForm';
import { ShareTokenPanel } from '@/components/erp/ShareTokenPanel';
import { DeleteCompanyButton } from '@/components/erp/DeleteCompanyButton';
import { SiteAssignSection } from '@/components/erp/SiteAssignSection';
import { createClient } from '@/lib/supabase/server';
import { formatKRW, formatKg, formatDate } from '@/lib/format';
import type { Company, Site, Direction } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

interface RecentLog {
  id: string;
  log_date: string;
  direction: Direction;
  weight_kg: number | null;
  total_amount: number | null;
  is_paid: boolean;
  waste_types: { name: string } | null;
}

export default async function CompanyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const [companyRes, sitesRes, otherSitesRes, recentRes, totalRes] = await Promise.all([
    supabase.from('companies').select('*').eq('id', params.id).maybeSingle(),
    supabase
      .from('sites')
      .select('*')
      .eq('company_id', params.id)
      .order('name'),
    supabase
      .from('sites')
      .select('id, name, company_id, companies(name)')
      .neq('company_id', params.id)
      .order('name'),
    supabase
      .from('waste_logs')
      .select(
        `id, log_date, direction, weight_kg, total_amount, is_paid,
         waste_types(name)`,
      )
      .eq('company_id', params.id)
      .neq('status', 'archived')
      .order('log_date', { ascending: false })
      .limit(10),
    supabase
      .from('waste_logs')
      .select('total_amount, is_paid, direction', { count: 'exact' })
      .eq('company_id', params.id)
      .neq('status', 'archived'),
  ]);

  if (!companyRes.data) notFound();
  const company = companyRes.data as Company;
  const sites = (sitesRes.data ?? []) as Site[];
  const otherSites = ((otherSitesRes.data ?? []) as unknown as Array<{
    id: string;
    name: string;
    company_id: string;
    companies: { name: string } | null;
  }>).map((s) => ({
    id: s.id,
    name: s.name,
    company_id: s.company_id,
    company_name: s.companies?.name ?? null,
  }));
  const recent = (recentRes.data ?? []) as unknown as RecentLog[];
  const totalRows = (totalRes.data ?? []) as Array<{
    total_amount: number | null;
    is_paid: boolean;
    direction: Direction;
  }>;
  const inRows = totalRows.filter((r) => r.direction === 'in');
  const outRows = totalRows.filter((r) => r.direction === 'out');
  const totals = {
    count: totalRows.length,
    inCount: inRows.length,
    inSum: inRows.reduce((s, r) => s + (r.total_amount ?? 0), 0),
    inUnpaid: inRows
      .filter((r) => !r.is_paid)
      .reduce((s, r) => s + (r.total_amount ?? 0), 0),
    outCount: outRows.length,
    outSum: outRows.reduce((s, r) => s + (r.total_amount ?? 0), 0),
    outUnpaid: outRows
      .filter((r) => !r.is_paid)
      .reduce((s, r) => s + (r.total_amount ?? 0), 0),
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3003';

  const directionLabel: Record<Direction, string> = { in: '반입', out: '반출' };

  return (
    <>
      <PageHeader
        title={company.name}
        subtitle={company.business_no ?? '사업자번호 미등록'}
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '거래처', href: '/companies' },
          { label: company.name },
        ]}
        actions={
          <Link href="/companies">
            <Button size="sm" variant="outline">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />목록
            </Button>
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-7">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <CompanyForm
              mode="edit"
              companyId={company.id}
              defaults={{
                name: company.name,
                business_no: company.business_no ?? '',
                address: company.address ?? '',
                contact_name: company.contact_name ?? '',
                contact_phone: company.contact_phone ?? '',
                default_unit_price: company.default_unit_price ?? '',
                is_internal: company.is_internal,
              }}
            />

            <SiteAssignSection
              companyId={company.id}
              sites={sites}
              otherSites={otherSites}
            />

            <section className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
              <h3 className="mb-3 text-[13px] font-semibold tracking-tight">
                최근 거래 (최대 10건)
              </h3>
              {recent.length === 0 ? (
                <p className="text-xs text-foreground-muted">거래 이력이 없습니다.</p>
              ) : (
                <ul className="space-y-1.5">
                  {recent.map((log) => (
                    <li
                      key={log.id}
                      className="flex items-center justify-between gap-2 border-b border-divider pb-1.5 text-sm last:border-0"
                    >
                      <Link
                        href={`/logs/${log.id}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <span className="font-mono text-xs text-foreground-muted">
                          {formatDate(log.log_date)}
                        </span>
                        <Pill tone={log.direction === 'in' ? 'info' : 'primary'}>
                          {directionLabel[log.direction]}
                        </Pill>
                        <span>{log.waste_types?.name ?? '—'}</span>
                        <span className="font-mono text-xs text-foreground-muted">
                          {formatKg(log.weight_kg)}
                        </span>
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">
                          {formatKRW(log.total_amount)}
                        </span>
                        <Pill tone={log.is_paid ? 'success' : 'warning'}>
                          {log.is_paid ? '완료' : '대기'}
                        </Pill>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside>
            <div className="sticky top-4 space-y-4">
              <div className="rounded-[10px] border border-border bg-surface p-4 shadow-sm">
                <h3 className="text-[13px] font-semibold tracking-tight">전체 요약</h3>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <dt className="text-foreground-muted">총 거래</dt>
                    <dd className="font-mono">{totals.count}건</dd>
                  </div>
                </dl>

                <div className="mt-3 rounded-md border border-border bg-background-subtle/40 p-2.5">
                  <div className="text-[10.5px] font-semibold text-foreground-muted">
                    반입 (매출)
                  </div>
                  <dl className="mt-1.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <dt className="text-foreground-muted">건수</dt>
                      <dd className="font-mono">{totals.inCount}건</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-foreground-muted">청구 합계</dt>
                      <dd className="font-mono">{formatKRW(totals.inSum)}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-foreground-muted">미수금</dt>
                      <dd className="font-mono text-danger">{formatKRW(totals.inUnpaid)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-2 rounded-md border border-border bg-background-subtle/40 p-2.5">
                  <div className="text-[10.5px] font-semibold text-foreground-muted">
                    반출 (매입)
                  </div>
                  <dl className="mt-1.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <dt className="text-foreground-muted">건수</dt>
                      <dd className="font-mono">{totals.outCount}건</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-foreground-muted">매입 합계</dt>
                      <dd className="font-mono">{formatKRW(totals.outSum)}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-foreground-muted">미지급</dt>
                      <dd className="font-mono text-danger">{formatKRW(totals.outUnpaid)}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {!company.is_deleted && (
                <ShareTokenPanel
                  companyId={company.id}
                  initialToken={company.share_token}
                  appUrl={appUrl}
                />
              )}

              <DeleteCompanyButton
                companyId={company.id}
                companyName={company.name}
                isDeleted={company.is_deleted}
                hasShareToken={!!company.share_token}
                logCount={totals.count}
              />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
