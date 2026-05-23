import Link from 'next/link';
import { Plus, X, Grid3x3, Download, Upload, CalendarDays, History, Search } from 'lucide-react';
import { PageHeader } from '@/components/erp/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/server';
import { getReviewProcessEnabled } from '@/lib/settings';
import { cn } from '@/lib/utils';
import { LogsTable, type LogRow } from './_table';
import { LogCompanyFilter } from './_company-filter';
import type { LogStatus } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

interface SearchParams {
  view?: string; // 'daily' (default) | 'range'
  date?: string; // YYYY-MM-DD (daily mode)
  status?: string;
  from?: string;
  to?: string;
  company?: string;
  direction?: string;
  plant?: string;
  q?: string; // 전역 검색어
}

// 전화번호 검색용 — 입력 문자열에서 숫자만 추출 (예: '010-1234-5678' → '01012345678')
function digitsOnly(s: string): string {
  return s.replace(/[^0-9]/g, '');
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

// 한국 시간(Asia/Seoul) 기준 오늘 — 서버가 UTC 일 때도 일관.
const todayIso = () => {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });
  return fmt.format(new Date()); // 'YYYY-MM-DD'
};

function isValidDate(s?: string): boolean {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const reviewEnabled = await getReviewProcessEnabled();
  const statusFilters = reviewEnabled ? statusFiltersAll : statusFiltersWithoutReview;

  // 뷰 모드: 디폴트 = daily (오늘)
  const view = searchParams.view === 'range' ? 'range' : 'daily';
  const dailyDate = isValidDate(searchParams.date) ? searchParams.date! : todayIso();

  // 일일 뷰의 경우 from/to 를 그 날짜 하루로 강제
  const effectiveFrom = view === 'daily' ? dailyDate : searchParams.from;
  const effectiveTo = view === 'daily' ? dailyDate : searchParams.to;

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
      `id, log_date, direction, vehicle_no,
       weight_kg, unit_price, transport_fee, billing_type,
       supply_amount, vat, total_amount,
       status, is_invoiced, is_paid, note,
       companies(id, name), sites(name), waste_types(id, name)`,
    )
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(view === 'daily' ? 200 : 100);

  // archived 명시 시만 보임. 미명시 시 archived 자동 제외
  if (searchParams.status) {
    query = query.eq('status', searchParams.status);
  } else {
    query = query.neq('status', 'archived');
  }
  if (effectiveFrom) query = query.gte('log_date', effectiveFrom);
  if (effectiveTo) query = query.lte('log_date', effectiveTo);
  if (searchParams.company) query = query.eq('company_id', searchParams.company);
  if (searchParams.direction === 'in' || searchParams.direction === 'out') {
    query = query.eq('direction', searchParams.direction);
  }
  if (searchParams.plant) query = query.eq('treatment_plant_id', searchParams.plant);

  // 전역 검색 — 거래처/현장/성상/처리장/차량/비고/연락처/사업자번호 모두 매칭
  const searchTerm = searchParams.q?.trim() ?? '';
  if (searchTerm) {
    const like = `%${searchTerm}%`;
    const digits = digitsOnly(searchTerm);

    // 관련 마스터 ID 들 (이름·연락처·사업자번호로 매칭)
    const [matchCompanies, matchSites, matchWasteTypes, matchPlants] = await Promise.all([
      // 거래처: name | business_no | contact_name | contact_phone | address | representative | email
      (async () => {
        let q = supabase.from('companies').select('id');
        const filters = [
          `name.ilike.${like}`,
          `business_no.ilike.${like}`,
          `contact_name.ilike.${like}`,
          `contact_phone.ilike.${like}`,
          `address.ilike.${like}`,
          `representative.ilike.${like}`,
          `email.ilike.${like}`,
        ];
        if (digits.length >= 3) filters.push(`contact_phone.ilike.%${digits}%`);
        q = q.or(filters.join(','));
        const { data } = await q;
        return (data ?? []).map((r) => r.id as string);
      })(),
      (async () => {
        const { data } = await supabase
          .from('sites')
          .select('id')
          .or(`name.ilike.${like},address.ilike.${like}`);
        return (data ?? []).map((r) => r.id as string);
      })(),
      (async () => {
        const { data } = await supabase
          .from('waste_types')
          .select('id')
          .ilike('name', like);
        return (data ?? []).map((r) => r.id as string);
      })(),
      (async () => {
        const { data } = await supabase
          .from('treatment_plants')
          .select('id')
          .or(`name.ilike.${like},address.ilike.${like}`);
        return (data ?? []).map((r) => r.id as string);
      })(),
    ]);

    // Supabase .or() 안에 .in.(uuid1,uuid2) 를 넣으면 콤마가 OR 구분자와 충돌해
    // 쿼리가 깨짐. 회피: 매칭되는 waste_log id 들을 미리 모은 뒤 .in('id', ...) 로 한 번에 필터.
    const matchedLogIds = new Set<string>();

    // 1) waste_logs 직접 컬럼 (vehicle_no / note / snapshot) ilike
    const { data: directLogs } = await supabase
      .from('waste_logs')
      .select('id')
      .or(
        `vehicle_no.ilike.${like},note.ilike.${like},treatment_plant_name_snapshot.ilike.${like}`,
      );
    for (const r of (directLogs ?? []) as Array<{ id: string }>) {
      matchedLogIds.add(r.id);
    }

    // 2) 마스터 매칭별로 log id 수집 (각 in 절은 개별 쿼리라 콤마 충돌 없음)
    const collect = async (column: string, ids: string[]) => {
      if (ids.length === 0) return;
      const { data } = await supabase
        .from('waste_logs')
        .select('id')
        .in(column, ids);
      for (const r of (data ?? []) as Array<{ id: string }>) {
        matchedLogIds.add(r.id);
      }
    };
    await Promise.all([
      collect('company_id', matchCompanies),
      collect('site_id', matchSites),
      collect('waste_type_id', matchWasteTypes),
      collect('treatment_plant_id', matchPlants),
    ]);

    // 매칭 0건이면 의도적으로 빈 결과 — 존재하지 않는 id 로 필터
    const idList = Array.from(matchedLogIds);
    if (idList.length === 0) {
      query = query.eq('id', '00000000-0000-0000-0000-000000000000');
    } else {
      query = query.in('id', idList);
    }
  }


  const { data: logs } = await query;
  const rows = (logs ?? []) as unknown as LogRow[];

  // 표에 등장하는 거래처들의 활성 현장 일괄 조회 — 현장별 거래명세표 드롭다운용
  const companyIds = Array.from(
    new Set(
      rows.map((r) => r.companies?.id).filter((id): id is string => !!id),
    ),
  );
  const sitesByCompany: Record<string, Array<{ id: string; name: string }>> = {};
  if (companyIds.length > 0) {
    const { data: sites } = await supabase
      .from('sites')
      .select('id, name, company_id')
      .in('company_id', companyIds)
      .eq('is_active', true)
      .order('name');
    for (const s of (sites ?? []) as Array<{ id: string; name: string; company_id: string }>) {
      (sitesByCompany[s.company_id] ??= []).push({ id: s.id, name: s.name });
    }
  }

  // 성상(waste_types) 마스터 — 인라인 편집 드롭다운용
  const { data: wasteTypesData } = await supabase
    .from('waste_types')
    .select('id, name')
    .order('name');
  const wasteTypes = (wasteTypesData ?? []) as Array<{ id: string; name: string }>;

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
    if (view === 'range') params.set('view', 'range');
    if (view === 'daily') params.set('date', dailyDate);
    if (statusValue) params.set('status', statusValue);
    if (view === 'range' && searchParams.from) params.set('from', searchParams.from);
    if (view === 'range' && searchParams.to) params.set('to', searchParams.to);
    if (searchParams.company) params.set('company', searchParams.company);
    if (searchParams.direction) params.set('direction', searchParams.direction);
    if (searchParams.plant) params.set('plant', searchParams.plant);
    if (searchTerm) params.set('q', searchTerm);
    const qs = params.toString();
    return qs ? `/logs?${qs}` : '/logs';
  };

  const buildDirectionHref = (directionValue?: string) => {
    const params = new URLSearchParams();
    if (view === 'range') params.set('view', 'range');
    if (view === 'daily') params.set('date', dailyDate);
    if (directionValue) params.set('direction', directionValue);
    if (searchParams.status) params.set('status', searchParams.status);
    if (view === 'range' && searchParams.from) params.set('from', searchParams.from);
    if (view === 'range' && searchParams.to) params.set('to', searchParams.to);
    if (searchParams.company) params.set('company', searchParams.company);
    if (searchParams.plant) params.set('plant', searchParams.plant);
    if (searchTerm) params.set('q', searchTerm);
    const qs = params.toString();
    return qs ? `/logs?${qs}` : '/logs';
  };

  const buildViewHref = (newView: 'daily' | 'range') => {
    const params = new URLSearchParams();
    if (newView === 'range') params.set('view', 'range');
    if (newView === 'daily') params.set('date', dailyDate);
    if (searchParams.status) params.set('status', searchParams.status);
    if (searchParams.company) params.set('company', searchParams.company);
    if (searchParams.direction) params.set('direction', searchParams.direction);
    if (searchParams.plant) params.set('plant', searchParams.plant);
    if (searchTerm) params.set('q', searchTerm);
    const qs = params.toString();
    return qs ? `/logs?${qs}` : '/logs';
  };

  const hasFilter =
    !!searchParams.status ||
    !!searchParams.from ||
    !!searchParams.to ||
    !!searchParams.company ||
    !!searchParams.direction ||
    !!searchParams.plant ||
    !!searchTerm ||
    view === 'range';

  const selectedPlantName = searchParams.plant
    ? (
        await supabase
          .from('treatment_plants')
          .select('name')
          .eq('id', searchParams.plant)
          .maybeSingle()
      ).data?.name ?? null
    : null;

  const selectedCompanyName = searchParams.company
    ? companies.find((c) => c.id === searchParams.company)?.name
    : null;

  // 일일 뷰 — 일자 ±1 navigation
  const dayDate = new Date(dailyDate + 'T00:00:00');
  const prevDay = new Date(dayDate);
  prevDay.setDate(prevDay.getDate() - 1);
  const nextDay = new Date(dayDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const prevDayIso = prevDay.toISOString().slice(0, 10);
  const nextDayIso = nextDay.toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="폐기물일보"
        subtitle={
          view === 'daily'
            ? `${dailyDate} 일일 일보 (${rows.length}건)`
            : '반입 / 반출 일보 — 기간 조회'
        }
        breadcrumb={[{ label: '에이스알앤씨' }, { label: '폐기물일보' }]}
        actions={
          <>
            <a
              href={`/api/logs/export?${new URLSearchParams({
                ...(effectiveFrom ? { from: effectiveFrom } : {}),
                ...(effectiveTo ? { to: effectiveTo } : {}),
              }).toString()}`}
              target="_blank"
              rel="noopener"
              title={
                effectiveFrom || effectiveTo
                  ? `${effectiveFrom ?? '전체'} ~ ${effectiveTo ?? '전체'} 범위 다운로드`
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
        {/* 뷰 탭: 일일 / 전체 기간 */}
        <div className="flex flex-shrink-0 items-center gap-1 border-b border-border bg-surface px-7 pt-3">
          <Link
            href={buildViewHref('daily')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors',
              view === 'daily'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-foreground-muted hover:text-foreground-secondary',
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
            일일 일보
          </Link>
          <Link
            href={buildViewHref('range')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors',
              view === 'range'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-foreground-muted hover:text-foreground-secondary',
            )}
          >
            <History className="h-3.5 w-3.5" strokeWidth={1.75} />
            기간 조회
          </Link>
        </div>

        {/* 전역 검색바 — 거래처/현장/성상/처리장/차량/연락처/사업자번호/비고 모두 매칭 */}
        <form
          method="get"
          className="flex flex-shrink-0 items-center gap-2 border-b border-border bg-surface px-7 py-3"
        >
          {/* 기존 필터 보존 hidden — q 변경 시에도 다른 필터 유지 */}
          {view === 'range' && <input type="hidden" name="view" value="range" />}
          {view === 'daily' && <input type="hidden" name="date" value={dailyDate} />}
          {searchParams.status && (
            <input type="hidden" name="status" value={searchParams.status} />
          )}
          {searchParams.direction && (
            <input type="hidden" name="direction" value={searchParams.direction} />
          )}
          {searchParams.company && (
            <input type="hidden" name="company" value={searchParams.company} />
          )}
          {searchParams.plant && (
            <input type="hidden" name="plant" value={searchParams.plant} />
          )}
          {view === 'range' && searchParams.from && (
            <input type="hidden" name="from" value={searchParams.from} />
          )}
          {view === 'range' && searchParams.to && (
            <input type="hidden" name="to" value={searchParams.to} />
          )}
          <div className="relative flex-1 max-w-2xl">
            <Search
              className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted"
              strokeWidth={1.75}
            />
            <input
              type="text"
              name="q"
              defaultValue={searchTerm}
              placeholder="검색 — 거래처명 · 사업자번호 · 담당자 · 연락처 · 차량번호 · 현장 · 성상 · 처리장 · 비고"
              className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-[13px] placeholder:text-foreground-muted focus:border-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="h-9">
            검색
          </Button>
          {searchTerm && (
            <Link
              href={buildHref(searchParams.status).replace(/[?&]q=[^&]*/, '')}
              className="rounded-md px-2 py-1 text-xs text-foreground-muted hover:bg-background-subtle"
              title="검색어 지우기"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          )}
        </form>

        {/* 통합 필터 바 — 데스크탑 가로 정렬, 모바일 세로 wrap. 그룹 간 넓은 간격 */}
        <div className="flex flex-shrink-0 flex-col gap-3 border-b border-border bg-surface px-7 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-10 lg:gap-y-3">
          {/* 일일 일자 선택 (일일 뷰만) */}
          {view === 'daily' && (
            <form method="get" className="flex flex-wrap items-center gap-1.5">
              {searchParams.status && (
                <input type="hidden" name="status" value={searchParams.status} />
              )}
              {searchParams.direction && (
                <input type="hidden" name="direction" value={searchParams.direction} />
              )}
              {searchParams.company && (
                <input type="hidden" name="company" value={searchParams.company} />
              )}
              {searchParams.plant && (
                <input type="hidden" name="plant" value={searchParams.plant} />
              )}
              {searchTerm && <input type="hidden" name="q" value={searchTerm} />}
              <Link
                href={buildViewHref('daily').replace(`date=${dailyDate}`, `date=${prevDayIso}`)}
                className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-background-subtle"
                title="이전일"
              >
                ←
              </Link>
              <Input
                type="date"
                name="date"
                defaultValue={dailyDate}
                max={todayIso()}
                className="h-7 w-[140px] text-xs"
              />
              <Button type="submit" size="sm" variant="outline" className="h-7">
                조회
              </Button>
              <Link
                href={buildViewHref('daily').replace(`date=${dailyDate}`, `date=${nextDayIso}`)}
                className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-background-subtle"
                title="다음일"
              >
                →
              </Link>
              {dailyDate !== todayIso() && (
                <Link
                  href={buildViewHref('daily').replace(`date=${dailyDate}`, `date=${todayIso()}`)}
                  className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-background-subtle"
                >
                  오늘
                </Link>
              )}
            </form>
          )}

          {/* 기간 (range 뷰만) */}
          {view === 'range' && (
            <form method="get" className="flex flex-wrap items-end gap-2">
              {searchParams.status && (
                <input type="hidden" name="status" value={searchParams.status} />
              )}
              {searchParams.direction && (
                <input type="hidden" name="direction" value={searchParams.direction} />
              )}
              {searchParams.plant && (
                <input type="hidden" name="plant" value={searchParams.plant} />
              )}
              {searchParams.company && (
                <input type="hidden" name="company" value={searchParams.company} />
              )}
              {searchTerm && <input type="hidden" name="q" value={searchTerm} />}
              <input type="hidden" name="view" value="range" />
              <div>
                <label className="block text-[10px] text-foreground-muted">시작일</label>
                <Input type="date" name="from" defaultValue={searchParams.from ?? ''} className="h-7 w-[140px] text-xs" />
              </div>
              <div>
                <label className="block text-[10px] text-foreground-muted">종료일</label>
                <Input type="date" name="to" defaultValue={searchParams.to ?? ''} className="h-7 w-[140px] text-xs" />
              </div>
              <Button type="submit" size="sm" variant="outline" className="h-7">조회</Button>
            </form>
          )}

          {/* 상태 칩 */}
          <div className="flex flex-nowrap items-center gap-1.5">
            <span className="whitespace-nowrap text-[12.5px] font-medium text-foreground-secondary">상태</span>
            {statusFilters.map((f) => {
              const active = (searchParams.status ?? 'all') === (f.value ?? 'all');
              const count = statusCounts[f.value ?? 'all'] ?? 0;
              return (
                <Link
                  key={f.id}
                  href={buildHref(f.value)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                    active
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-surface text-foreground-secondary hover:bg-background-subtle',
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      'rounded-full px-1 text-[9.5px] font-mono',
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

          {/* 구분 칩 */}
          <div className="flex flex-nowrap items-center gap-1.5">
            <span className="whitespace-nowrap text-[12.5px] font-medium text-foreground-secondary">구분</span>
            {(
              [
                { id: 'all', label: '전체', value: undefined },
                { id: 'in', label: '반입', value: 'in' },
                { id: 'out', label: '반출', value: 'out' },
              ] as Array<{ id: string; label: string; value?: string }>
            ).map((f) => {
              const active = (searchParams.direction ?? 'all') === (f.value ?? 'all');
              return (
                <Link
                  key={f.id}
                  href={buildDirectionHref(f.value)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                    active
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-surface text-foreground-secondary hover:bg-background-subtle',
                  )}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>

          {/* 거래처 select — 타자 검색 가능 */}
          <LogCompanyFilter
            companies={companies}
            defaultValue={searchParams.company ?? ''}
            preserved={{
              status: searchParams.status,
              direction: searchParams.direction,
              plant: searchParams.plant,
              view: view === 'range' ? 'range' : undefined,
              date: view === 'daily' ? dailyDate : undefined,
              from: view === 'range' ? searchParams.from : undefined,
              to: view === 'range' ? searchParams.to : undefined,
              q: searchTerm || undefined,
            }}
          />

          {/* 우측 — 선택 칩 + 초기화 */}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {searchTerm && (
              <span className="inline-flex items-center rounded-full bg-info-bg px-2 py-0.5 text-[10.5px] text-info">
                검색: &quot;{searchTerm}&quot;
              </span>
            )}
            {selectedCompanyName && (
              <span className="inline-flex items-center rounded-full bg-info-bg px-2 py-0.5 text-[10.5px] text-info">
                거래처: {selectedCompanyName}
              </span>
            )}
            {selectedPlantName && (
              <span className="inline-flex items-center rounded-full bg-info-bg px-2 py-0.5 text-[10.5px] text-info">
                처리장: {selectedPlantName}
              </span>
            )}
            {hasFilter && (
              <Link href="/logs">
                <Button type="button" size="sm" variant="ghost" className="h-7">
                  <X className="mr-1 h-3 w-3" strokeWidth={1.75} />초기화
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-7">
          {view === 'daily' && rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
              <p className="text-sm text-foreground-muted">
                {dailyDate} 일자에 등록된 일보가 없습니다.
              </p>
              <p className="mt-2 text-[11px] text-foreground-muted">
                새 일보를 입력하거나 다른 날짜를 선택해주세요.
              </p>
            </div>
          ) : (
            <LogsTable
              rows={rows}
              sitesByCompany={sitesByCompany}
              wasteTypes={wasteTypes}
            />
          )}
        </div>
      </div>
    </>
  );
}
