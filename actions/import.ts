'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Direction, BillingType } from '@/lib/types/database';

export interface ImportRow {
  log_date: string;
  direction: Direction;
  company_name: string;
  site_name: string | null;
  waste_type_name: string;
  treatment_plant_name: string | null;
  vehicle_no: string | null;
  weight_kg: number | null;
  weight_total_kg: number | null;
  weight_tare_kg: number | null;
  unit_price: number | null;
  transport_fee: number | null;
  billing_type: BillingType;
  supply_amount: number | null;
  vat: number | null;
  total_amount: number | null;
  is_invoiced: boolean;
  is_paid: boolean;
  note: string | null;
}

export interface BulkImportResult {
  ok: boolean;
  inserted: number;
  failed: Array<{ index: number; error: string }>;
  newCompanies: number;
  newWasteTypes: number;
  newPlants: number;
  newSites: number;
  error?: string;
}

async function resolveByName(
  supabase: SupabaseClient,
  table: 'companies' | 'waste_types' | 'treatment_plants',
  name: string,
): Promise<{ id: string; created: boolean } | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data: existing } = await supabase
    .from(table)
    .select('id')
    .eq('name', trimmed)
    .maybeSingle();
  if (existing) return { id: existing.id as string, created: false };
  const { data: created, error } = await supabase
    .from(table)
    .insert({ name: trimmed })
    .select('id')
    .single();
  if (error || !created) return null;
  return { id: created.id as string, created: true };
}

async function resolveSite(
  supabase: SupabaseClient,
  companyId: string,
  name: string,
): Promise<{ id: string; created: boolean } | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data: existing } = await supabase
    .from('sites')
    .select('id')
    .eq('company_id', companyId)
    .eq('name', trimmed)
    .maybeSingle();
  if (existing) return { id: existing.id as string, created: false };
  const { data: created, error } = await supabase
    .from('sites')
    .insert({ company_id: companyId, name: trimmed, is_active: true })
    .select('id')
    .single();
  if (error || !created) return null;
  return { id: created.id as string, created: true };
}

export async function bulkImportLogsAction(rows: ImportRow[]): Promise<BulkImportResult> {
  if (rows.length === 0) {
    return {
      ok: false,
      inserted: 0,
      failed: [],
      newCompanies: 0,
      newWasteTypes: 0,
      newPlants: 0,
      newSites: 0,
      error: '등록할 행이 없습니다',
    };
  }

  const supabase = createClient();

  const stat = { newCompanies: 0, newWasteTypes: 0, newPlants: 0, newSites: 0 };

  // 1) 거래처 unique → lookup-or-create
  const uniqueCompanies = [...new Set(rows.map((r) => r.company_name.trim()).filter(Boolean))];
  const companyMap = new Map<string, string>();
  for (const name of uniqueCompanies) {
    const r = await resolveByName(supabase, 'companies', name);
    if (r) {
      companyMap.set(name, r.id);
      if (r.created) stat.newCompanies++;
    }
  }

  // 2) 성상 unique → lookup-or-create
  const uniqueWasteTypes = [...new Set(rows.map((r) => r.waste_type_name.trim()).filter(Boolean))];
  const wasteTypeMap = new Map<string, string>();
  for (const name of uniqueWasteTypes) {
    const r = await resolveByName(supabase, 'waste_types', name);
    if (r) {
      wasteTypeMap.set(name, r.id);
      if (r.created) stat.newWasteTypes++;
    }
  }

  // 3) 처리장 unique → lookup-or-create
  const uniquePlants = [
    ...new Set(rows.map((r) => r.treatment_plant_name?.trim() ?? '').filter(Boolean)),
  ];
  const plantMap = new Map<string, string>();
  for (const name of uniquePlants) {
    const r = await resolveByName(supabase, 'treatment_plants', name);
    if (r) {
      plantMap.set(name, r.id);
      if (r.created) stat.newPlants++;
    }
  }

  // 4) sites unique (company_id, name) → lookup-or-create
  const siteKeys = new Set<string>(); // `${companyId}::${name}`
  const siteMap = new Map<string, string>();
  for (const row of rows) {
    const cName = row.company_name.trim();
    const sName = row.site_name?.trim() ?? '';
    if (!cName || !sName) continue;
    const cId = companyMap.get(cName);
    if (!cId) continue;
    const key = `${cId}::${sName}`;
    if (siteKeys.has(key)) continue;
    siteKeys.add(key);
    const r = await resolveSite(supabase, cId, sName);
    if (r) {
      siteMap.set(key, r.id);
      if (r.created) stat.newSites++;
    }
  }

  // 5) waste_logs INSERT (100 행씩 batch)
  const insertRows: Array<Record<string, unknown>> = [];
  const failed: Array<{ index: number; error: string }> = [];

  rows.forEach((r, idx) => {
    const companyId = companyMap.get(r.company_name.trim());
    const wasteTypeId = wasteTypeMap.get(r.waste_type_name.trim());
    if (!companyId) {
      failed.push({ index: idx, error: '거래처 등록 실패' });
      return;
    }
    if (!wasteTypeId) {
      failed.push({ index: idx, error: '성상 등록 실패' });
      return;
    }
    const plantId = r.treatment_plant_name
      ? (plantMap.get(r.treatment_plant_name.trim()) ?? null)
      : null;
    const siteId = r.site_name
      ? (siteMap.get(`${companyId}::${r.site_name.trim()}`) ?? null)
      : null;

    insertRows.push({
      log_date: r.log_date,
      direction: r.direction,
      company_id: companyId,
      site_id: siteId,
      waste_type_id: wasteTypeId,
      treatment_plant_id: plantId,
      vehicle_no: r.vehicle_no ?? null,
      weight_kg: r.weight_kg ?? null,
      weight_total_kg: r.weight_total_kg ?? null,
      weight_tare_kg: r.weight_tare_kg ?? null,
      unit_price: r.unit_price ?? null,
      transport_fee: r.transport_fee ?? 0,
      billing_type: r.billing_type,
      supply_amount: r.supply_amount ?? 0,
      vat: r.vat ?? 0,
      total_amount: r.total_amount ?? 0,
      is_invoiced: r.is_invoiced ?? false,
      is_paid: r.is_paid ?? false,
      note: r.note ?? null,
      status: 'active',
      created_by: 'import',
    });
  });

  let inserted = 0;
  const batchSize = 100;
  for (let i = 0; i < insertRows.length; i += batchSize) {
    const batch = insertRows.slice(i, i + batchSize);
    const { data, error } = await supabase.from('waste_logs').insert(batch).select('id');
    if (error) {
      for (let j = 0; j < batch.length; j++) {
        failed.push({ index: i + j, error: error.message });
      }
    } else {
      inserted += data?.length ?? 0;
    }
  }

  revalidatePath('/logs');
  revalidatePath('/dashboard');
  revalidatePath('/companies');
  revalidatePath('/masters/waste-types');
  revalidatePath('/masters/plants');

  return {
    ok: true,
    inserted,
    failed,
    ...stat,
  };
}
