'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createClient } from '@/lib/supabase/server';

// ========================================
// 일보 입력 인라인 등록용 (이름 + 최소 정보)
// ========================================
const inlineSchema = z.object({
  name: z.string().min(1, '거래처명을 입력하세요').max(200),
  business_no: z.string().max(20).optional().nullable(),
  contact_name: z.string().max(50).optional().nullable(),
  contact_phone: z.string().max(20).optional().nullable(),
  default_unit_price: z.number().int().nonnegative().optional().nullable(),
});

export type CompanyInlineInput = z.infer<typeof inlineSchema>;

export interface CreateCompanyInlineResult {
  ok: boolean;
  company?: { id: string; name: string; default_unit_price: number | null };
  error?: string;
}

export async function createCompanyInline(
  input: CompanyInlineInput,
): Promise<CreateCompanyInlineResult> {
  const parsed = inlineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from('companies')
    .insert({
      name: parsed.data.name,
      business_no: parsed.data.business_no ?? null,
      contact_name: parsed.data.contact_name ?? null,
      contact_phone: parsed.data.contact_phone ?? null,
      default_unit_price: parsed.data.default_unit_price ?? null,
    })
    .select('id, name, default_unit_price')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? '저장 실패' };
  }
  return {
    ok: true,
    company: {
      id: data.id as string,
      name: data.name as string,
      default_unit_price: (data.default_unit_price as number | null) ?? null,
    },
  };
}

// ========================================
// 거래처 마스터 페이지 — 신규/수정
// ========================================
const companySchema = z.object({
  name: z.string().min(1, '거래처명을 입력하세요').max(200),
  business_no: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  contact_name: z.string().max(50).optional().nullable(),
  contact_phone: z.string().max(20).optional().nullable(),
  default_unit_price: z.number().int().nonnegative().optional().nullable(),
  is_internal: z.boolean().default(false),
});

export type CompanyInput = z.infer<typeof companySchema>;

export interface CompanyActionResult {
  ok: boolean;
  error?: string;
  companyId?: string;
}

export async function createCompanyAction(input: CompanyInput): Promise<CompanyActionResult> {
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from('companies')
    .insert(parsed.data)
    .select('id')
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? '등록 실패' };
  }
  revalidatePath('/companies');
  redirect(`/companies/${data.id}`);
}

export async function updateCompanyAction(
  id: string,
  input: CompanyInput,
): Promise<CompanyActionResult> {
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from('companies')
    .update(parsed.data)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/companies');
  revalidatePath(`/companies/${id}`);
  return { ok: true, companyId: id };
}

// ========================================
// 거래처 삭제 (soft delete) — 기존 일보 보존, 신규 입력·자동완성에서 제외
// share_token 도 자동 nullify (외부 접근 차단)
// ========================================
export async function deleteCompanyAction(id: string): Promise<CompanyActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from('companies')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      share_token: null,
    })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/companies');
  revalidatePath(`/companies/${id}`);
  revalidatePath('/invoices');
  revalidatePath('/logs');
  return { ok: true, companyId: id };
}

export async function restoreCompanyAction(id: string): Promise<CompanyActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from('companies')
    .update({ is_deleted: false, deleted_at: null })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/companies');
  revalidatePath(`/companies/${id}`);
  return { ok: true, companyId: id };
}

// ========================================
// share_token 발급 / 재발급 / 회수
// ========================================
export interface ShareTokenResult {
  ok: boolean;
  token?: string | null;
  error?: string;
}

export async function regenerateShareTokenAction(id: string): Promise<ShareTokenResult> {
  const supabase = createClient();
  const token = nanoid(16); // PRD § 9.1 — 12자 이상

  const { error } = await supabase
    .from('companies')
    .update({ share_token: token })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/companies/${id}`);
  revalidatePath('/companies');
  return { ok: true, token };
}

export async function revokeShareTokenAction(id: string): Promise<ShareTokenResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from('companies')
    .update({ share_token: null })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/companies/${id}`);
  revalidatePath('/companies');
  return { ok: true, token: null };
}
