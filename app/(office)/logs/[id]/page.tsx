import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/erp/PageHeader';
import { Pill } from '@/components/erp/Pill';
import { Button } from '@/components/ui/button';
import { PhotoSection } from '@/components/erp/PhotoSection';
import { DownloadHistoryBanner } from '@/components/erp/DownloadHistoryBanner';
import { createClient } from '@/lib/supabase/server';
import { getReviewProcessEnabled } from '@/lib/settings';
import { formatKRW, formatKg, formatDate, formatDateTime } from '@/lib/format';
import { LogActions } from './_actions';
import type {
  WasteLog,
  LogStatus,
  Direction,
  BillingType,
  Attachment,
  FieldUploadLink,
} from '@/lib/types/database';

export const dynamic = 'force-dynamic';

const directionLabel: Record<Direction, string> = { in: '반입', out: '반출' };
const statusLabel: Record<LogStatus, string> = {
  draft: '임시저장',
  pending_review: '검토 대기',
  active: '정식',
  archived: '보관',
};
const billingLabel: Record<BillingType, string> = {
  weight_based: '중량기준',
  flat_rate: '정액',
  internal: '사급',
  tax_exempt: '면세',
};

function statusTone(status: LogStatus): 'neutral' | 'warning' | 'success' {
  if (status === 'pending_review') return 'warning';
  if (status === 'active') return 'success';
  return 'neutral';
}

interface LogDetail extends WasteLog {
  companies: { id: string; name: string; business_no: string | null } | null;
  sites: { id: string; name: string } | null;
  waste_types: { id: string; name: string } | null;
  treatment_plants: { id: string; name: string } | null;
}

interface AuditRow {
  id: string;
  action: string;
  change_reason: string | null;
  changed_by: string | null;
  changed_at: string;
}

