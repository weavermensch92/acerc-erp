import 'server-only';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

// RSC + Server Action 용 Supabase 클라이언트.
// authenticated 컨텍스트 (RLS 통과). cookies 어댑터로 세션 자동 주입.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // RSC 컨텍스트에서는 cookie 쓰기 불가 — Server Action / Route Handler 에서만 가능.
            // middleware 가 세션 갱신을 담당하므로 무시해도 안전.
          }
        },
      },
    },
  );
}
