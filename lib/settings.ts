import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import {
  DEFAULT_SELF_COMPANY,
  type SelfCompanyInfo,
} from '@/lib/company-info';

const REVIEW_KEY = 'review_process_enabled';
const SELF_COMPANY_KEY = 'self_company_info';

// 검토(승인/반려) 프로세스 ON/OFF.
// 기본값: false — app_settings 에 저장된 값 없으면 OFF.
export async function getReviewProcessEnabled(): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', REVIEW_KEY)
    .maybeSingle();
  const v = data?.value as { enabled?: boolean } | null;
  return v?.enabled === true;
}

export async function setReviewProcessEnabled(enabled: boolean): Promise<void> {
  const supabase = createClient();
  await supabase.from('app_settings').upsert(
    {
      key: REVIEW_KEY,
      value: { enabled },
    },
    { onConflict: 'key' },
  );
}

// ========================================
// 자사 정보 (거래명세표 등 발급 문서의 공급자)
// 인자로 client 받으면 그것을 사용 (share 페이지의 admin client 호환).
// ========================================
export async function getSelfCompanyInfo(
  client?: SupabaseClient,
): Promise<SelfCompanyInfo> {
  const supabase = client ?? createClient();
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', SELF_COMPANY_KEY)
    .maybeSingle();
  if (!data?.value) return DEFAULT_SELF_COMPANY;
  return {
    ...DEFAULT_SELF_COMPANY,
    ...(data.value as Partial<SelfCompanyInfo>),
  };
}

export async function setSelfCompanyInfo(info: SelfCompanyInfo): Promise<void> {
  const supabase = createClient();
  await supabase.from('app_settings').upsert(
    { key: SELF_COMPANY_KEY, value: info },
    { onConflict: 'key' },
  );
}
