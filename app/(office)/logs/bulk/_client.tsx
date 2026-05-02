'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2, CheckCircle2, AlertTriangle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bulkImportLogsAction, type ImportRow, type BulkImportResult } from '@/actions/import';
import { calcBilling } from '@/lib/calc/billing';
import { formatKRW } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Direction } from '@/lib/types/database';

interface MasterCompany {
  id: string;
  name: string;
  default_unit_price: number | null;
}
interface MasterWasteType {
  id: string;
  name: string;
  default_unit_price: number | null;
}
interface MasterPlant {
  id: string;
  name: string;
}

interface SpreadsheetRow {
  log_date: string;
  direction: Direction;
  company_name: string;
  site_name: string;
  waste_type_name: string;
  treatment_plant_name: string;
  vehicle_no: string;
  weight_total_kg: string;
  weight_tare_kg: string;
  unit_price: string;
  transport_fee: string;
  note: string;
}

// 총중량 - 공차중량 = 실중량 (음수 0으로 클램프)
function calcNetWeight(total: string, tare: string): number {
  const t = total ? Number(total) : 0;
  const a = tare ? Number(tare) : 0;
  return Math.max(0, t - a);
}

interface Props {
  companies: MasterCompany[];
  wasteTypes: MasterWasteType[];
  treatmentPlants: MasterPlant[];
}

const today = () => new Date().toISOString().slice(0, 10);

const blankRow = (date?: string): SpreadsheetRow => ({
  log_date: date ?? today(),
  direction: 'in',
  company_name: '',
  site_name: '',
  waste_type_name: '',
  treatment_plant_name: '',
  vehicle_no: '',
  weight_total_kg: '',
  weight_tare_kg: '',
  unit_price: '',
  transport_fee: '0',
  note: '',
});

const INITIAL_ROWS = 5;

