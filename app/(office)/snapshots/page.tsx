import Link from 'next/link';
import { Camera, Download, Eye, Calendar } from 'lucide-react';
import { PageHeader } from '@/components/erp/PageHeader';
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
import { formatKRW, formatNumber, formatDateTime, formatDate } from '@/lib/format';
import { CreateSnapshotButton } from './_create-button';
import { DeleteSnapshotButton } from './_delete-button';
import type { Snapshot } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function SnapshotsPage() {
  const supabase = createClient();
  const { data: snapshotsData } = await supabase
    .from('snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  const snapshots = (snapshotsData ?? []) as Snapshot[];

  return (
    <>
      <PageHeader
        title="스냅샷"
        subtitle="일자별 데이터 스냅샷 — 과거 시점 조회"
        breadcrumb={[{ label: '에이스알앤씨' }, { label: '스냅샷' }]}
        actions={<CreateSnapshotButton />}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-7 py-3">
          <span className="text-[11.5px] text-foreground-muted">
            총 {snapshots.length} 개 (최근 50)
          </span>
          <span className="text-[11.5px] text-foreground-muted">
            ※ 자동 일일 스냅샷은 Phase 2 (cron) 에서 추가
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-7">
          {snapshots.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
              <Camera
                className="mx-auto h-8 w-8 text-foreground-muted"
                strokeWidth={1.5}
              />
              <p className="mt-2 text-sm text-foreground-muted">
                저장된 스냅샷이 없습니다.
              </p>
              <p className="mt-1 text-[11px] text-foreground-muted">
                우상단 [지금 스냅샷] 으로 현재 시점 데이터를 기록하세요.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>스냅샷 시각</TableHead>
                    <TableHead>기준일</TableHead>
                    <TableHead className="text-right">일보 건수</TableHead>
                    <TableHead className="text-right">거래처 수</TableHead>
                    <TableHead className="text-right">청구 합계</TableHead>
                    <TableHead>비고</TableHead>
                    <TableHead className="w-44"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">
                        {formatDateTime(s.created_at)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <Calendar
                          className="mr-1 inline h-3 w-3 text-foreground-muted"
                          strokeWidth={1.75}
                        />
                        {formatDate(s.snapshot_date)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(s.log_count)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-foreground-secondary">
                        {formatNumber(s.company_count)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatKRW(s.total_amount)}
                      </TableCell>
                      <TableCell className="text-xs text-foreground-secondary">
                        {s.note ?? '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Link href={`/snapshots/${s.id}`}>
                            <Button size="sm" variant="ghost" title="이 시점 미리보기">
                              <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </Button>
                          </Link>
                          <a
                            href={`/api/snapshots/${s.id}/csv`}
                            target="_blank"
                            rel="noopener"
                          >
                            <Button size="sm" variant="ghost" title="CSV 다운로드">
                              <Download
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                            </Button>
                          </a>
                          <DeleteSnapshotButton id={s.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
