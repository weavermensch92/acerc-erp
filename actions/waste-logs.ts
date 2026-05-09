'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import {
  wasteLogCreateSchema,
  wasteLogUpdateSchema,
  type WasteLogCreateInput,
  type WasteLogUpdateInput,
} from '@/lib/validation/waste-log';
import { calcBilling } from '@/lib/calc/billing';
import { getReviewProcessEnabled } from '@/lib/settings';

export interface ActionResult {
  error?: string;
}

// 폐기물일보(waste_logs) 가 모든 화면의 SSOT — 변경 시 모든 의존 페이지 캐시 무효화.
// id 가 있으면 해당 일보 상세도 같이 revalidate.
function revalidateAllAffectedByLog(id?: string) {
  revalidatePath('/logs');
  if (id) revalidatePath(`/logs/${id}`);
  revalidatePath('/dashboard');
  revalidatePath('/invoices');
  revalidatePath('/payouts');
  revalidatePath('/pending');
  revalidatePath('/snapshots');
}

// ========================================
// 마스터 lookup-or-create 헬퍼
// ========================================
async function resolveWasteTypeId(
  supabase: SupabaseClient,
  name: string,
): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('성상이 비어있습니다');

  const { data: existing } = await supabase
    .from('waste_types')
    .select('id')
    .eq('name', trimmed)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from('waste_types')
    .insert({ name: trimmed })
    .select('id')
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? '성상 등록 실패');
  }
  return created.id as string;
}

async function resolveTreatmentPlantId(
  supabase: SupabaseClient,
  name: string | null | undefined,
): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const { data: existing } = await supabase
    .from('treatment_plants')
    .select('id')
    .eq('name', trimmed)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from('treatment_plants')
    .insert({ name: trimmed })
    .select('id')
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? '처리장 등록 실패');
  }
  return created.id as string;
}

// 차량번호 + 공차 → vehicles 마스터 upsert (다음 입력 시 자동 채움용)
async function rememberVehicleTare(
  supabase: SupabaseClient,
  vehicleNo: string | null | undefined,
  tareKg: number | null | undefined,
): Promise<void> {
  const trimmed = vehicleNo?.trim();
  if (!trimmed) return;
  if (tareKg === null || tareKg === undefined) {
    // 공차 없으면 vehicle_no 만 등록 (이미 있으면 무시)
    await supabase
      .from('vehicles')
      .insert({ vehicle_no: trimmed })
      .select('id')
      .single();
    // .single() 의 error 는 무시 (중복 23505 등) — destructure 안 함
    return;
  }
  await supabase
    .from('vehicles')
    .upsert(
      { vehicle_no: trimmed, default_tare_kg: tareKg },
      { onConflict: 'vehicle_no' },
    );
}

async function resolveSiteId(
  supabase: SupabaseClient,
  companyId: string,
  name: string | null | undefined,
): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const { data: existing } = await supabase
    .from('sites')
    .select('id')
    .eq('company_id', companyId)
    .eq('name', trimmed)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from('sites')
    .insert({ company_id: companyId, name: trimmed, is_active: true })
    .select('id')
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? '공사현장 등록 실패');
  }
  return created.id as string;
}

