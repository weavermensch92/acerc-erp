'use client';

import { useState, useTransition } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/erp/Pill';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  bulkImportLogsAction,
  type ImportRow,
  type BulkImportResult,
} from '@/actions/import';
import type { Direction, BillingType } from '@/lib/types/database';

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('ko-KR').format(n);
}

// ========================================
// 헤더 자동 매핑 — 한국어 / 영문 / 변형 모두 인식
// ========================================
const HEADER_MAP: Record<string, string> = {
  // log_date
  일자: 'log_date',
  날짜: 'log_date',
  date: 'log_date',
  log_date: 'log_date',
  // direction
  구분: 'direction',
  반입반출: 'direction',
  반입출: 'direction',
  direction: 'direction',
  // company
  거래처: 'company_name',
  배출자: 'company_name',
  거래처명: 'company_name',
  company: 'company_name',
  // site
  공사: 'site_name',
  공사명: 'site_name',
  공사현장: 'site_name',
  현장: 'site_name',
  현장명: 'site_name',
  site: 'site_name',
  // waste_type
  성상: 'waste_type_name',
  폐기물: 'waste_type_name',
  폐기물종류: 'waste_type_name',
  waste: 'waste_type_name',
  waste_type: 'waste_type_name',
  // treatment_plant
  처리장: 'treatment_plant_name',
  처리시설: 'treatment_plant_name',
  처리지: 'treatment_plant_name',
  plant: 'treatment_plant_name',
  // vehicle
  차량: 'vehicle_no',
  차량번호: 'vehicle_no',
  vehicle: 'vehicle_no',
  // weight_kg
  중량: 'weight_kg',
  '중량(kg)': 'weight_kg',
  실중량: 'weight_kg',
  weight: 'weight_kg',
  kg: 'weight_kg',
  // unit_price
  단가: 'unit_price',
  '단가(원)': 'unit_price',
  price: 'unit_price',
  // transport_fee
  운반비: 'transport_fee',
  fee: 'transport_fee',
  // supply_amount
  공급가액: 'supply_amount',
  공급액: 'supply_amount',
  supply: 'supply_amount',
  // vat
  부가세: 'vat',
  세액: 'vat',
  vat: 'vat',
  // total_amount
  청구금액: 'total_amount',
  합계: 'total_amount',
  총액: 'total_amount',
  total: 'total_amount',
  // is_invoiced
  청구: 'is_invoiced',
  청구유무: 'is_invoiced',
  // is_paid
  결제: 'is_paid',
  결제유무: 'is_paid',
  // note
  비고: 'note',
  메모: 'note',
  note: 'note',
  memo: 'note',
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '');
}

function mapHeaders(rawHeaders: string[]): Record<string, string> {
  // 결과: { '거래처': 'company_name', ... } - excel 헤더 → 우리 필드
  const map: Record<string, string> = {};
  for (const h of rawHeaders) {
    const key = normalizeHeader(h);
    const field = HEADER_MAP[key];
    if (field) map[h] = field;
  }
  return map;
}

function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof v === 'number') {
    // Excel serial number
    const dateInfo = XLSX.SSF.parse_date_code(v);
    if (dateInfo) {
      const y = dateInfo.y;
      const m = String(dateInfo.m).padStart(2, '0');
      const d = String(dateInfo.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  if (typeof v === 'string') {
    const s = v.trim();
    const m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (m) {
      return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }
  }
  return null;
}

function parseDirection(v: unknown): Direction | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (['in', '반입', '입고', '입'].includes(s)) return 'in';
  if (['out', '반출', '출고', '출'].includes(s)) return 'out';
  return null;
}

function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[,₩원\s]/g, '');
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseBoolean(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v === null || v === undefined) return false;
  const s = String(v).trim().toLowerCase();
  return ['y', 'yes', 'true', '1', 'o', '✓', '완료', '청구', '결제'].includes(s);
}

function parseString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

// PRD § 시나리오 8 자동 분류 로직
function inferBillingType(row: Partial<ImportRow>): BillingType {
  const w = row.weight_kg ?? 0;
  const p = row.unit_price ?? 0;
  const total = row.total_amount ?? 0;
  const vat = row.vat ?? 0;
  const supply = row.supply_amount ?? 0;

  if ((p === 0 || row.unit_price === null) && total === 0) return 'internal';
  if (Math.abs(total - w * p) > 1 && p >= 50000) return 'flat_rate';
  if (vat === 0 && supply > 0) return 'tax_exempt';
  return 'weight_based';
}

interface ParsedRow {
  index: number; // 엑셀 행 번호 (헤더 다음 1부터)
  data: ImportRow;
  errors: string[];
}

