'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Save, RotateCcw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { calcBilling } from '@/lib/calc/billing';
import { formatKRW, formatKg, formatNumber, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  bulkUpdateLogsInlineAction,
  type InlineRowUpdate,
  type BulkUpdateResult,
} from '@/actions/waste-logs';
import type { Direction, BillingType } from '@/lib/types/database';

export interface EditableLog {
  id: string;
  log_date: string;
  direction: Direction;
  vehicle_no: string | null;
  weight_kg: number | null;
  unit_price: number | null;
  transport_fee: number | null;
  billing_type: BillingType;
  supply_amount: number | null;
  vat: number | null;
  total_amount: number | null;
  is_invoiced: boolean;
  is_paid: boolean;
  note: string | null;
  sites: { name: string } | null;
  waste_types: { name: string } | null;
}

interface RowState {
  weight_kg: string;
  unit_price: string;
  transport_fee: string;
  billing_type: BillingType;
  is_invoiced: boolean;
  is_paid: boolean;
  note: string;
}

const billingLabel: Record<BillingType, string> = {
  weight_based: '중량',
  flat_rate: '정액',
  internal: '사급',
  tax_exempt: '면세',
};

const directionLabel: Record<Direction, string> = { in: '반입', out: '반출' };

function toRowState(log: EditableLog): RowState {
  return {
    weight_kg: log.weight_kg !== null ? String(log.weight_kg) : '',
    unit_price: log.unit_price !== null ? String(log.unit_price) : '',
    transport_fee: log.transport_fee !== null ? String(log.transport_fee) : '0',
    billing_type: log.billing_type,
    is_invoiced: log.is_invoiced,
    is_paid: log.is_paid,
    note: log.note ?? '',
  };
}

function statesEqual(a: RowState | undefined, b: RowState | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.weight_kg === b.weight_kg &&
    a.unit_price === b.unit_price &&
    a.transport_fee === b.transport_fee &&
    a.billing_type === b.billing_type &&
    a.is_invoiced === b.is_invoiced &&
    a.is_paid === b.is_paid &&
    a.note === b.note
  );
}

interface Props {
  logs: EditableLog[];
  // 컨텍스트별 라벨 — 반입(거래명세표) 기본값, 반출(지급) 시 prop 으로 덮어씀
  invoicedLabel?: string; // 청구 / 청구서수령
  paidLabel?: string;     // 결제 / 지급
  amountLabel?: string;   // 청구금액 / 지급금액
}

