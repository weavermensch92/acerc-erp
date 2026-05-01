import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/erp/PageHeader';
import { Button } from '@/components/ui/button';
import { PrintButton } from '@/components/erp/PrintButton';
import { WeightCertPreview } from '@/components/erp/WeightCertPreview';
import { createClient } from '@/lib/supabase/server';
import { getSelfCompanyInfo } from '@/lib/settings';

export const dynamic = 'force-dynamic';

interface LogDetail {
  log_date: string;
  vehicle_no: string | null;
  weight_total_kg: number | null;
  weight_tare_kg: number | null;
  weight_kg: number | null;
  companies: { name: string } | null;
  waste_types: { name: string } | null;
  treatment_plants: { name: string } | null;
}

export default async function WeightCertPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const selfCompany = await getSelfCompanyInfo(supabase);

  const { data } = await supabase
    .from('waste_logs')
    .select(
      `log_date, vehicle_no, weight_total_kg, weight_tare_kg, weight_kg,
       companies(name), waste_types(name), treatment_plants(name)`,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!data) notFound();
  const detail = data as unknown as LogDetail;
  if (!detail.companies || !detail.waste_types) notFound();

  return (
    <>
      <PageHeader
        title="계량증명서"
        subtitle="A4 1장 3부 분할 (배출자용 / 운반자용 / 처리자용)"
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '폐기물일보', href: '/logs' },
          { label: '상세', href: `/logs/${params.id}` },
          { label: '계량증명서' },
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
        <WeightCertPreview
          serial={params.id.slice(0, 8).toUpperCase()}
          log={{
            log_date: detail.log_date,
            vehicle_no: detail.vehicle_no,
            weight_total_kg: detail.weight_total_kg,
            weight_tare_kg: detail.weight_tare_kg,
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
