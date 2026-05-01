'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface BatchActionResult {
  ok: boolean;
  error?: string;
  batchId?: string;
}

const batchInputSchema = z.object({
  period_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  company_ids: z.array(z.string().uuid()).min(1, '거래처를 1개 이상 선택하세요'),
  note: z.string().max(500).optional().nullable(),
});

// ========================================
// 일괄 발급 — 선택된 거래처마다 pdf_downloads 행 생성 + batch 묶음
// ========================================
export async function createInvoiceBatchAction(input: {
  period_from: string;
  period_to: string;
  company_ids: string[];
  note?: string | null;
}): Promise<BatchActionResult> {
  const parsed = batchInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const data = parsed.data;
  const supabase = createClient();

  // 거래처별 합계 집계 (active 만)
  const { data: logs } = await supabase
    .from('waste_logs')
    .select('company_id, total_amount')
    .in('company_id', data.company_ids)
    .gte('log_date', data.period_from)
    .lte('log_date', data.period_to)
    .eq('status', 'active');

  const totalAmount = (logs ?? []).reduce(
    (s, r) => s + ((r.total_amount as number | null) ?? 0),
    0,
  );

  // 1) batch INSERT
  const { data: batch, error } = await supabase
    .from('invoice_batches')
    .insert({
      period_from: data.period_from,
      period_to: data.period_to,
      company_count: data.company_ids.length,
      total_amount: totalAmount,
      note: data.note ?? null,
      created_by: 'office',
    })
    .select('id')
    .single();
  if (error || !batch) {
    return { ok: false, error: error?.message ?? '배치 생성 실패' };
  }

  // 2) 거래처마다 pdf_downloads INSERT
  const downloads = data.company_ids.map((cid) => ({
    company_id: cid,
    download_type: 'invoice' as const,
    period_from: data.period_from,
    period_to: data.period_to,
    batch_id: batch.id,
    downloaded_by: 'office_batch',
  }));
  const { error: dlErr } = await supabase.from('pdf_downloads').insert(downloads);
  if (dlErr) {
    return { ok: false, error: `발급 이력 기록 실패: ${dlErr.message}` };
  }

  revalidatePath('/invoices');
  revalidatePath('/invoices/batches');
  redirect(`/invoices/${batch.id}`);
}

// ========================================
// 단건 / 셀프 다운로드 이력 기록 (시나리오 7 알림 의존)
// share/[token] 페이지에서 호출 시 admin client 사용
// ========================================
export interface RecordDownloadInput {
  company_id: string;
  period_from: string;
  period_to: string;
  downloaded_by: 'office_single' | 'company_self';
  share_token?: string | null;
}

export async function recordPdfDownloadAction(
  input: RecordDownloadInput,
  useAdmin = false,
): Promise<{ ok: boolean; error?: string }> {
  const client: SupabaseClient = useAdmin ? createAdminClient() : createClient();
  const { error } = await client.from('pdf_downloads').insert({
    company_id: input.company_id,
    download_type: 'invoice',
    period_from: input.period_from,
    period_to: input.period_to,
    downloaded_by: input.downloaded_by,
    share_token_used: input.share_token ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
