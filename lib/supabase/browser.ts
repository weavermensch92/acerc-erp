'use client';

import { createBrowserClient } from '@supabase/ssr';

// 클라이언트 컴포넌트용 Supabase 클라이언트.
// 본 plan 에서는 자동완성도 API Route 경유라 잘 사용 안 됨. 필요 시 사용.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
