import { PageHeader } from '@/components/erp/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { BulkLogClient } from './_client';

export const dynamic = 'force-dynamic';

export default async function BulkLogPage() {
  const supabase = createClient();

  const [companiesRes, wasteTypesRes, treatmentPlantsRes] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name, default_unit_price')
      .eq('is_deleted', false)
      .order('name'),
    supabase.from('waste_types').select('id, name, default_unit_price').order('name'),
    supabase.from('treatment_plants').select('id, name').order('name'),
  ]);

  return (
    <>
      <PageHeader
        title="빠른 입력 (스프레드시트)"
        subtitle="여러 일보를 한 화면에서 일괄 등록 — 파워유저 모드 (Tab / Shift+Tab)"
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '폐기물일보', href: '/logs' },
          { label: '빠른 입력' },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-7">
        <BulkLogClient
          companies={(companiesRes.data ?? []) as Array<{
            id: string;
            name: string;
            default_unit_price: number | null;
          }>}
          wasteTypes={(wasteTypesRes.data ?? []) as Array<{
            id: string;
            name: string;
            default_unit_price: number | null;
          }>}
          treatmentPlants={(treatmentPlantsRes.data ?? []) as Array<{
            id: string;
            name: string;
          }>}
        />
      </div>
    </>
  );
}