export default async function LogDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const reviewEnabled = await getReviewProcessEnabled();

  const { data: log } = await supabase
    .from('waste_logs')
    .select(
      `*,
       companies(id, name, business_no),
       sites(id, name),
       waste_types(id, name),
       treatment_plants(id, name)`,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!log) notFound();
  const detail = log as unknown as LogDetail;

  const [auditsRes, attachmentsRes, activeLinkRes, downloadsRes] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('id, action, change_reason, changed_by, changed_at')
      .eq('table_name', 'waste_logs')
      .eq('record_id', params.id)
      .order('changed_at', { ascending: false })
      .limit(20),
    supabase
      .from('attachments')
      .select('*')
      .eq('waste_log_id', params.id)
      .order('uploaded_at', { ascending: false }),
    supabase
      .from('field_upload_links')
      .select('*')
      .eq('waste_log_id', params.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // 시나리오 7 — 이 일보의 거래처가 이 일자를 포함하는 명세표를 받아간 이력
    supabase
      .from('pdf_downloads')
      .select('id, downloaded_at, period_from, period_to, downloaded_by')
      .eq('company_id', detail.company_id)
      .lte('period_from', detail.log_date)
      .gte('period_to', detail.log_date)
      .order('downloaded_at', { ascending: false })
      .limit(20),
  ]);

  const auditRows = (auditsRes.data ?? []) as AuditRow[];
  const attachments = (attachmentsRes.data ?? []) as Attachment[];
  const downloadHistories = (downloadsRes.data ?? []) as Array<{
    id: string;
    downloaded_at: string;
    period_from: string | null;
    period_to: string | null;
    downloaded_by: string | null;
  }>;
  const activeLink = (activeLinkRes.data ?? null) as FieldUploadLink | null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3003';

  return (
    <>
      <PageHeader
        title={`일보 #${detail.id.slice(0, 8)}`}
        subtitle={`${formatDate(detail.log_date)} · ${directionLabel[detail.direction]} · ${detail.companies?.name ?? ''}`}
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '폐기물일보', href: '/logs' },
          { label: '상세' },
        ]}
        actions={
          <Link href="/logs">
            <Button size="sm" variant="outline">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />목록
            </Button>
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-7">
        {downloadHistories.length > 0 && (
          <div className="mb-5">
            <DownloadHistoryBanner
              histories={downloadHistories}
              companyName={detail.companies?.name}
            />
          </div>
        )}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <Section title="기본정보">
              <Field label="일자">{formatDate(detail.log_date)}</Field>
              <Field label="구분">
                <Pill tone={detail.direction === 'in' ? 'info' : 'primary'}>
                  {directionLabel[detail.direction]}
                </Pill>
              </Field>
              <Field label="거래처">
                <span>{detail.companies?.name ?? '—'}</span>
                {detail.companies?.business_no && (
                  <span className="ml-2 text-xs text-foreground-muted">
                    {detail.companies.business_no}
                  </span>
                )}
              </Field>
              <Field label="공사현장">{detail.sites?.name ?? '—'}</Field>
            </Section>

            <Section title="폐기물">
              <Field label="성상">{detail.waste_types?.name ?? '—'}</Field>
              <Field label="처리장">{detail.treatment_plants?.name ?? '—'}</Field>
              <Field label="차량번호">
                <span className="font-mono">{detail.vehicle_no ?? '—'}</span>
              </Field>
            </Section>

            <Section title="금액">
              <Field label="청구 타입">
                <Pill tone="neutral">{billingLabel[detail.billing_type]}</Pill>
              </Field>
              <Field label="중량">
                <span className="font-mono">{formatKg(detail.weight_kg)}</span>
              </Field>
              <Field label="단가">
                <span className="font-mono">{formatKRW(detail.unit_price)}</span>
              </Field>
              <Field label="운반비">
                <span className="font-mono">{formatKRW(detail.transport_fee)}</span>
              </Field>
              <div className="grid grid-cols-3 gap-3 pt-2">
                <CalcCell label="공급가액" value={formatKRW(detail.supply_amount)} />
                <CalcCell label="부가세" value={formatKRW(detail.vat)} />
                <CalcCell
                  label="청구금액"
                  value={formatKRW(detail.total_amount)}
                  primary
                />
              </div>
            </Section>

            {detail.note && (
              <Section title="비고">
                <p className="whitespace-pre-wrap text-sm">{detail.note}</p>
              </Section>
            )}

            <PhotoSection
              logId={detail.id}
              attachments={attachments}
              activeLink={activeLink}
              appUrl={appUrl}
            />

            <Section title="변경 이력">
              {auditRows.length === 0 ? (
                <p className="text-xs text-foreground-muted">아직 변경 이력이 없습니다.</p>
              ) : (
                <ul className="space-y-1.5">
                  {auditRows.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 border-b border-divider pb-1.5 text-xs last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-background-subtle px-2 py-px font-medium">
                          {a.action}
                        </span>
                        {a.change_reason && (
                          <span className="text-foreground">{a.change_reason}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-foreground-muted">
                        <span>{a.changed_by ?? 'system'}</span>
                        <span className="font-mono">{formatDateTime(a.changed_at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <aside>
            <div className="sticky top-4 space-y-4">
              <div className="rounded-[10px] border border-border bg-surface p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-medium text-foreground-muted">상태</span>
                  <Pill tone={statusTone(detail.status)} dot>
                    {statusLabel[detail.status]}
                  </Pill>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <FlagCell label="청구" on={detail.is_invoiced} />
                  <FlagCell label="결제" on={detail.is_paid} />
                </div>
              </div>
              <LogActions
                logId={detail.id}
                status={detail.status}
                reviewEnabled={reviewEnabled}
              />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
      <h3 className="mb-3 text-[13px] font-semibold tracking-tight">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-divider pb-2 text-sm last:border-0 last:pb-0">
      <span className="text-foreground-muted">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function CalcCell({
  label,
  value,
  primary = false,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <div
      className={`rounded-md border ${
        primary
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-background-subtle text-foreground'
      } p-3`}
    >
      <div
        className={`text-[10.5px] ${primary ? 'opacity-80' : 'text-foreground-muted'}`}
      >
        {label}
      </div>
      <div className="mt-1 font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

function FlagCell({ label, on }: { label: string; on: boolean }) {
  return (
    <div
      className={`rounded-md border p-2 text-center ${
        on
          ? 'border-success bg-success-bg text-success'
          : 'border-border bg-background-subtle text-foreground-muted'
      }`}
    >
      <div className="text-[10.5px] opacity-80">{label}</div>
      <div className="text-sm font-medium">{on ? '✓' : '대기'}</div>
    </div>
  );
}