// ========================================
// 신규 일보 등록 (시나리오 2)
// 마스터에 없는 성상/처리장/공사현장은 자동 추가
// ========================================
export async function createLogAction(input: WasteLogCreateInput): Promise<ActionResult> {
  const parsed = wasteLogCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const data = parsed.data;
  const calc = calcBilling({
    billingType: data.billing_type,
    weightKg: data.weight_kg ?? null,
    unitPrice: data.unit_price ?? null,
    transportFee: data.transport_fee ?? 0,
  });

  const supabase = createClient();

  let wasteTypeId: string;
  let treatmentPlantId: string | null;
  let siteId: string | null;
  try {
    wasteTypeId = await resolveWasteTypeId(supabase, data.waste_type_name);
    treatmentPlantId = await resolveTreatmentPlantId(supabase, data.treatment_plant_name);
    siteId = await resolveSiteId(supabase, data.company_id, data.site_name);
  } catch (e) {
    return { error: e instanceof Error ? e.message : '마스터 등록 실패' };
  }

  // 사무직원 입력은 항상 active (검토 프로세스가 ON 이어도 사무직원 직접 입력은 active)
  // 현장기사 일회용 링크 입력은 Phase 2 — 그쪽 path 에서 pending_review 사용
  const { data: created, error } = await supabase
    .from('waste_logs')
    .insert({
      log_date: data.log_date,
      direction: data.direction,
      company_id: data.company_id,
      site_id: siteId,
      waste_type_id: wasteTypeId,
      treatment_plant_id: treatmentPlantId,
      treatment_plant_name_snapshot: null,
      vehicle_no: data.vehicle_no ?? null,
      weight_total_kg: data.weight_total_kg ?? null,
      weight_tare_kg: data.weight_tare_kg ?? null,
      weight_kg: data.weight_kg ?? null,
      unit_price: data.unit_price ?? null,
      transport_fee: data.transport_fee ?? 0,
      billing_type: data.billing_type,
      supply_amount: calc.supplyAmount,
      vat: calc.vat,
      total_amount: calc.totalAmount,
      note: data.note ?? null,
      status: 'active',
      created_by: 'office',
    })
    .select('id')
    .single();

  if (error || !created) {
    return { error: error?.message ?? '저장 실패' };
  }

  // 차량번호 + 공차 기억 (다음 입력 시 자동 채움)
  await rememberVehicleTare(supabase, data.vehicle_no, data.weight_tare_kg);

  revalidateAllAffectedByLog(created.id);
  redirect(`/logs/${created.id}`);
}

// ========================================
// 다중 선택 일괄 삭제 (soft delete — status='archived')
// ========================================
export interface BulkArchiveResult {
  ok: boolean;
  archived: number;
  error?: string;
}

export async function bulkArchiveLogsAction(
  ids: string[],
  reason?: string | null,
): Promise<BulkArchiveResult> {
  if (ids.length === 0) {
    return { ok: false, archived: 0, error: '선택된 일보가 없습니다' };
  }
  const supabase = createClient();

  const { data, error } = await supabase
    .from('waste_logs')
    .update({ status: 'archived' })
    .in('id', ids)
    .neq('status', 'archived')
    .select('id');

  if (error) return { ok: false, archived: 0, error: error.message };

  const archivedCount = data?.length ?? 0;

  // 사유 별도 audit row (트리거 update 행과 별개)
  const trimmedReason = reason?.trim();
  if (trimmedReason && archivedCount > 0) {
    await supabase.from('audit_logs').insert(
      (data ?? []).map((r) => ({
        table_name: 'waste_logs',
        record_id: (r as { id: string }).id,
        action: 'update',
        change_reason: `일괄 삭제(보관): ${trimmedReason}`,
      })),
    );
  }

  revalidateAllAffectedByLog();
  return { ok: true, archived: archivedCount };
}

// ========================================
// 보관(archived) → active 복원
// ========================================
export async function restoreLogAction(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from('waste_logs')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('status', 'archived');
  if (error) return { error: error.message };

  await supabase.from('audit_logs').insert({
    table_name: 'waste_logs',
    record_id: id,
    action: 'restore',
    change_reason: '보관 → 정식 복원',
  });

  revalidateAllAffectedByLog(id);
  return {};
}

// ========================================
// 거래명세표에서 인라인 일괄 편집 — 가격·중량·청구·결제 플래그
// 마스터 변경 X (거래처/성상/처리장/현장은 그대로). calc 자동 재계산.
// ========================================
export interface InlineRowUpdate {
  id: string;
  weight_kg: number | null;
  unit_price: number | null;
  transport_fee: number | null;
  billing_type: import('@/lib/types/database').BillingType;
  is_invoiced: boolean;
  is_paid: boolean;
  note: string | null;
}

