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

type ResolveOk = { ok: true; id: string; created: boolean };
type ResolveErr = { ok: false; error: string };
type ResolveResult = ResolveOk | ResolveErr;

// PostgREST ilike 패턴용 특수문자 이스케이프
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => '\\' + m);
}

async function resolveByName(
  supabase: SupabaseClient,
  table: 'companies' | 'waste_types' | 'treatment_plants',
  name: string,
): Promise<ResolveResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: '이름이 비어있음' };

  const target = trimmed.toLowerCase();

  // 1) 빠른 경로: 정확 일치 (companies 는 활성행만)
  {
    let q = supabase.from(table).select('id, name').eq('name', trimmed).limit(2);
    if (table === 'companies') q = q.eq('is_deleted', false);
    const { data } = await q;
    if (data && data.length > 0) {
      return { ok: true, id: data[0].id as string, created: false };
    }
  }

  // 2) 느린 경로: DB unique 인덱스 시맨틱(lower(trim(name)))과 일치하도록
  //    공백/대소문자 차이를 허용해 재조회. 매칭 후 후처리 필터.
  const fuzzyLookup = async (): Promise<{ id: string; name: string } | null> => {
    let q = supabase
      .from(table)
      .select('id, name')
      .ilike('name', `%${escapeLike(trimmed)}%`)
      .limit(50);
    if (table === 'companies') q = q.eq('is_deleted', false);
    const { data } = await q;
    if (!data || data.length === 0) return null;
    const hit = data.find((r) => (r.name as string).trim().toLowerCase() === target);
    return hit ? { id: hit.id as string, name: hit.name as string } : null;
  };
  {
    const hit = await fuzzyLookup();
    if (hit) return { ok: true, id: hit.id, created: false };
  }

  // 3) INSERT 시도
  const { data: created, error } = await supabase
    .from(table)
    .insert({ name: trimmed })
    .select('id')
    .single();
  if (!error && created) {
    return { ok: true, id: created.id as string, created: true };
  }

  // 4) INSERT 가 unique 충돌이면 재조회로 흡수
  const retry = await fuzzyLookup();
  if (retry) return { ok: true, id: retry.id, created: false };

  return { ok: false, error: error?.message ?? '알 수 없는 오류' };
}

