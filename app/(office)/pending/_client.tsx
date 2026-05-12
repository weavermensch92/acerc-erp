'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Save,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/erp/Pill';
import { formatKRW, formatDate, formatNumber } from '@/lib/format';
import {
  markCompanyInvoicedAction,
  markLogsInvoicedAction,
  markCompanyPaidAction,
  markLogsPaidAction,
} from '@/actions/pending';
import {
  bulkUpdateLogsInlineAction,
  type InlineRowUpdate,
} from '@/actions/waste-logs';
import { calcBilling } from '@/lib/calc/billing';
import { cn } from '@/lib/utils';
import type { BillingType, Direction } from '@/lib/types/database';

export type Kind = 'invoice' | 'payment';

export interface PendingLogRow {
  id: string;
  log_date: string;
  weight_kg: number | null;
  unit_price: number | null;
  transport_fee: number | null;
  billing_type: BillingType;
  total_amount: number | null;
  vehicle_no: string | null;
  is_paid: boolean;
  is_invoiced: boolean;
  site_id: string | null;
  site_name: string | null;
  waste_type_id: string;
  waste_type_name: string | null;
}

export interface CompanyGroup {
  companyId: string;
  companyName: string;
  oldestDate: string;
  latestDate: string;
  count: number;
  totalAmount: number;
  unpaidAmount: number;
  logs: PendingLogRow[];
}

interface Props {
  direction: Direction;
  kind: Kind;
  groups: CompanyGroup[];
  period: { from: string; to: string };
  sitesByCompany?: Record<string, Array<{ id: string; name: string }>>;
  wasteTypes?: Array<{ id: string; name: string }>;
}

