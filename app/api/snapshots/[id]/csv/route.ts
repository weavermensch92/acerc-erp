import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface SnapshotRow {
  id: string;
  log_date: string;
  direction: string;
  vehicle_no: string | null;
  weight_kg: number | null;
  unit_price: number | null;
  supply_amount: number | null;
  vat: number | null;
  total_amount: number | null;
  billing_type: string;
  status: string;
  is_invoiced: boolean;
  is_paid: boolean;
  note: string | null;
  companies: { name: string } | null;
  sites: { name: string } | null;
  waste_types: { name: string } | null;
  treatment_plants: { name: string } | null;
  treatment_plant_name_snapshot: string | null;
}

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();

  const { data: snap } = await supabase
    .from('snapshots')
    .select('id, snapshot_date, created_at, note')
    .eq('id', params.id)
    .maybeSingle();
  if (!snap) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: logs } = await supabase
    .from('waste_logs')
    .select(
      `id, log_date, direction, vehicle_no, weight_kg, unit_price,
       supply_amount, vat, total_amount, billing_type, status,
       is_invoiced, is_paid, note,
       companies(name), sites(name), waste_types(name), treatment_plants(name),
       treatment_plant_name_snapshot`,
    )
    .lte('created_at', snap.created_at)
    .order('log_date', { ascending: true });

  const rows = (logs ?? []) as unknown as SnapshotRow[];

  const headers = [
    '일자',
    '구분',
    '거래처',
    '공사현장',
    '성상',
    '처리장',
    '차량번호',
    '중량(kg)',
    '단가(원)',
    '청구타입',
    '공급가액',
    '부가세',
    '청구금액',
    '청구',
    '결제',
    '상태',
    '비고',
  ];

  const lines = [headers.map(csvEscape).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.log_date,
        r.direction === 'in' ? '반입' : '반출',
        r.companies?.name ?? '',
        r.sites?.name ?? '',
        r.waste_types?.name ?? '',
        r.treatment_plants?.name ?? r.treatment_plant_name_snapshot ?? '',
        r.vehicle_no ?? '',
        r.weight_kg ?? '',
        r.unit_price ?? '',
        r.billing_type,
        r.supply_amount ?? '',
        r.vat ?? '',
        r.total_amount ?? '',
        r.is_invoiced ? 'Y' : 'N',
        r.is_paid ? 'Y' : 'N',
        r.status,
        r.note ?? '',
      ]
        .map(csvEscape)
        .join(','),
    );
  }

  // ﻿ (UTF-8 BOM) — Excel 한글 정상 표시
  const csv = '﻿' + lines.join('\n');
  const filename = `snapshot-${snap.snapshot_date}-${snap.id.slice(0, 8)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
