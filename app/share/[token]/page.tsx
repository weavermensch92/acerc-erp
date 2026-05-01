import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSelfCompanyInfo } from '@/lib/settings';
import { formatKRW, formatKg, formatDate, formatMonth } from '@/lib/format';
import { Pill } from '@/components/erp/Pill';
import { SharePrintButton } from '@/components/erp/SharePrintButton';
import {
  InvoicePreview,
  type InvoiceLog,
  type InvoiceCompanyInfo,
} from '@/components/erp/InvoicePreview';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import type { Direction } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

const directionLabel: Record<Direction, string> = { in: '반입', out: '반출' };

interface SharePageProps {
  params: { token: string };
  searchParams: { month?: string };
}

interface ShareLog {
  id: string;
  log_date: string;
  direction: Direction;
  vehicle_no: string | null;
  weight_kg: number | null;
  unit_price: number | null;
  transport_fee: number | null;
  supply_amount: number | null;
  vat: number | null;
  total_amount: number | null;
  is_invoiced: boolean;
  is_paid: boolean;
  sites: { name: string } | null;
  waste_types: { name: string } | null;
}

function getMonthRange(monthParam?: string) {
  let date: Date;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number);
    date = new Date(y, m - 1, 1);
  } else {
    const now = new Date();
    date = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const yyyymm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return {
    start: fmt(start),
    end: fmt(end),
    label: formatMonth(date),
    paramKey: yyyymm,
  };
}

function buildMonthOptions() {
  const now = new Date();
  const options: Array<{ value: string; label: string }> = [];
  for (let i = -6; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    options.push({ value, label: formatMonth(d) });
  }
  return options.reverse();
}

