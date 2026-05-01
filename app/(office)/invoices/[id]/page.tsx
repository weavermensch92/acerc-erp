import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Copy, Printer } from 'lucide-react';
import { PageHeader } from '@/components/erp/PageHeader';
import { Pill } from '@/components/erp/Pill';
import { Button } from '@/components/ui/button';
import { CopyButton } from './_copy-button';
import { createClient } from '@/lib/supabase/server';
import { formatKRW, formatNumber, formatDate, formatDateTime } from '@/lib/format';
import type { InvoiceBatch } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

interface BatchDownload {
  id: string;
  company_id: string;
  downloaded_at: string;
  companies: {
    id: string;
    name: string;
    share_token: string | null;
    contact_phone: string | null;
  } | null;
}

export default async function BatchDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: batchData } = await supabase
    .from('invoice_batches')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!batchData) notFound();
  const batch = batchData as InvoiceBatch;

  const { data: dlData } = await supabase
    .from('pdf_downloads')
    .select(
      `id, company_id, downloaded_at,
       companies(id, name, share_token, contact_phone)`,
    )
    .eq('batch_id', params.id)
    .order('companies(name)', { ascending: true });
  const downloads = (dlData ?? []) as unknown as BatchDownload[];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3003';

  return (
    <>
      <PageHeader
        title={`일괄 발급 결과`}
        subtitle={`${formatDate(batch.period_from)} ~ ${formatDate(batch.period_to)} · ${batch.company_count}곳 · ${formatKRW(batch.total_amount)}`}
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '거래명세표', href: '/invoices' },
          { label: '발급 결과' },
        ]}
        actions={
          <Link href="/invoices/batches">
            <Button size="sm" variant="outline">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
              발급 이력
            </Button>
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-7">
        <div className="mb-4 rounded-md border border-success/40 bg-success-bg/60 px-4 py-3 text-sm text-success">
          <strong>{downloads.length}곳</strong>에 발급 이력이 기록되었습니다.
          각 거래처 카드의 [공유 링크 복사] 또는 [PDF 미리보기] 로 카톡/메일 전달하세요.
          {batch.note && <span className="block mt-1 text-[11.5px]">{batch.note}</span>}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {downloads.map((dl) => {
            const company = dl.companies;
            if (!company) return null;
            const previewUrl = `/invoices?company=${company.id}&period=${batch.period_from.slice(0, 7)}`;
            const shareUrl = company.share_token
              ? `${appUrl}/share/${company.share_token}`
              : null;
            return (
              <div
                key={dl.id}
                className="flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{company.name}</div>
                    <div className="mt-0.5 text-[11px] text-foreground-muted">
                      발급 {formatDateTime(dl.downloaded_at)}
                    </div>
                  </div>
                  {shareUrl ? (
                    <Pill tone="info" dot>
                      공유링크
                    </Pill>
                  ) : (
                    <Pill tone="warning">링크 미발급</Pill>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Link href={previewUrl} target="_blank" rel="noopener">
                    <Button size="sm" variant="outline">
                      <Printer className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />
                      PDF 미리보기
                    </Button>
                  </Link>
                  {shareUrl && (
                    <>
                      <CopyButton url={shareUrl} label="공유링크 복사" />
                      <Link href={shareUrl} target="_blank" rel="noopener">
                        <Button size="sm" variant="ghost">
                          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </Button>
                      </Link>
                    </>
                  )}
                </div>

                {company.contact_phone && (
                  <div className="text-[10.5px] text-foreground-muted">
                    📱 {company.contact_phone} (수동 카톡 전송)
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-5 text-[11px] text-foreground-muted">
          * 카톡 자동 전송 / OS 공유시트는 Phase 2 (PRD § 시나리오 4).
          현재는 [공유링크 복사] 후 사용자가 직접 카톡으로 붙여넣어 전송합니다.
        </p>
      </div>
    </>
  );
}
