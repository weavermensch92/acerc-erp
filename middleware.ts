import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

// 사무직원 영역 보호 + 거래처 셀프 우회.
// matcher 에서 share / api/share / 정적 자산은 제외.
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options });
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLoginPath = pathname === '/login' || pathname.startsWith('/login/');

  // 인증된 사용자가 /login 접근 → /dashboard
  if (user && isLoginPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 미인증 + 보호 영역 → /login
  if (!user && !isLoginPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // _next/static, _next/image, favicon.ico, /share/*, /api/share/*, /expired 는 우회
    '/((?!_next/static|_next/image|favicon.ico|share|api/share|field|api/field|api/cron|expired).*)',
  ],
};
