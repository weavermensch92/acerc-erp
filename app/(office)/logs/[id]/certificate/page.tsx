import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/erp/PageHeader';
import { Button } from '@/components/ui/button';
import { PrintButton } from '@/components/erp/PrintButton';
import { CertificatePreview } from '@/components/erp/CertificatePreview';
import { createClient } from '@/lib/supabase/server';
import { getSelfCompanyInfo } from '@/lib/settings';

export const dynamic = 'force-dynamic';

interface LogDetail {
  log_date: string;
  vehicle_no: string | null;
  weight_kg: number | null;
  companies: {
    name: string;
    business_no: string | null;
    address: string | null;
    contact_name: string | null;
    contact_phone: string | null;
  } | null;
  waste_types: { name: string } | null;
  treatment_plants: { name: string; address: string | null } | null;
  treatment_plant_name_snapshot: string | null;
}

export default async function CertificatePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { selfAsProcessor?: string };
}) {
  const supabase = createClient();
  const selfCompany = await getSelfCompanyInfo(supabase);
  const selfAsProcessor = searchParams.selfAsProcessor === '1';

  const { data } = await supabase
    .from('waste_logs')
    .select(
      `log_date, vehicle_no, weight_kg,
       companies(name, business_no, address, contact_name, contact_phone),
       waste_types(name),
       treatment_plants(name, address),
       treatment_plant_name_snapshot`,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!data) notFound();
  const detail = data as unknown as LogDetail;

  if (!detail.companies || !detail.waste_types) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="처리확인서"
        subtitle="폐기물관리법 § 시나리오 5 표준 양식"
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '폐기물일보', href: '/logs' },
          { label: '상세', href: `/logs/${params.id}` },
          { label: '처리확인서' },
        ]}
        actions={
          <>
            <PrintButton label="인쇄 / PDF 저장" />
            <Link href={`/logs/${params.id}`}>
              <Button size="sm" variant="outline">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
                돌아가기
              </Button>
            </Link>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto p-7 print:p-0">
        {selfCompany.stamp_url && (
          <div className="mb-4 flex items-center justify-end gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs print:hidden">
            <span className="text-foreground-muted">처리자에도 자사 도장 적용:</span>
            <Link
              href={`?selfAsProcessor=${selfAsProcessor ? '0' : '1'}`}
              className="rounded-full border border-border px-3 py-1 font-medium hover:bg-background-subtle"
            >
              {selfAsProcessor ? '✓ 적용 중 (해제)' : '적용하기'}
            </Link>
            <span className="text-[10.5px] text-foreground-muted">
              자사가 처리장 역할도 하는 경우만 사용
            </span>
          </div>
        )}
        <CertificatePreview
          serial={params.id.slice(0, 8).toUpperCase()}
          log={{
            log_date: detail.log_date,
            vehicle_no: detail.vehicle_no,
            weight_kg: detail.weight_kg,
          }}
          company={detail.companies}
          selfCompany={selfCompany}
          plant={
            detail.treatment_plants ??
            (detail.treatment_plant_name_snapshot
              ? { name: detail.treatment_plant_name_snapshot, address: null }
              : null)
          }
          wasteType={detail.waste_types}
          selfAsProcessor={selfAsProcessor}
        />
      </div>
    </>
  );
}