export default async function SharePage({ params, searchParams }: SharePageProps) {
  const token = params.token;
  // PRD § 9.1 토큰 길이 12 자 이상 (nanoid)
  if (!token || token.length < 12) {
    notFound();
  }

  const admin = createAdminClient();
  const selfCompany = await getSelfCompanyInfo(admin);

  // 1) 토큰 → 거래처 매핑 (회사 격리 핵심)
  const { data: company } = await admin
    .from('companies')
    .select('id, name, business_no, address, contact_name, contact_phone')
    .eq('share_token', token)
    .maybeSingle();

  if (!company) notFound();

  const { start, end, label, paramKey } = getMonthRange(searchParams.month);

  // 2) 해당 거래처 일보만 명시적 컬럼 SELECT (다른 거래처 정보 leak 방지)
  const { data: logs } = await admin
    .from('waste_logs')
    .select(
      `id, log_date, direction, vehicle_no, weight_kg, unit_price, transport_fee,
       supply_amount, vat, total_amount,
       is_invoiced, is_paid,
       sites(name), waste_types(name)`,
    )
    .eq('company_id', company.id)
    .neq('status', 'archived')
    .gte('log_date', start)
    .lte('log_date', end)
    .order('log_date', { ascending: false });

  const rows = (logs ?? []) as unknown as ShareLog[];

  const stats = {
    count: rows.length,
    totalAmount: rows.reduce((s, r) => s + (r.total_amount ?? 0), 0),
    unpaidCount: rows.filter((r) => !r.is_paid).length,
    unpaidAmount: rows
      .filter((r) => !r.is_paid)
      .reduce((s, r) => s + (r.total_amount ?? 0), 0),
  };

  const monthOptions = buildMonthOptions();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-4 py-4 md:px-7 md:py-5 print:hidden">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              A
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-semibold tracking-tight">{company.name}</span>
              <span className="text-[11px] text-foreground-muted">
                (주)에이스알앤씨 거래내역
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 인쇄용 (화면에서 hidden, 인쇄 시만 표시) — 정식 거래명세표 양식 */}
      {rows.length > 0 && (
        <div className="hidden print:block">
          <InvoicePreview
            company={{
              id: company.id,
              name: company.name,
              business_no: company.business_no,
              address: (company as { address?: string | null }).address ?? null,
              contact_name: (company as { contact_name?: string | null }).contact_name ?? null,
              contact_phone: (company as { contact_phone?: string | null }).contact_phone ?? null,
            }}
            selfCompany={selfCompany}
            period={{ from: start, to: end }}
            logs={rows as unknown as InvoiceLog[]}
          />
        </div>
      )}

      <main className="mx-auto max-w-3xl space-y-4 p-4 md:p-7 print:hidden">
        {/* 월 선택 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-base font-semibold tracking-tight">{label} 거래</h1>
          <form method="get" className="flex items-center gap-2">
            <select
              name="month"
              defaultValue={paramKey}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-background-subtle"
            >
              조회
            </button>
          </form>
        </div>

        {/* 요약 카드 3 */}
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <SummaryCard label="이번달 건수" value={String(stats.count)} hint="active 기준" />
          <SummaryCard
            label="청구 합계"
            value={formatKRW(stats.totalAmount)}
            hint="VAT 포함"
          />
          <SummaryCard
            label="미결제"
            value={formatKRW(stats.unpaidAmount)}
            hint={`${stats.unpaidCount}건`}
            tone={stats.unpaidAmount > 0 ? 'danger' : 'neutral'}
          />
        </div>

        {/* 거래내역 */}
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
            <p className="text-sm text-foreground-muted">
              {label} 에 등록된 거래가 없습니다.
            </p>
          </div>
        ) : (
          <>
            {/* 모바일: 카드 리스트 */}
            <ul className="space-y-2 md:hidden">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-border bg-surface p-3.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[11px] text-foreground-muted">
                        {formatDate(row.log_date)}
                      </span>
                      <span className="text-sm font-medium">
                        {row.waste_types?.name ?? '—'}
                      </span>
                      <span className="text-[11px] text-foreground-muted">
                        {row.sites?.name ?? '현장 미지정'} · {formatKg(row.weight_kg)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-mono text-sm font-semibold">
                        {formatKRW(row.total_amount)}
                      </span>
                      <Pill tone={row.is_paid ? 'success' : 'warning'}>
                        {row.is_paid ? '결제 완료' : '미결제'}
                      </Pill>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* 데스크톱: 테이블 */}
            <div className="hidden overflow-hidden rounded-lg border border-border bg-surface shadow-sm md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>일자</TableHead>
                    <TableHead>구분</TableHead>
                    <TableHead>현장</TableHead>
                    <TableHead>성상</TableHead>
                    <TableHead className="text-right">중량</TableHead>
                    <TableHead className="text-right">청구금액</TableHead>
                    <TableHead>결제</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">
                        {formatDate(row.log_date)}
                      </TableCell>
                      <TableCell>
                        <Pill tone={row.direction === 'in' ? 'info' : 'primary'}>
                          {directionLabel[row.direction]}
                        </Pill>
                      </TableCell>
                      <TableCell>{row.sites?.name ?? '—'}</TableCell>
                      <TableCell>{row.waste_types?.name ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatKg(row.weight_kg)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatKRW(row.total_amount)}
                      </TableCell>
                      <TableCell>
                        <Pill tone={row.is_paid ? 'success' : 'warning'}>
                          {row.is_paid ? '완료' : '대기'}
                        </Pill>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* 인쇄 / PDF — 거래명세표 양식으로 (브라우저 [Ctrl+P] → "PDF로 저장") */}
        <div className="flex flex-wrap gap-2 pt-2 print:hidden">
          <SharePrintButton
            companyId={company.id}
            periodFrom={start}
            periodTo={end}
            shareToken={token}
          />
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground-muted opacity-60"
            title="Phase 2 예정"
          >
            엑셀 다운로드 (Phase 2)
          </button>
        </div>

        <footer className="pt-6 text-center text-[11px] text-foreground-muted">
          문의: (주)에이스알앤씨 사무실
        </footer>
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <div
      className={`rounded-[10px] border bg-surface p-3 shadow-sm md:p-4 ${
        tone === 'danger' ? 'border-danger/40' : 'border-border'
      }`}
    >
      <div className="text-[10.5px] font-medium text-foreground-muted">{label}</div>
      <div className="mt-1.5 font-mono text-sm font-semibold tracking-tight md:text-lg">
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[10px] text-foreground-muted">{hint}</div>}
    </div>
  );
}
