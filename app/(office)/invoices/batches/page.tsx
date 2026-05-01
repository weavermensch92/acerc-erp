import Link from 'next/link';
import { Plus, Eye, Send } from 'lucide-react';
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
import { formatKRW, formatNumber, formatDate, formatDateTime } from '@/lib/format';
import type { InvoiceBatch } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function BatchesPage() {
  const supabase = createClient();
  const { data: batchesData } = await supabase
    .from('invoice_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  const batches = (batchesData ?? []) as InvoiceBatch[];

  return (
    <>
      <PageHeader
        title="발급 이력"
        subtitle="거래명세표 일괄 발급 batch 목록"
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '거래명세표', href: '/invoices' },
          { label: '발급 이력' },
        ]}
        actions={
          <Link href="/invoices/new">
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />새 일괄 발급
            </Button>
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-7">
        {batches.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
            <Send className="mx-auto h-8 w-8 text-foreground-muted" strokeWidth={1.5} />
            <p className="mt-2 text-sm text-foreground-muted">
              아직 발급된 일괄 거래명세표가 없습니다.
            </p>
            <Link
              href="/invoices/new"
              className="mt-3 inline-block text-sm font-medium text-foreground underline"
            >
              새 일괄 발급 →
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>발급 시각</TableHead>
                  <TableHead>대상 기간</TableHead>
                  <TableHead className="text-right">거래처 수</TableHead>
                  <TableHead className="text-right">청구 합계</TableHead>
                  <TableHead>비고</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">
                      {formatDateTime(b.created_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatDate(b.period_from)} ~ {formatDate(b.period_to)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(b.company_count)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatKRW(b.total_amount)}
                    </TableCell>
                    <TableCell className="text-xs text-foreground-secondary">
                      {b.note ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Link href={`/invoices/${b.id}`}>
                        <Button size="sm" variant="ghost">
                          <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