function validateRow(row: ImportRow): string[] {
  const errs: string[] = [];
  if (!row.log_date) errs.push('일자 누락/형식오류');
  if (!row.direction) errs.push('구분(반입/반출) 누락');
  if (!row.company_name) errs.push('거래처 누락');
  if (!row.waste_type_name) errs.push('성상 누락');
  return errs;
}

function rowFromExcel(
  raw: Record<string, unknown>,
  headerToField: Record<string, string>,
): ImportRow {
  const fieldVal = (field: string) => {
    for (const [h, f] of Object.entries(headerToField)) {
      if (f === field) return raw[h];
    }
    return undefined;
  };

  const partial: Partial<ImportRow> = {
    log_date: parseDate(fieldVal('log_date')) ?? '',
    direction: parseDirection(fieldVal('direction')) ?? ('in' as Direction),
    company_name: parseString(fieldVal('company_name')) ?? '',
    site_name: parseString(fieldVal('site_name')),
    waste_type_name: parseString(fieldVal('waste_type_name')) ?? '',
    treatment_plant_name: parseString(fieldVal('treatment_plant_name')),
    vehicle_no: parseString(fieldVal('vehicle_no')),
    weight_kg: parseNumber(fieldVal('weight_kg')),
    unit_price: parseNumber(fieldVal('unit_price')),
    transport_fee: parseNumber(fieldVal('transport_fee')) ?? 0,
    supply_amount: parseNumber(fieldVal('supply_amount')),
    vat: parseNumber(fieldVal('vat')),
    total_amount: parseNumber(fieldVal('total_amount')),
    is_invoiced: parseBoolean(fieldVal('is_invoiced')),
    is_paid: parseBoolean(fieldVal('is_paid')),
    note: parseString(fieldVal('note')),
  };
  partial.billing_type = inferBillingType(partial);
  // 누락 필드: 자동 계산
  if (partial.billing_type === 'weight_based') {
    if (partial.supply_amount === null || partial.supply_amount === undefined) {
      partial.supply_amount = Math.round(
        (partial.weight_kg ?? 0) * (partial.unit_price ?? 0) +
          (partial.transport_fee ?? 0),
      );
    }
    if (partial.vat === null || partial.vat === undefined) {
      partial.vat = Math.round((partial.supply_amount ?? 0) * 0.1);
    }
    if (partial.total_amount === null || partial.total_amount === undefined) {
      partial.total_amount = (partial.supply_amount ?? 0) + (partial.vat ?? 0);
    }
  }
  return partial as ImportRow;
}

