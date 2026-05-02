'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export interface MasterActionResult {
  ok: boolean;
  error?: string;
}

// ========================================
// 성상 (waste_types)
// ========================================
const wasteTypeSchema = z.object({
  name: z.string().min(1, '이름을 입력하세요').max(100),
  default_unit_price: z.number().int().nonnegative().nullable().optional(),
});

export type WasteTypeInput = z.infer<typeof wasteTypeSchema>;

export async function createWasteTypeAction(input: WasteTypeInput): Promise<MasterActionResult> {
  const parsed = wasteTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const supabase = createClient();
  const { error } = await supabase.from('waste_types').insert({
    name: parsed.data.name,
    default_unit_price: parsed.data.default_unit_price ?? null,
  });
  if (error) {
    if (error.code === '23505') return { ok: false, error: '같은 이름의 성상이 이미 있습니다' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/masters/waste-types');
  return { ok: true };
}

export async function updateWasteTypeAction(
  id: string,
  input: WasteTypeInput,
): Promise<MasterActionResult> {
  const parsed = wasteTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from('waste_types')
    .update({
      name: parsed.data.name,
      default_unit_price: parsed.data.default_unit_price ?? null,
    })
    .eq('id', id);
  if (error) {
    if (error.code === '23505') return { ok: false, error: '같은 이름의 성상이 이미 있습니다' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/masters/waste-types');
  return { ok: true };
}

export async function deleteWasteTypeAction(id: string): Promise<MasterActionResult> {
  const supabase = createClient();
  const { count } = await supabase
    .from('waste_logs')
    .select('id', { count: 'exact', head: true })
    .eq('waste_type_id', id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `이 성상을 사용하는 일보가 ${count}건 있어 삭제할 수 없습니다`,
    };
  }
  const { error } = await supabase.from('waste_types').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/masters/waste-types');
  return { ok: true };
}

// ========================================
// 처리장 (treatment_plants)
// ========================================
const treatmentPlantSchema = z.object({
  name: z.string().min(1, '이름을 입력하세요').max(100),
  address: z.string().max(500).nullable().optional(),
});

export type TreatmentPlantInput = z.infer<typeof treatmentPlantSchema>;

export async function createTreatmentPlantAction(
  input: TreatmentPlantInput,
): Promise<MasterActionResult> {
  const parsed = treatmentPlantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const supabase = createClient();
  const { error } = await supabase.from('treatment_plants').insert({
    name: parsed.data.name,
    address: parsed.data.address ?? null,
  });
  if (error) {
    if (error.code === '23505') return { ok: false, error: '같은 이름의 처리장이 이미 있습니다' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/masters/plants');
  return { ok: true };
}

export async function updateTreatmentPlantAction(
  id: string,
  input: TreatmentPlantInput,
): Promise<MasterActionResult> {
  const parsed = treatmentPlantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from('treatment_plants')
    .update({
      name: parsed.data.name,
      address: parsed.data.address ?? null,
    })
    .eq('id', id);
  if (error) {
    if (error.code === '23505') return { ok: false, error: '같은 이름의 처리장이 이미 있습니다' };
    return { ok: false, error: error.message };
  }
  revalidatePath('/masters/plants');
  return { ok: true };
}

export async function deleteTreatmentPlantAction(
  id: string,
  options?: { detachLogs?: boolean },
): Promise<MasterActionResult> {
  const supabase = createClient();
  const { count } = await supabase
    .from('waste_logs')
    .select('id', { count: 'exact', head: true })
    .eq('treatment_plant_id', id);
  const usage = count ?? 0;

  if (usage > 0 && !options?.detachLogs) {
    return {
      ok: false,
      error: `이 처리장을 사용하는 일보가 ${usage}건 있습니다 (보관 상태 포함). 다이얼로그에서 "연결 해제 후 처리장 삭제" 버튼으로 진행하세요`,
    };
  }

  if (usage > 0 && options?.detachLogs) {
    // 1) 마스터 이름을 snapshot 으로 보존 (FK 끊은 후에도 일보 표시 유지)
    const { data: plantRow, error: readErr } = await supabase
      .from('treatment_plants')
      .select('name')
      .eq('id', id)
      .maybeSingle();
    if (readErr || !plantRow) {
      return { ok: false, error: readErr?.message ?? '처리장 정보를 읽을 수 없습니다' };
    }

    const { error: snapErr } = await supabase
      .from('waste_logs')
      .update({ treatment_plant_name_snapshot: plantRow.name })
      .eq('treatment_plant_id', id);
    if (snapErr) {
      return { ok: false, error: `이름 snapshot 실패: ${snapErr.message}` };
    }

    // 2) FK detach
    const { error: detachErr } = await supabase
      .from('waste_logs')
      .update({ treatment_plant_id: null })
      .eq('treatment_plant_id', id);
    if (detachErr) {
      return { ok: false, error: `일보 연결 해제 실패: ${detachErr.message}` };
    }
  }

  const { error } = await supabase.from('treatment_plants').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/masters/plants');
  revalidatePath('/logs');
  return { ok: true };
}

// 처리장이 사용 중인 일보 목록 조회 (삭제 다이얼로그 미리보기용)
export interface PlantUsageLog {
  id: string;
  log_date: string;
  direction: 'in' | 'out';
  vehicle_no: string | null;
  weight_kg: number | null;
  status: string;
  companies: { name: string } | null;
  waste_types: { name: string } | null;
}

export async function getTreatmentPlantUsageAction(
  id: string,
  limit = 50,
): Promise<{ ok: true; logs: PlantUsageLog[]; total: number } | { ok: false; error: string }> {
  const supabase = createClient();
  const [{ data, error }, { count }] = await Promise.all([
    supabase
      .from('waste_logs')
      .select(
        `id, log_date, direction, vehicle_no, weight_kg, status,
         companies(name), waste_types(name)`,
      )
      .eq('treatment_plant_id', id)
      .order('log_date', { ascending: false })
      .limit(limit),
    supabase
      .from('waste_logs')
      .select('id', { count: 'exact', head: true })
      .eq('treatment_plant_id', id),
  ]);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    logs: (data ?? []) as unknown as PlantUsageLog[],
    total: count ?? 0,
  };
}