export interface BulkUpdateResult {
  ok: boolean;
  updated: number;
  failed: Array<{ id: string; error: string }>;
}

export async function bulkUpdateLogsInlineAction(
  updates: InlineRowUpdate[],
  changeReason?: string | null,
): Promise<BulkUpdateResult> {
  if (updates.length === 0) {
    return { ok: true, updated: 0, failed: [] };
  }
  const supabase = createClient();
  let updated = 0;
  const failed: Array<{ id: string; error: string }> = [];

  for (const u of updates) {
    const calc = calcBilling({
      billingType: u.billing_type,
      weightKg: u.weight_kg,
      unitPrice: u.unit_price,
      transportFee: u.transport_fee ?? 0,
    });
    const { error } = await supabase
      .from('waste_logs')
      .update({
        weight_kg: u.weight_kg,
        unit_price: u.unit_price,
        transport_fee: u.transport_fee ?? 0,
        billing_type: u.billing_type,
        supply_amount: calc.supplyAmount,
        vat: calc.vat,
        total_amount: calc.totalAmount,
        is_invoiced: u.is_invoiced,
        is_paid: u.is_paid,
        note: u.note ?? null,
      })
      .eq('id', u.id);
    if (error) {
      failed.push({ id: u.id, error: error.message });
    } else {
      updated += 1;
    }
  }

  // change_reason 별도 audit row (전체 batch 대표 1행)
  const reason = changeReason?.trim();
  if (reason && updated > 0) {
    await supabase.from('audit_logs').insert(
      updates.slice(0, updated).map((u) => ({
        table_name: 'waste_logs',
        record_id: u.id,
        action: 'update',
        change_reason: `거래명세표 인라인 편집: ${reason}`,
      })),
    );
  }

  revalidateAllAffectedByLog();

  return { ok: failed.length === 0, updated, failed };
}

// 단일 행 청구/결재 플래그 토글 — /logs 표 pill 클릭 즉시 저장용.
export async function toggleLogFlagAction(
  id: string,
  field: 'is_invoiced' | 'is_paid',
  value: boolean,
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from('waste_logs')
    .update({ [field]: value })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidateAllAffectedByLog();
  return {};
}

