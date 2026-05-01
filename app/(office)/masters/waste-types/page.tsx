import { PageHeader } from '@/components/erp/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { WasteTypesClient } from './_client';
import type { WasteType } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function WasteTypesPage() {
  const supabase = createClient();

  const { data: wasteTypes } = await supabase
    .from('waste_types')
    .select('*')
    .order('name');

  // 사용 건수 집계
  const { data: counts } = await supabase
    .from('waste_logs')
    .select('waste_type_id')
    .neq('status', 'archived');

  const usageMap: Record<string, number> = {};
  for (const r of (counts ?? []) as { waste_type_id: string }[]) {
    usageMap[r.waste_type_id] = (usageMap[r.waste_type_id] ?? 0) + 1;
  }

  return (
    <>
      <PageHeader
        title="성상 마스터"
        subtitle="폐기물 성상 + 기본단가"
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '마스터', href: '/masters' },
          { label: '성상' },
        ]}
      />
      <WasteTypesClient
        wasteTypes={(wasteTypes ?? []) as WasteType[]}
        usageMap={usageMap}
      />
    </>
  );
}
