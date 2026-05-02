import Link from 'next/link';
import { Plus, X, Grid3x3, Download, Upload } from 'lucide-react';
import { PageHeader } from '@/components/erp/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/server';
import { getReviewProcessEnabled } from '@/lib/settings';
import { cn } from '@/lib/utils';
import { LogsTable, type LogRow } from './_table';
import type { LogStatus } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
  from?: string;
  to?: string;
  company?: string;
}

const statusFiltersAll: Array<{ id: string; label: string; value?: LogStatus }> = [
  { id: 'all', label: '전체' },
  { id: 'pending_review', label: '검토 대기', value: 'pending_review' },
  { id: 'active', label: '정식 등록', value: 'active' },
  { id: 'archived', label: '보관(삭제)', value: 'archived' },
];
const statusFiltersWithoutReview: Array<{
  id: string;
  label: string;
  value?: LogStatus;
}> = [
  { id: 'all', label: '전체' },
  { id: 'active', label: '정식 등록', value: 'active' },
  { id: 'archived', label: '보관(삭제)', value: 'archived' },
];

export default async function LogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const reviewEnabled = await getReviewProcessEnabled();
  const statusFilters = reviewEnabled ? statusFiltersAll : statusFiltersWithoutReview;

  // 거래처 목록 (필터 select 용 — 활성만)
  const { data: companiesData } = await supabase
    .from('companies')
    .select('id, name')
    .eq('is_deleted', false)
    .order('name');
  const companies = (companiesData ?? []) as Array<{ id: string; name: string }>;

  let query = supabase
    .from('waste_logs')
    .select(
      `id, log_date, direction, vehicle_no, weight_kg, total_amount, status, is_invoiced, is_paid,
       companies(name), sites(name), waste_types(name)`,
    )
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);

  // archived 명시 시만 보임. 미명시 시 archived 자동 제외
  if (searchParams.status) {
    query = query.eq('status', searchParams.status);
  } else {
    query = query.neq('status', 'archived');
  }
  if (searchParams.from) query = query.gte('log_date', searchParams.from);
  if (searchParams.to) query = query.lte('log_date', searchParams.to);
  if (searchParams.company) query = query.eq('company_id', searchParams.company);

  const { data: logs } = await query;
  const rows = (logs ?? []) as unknown as LogRow[];

  // 상태별 카운트 (chip 우측 숫자)
  const { data: countsData } = await supabase
    .from('waste_logs')
    .select('status')
    .neq('status', 'archived');
  const statusCounts: Record<string, number> = { all: 0 };
  for (const r of (countsData ?? []) as { status: LogStatus }[]) {
    statusCounts.all += 1;
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }

  const buildHref = (statusValue?: string) => {
    const params = new URLSearchParams();
    if (statusValue) params.set('status', statusValue);
    if (searchParams.from) params.set('from', searchParams.from);
    if (searchParams.to) params.set('to', searchParams.to);
    if (searchParams.company) params.set('company', searchParams.company);
    const q = params.toString();
    return q ? `/logs?${q}` : '/logs';
  };

  const hasFilter =
    !!searchParams.status ||
    !!searchParams.from ||
    !!searchParams.to ||
    !!searchParams.company;

  const selectedCompanyName = searchParams.company
    ? companies.find((c) => c.id === searchParams.company)?.name
    : null;

  return (
    <>
      <PageHeader
        title="폐기물일보"
        subtitle="반입 / 반출 일보 목록"
        breadcrumb={[{ label: '에이스알앤씨' }, { label: '폐기물일보' }]}
        actions={
          <>
            <a
              href={`/api/logs/export?${new URLSearchParams({
                ...(searchParams.from ? { from: searchParams.from } : {}),
                ...(searchParams.to ? { to: searchParams.to } : {}),
              }).toString()}`}
              target="_blank"
              rel="noopener"
              title={
                searchParams.from || searchParams.to
                  ? `${searchParams.from ?? '전체'} ~ ${searchParams.to ?? '전체'} 범위 다운로드`
                  : '전체 일보 다운로드'
              }
            >
              <Button size="sm" variant="outline">
                <Download className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
                엑셀 다운
              </Button>
            </a>
            <Link href="/admin/import">
              <Button size="sm" variant="outline">
                <Upload className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
                엑셀 업로드
              </Button>
            </Link>
            <Link href="/logs/bulk">
              <Button size="sm" variant="outline">
                <Grid3x3 className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />빠른 입력
              </Button>
            </Link>
            <Link href="/logs/new">
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />새 일보 입력
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 상태 칩 (숫자 표시) */}
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-border bg-surface px-7 py-3">
          <span className="mr-1 text-[11.5px] text-foreground-muted">상태</span>
          {statusFilters.map((f) => {
            const active = (searchParams.status ?? 'all') === (f.value ?? 'all');
            const count = statusCounts[f.value ?? 'all'] ?? 0;
            return (
              <Link
                key={f.id}
                href={buildHref(f.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors',
                  active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-surface text-foreground-secondary hover:bg-background-subtle',
                )}
              >
                {f.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[10px] font-mono',
                    active
                      ? 'bg-background/20 text-background'
                      : 'bg-background-subtle text-foreground-muted',
                  )}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </div>

        {/* 추가 필터 (거래처 + 기간) — GET form */}
        <form
          method="get"
          className="flex flex-shrink-0 flex-wrap items-end gap-3 border-b border-border bg-surface px-7 py-3"
        >
          {searchParams.status && (
            <input type="hidden" name="status" value={searchParams.status} />
          )}
          <div className="space-y-1">
            <label className="text-[10.5px] text-foreground-muted">거래처</label>
            <Select name="company" defaultValue={searchParams.company ?? ''} className="min-w-[180px]">
              <option value="">전체</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10.5px] text-foreground-muted">시작일</label>
            <Input type="date" name="from" defaultValue={searchParams.from ?? ''} className="w-[150px]" />
          </div>
          <div className="space-y-1">
            <label className="text-[10.5px] text-foreground-muted">종료일</label>
            <Input type="date" name="to" defaultValue={searchParams.to ?? ''} className="w-[150px]" />
          </div>
          <Button type="submit" size="sm" variant="outline">
            적용
          </Button>
          {hasFilter && (
            <Link href="/logs">
              <Button type="button" size="sm" variant="ghost">
                <X className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />초기화
              </Button>
            </Link>
          )}
          {selectedCompanyName && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-info-bg px-2.5 py-1 text-[11px] text-info">
              {selectedCompanyName}
            </span>
          )}
        </form>

        <div className="flex-1 overflow-y-auto p-7">
          <LogsTable rows={rows} />
        </div>
      </div>
    </>
  );
}

