'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const SCHEMA_VERSION = 1;

const TABLES = [
  'companies',
  'waste_types',
  'treatment_plants',
  'sites',
  'waste_logs',
] as const;

type TableName = (typeof TABLES)[number];

export interface BackupPayload {
  schema_version: number;
  exported_at: string;
  data: {
    companies: Record<string, unknown>[];
    waste_types: Record<string, unknown>[];
    treatment_plants: Record<string, unknown>[];
    sites: Record<string, unknown>[];
    waste_logs: Record<string, unknown>[];
    app_settings: Array<{ key: string; value: unknown; updated_at: string }>;
  };
}

export interface ExportResult {
  ok: true;
  payload: BackupPayload;
}

export interface ImportTableResult {
  inserted: number;
  updated: number;
  skipped: number;
  failed: Array<{ id: string | null; error: string }>;
}

export interface ImportResult {
  ok: boolean;
  error?: string;
  results?: Record<TableName | 'app_settings', ImportTableResult>;
}

// ========================================
// Export — 전체 DB 상태를 JSON 으로 내보냄
// 거래 데이터(waste_logs) + 마스터 + 자사 정보(app_settings) 포함
// ========================================
export async function exportBackupAction(): Promise<ExportResult | { ok: false; error: string }> {
  const supabase = createClient();

  const result: BackupPayload = {
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    data: {
      companies: [],
      waste_types: [],
      treatment_plants: [],
      sites: [],
      waste_logs: [],
      app_settings: [],
    },
  };

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) return { ok: false, error: `${table}: ${error.message}` };
    result.data[table] = (data ?? []) as Record<string, unknown>[];
  }

  const { data: settingsData, error: settingsError } = await supabase
    .from('app_settings')
    .select('key, value, updated_at');
  if (settingsError) return { ok: false, error: `app_settings: ${settingsError.message}` };
  result.data.app_settings = (settingsData ?? []) as BackupPayload['data']['app_settings'];

  return { ok: true, payload: result };
}

// ========================================
// Import — JSON 페이로드를 DB 에 복원
// 정책: 동일 id 행이 있으면 백업의 updated_at 이 더 최신일 때만 덮어쓰기.
// ========================================
function emptyTableResult(): ImportTableResult {
  return { inserted: 0, updated: 0, skipped: 0, failed: [] };
}

export async function importBackupAction(payloadJson: string): Promise<ImportResult> {
  let payload: BackupPayload;
  try {
    payload = JSON.parse(payloadJson) as BackupPayload;
  } catch {
    return { ok: false, error: 'JSON 파싱 실패' };
  }

  if (payload?.schema_version !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: `스키마 버전 불일치 (지원: ${SCHEMA_VERSION}, 파일: ${payload?.schema_version})`,
    };
  }
  if (!payload.data) return { ok: false, error: '데이터가 비어있습니다' };

  const supabase = createClient();
  const results: Record<TableName | 'app_settings', ImportTableResult> = {
    companies: emptyTableResult(),
    waste_types: emptyTableResult(),
    treatment_plants: emptyTableResult(),
    sites: emptyTableResult(),
    waste_logs: emptyTableResult(),
    app_settings: emptyTableResult(),
  };

  // FK 의존성 순서: 부모 테이블 먼저
  for (const table of TABLES) {
    const rows = payload.data[table] ?? [];
    if (rows.length === 0) continue;

    const ids = rows.map((r) => r.id as string).filter(Boolean);
    const { data: existingRows } = await supabase
      .from(table)
      .select('id, updated_at')
      .in('id', ids);
    const existingMap = new Map<string, string>(
      ((existingRows ?? []) as Array<{ id: string; updated_at: string }>).map((r) => [
        r.id,
        r.updated_at,
      ]),
    );

    const toUpsert: Record<string, unknown>[] = [];
    let skipped = 0;
    for (const row of rows) {
      const id = row.id as string;
      const backupUpdatedAt = String(row.updated_at ?? '');
      const existingUpdatedAt = existingMap.get(id);
      if (existingUpdatedAt && backupUpdatedAt <= existingUpdatedAt) {
        skipped += 1;
        continue;
      }
      toUpsert.push(row);
    }
    results[table].skipped = skipped;

    // 청크 단위 upsert (Supabase 단일 호출 한도 회피)
    const CHUNK = 500;
    for (let i = 0; i < toUpsert.length; i += CHUNK) {
      const chunk = toUpsert.slice(i, i + CHUNK);
      const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
      if (error) {
        // 실패 시 행별로 재시도해서 실패 사유 수집
        for (const row of chunk) {
          const { error: rowError } = await supabase
            .from(table)
            .upsert(row, { onConflict: 'id' });
          if (rowError) {
            results[table].failed.push({
              id: (row.id as string) ?? null,
              error: rowError.message,
            });
          } else {
            const isUpdate = existingMap.has(row.id as string);
            if (isUpdate) results[table].updated += 1;
            else results[table].inserted += 1;
          }
        }
      } else {
        for (const row of chunk) {
          const isUpdate = existingMap.has(row.id as string);
          if (isUpdate) results[table].updated += 1;
          else results[table].inserted += 1;
        }
      }
    }
  }

  // app_settings — key 기반 upsert + updated_at 비교
  const settingsRows = payload.data.app_settings ?? [];
  if (settingsRows.length > 0) {
    const keys = settingsRows.map((r) => r.key);
    const { data: existing } = await supabase
      .from('app_settings')
      .select('key, updated_at')
      .in('key', keys);
    const existingMap = new Map<string, string>(
      ((existing ?? []) as Array<{ key: string; updated_at: string }>).map((r) => [
        r.key,
        r.updated_at,
      ]),
    );
    for (const row of settingsRows) {
      const existingUpdatedAt = existingMap.get(row.key);
      if (existingUpdatedAt && String(row.updated_at) <= existingUpdatedAt) {
        results.app_settings.skipped += 1;
        continue;
      }
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: row.key, value: row.value }, { onConflict: 'key' });
      if (error) {
        results.app_settings.failed.push({ id: row.key, error: error.message });
      } else if (existingUpdatedAt) {
        results.app_settings.updated += 1;
      } else {
        results.app_settings.inserted += 1;
      }
    }
  }

  // 모든 페이지 갱신
  revalidatePath('/', 'layout');

  const hasFailures = Object.values(results).some((r) => r.failed.length > 0);
  return { ok: !hasFailures, results };
}
