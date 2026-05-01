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

export async function deleteTreatmentPlantAction(id: string): Promise<MasterActionResult> {
  const supabase = createClient();
  const { count } = await supabase
    .from('waste_logs')
    .select('id', { count: 'exact', head: true })
    .eq('treatment_plant_id', id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `이 처리장을 사용하는 일보가 ${count}건 있어 삭제할 수 없습니다`,
    };
  }
  const { error } = await supabase.from('treatment_plants').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/masters/plants');
  return { ok: true };
}
