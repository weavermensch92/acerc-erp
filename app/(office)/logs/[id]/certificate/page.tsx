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
}

export default async function CertificatePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const selfCompany = await getSelfCompanyInfo(supabase);

  const { data } = await supabase
    .from('waste_logs')
    .select(
      `log_date, vehicle_no, weight_kg,
       companies(name, business_no, address, contact_name, contact_phone),
       waste_types(name),
       treatment_plants(name, address)`,
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
        <CertificatePreview
          serial={params.id.slice(0, 8).toUpperCase()}
          log={{
            log_date: detail.log_date,
            vehicle_no: detail.vehicle_no,
            weight_kg: detail.weight_kg,
          }}
          company={detail.companies}
          selfCompany={selfCompany}
          plant={detail.treatment_plants}
          wasteType={detail.waste_types}
        />
      </div>
    </>
  );
}
