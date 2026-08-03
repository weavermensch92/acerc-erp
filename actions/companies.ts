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
    if (error?.code === '23505') {
      return { ok: false, error: '같은 이름의 거래처가 이미 등록되어 있습니다.' };
    }
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
  representative: z.string().max(50).optional().nullable(),
  business_type: z.string().max(100).optional().nullable(),
  business_item: z.string().max(100).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  default_unit_price: z.number().int().nonnegative().optional().nullable(),
  is_internal: z.boolean().default(false),
});

export type CompanyInput = z.infer<typeof companySchema>;

export interface CompanyActionResult {
  ok: boolean;
  error?: string;
  companyId?: string;
  // 이름 중복(23505) 시 충돌한 기존 거래처 — 병합 제안 모달용
  conflict?: { id: string; name: string };
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
    if (error?.code === '23505') {
      return { ok: false, error: '같은 이름의 거래처가 이미 등록되어 있습니다.' };
    }
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
  if (error) {
    if (error.code === '23505') {
      // 충돌한 기존 거래처를 찾아 반환 — 폼에서 병합 여부를 물을 수 있게
      const { data: dup } = await supabase
        .from('companies')
        .select('id, name')
        .eq('name', parsed.data.name)
        .eq('is_deleted', false)
        .neq('id', id)
        .maybeSingle();
      return {
        ok: false,
        error: '같은 이름의 거래처가 이미 등록되어 있습니다.',
        conflict: dup ? { id: dup.id as string, name: dup.name as string } : undefined,
      };
    }
    return { ok: false, error: error.message };
  }
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
// 병합 미리보기 — 거래처별 자식 레코드 건수 (병합 모달 시각화용)
// ========================================
export interface CompanyMergeCounts {
  id: string;
  name: string;
  waste_logs: number;
  sites: number;
  invoice_batches: number;
  pdf_downloads: number;
}

export interface MergeCountsResult {
  ok: boolean;
  error?: string;
  companies?: CompanyMergeCounts[];
}

export async function getCompaniesMergeCountsAction(
  ids: string[],
): Promise<MergeCountsResult> {
  if (ids.length === 0) return { ok: true, companies: [] };
  const supabase = createClient();

  const { data: namesData, error: namesErr } = await supabase
    .from('companies')
    .select('id, name')
    .in('id', ids);
  if (namesErr) return { ok: false, error: namesErr.message };
  const nameMap = new Map(
    ((namesData ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
  );

  const tables = ['waste_logs', 'sites', 'invoice_batches', 'pdf_downloads'] as const;
  const result: CompanyMergeCounts[] = [];
  for (const id of ids) {
    if (!nameMap.has(id)) continue;
    const counts = await Promise.all(
      tables.map(async (table) => {
        const { count } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('company_id', id);
        return count ?? 0;
      }),
    );
    result.push({
      id,
      name: nameMap.get(id)!,
      waste_logs: counts[0],
      sites: counts[1],
      invoice_batches: counts[2],
      pdf_downloads: counts[3],
    });
  }
  return { ok: true, companies: result };
}

// ========================================
// 거래처 병합 (중복 정리)
// source 의 모든 자식 레코드(일보·현장·명세표배치·발급이력)를 target 으로 이전하고
// source 는 soft delete. 같은 이름으로 중복 등록된 거래처를 하나로 합칠 때 사용.
// ========================================
export interface MergeCompaniesResult {
  ok: boolean;
  error?: string;
  moved?: {
    waste_logs: number;
    sites: number;
    invoice_batches: number;
    pdf_downloads: number;
  };
}

export async function mergeCompaniesAction(
  sourceId: string,
  targetId: string,
): Promise<MergeCompaniesResult> {
  if (!sourceId || !targetId) {
    return { ok: false, error: '원본·대상 거래처를 모두 선택하세요.' };
  }
  if (sourceId === targetId) {
    return { ok: false, error: '같은 거래처로는 병합할 수 없습니다.' };
  }

  const supabase = createClient();

  // 두 거래처 존재 확인 + 대상이 활성인지 검증
  const { data: pair } = await supabase
    .from('companies')
    .select('id, name, is_deleted')
    .in('id', [sourceId, targetId]);
  const rows = (pair ?? []) as Array<{
    id: string;
    name: string;
    is_deleted: boolean;
  }>;
  const source = rows.find((c) => c.id === sourceId);
  const target = rows.find((c) => c.id === targetId);
  if (!source || !target) {
    return { ok: false, error: '거래처를 찾을 수 없습니다.' };
  }
  if (target.is_deleted) {
    return {
      ok: false,
      error: '삭제된 거래처로는 병합할 수 없습니다. 남길(활성) 거래처를 대상으로 선택하세요.',
    };
  }

  // company_id 를 참조하는 모든 테이블의 행을 target 으로 이전
  const moved = { waste_logs: 0, sites: 0, invoice_batches: 0, pdf_downloads: 0 };
  const tables = Object.keys(moved) as Array<keyof typeof moved>;
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .update({ company_id: targetId })
      .eq('company_id', sourceId)
      .select('id');
    if (error) {
      return { ok: false, error: `${table} 이전 실패: ${error.message}` };
    }
    moved[table] = data?.length ?? 0;
  }

  // 자식 이전이 끝난 뒤 원본 soft delete (중간 실패 시 원본은 그대로 남아 재시도 가능)
  const { error: delErr } = await supabase
    .from('companies')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      share_token: null,
    })
    .eq('id', sourceId);
  if (delErr) {
    return { ok: false, error: `원본 거래처 정리 실패: ${delErr.message}` };
  }

  await supabase.from('audit_logs').insert({
    table_name: 'companies',
    record_id: sourceId,
    action: 'update',
    change_reason:
      `거래처 병합 → ${target.name} (${targetId}). ` +
      `이전: 일보 ${moved.waste_logs} · 현장 ${moved.sites} · ` +
      `명세표배치 ${moved.invoice_batches} · 발급이력 ${moved.pdf_downloads}`,
  });

  revalidatePath('/companies');
  revalidatePath(`/companies/${sourceId}`);
  revalidatePath(`/companies/${targetId}`);
  revalidatePath('/logs');
  revalidatePath('/invoices');
  revalidatePath('/pending');
  revalidatePath('/dashboard');
  return { ok: true, moved };
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