export function BulkLogClient({ companies, wasteTypes, treatmentPlants }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<SpreadsheetRow[]>(() =>
    Array.from({ length: INITIAL_ROWS }, () => blankRow()),
  );
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const companyMap = useMemo(
    () => new Map(companies.map((c) => [c.name, c])),
    [companies],
  );
  const wasteTypeMap = useMemo(
    () => new Map(wasteTypes.map((w) => [w.name, w])),
    [wasteTypes],
  );

  const updateRow = <K extends keyof SpreadsheetRow>(
    i: number,
    field: K,
    value: SpreadsheetRow[K],
  ) => {
    setRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };

      // 자동 채움: 거래처 매칭 시 단가
      if (field === 'company_name' && typeof value === 'string') {
        const match = companyMap.get(value.trim());
        if (match?.default_unit_price && !next[i].unit_price) {
          next[i].unit_price = String(match.default_unit_price);
        }
      }
      // 자동 채움: 성상 매칭 시 단가
      if (field === 'waste_type_name' && typeof value === 'string') {
        const match = wasteTypeMap.get(value.trim());
        if (match?.default_unit_price && !next[i].unit_price) {
          next[i].unit_price = String(match.default_unit_price);
        }
      }
      return next;
    });
  };

  const addRow = () => {
    const last = rows[rows.length - 1];
    setRows((prev) => [...prev, blankRow(last?.log_date)]);
  };

  const addBlankRows = (n: number) => {
    setRows((prev) => [...prev, ...Array.from({ length: n }, () => blankRow())]);
  };

  const removeRow = (i: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  const isRowEmpty = (r: SpreadsheetRow) =>
    !r.company_name.trim() &&
    !r.waste_type_name.trim() &&
    !r.weight_total_kg &&
    !r.weight_tare_kg &&
    !r.note.trim();

  const isRowValid = (r: SpreadsheetRow) =>
    r.log_date &&
    r.direction &&
    r.company_name.trim() &&
    r.waste_type_name.trim();

  const validRows = rows.filter((r) => !isRowEmpty(r) && isRowValid(r));
  const invalidRows = rows.filter((r) => !isRowEmpty(r) && !isRowValid(r));

  const totalCalc = useMemo(() => {
    return validRows.reduce(
      (s, r) => {
        const c = calcBilling({
          billingType: 'weight_based',
          weightKg: calcNetWeight(r.weight_total_kg, r.weight_tare_kg),
          unitPrice: r.unit_price ? Number(r.unit_price) : 0,
          transportFee: r.transport_fee ? Number(r.transport_fee) : 0,
        });
        return {
          supply: s.supply + c.supplyAmount,
          vat: s.vat + c.vat,
          total: s.total + c.totalAmount,
        };
      },
      { supply: 0, vat: 0, total: 0 },
    );
  }, [validRows]);

  const handleSave = () => {
    if (validRows.length === 0) return;
    setResult(null);
    const payload: ImportRow[] = validRows.map((r) => {
      const netKg = calcNetWeight(r.weight_total_kg, r.weight_tare_kg);
      const c = calcBilling({
        billingType: 'weight_based',
        weightKg: netKg,
        unitPrice: r.unit_price ? Number(r.unit_price) : 0,
        transportFee: r.transport_fee ? Number(r.transport_fee) : 0,
      });
      return {
        log_date: r.log_date,
        direction: r.direction,
        company_name: r.company_name.trim(),
        site_name: r.site_name.trim() || null,
        waste_type_name: r.waste_type_name.trim(),
        treatment_plant_name: r.treatment_plant_name.trim() || null,
        vehicle_no: r.vehicle_no.trim() || null,
        weight_kg: r.weight_total_kg || r.weight_tare_kg ? netKg : null,
        weight_total_kg: r.weight_total_kg ? Number(r.weight_total_kg) : null,
        weight_tare_kg: r.weight_tare_kg ? Number(r.weight_tare_kg) : null,
        unit_price: r.unit_price ? Number(r.unit_price) : null,
        transport_fee: r.transport_fee ? Number(r.transport_fee) : 0,
        billing_type: 'weight_based',
        supply_amount: c.supplyAmount,
        vat: c.vat,
        total_amount: c.totalAmount,
        is_invoiced: false,
        is_paid: false,
        note: r.note.trim() || null,
      };
    });

    startTransition(async () => {
      const r = await bulkImportLogsAction(payload);
      setResult(r);
      if (r.ok && r.failed.length === 0) {
        // 모두 성공 — 폼 초기화
        setRows(Array.from({ length: INITIAL_ROWS }, () => blankRow()));
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* 안내 */}
      <div className="rounded-md border border-border bg-background-subtle px-3 py-2 text-[11px] text-foreground-secondary">
        <strong className="text-foreground">스프레드시트 모드</strong> · 청구 타입은
        <span className="font-mono"> weight_based </span>(중량×단가) 고정. 정액·면세·사급 건은 일반
        입력 화면을 사용하세요. 마스터에 없는 거래처·성상·처리장·현장은 자동 추가됩니다.
      </div>

      {/* datalist 공유 */}
      <datalist id="bulk-companies">
        {companies.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <datalist id="bulk-waste-types">
        {wasteTypes.map((w) => (
          <option key={w.id} value={w.name}>
            {w.default_unit_price !== null ? `${w.default_unit_price}원/kg` : ''}
          </option>
        ))}
      </datalist>
      <datalist id="bulk-plants">
        {treatmentPlants.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>

      {/* 스프레드시트 */}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-background-subtle">
            <tr className="border-b border-border">
              <Th className="w-8">#</Th>
              <Th className="w-28">일자<span className="text-danger">*</span></Th>
              <Th className="w-16">구분<span className="text-danger">*</span></Th>
              <Th className="w-36">거래처<span className="text-danger">*</span></Th>
              <Th className="w-28">현장</Th>
              <Th className="w-28">성상<span className="text-danger">*</span></Th>
              <Th className="w-28">처리장</Th>
              <Th className="w-28">차량</Th>
              <Th className="w-20 text-right">총중량(kg)</Th>
              <Th className="w-20 text-right">공차중량(kg)</Th>
              <Th className="w-20 text-right">실중량 (자동)</Th>
              <Th className="w-20 text-right">단가</Th>
              <Th className="w-20 text-right">운반비</Th>
              <Th className="w-32 text-right">청구금액 (자동)</Th>
              <Th className="w-40">비고</Th>
              <Th className="w-8"></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const netKg = calcNetWeight(r.weight_total_kg, r.weight_tare_kg);
              const calc = calcBilling({
                billingType: 'weight_based',
                weightKg: netKg,
                unitPrice: r.unit_price ? Number(r.unit_price) : 0,
                transportFee: r.transport_fee ? Number(r.transport_fee) : 0,
              });
              const empty = isRowEmpty(r);
              const invalid = !empty && !isRowValid(r);
              return (
                <tr
                  key={i}
                  className={cn(
                    'border-b border-divider transition-colors',
                    invalid && 'bg-danger-bg/30',
                    empty && 'bg-background-subtle/30',
                  )}
                >
                  <Td>
                    <span className="font-mono text-foreground-muted">{i + 1}</span>
                  </Td>
                  <Td>
                    <CellInput
                      type="date"
                      value={r.log_date}
                      onChange={(v) => updateRow(i, 'log_date', v)}
                    />
                  </Td>
                  <Td>
                    <select
                      value={r.direction}
                      onChange={(e) => updateRow(i, 'direction', e.target.value as Direction)}
                      className="h-7 w-full rounded border border-transparent bg-transparent px-1 text-xs focus:border-foreground focus:outline-none"
                    >
                      <option value="in">반입</option>
                      <option value="out">반출</option>
                    </select>
                  </Td>
                  <Td>
                    <CellInput
                      list="bulk-companies"
                      value={r.company_name}
                      onChange={(v) => updateRow(i, 'company_name', v)}
                      placeholder="거래처명"
                    />
                  </Td>
                  <Td>
                    <CellInput
                      value={r.site_name}
                      onChange={(v) => updateRow(i, 'site_name', v)}
                    />
                  </Td>
                  <Td>
                    <CellInput
                      list="bulk-waste-types"
                      value={r.waste_type_name}
                      onChange={(v) => updateRow(i, 'waste_type_name', v)}
                      placeholder="성상"
                    />
                  </Td>
                  <Td>
                    <CellInput
                      list="bulk-plants"
                      value={r.treatment_plant_name}
                      onChange={(v) => updateRow(i, 'treatment_plant_name', v)}
                    />
                  </Td>
                  <Td>
                    <CellInput
                      value={r.vehicle_no}
                      onChange={(v) => updateRow(i, 'vehicle_no', v)}
                    />
                  </Td>
                  <Td>
                    <CellInput
                      type="number"
                      align="right"
                      mono
                      value={r.weight_total_kg}
                      onChange={(v) => updateRow(i, 'weight_total_kg', v)}
                    />
                  </Td>
                  <Td>
                    <CellInput
                      type="number"
                      align="right"
                      mono
                      value={r.weight_tare_kg}
                      onChange={(v) => updateRow(i, 'weight_tare_kg', v)}
                    />
                  </Td>
                  <Td className="text-right font-mono">
                    {r.weight_total_kg || r.weight_tare_kg ? (
                      <span className="text-foreground-muted">{netKg}</span>
                    ) : (
                      <span className="text-foreground-dim">—</span>
                    )}
                  </Td>
                  <Td>
                    <CellInput
                      type="number"
                      align="right"
                      mono
                      value={r.unit_price}
                      onChange={(v) => updateRow(i, 'unit_price', v)}
                    />
                  </Td>
                  <Td>
                    <CellInput
                      type="number"
                      align="right"
                      mono
                      value={r.transport_fee}
                      onChange={(v) => updateRow(i, 'transport_fee', v)}
                    />
                  </Td>
                  <Td className="text-right font-mono">
                    {empty ? (
                      <span className="text-foreground-dim">—</span>
                    ) : (
                      <span className={cn(invalid && 'text-foreground-muted')}>
                        {formatKRW(calc.totalAmount)}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <CellInput
                      value={r.note}
                      onChange={(v) => updateRow(i, 'note', v)}
                    />
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      disabled={rows.length <= 1}
                      className="rounded p-1 text-foreground-muted hover:bg-danger-bg hover:text-danger disabled:opacity-30"
                      title="행 삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 추가 + 합계 + 저장 */}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="outline" onClick={addRow}>
          <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />행 추가
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => addBlankRows(5)}>
          + 5행
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => addBlankRows(10)}>
          + 10행
        </Button>

        <div className="ml-auto flex items-center gap-4 text-xs">
          <span className="text-foreground-muted">
            정상 <span className="font-mono text-foreground">{validRows.length}</span> · 오류{' '}
            <span className="font-mono text-danger">{invalidRows.length}</span>
          </span>
          <div className="rounded-md border border-border bg-surface px-3 py-1.5">
            <span className="text-[10.5px] text-foreground-muted">합계 </span>
            <span className="font-mono text-sm font-semibold">
              {formatKRW(totalCalc.total)}
            </span>
          </div>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending || validRows.length === 0}
          >
            {isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" strokeWidth={1.75} />
            )}
            {validRows.length}건 저장
          </Button>
        </div>
      </div>

      {/* 결과 */}
      {result && (
        <div
          className={cn(
            'flex items-start gap-3 rounded-md border px-4 py-3 text-sm',
            result.failed.length === 0
              ? 'border-success/40 bg-success-bg/60 text-success'
              : 'border-warning/40 bg-warning-bg/60 text-warning',
          )}
        >
          {result.failed.length === 0 ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          )}
          <div className="flex-1">
            <p className="font-semibold">{result.inserted}건 등록 완료</p>
            <p className="mt-0.5 text-[11px] opacity-90">
              신규 거래처 {result.newCompanies} · 성상 {result.newWasteTypes} · 처리장{' '}
              {result.newPlants} · 현장 {result.newSites}
              {result.failed.length > 0 && ` · 실패 ${result.failed.length}`}
            </p>
            <button
              type="button"
              onClick={() => router.push('/logs')}
              className="mt-2 text-[11px] font-medium underline"
            >
              일보 목록으로 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'border-r border-divider px-2 py-2 text-left text-[10.5px] font-medium text-foreground-muted last:border-0',
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td
      className={cn(
        'border-r border-divider px-1 py-1 align-middle last:border-0',
        className,
      )}
    >
      {children}
    </td>
  );
}

interface CellInputProps {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  list?: string;
  placeholder?: string;
  align?: 'left' | 'right';
  mono?: boolean;
}

function CellInput({
  value,
  onChange,
  type = 'text',
  list,
  placeholder,
  align = 'left',
  mono = false,
}: CellInputProps) {
  return (
    <input
      type={type}
      list={list}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      className={cn(
        'h-7 w-full rounded border border-transparent bg-transparent px-1.5 text-xs',
        'placeholder:text-foreground-dim',
        'focus:border-foreground focus:bg-surface focus:outline-none focus:ring-1 focus:ring-foreground/30',
        align === 'right' && 'text-right',
        mono && 'font-mono',
      )}
    />
  );
}