export function PendingClient({
  direction,
  kind,
  groups,
  period,
  sitesByCompany = {},
  wasteTypes = [],
}: Props) {
  const router = useRouter();
  const isInbound = direction === 'in';
  const isPayment = kind === 'payment';
  const processLabel = isPayment
    ? isInbound
      ? '입금 완료 표시'
      : '지급 완료 표시'
    : isInbound
      ? '청구 완료 표시'
      : '청구서 수령 표시';
  const linkLabel = isInbound ? '명세표 발급으로' : '지급 화면으로';
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
        <CheckCircle2
          className="mx-auto h-8 w-8 text-success"
          strokeWidth={1.5}
        />
        <p className="mt-2 text-sm font-medium">미처리 거래가 없습니다 🎉</p>
        <p className="mt-1 text-[11.5px] text-foreground-muted">
          기간 {period.from} ~ {period.to} 에 모든 {isInbound ? '반입' : '반출'}{' '}
          거래가 처리되어 있습니다.
        </p>
      </div>
    );
  }

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onProcessGroup = (g: CompanyGroup) => {
    setError(null);
    setPendingId(g.companyId);
    const fn = isPayment ? markCompanyPaidAction : markCompanyInvoicedAction;
    startTransition(async () => {
      const r = await fn(g.companyId, direction, {
        from: g.oldestDate,
        to: g.latestDate,
      });
      setPendingId(null);
      if (!r.ok) {
        setError(r.error ?? '처리 실패');
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger-bg/60 px-3 py-2 text-xs text-danger">
          <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
          {error}
        </div>
      )}

      {groups.map((g) => {
        const isOpen = expanded.has(g.companyId);
        const isProcessing = pendingId === g.companyId;
        const linkHref = isInbound
          ? `/invoices?company=${g.companyId}&from=${g.oldestDate}&to=${g.latestDate}`
          : `/payouts`;

        return (
          <div
            key={g.companyId}
            className="overflow-hidden rounded-[10px] border border-border bg-surface shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => toggle(g.companyId)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                )}
                <span className="text-sm font-semibold">{g.companyName}</span>
                <Pill tone="warning">{formatNumber(g.count)}건</Pill>
                <span className="text-[11.5px] text-foreground-muted">
                  {formatDate(g.oldestDate)} ~ {formatDate(g.latestDate)}
                </span>
              </button>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold">
                    {formatKRW(g.totalAmount)}
                  </div>
                  {g.unpaidAmount > 0 && (
                    <div className="font-mono text-[11px] text-danger">
                      {isInbound ? '미수금' : '미지급'} {formatKRW(g.unpaidAmount)}
                    </div>
                  )}
                </div>
                <Link href={linkHref}>
                  <Button size="sm" variant="outline">
                    <ExternalLink
                      className="mr-1 h-3.5 w-3.5"
                      strokeWidth={1.75}
                    />
                    {linkLabel}
                  </Button>
                </Link>
                <Button
                  size="sm"
                  onClick={() => onProcessGroup(g)}
                  disabled={isProcessing}
                  title={`${g.count}건 모두 ${processLabel}`}
                >
                  {isProcessing ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2
                      className="mr-1 h-3.5 w-3.5"
                      strokeWidth={1.75}
                    />
                  )}
                  일괄 {processLabel}
                </Button>
              </div>
            </div>

            {isOpen && (
              <LogsTable
                logs={g.logs}
                direction={direction}
                kind={kind}
                sites={sitesByCompany[g.companyId] ?? []}
                wasteTypes={wasteTypes}
                onAfterUpdate={() => router.refresh()}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const editCellInputClass =
  'h-7 w-full rounded border border-transparent bg-transparent px-1.5 text-xs ' +
  'focus:border-foreground focus:bg-surface focus:outline-none focus:ring-1 focus:ring-foreground/30 ' +
  'hover:border-border placeholder:text-foreground-dim';
const editCellSelectClass = editCellInputClass + ' pr-1';

interface EditState {
  site_id: string;
  waste_type_id: string;
  vehicle_no: string;
  weight_kg: string;
  unit_price: string;
}

function toEditState(l: PendingLogRow): EditState {
  return {
    site_id: l.site_id ?? '',
    waste_type_id: l.waste_type_id ?? '',
    vehicle_no: l.vehicle_no ?? '',
    weight_kg: l.weight_kg !== null ? String(l.weight_kg) : '',
    unit_price: l.unit_price !== null ? String(l.unit_price) : '',
  };
}

function editStatesEqual(a: EditState, b: EditState): boolean {
  return (
    a.site_id === b.site_id &&
    a.waste_type_id === b.waste_type_id &&
    a.vehicle_no === b.vehicle_no &&
    a.weight_kg === b.weight_kg &&
    a.unit_price === b.unit_price
  );
}

function LogsTable({
  logs,
  direction,
  kind,
  sites,
  wasteTypes,
  onAfterUpdate,
}: {
  logs: PendingLogRow[];
  direction: Direction;
  kind: Kind;
  sites: Array<{ id: string; name: string }>;
  wasteTypes: Array<{ id: string; name: string }>;
  onAfterUpdate: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 원본 상태 (저장 후 다시 fetch 되면 logs prop 이 바뀌므로 useMemo 로 추출)
  const initial = useMemo<Record<string, EditState>>(() => {
    const map: Record<string, EditState> = {};
    for (const l of logs) map[l.id] = toEditState(l);
    return map;
  }, [logs]);

  const [edited, setEdited] = useState<Record<string, EditState>>({});
  // logs 가 갱신되면 (router.refresh 후) 편집 버퍼 비움
  useEffect(() => {
    setEdited({});
  }, [logs]);

  const stateOf = (id: string) => edited[id] ?? initial[id];
  const updateField = <K extends keyof EditState>(
    id: string,
    field: K,
    value: EditState[K],
  ) => {
    setEdited((prev) => {
      const cur = prev[id] ?? initial[id];
      return { ...prev, [id]: { ...cur, [field]: value } };
    });
  };

  const dirtyIds = logs
    .map((l) => l.id)
    .filter((id) => edited[id] && !editStatesEqual(edited[id], initial[id]));

  const allSelected = logs.length > 0 && logs.every((l) => selected.has(l.id));
  const isInbound = direction === 'in';
  const isPayment = kind === 'payment';
  const applyLabel = isPayment
    ? isInbound
      ? '입금 완료 표시'
      : '지급 완료 표시'
    : isInbound
      ? '청구 완료 표시'
      : '청구서 수령 표시';

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(logs.map((l) => l.id)) : new Set());
  };

  const onApply = () => {
    if (selected.size === 0) return;
    setError(null);
    const fn = isPayment ? markLogsPaidAction : markLogsInvoicedAction;
    startTransition(async () => {
      const r = await fn([...selected]);
      if (!r.ok) {
        setError(r.error ?? '처리 실패');
        return;
      }
      setSelected(new Set());
      onAfterUpdate();
    });
  };

  const onSaveEdits = () => {
    if (dirtyIds.length === 0) return;
    setError(null);
    const updates: InlineRowUpdate[] = dirtyIds.map((id) => {
      const s = stateOf(id);
      const row = logs.find((l) => l.id === id)!;
      return {
        id,
        weight_kg: s.weight_kg ? Number(s.weight_kg) : null,
        unit_price: s.unit_price ? Number(s.unit_price) : null,
        transport_fee: row.transport_fee ?? 0,
        billing_type: row.billing_type,
        is_invoiced: row.is_invoiced,
        is_paid: row.is_paid,
        note: null,
        waste_type_id: s.waste_type_id || null,
        site_id: s.site_id || null,
        vehicle_no: s.vehicle_no.trim() || null,
      };
    });
    startSaveTransition(async () => {
      const r = await bulkUpdateLogsInlineAction(updates);
      if (!r.ok) {
        setError(r.failed[0]?.error ?? '저장 실패');
        return;
      }
      setEdited({});
      onAfterUpdate();
    });
  };

  const onResetEdits = () => setEdited({});

  return (
    <div className="border-t border-divider bg-background-subtle/40">
      <table className="w-full text-xs">
        <thead className="text-foreground-muted">
          <tr className="border-b border-divider">
            <th className="w-8 px-2 py-1.5 text-center">
              <input
                type="checkbox"
                aria-label="전체 선택"
                className="h-3.5 w-3.5 rounded border-border"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
              />
            </th>
            <th className="px-2 py-1.5 text-left font-medium">일자</th>
            <th className="px-2 py-1.5 text-left font-medium">현장</th>
            <th className="px-2 py-1.5 text-left font-medium">성상</th>
            <th className="px-2 py-1.5 text-left font-medium">차량</th>
            <th className="px-2 py-1.5 text-right font-medium">중량(kg)</th>
            <th className="px-2 py-1.5 text-right font-medium">단가</th>
            <th className="px-2 py-1.5 text-right font-medium">금액</th>
            <th className="px-2 py-1.5 text-center font-medium">
              {isInbound ? '입금' : '지급'}
            </th>
            <th className="px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => {
            const s = stateOf(l.id);
            const isDirty = !!edited[l.id] && !editStatesEqual(edited[l.id], initial[l.id]);
            const calc = calcBilling({
              billingType: l.billing_type,
              weightKg: s.weight_kg ? Number(s.weight_kg) : 0,
              unitPrice: s.unit_price ? Number(s.unit_price) : 0,
              transportFee: l.transport_fee ?? 0,
            });
            return (
              <tr
                key={l.id}
                className={cn(
                  'border-b border-divider last:border-0',
                  isDirty && 'bg-warning-bg/30',
                )}
              >
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    aria-label="선택"
                    className="h-3.5 w-3.5 rounded border-border"
                    checked={selected.has(l.id)}
                    onChange={() => toggle(l.id)}
                  />
                </td>
                <td className="px-2 py-1.5 font-mono text-foreground-muted">
                  {formatDate(l.log_date)}
                </td>
                <td className="px-2 py-1">
                  <select
                    value={s.site_id}
                    onChange={(e) => updateField(l.id, 'site_id', e.target.value)}
                    className={editCellSelectClass}
                  >
                    <option value="">—</option>
                    {l.site_id && !sites.some((x) => x.id === l.site_id) && (
                      <option value={l.site_id}>{l.site_name ?? '(보존)'}</option>
                    )}
                    {sites.map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <select
                    value={s.waste_type_id}
                    onChange={(e) => updateField(l.id, 'waste_type_id', e.target.value)}
                    className={editCellSelectClass}
                  >
                    <option value="">—</option>
                    {l.waste_type_id && !wasteTypes.some((x) => x.id === l.waste_type_id) && (
                      <option value={l.waste_type_id}>{l.waste_type_name ?? '(보존)'}</option>
                    )}
                    {wasteTypes.map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={s.vehicle_no}
                    onChange={(e) => updateField(l.id, 'vehicle_no', e.target.value)}
                    className={cn(editCellInputClass, 'font-mono')}
                    autoComplete="off"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={s.weight_kg}
                    onChange={(e) => updateField(l.id, 'weight_kg', e.target.value)}
                    className={cn(editCellInputClass, 'text-right font-mono')}
                    autoComplete="off"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={s.unit_price}
                    onChange={(e) => updateField(l.id, 'unit_price', e.target.value)}
                    className={cn(editCellInputClass, 'text-right font-mono')}
                    autoComplete="off"
                  />
                </td>
                <td className="px-2 py-1.5 text-right font-mono">
                  {isDirty ? (
                    <span className="text-warning">{formatKRW(calc.totalAmount)}</span>
                  ) : (
                    formatKRW(l.total_amount)
                  )}
                </td>
                <td className="px-2 py-1.5 text-center">
                  {l.is_paid ? (
                    <Pill tone="success">완료</Pill>
                  ) : (
                    <Pill tone="warning">대기</Pill>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Link
                    href={`/logs/${l.id}`}
                    className="text-[11px] text-foreground-muted hover:text-foreground hover:underline"
                  >
                    상세 →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {(selected.size > 0 || dirtyIds.length > 0 || error) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider bg-surface px-3 py-2">
          <span className="text-xs">
            {dirtyIds.length > 0 && (
              <span className="mr-3 font-semibold text-warning">
                수정 {dirtyIds.length}건
              </span>
            )}
            {selected.size > 0 && (
              <>
                <span className="font-semibold">{selected.size}건</span> 선택됨
              </>
            )}
          </span>
          {error && <span className="text-xs text-danger">{error}</span>}
          <div className="flex flex-wrap gap-2">
            {dirtyIds.length > 0 && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onResetEdits}
                  disabled={isSaving}
                  title="편집 되돌리기"
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />
                  되돌리기
                </Button>
                <Button size="sm" onClick={onSaveEdits} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />
                  )}
                  수정 {dirtyIds.length}건 저장
                </Button>
              </>
            )}
            {selected.size > 0 && (
              <Button size="sm" onClick={onApply} disabled={isPending}>
                {isPending ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2
                    className="mr-1 h-3.5 w-3.5"
                    strokeWidth={1.75}
                  />
                )}
                선택 {applyLabel}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
