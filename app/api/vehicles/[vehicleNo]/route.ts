import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// 차량번호 → 마지막 공차중량 lookup
// 일보 입력 시 차량번호 변경하면 클라이언트가 호출해서 공차 자동 채움
export async function GET(
  _req: Request,
  { params }: { params: { vehicleNo: string } },
) {
  const vehicleNo = decodeURIComponent(params.vehicleNo).trim();
  if (!vehicleNo) {
    return NextResponse.json({ tare_kg: null });
  }

  const supabase = createClient();
  const { data } = await supabase
    .from('vehicles')
    .select('default_tare_kg')
    .eq('vehicle_no', vehicleNo)
    .maybeSingle();

  return NextResponse.json({
    vehicle_no: vehicleNo,
    tare_kg: data?.default_tare_kg ?? null,
  });
}
