import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// 외부 클라이언트 (PDF 생성기 / 엑셀 export 등) 가 JSON 으로 가져갈 수 있는 endpoint.
// MVP 의 share 페이지 자체는 server component 가 admin 클라이언트 직접 호출.
// 본 route 는 Phase 2 PDF/엑셀 기능에서 사용.
export async function GET(
  req: Request,
  { params }: { params: { token: string } },
) {
  const token = params.token;
  if (!token || token.length < 12) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  }

  const admin = createAdminClient();

  const { data: company } = await admin
    .from('companies')
    .select('id, name, business_no')
    .eq('share_token', token)
    .maybeSingle();

  if (!company) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = new URL(req.url);
  const monthParam = url.searchParams.get('month');

  let from: string;
  let to: string;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number);
    from = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    to = new Date(y, m, 0).toISOString().slice(0, 10);
  } else {
    const now = new Date();
    from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  }

  const { data: logs } = await admin
    .from('waste_logs')
    .select(
      `id, log_date, direction, vehicle_no, weight_kg, supply_amount, vat, total_amount,
       is_invoiced, is_paid,
       sites(name), waste_types(name)`,
    )
    .eq('company_id', company.id)
    .neq('status', 'archived')
    .gte('log_date', from)
    .lte('log_date', to)
    .order('log_date', { ascending: false });

  return NextResponse.json({
    company: { id: company.id, name: company.name, business_no: company.business_no },
    period: { from, to },
    logs: logs ?? [],
  });
}
