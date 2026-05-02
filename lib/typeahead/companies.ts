import type { SupabaseClient } from '@supabase/supabase-js';

export interface CompanyTypeaheadResult {
  id: string;
  name: string;
  business_no: string | null;
  default_unit_price: number | null;
  is_internal: boolean;
  freq: number;
}

// PRD § 시나리오 2 자동완성:
// - 부분일치 (ILIKE %query%)
// - 거래 빈도(freq) 내림차순, 동률 시 사전순
// - 1글자 이상 + 최대 limit 건
export async function searchCompanies(
  supabase: SupabaseClient,
  query: string,
  limit = 10,
): Promise<CompanyTypeaheadResult[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const { data, error } = await supabase
    .from('companies')
    .select('id, name, business_no, default_unit_price, is_internal')
    .eq('is_deleted', false)
    .ilike('name', `%${trimmed}%`)
    .limit(limit * 2);
  if (error || !data) return [];

  // 빈도 별도 계산 (간이 — 큰 데이터셋에선 RPC/뷰 권장)
  const ids = data.map((c: { id: string }) => c.id);
  if (ids.length === 0) return [];

  const { data: counts } = await supabase
    .from('waste_logs')
    .select('company_id')
    .in('company_id', ids);

  const freqMap = new Map<string, number>();
  for (const row of (counts ?? []) as { company_id: string }[]) {
    freqMap.set(row.company_id, (freqMap.get(row.company_id) ?? 0) + 1);
  }

  const enriched: CompanyTypeaheadResult[] = data.map((c) => ({
    id: c.id as string,
    name: c.name as string,
    business_no: (c.business_no as string | null) ?? null,
    default_unit_price: (c.default_unit_price as number | null) ?? null,
    is_internal: Boolean(c.is_internal),
    freq: freqMap.get(c.id as string) ?? 0,
  }));

  enriched.sort((a, b) => {
    if (b.freq !== a.freq) return b.freq - a.freq;
    return a.name.localeCompare(b.name, 'ko');
  });

  return enriched.slice(0, limit);
}
