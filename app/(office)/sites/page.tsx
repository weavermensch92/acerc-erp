import { PageHeader } from '@/components/erp/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { Company, Site } from '@/lib/types/database';
import { SitesClient } from './_client';

export const dynamic = 'force-dynamic';

export default async function SitesPage() {
  const supabase = createClient();

  const [sitesRes, companiesRes] = await Promise.all([
    supabase
      .from('sites')
      .select('*, companies(id, name)')
      .order('name'),
    supabase
      .from('companies')
      .select('id, name')
      .eq('is_deleted', false)
      .order('name'),
  ]);

  type SiteWithCompany = Site & { companies: { id: string; name: string } | null };
  const sites = (sitesRes.data ?? []) as unknown as SiteWithCompany[];
  const companies = (companiesRes.data ?? []) as Pick<Company, 'id' | 'name'>[];

  // 일보 사용 건수
  const ids = sites.map((s) => s.id);
  const usageMap: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: counts } = await supabase
      .from('waste_logs')
      .select('site_id')
      .in('site_id', ids)
      .neq('status', 'archived');
    for (const r of (counts ?? []) as { site_id: string }[]) {
      usageMap[r.site_id] = (usageMap[r.site_id] ?? 0) + 1;
    }
  }

  return (
    <>
      <PageHeader
        title="현장 관리"
        subtitle="거래처별 공사현장 마스터"
        breadcrumb={[{ label: '에이스알앤씨' }, { label: '현장 관리' }]}
      />
      <SitesClient sites={sites} companies={companies} usageMap={usageMap} />
    </>
  );
}
