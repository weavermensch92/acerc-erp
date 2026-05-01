import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Download } from 'lucide-react';
import { PageHeader } from '@/components/erp/PageHeader';
import { Pill } from '@/components/erp/Pill';
import { StatCard } from '@/components/erp/StatCard';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { createClient } from '@/lib/supabase/server';
import { formatKRW, formatKg, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import type { Snapshot, Direction, LogStatus } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

interface SnapshotLog {
  id: string;
  log_date: string;
  direction: Direction;
  weight_kg: number | null;
  total_amount: number | null;
  status: LogStatus;
  is_paid: boolean;
  companies: { name: string } | null;
  waste_types: { name: string } | null;
}

const directionLabel: Record<Direction, string> = { in: '반입', out: '반출' };

export default async function SnapshotDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: snapData } = await supabase
    .from('snapshots')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!snapData) notFound();
  const snap = snapData as Snapshot;

  // 그 시점 일보: created_at <= snapshot.created_at
  const { data: logs } = await supabase
    .from('waste_logs')
    .select(
      `id, log_date, direction, weight_kg, total_amount, status, is_paid,
       companies(name), waste_types(name)`,
    )
    .lte('created_at', snap.created_at)
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);

  const rows = (logs ?? []) as unknown as SnapshotLog[];
  const stats = {
    count: rows.length,
    activeCount: rows.filter((r) => r.status === 'active').length,
    pendingCount: rows.filter((r) => r.status === 'pending_review').length,
    archivedCount: rows.filter((r) => r.status === 'archived').length,
    totalAmount: rows.reduce((s, r) => s + (r.total_amount ?? 0), 0),
  };

  return (
    <>
      {/* 과거 시점 보기 — 노란 띠 */}
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b-2 border-warning bg-warning-bg px-7 py-2.5 text-warning print:hidden">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
          <span className="text-sm font-semibold">
            과거 시점 보기 (읽기 전용)
          </span>
          <span className="text-[11.5px] opacity-80">
            · {formatDateTime(snap.created_at)} 기준
          </span>
        </div>
        <Link href="/dashboard">
          <Button size="sm" variant="outline" className="border-warning text-warning hover:bg-warning-bg/60">
            현재로 돌아가기
          </Button>
        </Link>
      </div>

      <PageHeader
        title={`스냅샷 — ${formatDate(snap.snapshot_date)}`}
        subtitle={snap.note ?? '비고 없음'}
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '스냅샷', href: '/snapshots' },
          { label: formatDate(snap.snapshot_date) },
        ]}
        actions={
          <>
            <a href={`/api/snapshots/${snap.id}/csv`} target="_blank" rel="noopener">
              <Button size="sm" variant="outline">
                <Download className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />CSV 다운로드
              </Button>
            </a>
            <Link href="/snapshots">
              <Button size="sm" variant="outline">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />목록
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex-1 space-y-5 overflow-y-auto p-7">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="총 일보" value={formatNumber(stats.count)} hint="archived 포함" />
          <StatCard label="정식" value={formatNumber(stats.activeCount)} tone="success" />
          <StatCard
            label="검토 대기"
            value={formatNumber(stats.pendingCount)}
            tone={stats.pendingCount > 0 ? 'warning' : 'neutral'}
          />
          <StatCard label="청구 합계" value={formatKRW(stats.totalAmount)} hint="VAT 포함" />
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>일자</TableHead>
                <TableHead>구분</TableHead>
                <TableHead>거래처</TableHead>
                <TableHead>성상</TableHead>
                <TableHead className="text-right">중량</TableHead>
                <TableHead className="text-right">청구금액</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="cursor-default">
                  <TableCell className="font-mono text-xs">
                    {formatDate(row.log_date)}
                  </TableCell>
                  <TableCell>
                    <Pill tone={row.direction === 'in' ? 'info' : 'primary'}>
                      {directionLabel[row.direction]}
                    </Pill>
                  </TableCell>
                  <TableCell className="font-medium">
                    {row.companies?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-foreground-secondary">
                    {row.waste_types?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatKg(row.weight_kg)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatKRW(row.total_amount)}
                  </TableCell>
                  <TableCell>
                    <Pill
                      tone={
                        row.status === 'active'
                          ? 'success'
                          : row.status === 'pending_review'
                            ? 'warning'
                            : 'neutral'
                      }
                      dot
                    >
                      {row.status}
                    </Pill>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-[11px] text-foreground-muted">
          * 이 화면은 스냅샷 시각 기준 데이터로, 그 이후 추가/수정된 일보는 보이지 않습니다.
          <br />* 실 데이터를 수정하려면 [현재로 돌아가기] 후 일보 상세에서 진행하세요.
        </p>
      </div>
    </>
  );
}
