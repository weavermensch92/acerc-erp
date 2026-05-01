import { notFound } from 'next/navigation';
import { Camera, Calendar, MapPin, Truck, type LucideIcon } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDate, formatKg } from '@/lib/format';
import { FieldUploadForm } from './_upload';

export const dynamic = 'force-dynamic';

interface LinkInfo {
  id: string;
  status: string;
  expires_at: string;
  recipient_name: string | null;
  waste_log_id: string;
}

interface LogContext {
  log_date: string;
  vehicle_no: string | null;
  weight_kg: number | null;
  companies: { name: string } | null;
  sites: { name: string } | null;
  waste_types: { name: string } | null;
  treatment_plants: { name: string } | null;
}

export default async function FieldUploadPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  if (!token || token.length < 12) notFound();

  const admin = createAdminClient();

  const { data: linkData } = await admin
    .from('field_upload_links')
    .select('id, status, expires_at, recipient_name, waste_log_id')
    .eq('token', token)
    .maybeSingle();

  if (!linkData) notFound();
  const link = linkData as LinkInfo;

  // 상태 분기
  const expired = new Date(link.expires_at).getTime() < Date.now();
  const isUsed = link.status === 'used';
  const isRevoked = link.status === 'revoked';
  const isActive = link.status === 'active' && !expired;

  // 일보 컨텍스트 (기사가 어떤 일보용 사진인지 확인 가능)
  const { data: logData } = await admin
    .from('waste_logs')
    .select(
      `log_date, vehicle_no, weight_kg,
       companies(name), sites(name), waste_types(name), treatment_plants(name)`,
    )
    .eq('id', link.waste_log_id)
    .maybeSingle();
  const log = logData as unknown as LogContext;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-4 py-4">
        <div className="mx-auto flex max-w-md items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            A
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[14px] font-semibold tracking-tight">
              사진 업로드
            </span>
            <span className="text-[10.5px] text-foreground-muted">
              (주)에이스알앤씨 — 일회용 링크
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 p-4">
        {/* 일보 컨텍스트 카드 */}
        <div className="rounded-[10px] border border-border bg-surface p-4 shadow-sm">
          <div className="text-[11px] text-foreground-muted">
            {link.recipient_name ? `${link.recipient_name} 기사님 — ` : ''}아래 거래
            건의 사진을 업로드해 주세요.
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <CtxLine icon={Calendar} label="일자" value={formatDate(log?.log_date)} />
            <CtxLine
              icon={MapPin}
              label="거래처 / 현장"
              value={`${log?.companies?.name ?? '—'} / ${log?.sites?.name ?? '—'}`}
            />
            <CtxLine
              icon={Camera}
              label="성상 / 중량"
              value={`${log?.waste_types?.name ?? '—'} · ${formatKg(log?.weight_kg)}`}
            />
            <CtxLine icon={Truck} label="차량" value={log?.vehicle_no ?? '—'} />
          </div>
        </div>

        {/* 상태별 UI */}
        {isRevoked && (
          <Status tone="danger" title="링크가 회수되었습니다">
            사무실에 연락해 새 링크를 받아주세요.
          </Status>
        )}
        {expired && link.status !== 'used' && (
          <Status tone="danger" title="링크가 만료되었습니다 (24시간 경과)">
            사무실에 연락해 새 링크를 요청해주세요.
          </Status>
        )}
        {isUsed && (
          <Status tone="success" title="이미 업로드 완료된 링크입니다">
            사진이 정상 접수되었습니다. 추가 업로드는 사무실에서 새 링크를 발급해야
            합니다.
          </Status>
        )}
        {isActive && (
          <FieldUploadForm token={token} expiresAt={link.expires_at} />
        )}

        <footer className="pt-4 text-center text-[10.5px] text-foreground-muted">
          문의: (주)에이스알앤씨 사무실
        </footer>
      </main>
    </div>
  );
}

function CtxLine({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <Icon className="h-3.5 w-3.5 text-foreground-muted" strokeWidth={1.75} />
      <span className="w-20 text-foreground-muted">{label}</span>
      <span className="flex-1">{value}</span>
    </div>
  );
}

function Status({
  tone,
  title,
  children,
}: {
  tone: 'success' | 'danger';
  title: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === 'success'
      ? 'border-success/40 bg-success-bg/60 text-success'
      : 'border-danger/40 bg-danger-bg/60 text-danger';
  return (
    <div className={`rounded-[10px] border p-4 ${cls}`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs">{children}</div>
    </div>
  );
}
