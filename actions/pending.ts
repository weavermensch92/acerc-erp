'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Direction } from '@/lib/types/database';

export interface PendingResult {
  ok: boolean;
  updated?: number;
  error?: string;
}

// 거래처(또는 처리장) 단위로 미처리(is_invoiced=false) active 일보를 일괄 invoiced 표시.
// 반입(in)은 거래명세표 발급 완료 / 반출(out)은 청구서 수령 완료 의미.
export async function markCompanyInvoicedAction(
  companyId: string,
  direction: Direction,
  range?: { from?: string; to?: string },
): Promise<PendingResult> {
  if (!companyId) return { ok: false, error: 'companyId 누락' };
  const supabase = createClient();

  let q = supabase
    .from('waste_logs')
    .update({ is_invoiced: true })
    .eq('company_id', companyId)
    .eq('direction', direction)
    .eq('is_invoiced', false)
    .eq('status', 'active');

  if (range?.from) q = q.gte('log_date', range.from);
  if (range?.to) q = q.lte('log_date', range.to);

  const { error, count } = await q.select('id', { count: 'exact' });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/pending');
  revalidatePath('/dashboard');
  revalidatePath(`/companies/${companyId}`);
  revalidatePath('/invoices');
  return { ok: true, updated: count ?? 0 };
}

export async function markLogsInvoicedAction(
  ids: string[],
): Promise<PendingResult> {
  if (ids.length === 0) return { ok: true, updated: 0 };
  const supabase = createClient();
  const { error, count } = await supabase
    .from('waste_logs')
    .update({ is_invoiced: true })
    .in('id', ids)
    .select('id', { count: 'exact' });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/pending');
  revalidatePath('/dashboard');
  revalidatePath('/invoices');
  return { ok: true, updated: count ?? 0 };
}
