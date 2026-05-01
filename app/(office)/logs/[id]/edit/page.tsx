import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/erp/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { LogForm } from '@/components/erp/LogForm';
import { formatDate } from '@/lib/format';
import type {
  WasteLog,
  Site,
  WasteType,
  TreatmentPlant,
  BillingType,
  Direction,
} from '@/lib/types/database';

export const dynamic = 'force-dynamic';

interface LogDetail extends WasteLog {
  companies: { id: string; name: string } | null;
  sites: { id: string; name: string } | null;
  waste_types: { id: string; name: string } | null;
  treatment_plants: { id: string; name: string } | null;
}

export default async function EditLogPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [logRes, wasteTypesRes, treatmentPlantsRes, sitesRes] = await Promise.all([
    supabase
      .from('waste_logs')
      .select(
        `*,
         companies(id, name),
         sites(id, name),
         waste_types(id, name),
         treatment_plants(id, name)`,
      )
      .eq('id', params.id)
      .maybeSingle(),
    supabase.from('waste_types').select('*').order('name'),
    supabase.from('treatment_plants').select('*').order('name'),
    supabase.from('sites').select('*').eq('is_active', true).order('name'),
  ]);

  if (!logRes.data) notFound();
  const detail = logRes.data as unknown as LogDetail;

  return (
    <>
      <PageHeader
        title="일보 수정"
        subtitle={`${formatDate(detail.log_date)} · ${detail.companies?.name ?? ''}`}
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '폐기물일보', href: '/logs' },
          { label: '상세', href: `/logs/${params.id}` },
          { label: '수정' },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-7">
        <LogForm
          mode="edit"
          logId={params.id}
          wasteTypes={(wasteTypesRes.data ?? []) as WasteType[]}
          treatmentPlants={(treatmentPlantsRes.data ?? []) as TreatmentPlant[]}
          allSites={(sitesRes.data ?? []) as Site[]}
          defaults={{
            log_date: detail.log_date,
            direction: detail.direction as Direction,
            company_id: detail.company_id,
            company_name: detail.companies?.name ?? '',
            site_name: detail.sites?.name ?? '',
            waste_type_name: detail.waste_types?.name ?? '',
            treatment_plant_name: detail.treatment_plants?.name ?? '',
            vehicle_no: detail.vehicle_no ?? '',
            weight_total_kg: detail.weight_total_kg ?? '',
            weight_tare_kg: detail.weight_tare_kg ?? '',
            weight_kg: detail.weight_kg ?? '',
            unit_price: detail.unit_price ?? '',
            transport_fee: detail.transport_fee ?? 0,
            billing_type: detail.billing_type as BillingType,
            note: detail.note ?? '',
          }}
        />
      </div>
    </>
  );
}
