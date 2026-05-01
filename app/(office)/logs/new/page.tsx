import { PageHeader } from '@/components/erp/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { NewLogForm } from './_form';
import type { Site, WasteType, TreatmentPlant } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function NewLogPage() {
  const supabase = createClient();

  const [wasteTypesRes, treatmentPlantsRes, sitesRes] = await Promise.all([
    supabase.from('waste_types').select('*').order('name'),
    supabase.from('treatment_plants').select('*').order('name'),
    supabase.from('sites').select('*').eq('is_active', true).order('name'),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="새 일보 입력"
        subtitle="반입 / 반출 1건 1행"
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '폐기물일보', href: '/logs' },
          { label: '새 일보' },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-7">
        <NewLogForm
          wasteTypes={(wasteTypesRes.data ?? []) as WasteType[]}
          treatmentPlants={(treatmentPlantsRes.data ?? []) as TreatmentPlant[]}
          allSites={(sitesRes.data ?? []) as Site[]}
          initialDate={today}
        />
      </div>
    </>
  );
}
