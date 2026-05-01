import { PageHeader } from '@/components/erp/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { TreatmentPlantsClient } from './_client';
import type { TreatmentPlant } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function TreatmentPlantsPage() {
  const supabase = createClient();

  const { data: plants } = await supabase
    .from('treatment_plants')
    .select('*')
    .order('name');

  const { data: counts } = await supabase
    .from('waste_logs')
    .select('treatment_plant_id')
    .neq('status', 'archived')
    .not('treatment_plant_id', 'is', null);

  const usageMap: Record<string, number> = {};
  for (const r of (counts ?? []) as { treatment_plant_id: string | null }[]) {
    if (r.treatment_plant_id) {
      usageMap[r.treatment_plant_id] = (usageMap[r.treatment_plant_id] ?? 0) + 1;
    }
  }

  return (
    <>
      <PageHeader
        title="처리장 마스터"
        subtitle="폐기물 최종 처리 시설"
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '마스터', href: '/masters' },
          { label: '처리장' },
        ]}
      />
      <TreatmentPlantsClient
        plants={(plants ?? []) as TreatmentPlant[]}
        usageMap={usageMap}
      />
    </>
  );
}
