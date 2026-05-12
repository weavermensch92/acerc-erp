'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export interface SiteActionResult {
  ok: boolean;
  error?: string;
  siteId?: string;
}

const siteSchema = z.object({
  company_id: z.string().uuid('거래처를 선택하세요'),
  name: z.string().min(1, '현장명을 입력하세요').max(200),
  address: z.string().max(500).nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export type SiteInput = z.infer<typeof siteSchema>;

export async function createSiteAction(input: SiteInput): Promise<SiteActionResult> {
  const parsed = siteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from('sites')
    .insert({
      company_id: parsed.data.company_id,
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      start_date: parsed.data.start_date || null,
      end_date: parsed.data.end_date || null,
      is_active: parsed.data.is_active ?? true,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? '등록 실패' };
  revalidatePath('/sites');
  revalidatePath(`/companies/${parsed.data.company_id}`);
  return { ok: true, siteId: data.id as string };
}

// 거래처 페이지에서 빠른 추가용 — 이름만 받고 나머지는 공란
export async function createSiteQuickAction(
  companyId: string,
  name: string,
): Promise<SiteActionResult> {
  if (!companyId) return { ok: false, error: '거래처를 선택하세요' };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: '현장명을 입력하세요' };
  const supabase = createClient();
  const { data, error } = await supabase
    .from('sites')
    .insert({ company_id: companyId, name: trimmed })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? '등록 실패' };
  revalidatePath('/sites');
  revalidatePath(`/companies/${companyId}`);
  return { ok: true, siteId: data.id as string };
}

export async function updateSiteAction(
  id: string,
  input: SiteInput,
): Promise<SiteActionResult> {
  const parsed = siteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const supabase = createClient();
  // 기존 company_id 도 알아내서 양쪽 거래처 페이지 모두 갱신
  const { data: prev } = await supabase
    .from('sites')
    .select('company_id')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('sites')
    .update({
      company_id: parsed.data.company_id,
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      start_date: parsed.data.start_date || null,
      end_date: parsed.data.end_date || null,
      is_active: parsed.data.is_active ?? true,
    })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/sites');
  revalidatePath(`/companies/${parsed.data.company_id}`);
  if (prev?.company_id && prev.company_id !== parsed.data.company_id) {
    revalidatePath(`/companies/${prev.company_id}`);
  }
  return { ok: true, siteId: id };
}

// 거래처 페이지에서 기존 현장 이관 (다른 거래처 → 이 거래처)
export async function reassignSiteAction(
  siteId: string,
  toCompanyId: string,
): Promise<SiteActionResult> {
  if (!siteId || !toCompanyId) return { ok: false, error: '필수 값 누락' };
  const supabase = createClient();
  const { data: prev } = await supabase
    .from('sites')
    .select('company_id')
    .eq('id', siteId)
    .maybeSingle();
  const { error } = await supabase
    .from('sites')
    .update({ company_id: toCompanyId })
    .eq('id', siteId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/sites');
  revalidatePath(`/companies/${toCompanyId}`);
  if (prev?.company_id && prev.company_id !== toCompanyId) {
    revalidatePath(`/companies/${prev.company_id}`);
  }
  return { ok: true, siteId };
}

export async function deleteSiteAction(id: string): Promise<SiteActionResult> {
  const supabase = createClient();
  const { count } = await supabase
    .from('waste_logs')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `이 현장을 사용하는 일보가 ${count}건 있어 삭제할 수 없습니다`,
    };
  }
  const { data: prev } = await supabase
    .from('sites')
    .select('company_id')
    .eq('id', id)
    .maybeSingle();
  const { error } = await supabase.from('sites').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/sites');
  if (prev?.company_id) revalidatePath(`/companies/${prev.company_id}`);
  return { ok: true };
}