// ========================================
// 일보 수정 (시나리오 7)
// 모든 status 의 일보 수정 가능. 마스터 자동 추가 + change_reason 별도 audit
// ========================================
export async function updateLogAction(
  id: string,
  input: WasteLogUpdateInput,
): Promise<ActionResult> {
  const parsed = wasteLogUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const data = parsed.data;
  const calc = calcBilling({
    billingType: data.billing_type,
    weightKg: data.weight_kg ?? null,
    unitPrice: data.unit_price ?? null,
    transportFee: data.transport_fee ?? 0,
  });

  const supabase = createClient();

  let wasteTypeId: string;
  let treatmentPlantId: string | null;
  let siteId: string | null;
  try {
    wasteTypeId = await resolveWasteTypeId(supabase, data.waste_type_name);
    treatmentPlantId = await resolveTreatmentPlantId(supabase, data.treatment_plant_name);
    siteId = await resolveSiteId(supabase, data.company_id, data.site_name);
  } catch (e) {
    return { error: e instanceof Error ? e.message : '마스터 등록 실패' };
  }

  const updatePayload: Record<string, unknown> = {
    log_date: data.log_date,
    direction: data.direction,
    company_id: data.company_id,
    site_id: siteId,
    waste_type_id: wasteTypeId,
    treatment_plant_id: treatmentPlantId,
    // 새로 처리장이 매칭/생성되면 snapshot은 비움 (FK 가 정상이면 fallback 불필요)
    treatment_plant_name_snapshot: treatmentPlantId ? null : undefined,
    vehicle_no: data.vehicle_no ?? null,
    weight_total_kg: data.weight_total_kg ?? null,
    weight_tare_kg: data.weight_tare_kg ?? null,
    weight_kg: data.weight_kg ?? null,
    unit_price: data.unit_price ?? null,
    transport_fee: data.transport_fee ?? 0,
    billing_type: data.billing_type,
    supply_amount: calc.supplyAmount,
    vat: calc.vat,
    total_amount: calc.totalAmount,
    note: data.note ?? null,
  };
  // 결제수단 / 청구·결제 플래그 — 폼에서 입력한 경우만 반영 (undefined 면 유지)
  if (data.payment_method !== undefined) {
    updatePayload.payment_method = data.payment_method ?? null;
  }
  if (data.is_invoiced !== undefined) {
    updatePayload.is_invoiced = data.is_invoiced;
  }
  if (data.is_paid !== undefined) {
    updatePayload.is_paid = data.is_paid;
  }

  const { error } = await supabase.from('waste_logs').update(updatePayload).eq('id', id);

  if (error) return { error: error.message };

  // 차량 + 공차 기억 (다음 입력 시 자동 채움)
  await rememberVehicleTare(supabase, data.vehicle_no, data.weight_tare_kg);

  // 사용자가 입력한 change_reason 별도 audit row (트리거가 만든 update row 와 별개)
  const reason = data.change_reason?.trim();
  if (reason) {
    await supabase.from('audit_logs').insert({
      table_name: 'waste_logs',
      record_id: id,
      action: 'update',
      change_reason: reason,
    });
  }

  revalidateAllAffectedByLog(id);
  redirect(`/logs/${id}`);
}

// ========================================
// 검토 승인 — pending_review → active
// ========================================
export async function approveLogAction(id: string): Promise<ActionResult> {
  // 검토 프로세스 OFF 면 액션 자체 거부
  const reviewEnabled = await getReviewProcessEnabled();
  if (!reviewEnabled) {
    return { error: '검토 프로세스가 비활성화 상태입니다' };
  }

  const supabase = createClient();

  const { error, count } = await supabase
    .from('waste_logs')
    .update({ status: 'active' }, { count: 'exact' })
    .eq('id', id)
    .eq('status', 'pending_review')
    .select('id');

  if (error) return { error: error.message };
  if ((count ?? 0) === 0) return { error: '검토 대기 상태가 아닙니다' };

  revalidateAllAffectedByLog(id);

  const { data: nextPending } = await supabase
    .from('waste_logs')
    .select('id')
    .eq('status', 'pending_review')
    .order('log_date', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextPending?.id) {
    redirect(`/logs/${nextPending.id}`);
  }
  redirect('/logs?status=pending_review');
}

// ========================================
// 검토 반려 — pending_review → archived + reason
// ========================================
export async function rejectLogAction(id: string, reason: string): Promise<ActionResult> {
  const reviewEnabled = await getReviewProcessEnabled();
  if (!reviewEnabled) {
    return { error: '검토 프로세스가 비활성화 상태입니다' };
  }

  const trimmedReason = reason.trim();
  if (trimmedReason.length === 0) {
    return { error: '반려 사유를 입력하세요' };
  }

  const supabase = createClient();

  const { error: updErr } = await supabase
    .from('waste_logs')
    .update({ status: 'archived' })
    .eq('id', id)
    .eq('status', 'pending_review');

  if (updErr) return { error: updErr.message };

  await supabase.from('audit_logs').insert({
    table_name: 'waste_logs',
    record_id: id,
    action: 'update',
    change_reason: `반려: ${trimmedReason}`,
  });

  revalidateAllAffectedByLog(id);

  const { data: nextPending } = await supabase
    .from('waste_logs')
    .select('id')
    .eq('status', 'pending_review')
    .order('log_date', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextPending?.id) {
    redirect(`/logs/${nextPending.id}`);
  }
  redirect('/logs');
}