export function EditableInvoiceTable({
  logs,
  invoicedLabel = '청구',
  paidLabel = '결제',
  amountLabel = '청구금액',
}: Props) {
  const initial = useMemo(
    () =>
      logs.reduce<Record<string, RowState>>((acc, l) => {
        acc[l.id] = toRowState(l);
        return acc;
      }, {}),
    [logs],
  );

  const [state, setState] = useState<Record<string, RowState>>(() => ({
    ...initial,
  }));
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkUpdateResult | null>(null);

  // logs prop 이 바뀌면 state 재초기화 (다른 거래처·기간 조회 시 row id 가 달라짐)
  useEffect(() => {
    setState({ ...initial });
    setResult(null);
  }, [initial]);

  const dirtyIds = useMemo(
    () => logs.map((l) => l.id).filter((id) => !statesEqual(state[id], initial[id])),
    [logs, state, initial],
  );

  const updateField = <K extends keyof RowState>(
    id: string,
    field: K,
    value: RowState[K],
  ) => {
    setState((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
    setResult(null);
  };

  const resetRow = (id: string) => {
    setState((prev) => ({ ...prev, [id]: initial[id] }));
    setResult(null);
  };

  const resetAll = () => {
    setState({ ...initial });
    setReason('');
    setResult(null);
  };

  const handleSave = () => {
    const updates: InlineRowUpdate[] = dirtyIds.map((id) => {
      const s = state[id];
      return {
        id,
        weight_kg: s.weight_kg ? Number(s.weight_kg) : null,
        unit_price: s.unit_price ? Number(s.unit_price) : null,
        transport_fee: s.transport_fee ? Number(s.transport_fee) : 0,
        billing_type: s.billing_type,
        is_invoiced: s.is_invoiced,
        is_paid: s.is_paid,
        note: s.note.trim() || null,
      };
    });
    setResult(null);
    startTransition(async () => {
      const r = await bulkUpdateLogsInlineAction(updates, reason);
      setResult(r);
    });
  };

  const totalCalc = useMemo(() => {
    return logs.reduce(
      (s, l) => {
        const rs = state[l.id] ?? initial[l.id];
        if (!rs) return s;
        const c = calcBilling({
          billingType: rs.billing_type,
          weightKg: rs.weight_kg ? Number(rs.weight_kg) : 0,
          unitPrice: rs.unit_price ? Number(rs.unit_price) : 0,
          transportFee: rs.transport_fee ? Number(rs.transport_fee) : 0,
        });
        return {
          supply: s.supply + c.supplyAmount,
          vat: s.vat + c.vat,
          total: s.total + c.totalAmount,
        };
      },
      { supply: 0, vat: 0, total: 0 },
    );
  }, [logs, state]);

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight">화면 편집</h3>
        <span className="text-[11px] text-foreground-muted">
          셀 클릭 → 수정 → 우측 [N건 저장]. 변경된 행만 DB 에 반영됩니다.
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-background-subtle">
            <tr className="border-b border-border">
              <Th className="w-20">일자</Th>
              <Th className="w-12">구분</Th>
              <Th className="w-24">현장</Th>
              <Th className="w-24">성상</Th>
              <Th className="w-20">차량</Th>
              <Th className="w-20">청구타입</Th>
              <Th className="w-20 text-right">중량(kg)</Th>
              <Th className="w-20 text-right">단가</Th>
              <Th className="w-20 text-right">운반비</Th>
              <Th className="w-28 text-right">{amountLabel}</Th>
              <Th className="w-12 text-center">{invoicedLabel}</Th>
              <Th className="w-12 text-center">{paidLabel}</Th>
              <Th className="w-32">비고</Th>
              <Th className="w-10"></Th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => {
              // state 가 아직 초기화 안 된 경우 (logs prop 바뀐 직후 첫 렌더) initial fallback
              const s = state[l.id] ?? initial[l.id];
              if (!s) return null;
              const isDirty = !statesEqual(s, initial[l.id]);
              const c = calcBilling({
                billingType: s.billing_type,
                weightKg: s.weight_kg ? Number(s.weight_kg) : 0,
                unitPrice: s.unit_price ? Number(s.unit_price) : 0,
                transportFee: s.transport_fee ? Number(s.transport_fee) : 0,
              });
              return (
                <tr
                  key={l.id}
                  className={cn(
                    'border-b border-divider transition-colors',
                    isDirty && 'bg-warning-bg/30',
                  )}
                >
                  <Td className="font-mono text-foreground-muted">
                    {formatDate(l.log_date)}
                  </Td>
                  <Td>{directionLabel[l.direction]}</Td>
                  <Td>{l.sites?.name ?? '—'}</Td>
                  <Td>{l.waste_types?.name ?? '—'}</Td>
                  <Td className="font-mono text-foreground-muted">
                    {l.vehicle_no ?? '—'}
                  </Td>
                  <Td>
                    <select
                      value={s.billing_type}
                      onChange={(e) =>
                        updateField(l.id, 'billing_type', e.target.value as BillingType)
                      }
                      className="h-7 w-full rounded border border-transparent bg-transparent px-1 text-xs focus:border-foreground focus:bg-surface focus:outline-none"
                    >
                      {Object.entries(billingLabel).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td>
                    <CellInput
                      align="right"
                      mono
                      value={s.weight_kg}
                      onChange={(v) => updateField(l.id, 'weight_kg', v)}
                    />
                  </Td>
                  <Td>
                    <CellInput
                      align="right"
                      mono
                      value={s.unit_price}
                      onChange={(v) => updateField(l.id, 'unit_price', v)}
                    />
                  </Td>
                  <Td>
                    <CellInput
                      align="right"
                      mono
                      value={s.transport_fee}
                      onChange={(v) => updateField(l.id, 'transport_fee', v)}
                    />
                  </Td>
                  <Td className="text-right font-mono">
                    {isDirty ? (
                      <span className="text-warning">{formatKRW(c.totalAmount)}</span>
                    ) : (
                      formatKRW(l.total_amount)
                    )}
                  </Td>
                  <Td className="text-center">
                    <input
                      type="checkbox"
                      checked={s.is_invoiced}
                      onChange={(e) => updateField(l.id, 'is_invoiced', e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                  </Td>
                  <Td className="text-center">
                    <input
                      type="checkbox"
                      checked={s.is_paid}
                      onChange={(e) => updateField(l.id, 'is_paid', e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                  </Td>
                  <Td>
                    <CellInput
                      value={s.note}
                      onChange={(v) => updateField(l.id, 'note', v)}
                    />
                  </Td>
                  <Td>
                    {isDirty && (
                      <button
                        type="button"
                        onClick={() => resetRow(l.id)}
                        className="rounded p-1 text-foreground-muted hover:bg-background-subtle"
                        title="이 행 되돌리기"
                      >
                        <RotateCcw className="h-3 w-3" strokeWidth={1.75} />
                      </button>
                    )}
                  </Td>
                </tr>
              );
            })}
            {logs.length > 0 && (
              <tr className="bg-background-subtle text-xs font-semibold">
                <td colSpan={9} className="px-2 py-2 text-right">
                  변경 후 합계
                </td>
                <td className="px-2 py-2 text-right font-mono">
                  {formatKRW(totalCalc.total)}
                </td>
                <td colSpan={4}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 저장 바 */}
      {dirtyIds.length > 0 && (
        <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-[10px] border border-warning bg-surface p-4 shadow-md">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning" strokeWidth={1.75} />
            <span className="font-semibold">{dirtyIds.length}건</span> 변경됨
          </div>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="수정 사유 (선택, audit_logs 에 기록)"
            className="ml-2 max-w-md flex-1"
          />
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={resetAll}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />전체 되돌리기
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" strokeWidth={1.75} />
              )}
              {dirtyIds.length}건 저장
            </Button>
          </div>
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
            result.ok
              ? 'border-success/40 bg-success-bg/60 text-success'
              : 'border-warning/40 bg-warning-bg/60 text-warning',
          )}
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4" strokeWidth={1.75} />
          )}
          <div>
            <p className="font-semibold">{result.updated}건 저장 완료</p>
            {result.failed.length > 0 && (
              <p className="mt-0.5 text-xs">실패 {result.failed.length}건</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
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

function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
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

interface CellProps {
  value: string;
  onChange: (v: string) => void;
  align?: 'left' | 'right';
  mono?: boolean;
}

function CellInput({ value, onChange, align = 'left', mono = false }: CellProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
