import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface LogRow {
  log_date: string;
  direction: string;
  vehicle_no: string | null;
  weight_total_kg: number | null;
  weight_tare_kg: number | null;
  weight_kg: number | null;
  unit_price: number | null;
  transport_fee: number | null;
  billing_type: string;
  supply_amount: number | null;
  vat: number | null;
  total_amount: number | null;
  is_invoiced: boolean;
  is_paid: boolean;
  status: string;
  note: string | null;
  created_at: string;
  companies: { name: string; business_no: string | null } | null;
  sites: { name: string } | null;
  waste_types: { name: string } | null;
  treatment_plants: { name: string } | null;
  treatment_plant_name_snapshot: string | null;
}

const directionLabel: Record<string, string> = { in: '반입', out: '반출' };
const billingLabel: Record<string, string> = {
  weight_based: '중량기준',
  flat_rate: '정액',
  internal: '사급',
  tax_exempt: '면세',
};
const statusLabel: Record<string, string> = {
  draft: '임시저장',
  pending_review: '검토대기',
  active: '정식',
  archived: '보관',
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const includeArchived = url.searchParams.get('archived') === '1';

  const supabase = createClient();

  let query = supabase
    .from('waste_logs')
    .select(
      `log_date, direction, vehicle_no,
       weight_total_kg, weight_tare_kg, weight_kg,
       unit_price, transport_fee, billing_type,
       supply_amount, vat, total_amount,
       is_invoiced, is_paid, status, note, created_at,
       companies(name, business_no),
       sites(name),
       waste_types(name),
       treatment_plants(name),
       treatment_plant_name_snapshot`,
    )
    .order('log_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (!includeArchived) {
    query = query.neq('status', 'archived');
  }
  if (from) query = query.gte('log_date', from);
  if (to) query = query.lte('log_date', to);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const logs = (data ?? []) as unknown as LogRow[];

  const headers = [
    '일자',
    '구분',
    '거래처',
    '사업자번호',
    '공사현장',
    '성상',
    '처리장',
    '차량번호',
    '총중량',
    '공차중량',
    '실중량',
    '단가',
    '운반비',
    '청구타입',
    '공급가액',
    '부가세',
    '청구금액',
    '청구',
    '결제',
    '상태',
    '비고',
  ];

  const rows = logs.map((r) => [
    r.log_date,
    directionLabel[r.direction] ?? r.direction,
    r.companies?.name ?? '',
    r.companies?.business_no ?? '',
    r.sites?.name ?? '',
    r.waste_types?.name ?? '',
    r.treatment_plants?.name ?? r.treatment_plant_name_snapshot ?? '',
    r.vehicle_no ?? '',
    r.weight_total_kg ?? '',
    r.weight_tare_kg ?? '',
    r.weight_kg ?? '',
    r.unit_price ?? '',
    r.transport_fee ?? '',
    billingLabel[r.billing_type] ?? r.billing_type,
    r.supply_amount ?? '',
    r.vat ?? '',
    r.total_amount ?? '',
    r.is_invoiced ? 'Y' : 'N',
    r.is_paid ? 'Y' : 'N',
    statusLabel[r.status] ?? r.status,
    r.note ?? '',
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // 컬럼 폭 자동 (간이)
  const colWidths = headers.map((h, idx) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String(r[idx] ?? '').length),
    );
    return { wch: Math.min(maxLen + 2, 30) };
  });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, '종합일보');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const fromTag = from ?? 'all';
  const toTag = to ?? 'all';
  const filename = `종합일보_${fromTag}_${toTag}.xlsx`;
  // 한글 파일명 — RFC 5987 형식 (filename* 사용)
  const encodedFilename = encodeURIComponent(filename);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="logs.xlsx"; filename*=UTF-8''${encodedFilename}`,
      'Cache-Control': 'no-store',
    },
  });
}
