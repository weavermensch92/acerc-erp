import { redirect } from 'next/navigation';
import { Shell } from '@/components/erp/Shell';
import { createClient } from '@/lib/supabase/server';
import { getReviewProcessEnabled } from '@/lib/settings';

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 검토 프로세스 OFF 면 사이드바 배지 / pendingCount 자체가 의미 없음
  const reviewEnabled = await getReviewProcessEnabled();

  let pendingCount = 0;
  if (reviewEnabled) {
    const { count } = await supabase
      .from('waste_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_review');
    pendingCount = count ?? 0;
  }

  return (
    <Shell user={{ email: user.email }} pendingCount={pendingCount}>
      {children}
    </Shell>
  );
}