async function resolveSite(
  supabase: SupabaseClient,
  companyId: string,
  name: string,
): Promise<ResolveResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: '현장명이 비어있음' };

  const target = trimmed.toLowerCase();

  {
    const { data } = await supabase
      .from('sites')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('name', trimmed)
      .limit(2);
    if (data && data.length > 0) {
      return { ok: true, id: data[0].id as string, created: false };
    }
  }

  const fuzzyLookup = async (): Promise<{ id: string; name: string } | null> => {
    const { data } = await supabase
      .from('sites')
      .select('id, name')
      .eq('company_id', companyId)
      .ilike('name', `%${escapeLike(trimmed)}%`)
      .limit(50);
    if (!data || data.length === 0) return null;
    const hit = data.find((r) => (r.name as string).trim().toLowerCase() === target);
    return hit ? { id: hit.id as string, name: hit.name as string } : null;
  };
  {
    const hit = await fuzzyLookup();
    if (hit) return { ok: true, id: hit.id, created: false };
  }

  const { data: created, error } = await supabase
    .from('sites')
    .insert({ company_id: companyId, name: trimmed, is_active: true })
    .select('id')
    .single();
  if (!error && created) {
    return { ok: true, id: created.id as string, created: true };
  }

  const retry = await fuzzyLookup();
  if (retry) return { ok: true, id: retry.id, created: false };

  return { ok: false, error: error?.message ?? '알 수 없는 오류' };
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
  const companyErr = new Map<string, string>();
  for (const name of uniqueCompanies) {
    const r = await resolveByName(supabase, 'companies', name);
    if (r.ok) {
      companyMap.set(name, r.id);
      if (r.created) stat.newCompanies++;
    } else {
      companyErr.set(name, r.error);
    }
  }

  // 2) 성상 unique → lookup-or-create
  const uniqueWasteTypes = [...new Set(rows.map((r) => r.waste_type_name.trim()).filter(Boolean))];
  const wasteTypeMap = new Map<string, string>();
  const wasteTypeErr = new Map<string, string>();
  for (const name of uniqueWasteTypes) {
    const r = await resolveByName(supabase, 'waste_types', name);
    if (r.ok) {
      wasteTypeMap.set(name, r.id);
      if (r.created) stat.newWasteTypes++;
    } else {
      wasteTypeErr.set(name, r.error);
    }
  }

  // 3) 처리장 unique → lookup-or-create
  const uniquePlants = [
    ...new Set(rows.map((r) => r.treatment_plant_name?.trim() ?? '').filter(Boolean)),
  ];
  const plantMap = new Map<string, string>();
  const plantErr = new Map<string, string>();
  for (const name of uniquePlants) {
    const r = await resolveByName(supabase, 'treatment_plants', name);
    if (r.ok) {
      plantMap.set(name, r.id);
      if (r.created) stat.newPlants++;
    } else {
      plantErr.set(name, r.error);
    }
  }

  // 4) sites unique (company_id, name) → lookup-or-create
  const siteKeys = new Set<string>(); // `${companyId}::${name}`
  const siteMap = new Map<string, string>();
  const siteErr = new Map<string, string>();
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
    if (r.ok) {
      siteMap.set(key, r.id);
      if (r.created) stat.newSites++;
    } else {
      siteErr.set(key, r.error);
    }
  }

  // 5) waste_logs INSERT (100 행씩 batch)
  const insertRows: Array<{ rowIndex: number; payload: Record<string, unknown> }> = [];
  const failed: Array<{ index: number; error: string }> = [];

  rows.forEach((r, idx) => {
    const cName = r.company_name.trim();
    const wName = r.waste_type_name.trim();
    const pName = r.treatment_plant_name?.trim() ?? '';
    const sName = r.site_name?.trim() ?? '';

    const companyId = companyMap.get(cName);
    const wasteTypeId = wasteTypeMap.get(wName);
    if (!companyId) {
      failed.push({
        index: idx,
        error: `거래처 등록 실패 (${cName}): ${companyErr.get(cName) ?? '확인 필요'}`,
      });
      return;
    }
    if (!wasteTypeId) {
      failed.push({
        index: idx,
        error: `성상 등록 실패 (${wName}): ${wasteTypeErr.get(wName) ?? '확인 필요'}`,
      });
      return;
    }

    let plantId: string | null = null;
    if (pName) {
      const found = plantMap.get(pName);
      if (!found) {
        failed.push({
          index: idx,
          error: `처리장 등록 실패 (${pName}): ${plantErr.get(pName) ?? '확인 필요'}`,
        });
        return;
      }
      plantId = found;
    }

    let siteId: string | null = null;
    if (sName) {
      const key = `${companyId}::${sName}`;
      const found = siteMap.get(key);
      if (!found) {
        failed.push({
          index: idx,
          error: `현장 등록 실패 (${sName}): ${siteErr.get(key) ?? '확인 필요'}`,
        });
        return;
      }
      siteId = found;
    }

    insertRows.push({
      rowIndex: idx,
      payload: {
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
      },
    });
  });

  let inserted = 0;
  const batchSize = 100;
  for (let i = 0; i < insertRows.length; i += batchSize) {
    const batch = insertRows.slice(i, i + batchSize);
    const payloads = batch.map((b) => b.payload);
    const { data, error } = await supabase.from('waste_logs').insert(payloads).select('id');
    if (error) {
      // 배치 전체가 거부됨 — 행별로 다시 시도해 실제 실패 행만 골라내고
      // 나머지는 정상 저장으로 회수한다.
      for (const item of batch) {
        const { data: one, error: oneErr } = await supabase
          .from('waste_logs')
          .insert(item.payload)
          .select('id');
        if (oneErr) {
          failed.push({ index: item.rowIndex, error: oneErr.message });
        } else {
          inserted += one?.length ?? 0;
        }
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
