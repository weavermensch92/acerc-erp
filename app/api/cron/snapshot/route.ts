import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vercel Cron — schedule "0 15 * * *" (UTC) = 매일 KST 자정
// vercel.json 의 crons 항목으로 등록
//
// 보호: Vercel Cron 호출 시 Authorization 헤더에 CRON_SECRET 자동 포함됨
// 환경변수 CRON_SECRET 설정 필요 (Vercel 대시보드)
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const expected = process.env.CRON_SECRET
    ? `Bearer ${process.env.CRON_SECRET}`
    : null;

  // CRON_SECRET 가 설정된 환경에서는 검증 강제
  if (expected && authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // 중복 방지 — 오늘 이미 cron 으로 만든 스냅샷 있으면 skip
  const { data: existing } = await admin
    .from('snapshots')
    .select('id')
    .eq('snapshot_date', today)
    .eq('created_by', 'cron')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      skipped: true,
      reason: 'Already exists for today',
      date: today,
      existingId: existing.id,
    });
  }

  // 데이터 집계
  const { data: logs, error: logsErr } = await admin
    .from('waste_logs')
    .select('id, company_id, total_amount')
    .neq('status', 'archived');
  if (logsErr) {
    return NextResponse.json({ error: logsErr.message }, { status: 500 });
  }

  const logRows = (logs ?? []) as Array<{
    id: string;
    company_id: string;
    total_amount: number | null;
  }>;
  const companyIds = new Set(logRows.map((r) => r.company_id));
  const totalAmount = logRows.reduce((s, r) => s + (r.total_amount ?? 0), 0);

  const { data: snap, error } = await admin
    .from('snapshots')
    .insert({
      snapshot_date: today,
      log_count: logRows.length,
      company_count: companyIds.size,
      total_amount: totalAmount,
      note: '자동 일일 스냅샷 (cron)',
      created_by: 'cron',
    })
    .select('id')
    .single();

  if (error || !snap) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create snapshot' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    snapshotId: snap.id,
    date: today,
    logCount: logRows.length,
    companyCount: companyIds.size,
    totalAmount,
  });
}