export function ImportClient() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [headerMap, setHeaderMap] = useState<Record<string, string>>({});
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { cellDates: true });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        setParseError('시트가 없습니다.');
        return;
      }
      const ws = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: null,
      });
      if (json.length === 0) {
        setParseError('데이터 행이 없습니다.');
        return;
      }
      const rawHeaders = Object.keys(json[0]);
      const map = mapHeaders(rawHeaders);
      const requiredMissing = ['log_date', 'direction', 'company_name', 'waste_type_name']
        .filter((f) => !Object.values(map).includes(f));
      if (requiredMissing.length > 0) {
        setParseError(
          `필수 컬럼 매핑 실패: ${requiredMissing.join(', ')}. 헤더 이름을 확인하세요.`,
        );
        setHeaders(rawHeaders);
        setHeaderMap(map);
        return;
      }

      const parsed: ParsedRow[] = json.map((raw, i) => {
        const data = rowFromExcel(raw, map);
        return { index: i + 1, data, errors: validateRow(data) };
      });
      setHeaders(rawHeaders);
      setHeaderMap(map);
      setParsedRows(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : '파싱 실패');
    }
  };

  const validRows = parsedRows.filter((p) => p.errors.length === 0);
  const invalidRows = parsedRows.filter((p) => p.errors.length > 0);

  const handleImport = () => {
    setResult(null);
    startTransition(async () => {
      const r = await bulkImportLogsAction(validRows.map((p) => p.data));
      setResult(r);
    });
  };

  return (
    <div className="space-y-5">
      {/* Step 1 — 파일 선택 */}
      <Section title="1. 파일 선택">
        <label className="flex cursor-pointer items-center gap-3 rounded-md border-2 border-dashed border-border bg-background-subtle p-6 hover:bg-background-subtle/70">
          <Upload className="h-6 w-6 text-foreground-muted" strokeWidth={1.75} />
          <div className="flex-1">
            <div className="text-sm font-medium">
              {fileName ?? '엑셀(.xlsx, .xls) 또는 CSV 파일 선택'}
            </div>
            <div className="mt-0.5 text-[11px] text-foreground-muted">
              첫 시트의 첫 행을 헤더로 인식합니다. 한국어 / 영문 헤더 모두 자동 매핑됩니다.
            </div>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="hidden"
          />
          <span className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium">
            파일 선택
          </span>
        </label>
        {parseError && (
          <div className="mt-3 rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
            {parseError}
          </div>
        )}
      </Section>

      {/* Step 2 — 컬럼 매핑 결과 */}
      {headers.length > 0 && (
        <Section title="2. 헤더 자동 매핑">
          <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {headers.map((h) => {
              const mapped = headerMap[h];
              return (
                <div
                  key={h}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-background-subtle px-3 py-1.5 text-xs"
                >
                  <span className="font-medium">{h}</span>
                  {mapped ? (
                    <Pill tone="success" dot>
                      {mapped}
                    </Pill>
                  ) : (
                    <Pill tone="neutral">매핑 안 됨 (무시)</Pill>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Step 3 — 검증 통계 + 미리보기 */}
      {parsedRows.length > 0 && (
        <Section title="3. 검증 통계">
          <div className="grid grid-cols-3 gap-3">
            <StatBox label="총 행" value={parsedRows.length} tone="neutral" />
            <StatBox label="정상" value={validRows.length} tone="success" />
            <StatBox label="오류" value={invalidRows.length} tone="danger" />
          </div>
          {invalidRows.length > 0 && (
            <div className="mt-4 max-h-60 overflow-y-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>행</TableHead>
                    <TableHead>거래처</TableHead>
                    <TableHead>일자</TableHead>
                    <TableHead>오류</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invalidRows.slice(0, 50).map((p) => (
                    <TableRow key={p.index}>
                      <TableCell className="font-mono text-xs">{p.index}</TableCell>
                      <TableCell className="text-xs">{p.data.company_name || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.data.log_date || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-danger">
                        {p.errors.join(', ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {invalidRows.length > 50 && (
                <p className="px-3 py-2 text-[11px] text-foreground-muted">
                  ※ 처음 50개만 표시. 총 {invalidRows.length}개 오류 행은 등록에서 제외됩니다.
                </p>
              )}
            </div>
          )}
        </Section>
      )}

      {/* Step 4 — 등록 */}
      {parsedRows.length > 0 && validRows.length > 0 && !result && (
        <Section title="4. 일괄 등록">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-foreground-muted">
              정상 {validRows.length}건을 등록합니다. 마스터(거래처/성상/처리장/공사현장)에 없는
              값은 자동으로 추가됩니다.
            </p>
            <Button onClick={handleImport} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-1 h-4 w-4" strokeWidth={1.75} />
              )}
              {validRows.length}건 등록
            </Button>
          </div>
        </Section>
      )}

      {/* 결과 */}
      {result && (
        <Section title="결과">
          <div className="space-y-3">
            <div
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                result.failed.length === 0
                  ? 'bg-success-bg text-success'
                  : 'bg-warning-bg text-warning'
              }`}
            >
              {result.failed.length === 0 ? (
                <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
              )}
              <span className="font-semibold">{result.inserted}건 등록 완료</span>
              {result.failed.length > 0 && (
                <span className="ml-2 text-xs">· 실패 {result.failed.length}건</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              <StatBox label="신규 거래처" value={result.newCompanies} tone="info" />
              <StatBox label="신규 성상" value={result.newWasteTypes} tone="info" />
              <StatBox label="신규 처리장" value={result.newPlants} tone="info" />
              <StatBox label="신규 현장" value={result.newSites} tone="info" />
            </div>
            {result.failed.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-foreground-muted">
                  실패 {result.failed.length}건 상세
                </summary>
                <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border bg-background-subtle p-2">
                  {result.failed.slice(0, 100).map((f) => (
                    <li key={f.index} className="font-mono text-[11px]">
                      [{f.index}] {f.error}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {result.error && (
              <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
                {result.error}
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
      <h3 className="mb-3 text-[13px] font-semibold tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'success' | 'danger' | 'info';
}) {
  const toneClasses = {
    neutral: 'border-border bg-background-subtle text-foreground',
    success: 'border-success/40 bg-success-bg text-success',
    danger: 'border-danger/40 bg-danger-bg text-danger',
    info: 'border-info/40 bg-info-bg text-info',
  };
  return (
    <div className={`rounded-md border p-2 text-center ${toneClasses[tone]}`}>
      <div className="text-[10.5px] opacity-80">{label}</div>
      <div className="mt-0.5 font-mono text-base font-semibold">{formatNumber(value)}</div>
    </div>
  );
}
