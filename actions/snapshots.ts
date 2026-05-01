'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface SnapshotResult {
  ok: boolean;
  error?: string;
  snapshotId?: string;
}

// ========================================
// 수동 스냅샷 생성 — 현재 시점 메타 기록
// (자동 cron 은 Phase B — Vercel Cron / Supabase Edge Function)
// ========================================
export async function createSnapshotAction(note?: string | null): Promise<SnapshotResult> {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  // 현재 데이터 집계
  const { data: logs, error: logsErr } = await supabase
    .from('waste_logs')
    .select('id, company_id, total_amount')
    .neq('status', 'archived');
  if (logsErr) return { ok: false, error: logsErr.message };

  const logRows = (logs ?? []) as Array<{
    id: string;
    company_id: string;
    total_amount: number | null;
  }>;
  const companyIds = new Set(logRows.map((r) => r.company_id));
  const totalAmount = logRows.reduce((s, r) => s + (r.total_amount ?? 0), 0);

  const trimmedNote = note?.trim();

  const { data: snap, error } = await supabase
    .from('snapshots')
    .insert({
      snapshot_date: today,
      log_count: logRows.length,
      company_count: companyIds.size,
      total_amount: totalAmount,
      note: trimmedNote || null,
      created_by: 'office',
    })
    .select('id')
    .single();

  if (error || !snap) {
    return { ok: false, error: error?.message ?? '스냅샷 생성 실패' };
  }
  revalidatePath('/snapshots');
  return { ok: true, snapshotId: snap.id as string };
}

export async function deleteSnapshotAction(id: string): Promise<SnapshotResult> {
  const supabase = createClient();
  const { error } = await supabase.from('snapshots').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/snapshots');
  return { ok: true };
}
