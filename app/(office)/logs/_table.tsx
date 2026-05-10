'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Trash2,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
  Save,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Pill } from '@/components/erp/Pill';
import { Modal } from '@/components/erp/Modal';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  bulkArchiveLogsAction,
  bulkUpdateLogsInlineAction,
  toggleLogFlagAction,
  type InlineRowUpdate,
  type BulkUpdateResult,
} from '@/actions/waste-logs';
import { calcBilling } from '@/lib/calc/billing';
import { formatKRW, formatNumber, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LogStatus, Direction, BillingType } from '@/lib/types/database';

const directionLabel: Record<Direction, string> = { in: '반입', out: '반출' };

const statusLabelMap: Record<LogStatus, string> = {
  draft: '임시저장',
  pending_review: '검토 대기',
  active: '정식',
  archived: '보관',
};

function statusTone(status: LogStatus): 'neutral' | 'warning' | 'success' {
  if (status === 'pending_review') return 'warning';
  if (status === 'active') return 'success';
  return 'neutral';
}

// 일보 일자가 속한 달의 시작/끝 (YYYY-MM-DD) — 거래명세표 링크용
function monthRange(logDate: string): { from: string; to: string } {
  const d = new Date(logDate);
  const y = d.getFullYear();
  const m = d.getMonth();
  const fmt = (date: Date) => date.toISOString().slice(0, 10);
  return {
    from: fmt(new Date(y, m, 1)),
    to: fmt(new Date(y, m + 1, 0)),
  };
}

export interface LogRow {
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
  status: LogStatus;
  is_invoiced: boolean;
  is_paid: boolean;
  note: string | null;
  companies: { id: string; name: string } | null;
  sites: { name: string } | null;
  waste_types: { id: string; name: string } | null;
}

interface RowState {
  weight_kg: string;
  unit_price: string;
  transport_fee: string;
  note: string;
  is_invoiced: boolean;
  is_paid: boolean;
  waste_type_id: string;
}

function toRowState(row: LogRow): RowState {
  return {
    weight_kg: row.weight_kg !== null ? String(row.weight_kg) : '',
    unit_price: row.unit_price !== null ? String(row.unit_price) : '',
    transport_fee: row.transport_fee !== null ? String(row.transport_fee) : '0',
    note: row.note ?? '',
    is_invoiced: row.is_invoiced,
    is_paid: row.is_paid,
    waste_type_id: row.waste_types?.id ?? '',
  };
}

function statesEqual(a: RowState | undefined, b: RowState | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.weight_kg === b.weight_kg &&
    a.unit_price === b.unit_price &&
    a.transport_fee === b.transport_fee &&
    a.note === b.note &&
    a.is_invoiced === b.is_invoiced &&
    a.is_paid === b.is_paid &&
    a.waste_type_id === b.waste_type_id
  );
}

interface Props {
  rows: LogRow[];
  sitesByCompany?: Record<string, Array<{ id: string; name: string }>>;
  wasteTypes?: Array<{ id: string; name: string }>;
}

export function LogsTable({ rows, sitesByCompany = {}, wasteTypes = [] }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [archivePending, startArchiveTransition] = useTransition();
  const [savePending, startSaveTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<BulkUpdateResult | null>(null);

  // 인라인 편집 상태 — row id → 편집된 값
  const initial = useMemo(() => {
    const m: Record<string, RowState> = {};
    for (const r of rows) m[r.id] = toRowState(r);
    return m;
  }, [rows]);
  const [edited, setEdited] = useState<Record<string, RowState>>(() => ({
    ...initial,
  }));

  // rows prop 이 바뀌면 (필터 변경 등) 편집 상태 재초기화
  useEffect(() => {
    setEdited({ ...initial });
    setSaveResult(null);
  }, [initial]);

  const dirtyIds = useMemo(
    () => rows.map((r) => r.id).filter((id) => !statesEqual(edited[id], initial[id])),
    [rows, edited, initial],
  );

  const updateField = <K extends keyof RowState>(
    id: string,
    field: K,
    value: RowState[K],
  ) => {
    setEdited((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
    setSaveResult(null);
  };

  const resetEdits = () => {
    setEdited({ ...initial });
    setSaveResult(null);
  };

  const handleSave = () => {
    const updates: InlineRowUpdate[] = dirtyIds.map((id) => {
      const s = edited[id];
      const row = rows.find((r) => r.id === id)!;
      return {
        id,
        weight_kg: s.weight_kg ? Number(s.weight_kg) : null,
        unit_price: s.unit_price ? Number(s.unit_price) : null,
        transport_fee: s.transport_fee ? Number(s.transport_fee) : 0,
        billing_type: row.billing_type,
        is_invoiced: s.is_invoiced,
        is_paid: s.is_paid,
        note: s.note.trim() || null,
        waste_type_id: s.waste_type_id || null,
      };
    });
    setSaveResult(null);
    startSaveTransition(async () => {
      const r = await bulkUpdateLogsInlineAction(updates, '');
      setSaveResult(r);
      if (r.ok) {
        setSavedNotice(`${r.updated}건 저장 완료`);
        setTimeout(() => setSavedNotice(null), 3000);
      }
    });
  };

  // archived 행은 선택 못 하게 (이미 보관된 것은 추가 보관 X)
  const selectableRows = rows.filter((r) => r.status !== 'archived');
  const allSelected =
    selectableRows.length > 0 &&
    selectableRows.every((r) => selected.has(r.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableRows.map((r) => r.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleDelete = () => {
    setError(null);
    startArchiveTransition(async () => {
      const r = await bulkArchiveLogsAction([...selected], reason || null);
      if (!r.ok) {
        setError(r.error ?? '삭제 실패');
        return;
      }
      setConfirmOpen(false);
      setReason('');
      setSavedNotice(`${r.archived}건 삭제(보관) 완료`);
      setSelected(new Set());
      setTimeout(() => setSavedNotice(null), 3000);
    });
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-sm text-foreground-muted">조건에 맞는 일보가 없습니다.</p>
        <Link
          href="/logs/new"
          className="mt-3 inline-block text-sm font-medium text-foreground underline"
        >
          새 일보 입력하기 →
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* 선택 액션 바 */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-3 rounded-[10px] border border-foreground bg-surface px-4 py-2.5 shadow-md">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono font-semibold">{selected.size}</span>
            <span className="text-foreground-muted">건 선택됨</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              <X className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />선택 해제
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />
              {selected.size}건 삭제
            </Button>
          </div>
        </div>
      )}

      {savedNotice && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-success/40 bg-success-bg/60 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
          {savedNotice}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={selectableRows.length === 0}
                  className="h-3.5 w-3.5 rounded border-border"
                />
              </TableHead>
              <TableHead>일자</TableHead>
              <TableHead>구분</TableHead>
              <TableHead>거래처</TableHead>
              <TableHead>현장</TableHead>
              <TableHead>성상</TableHead>
              <TableHead className="text-right">중량(kg)</TableHead>
              <TableHead className="text-right">단가</TableHead>
              <TableHead className="text-right">운반비</TableHead>
              <TableHead className="text-right">청구금액</TableHead>
              <TableHead>비고</TableHead>
              <TableHead>문서</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const s = edited[row.id] ?? initial[row.id];
              const sites =
                row.companies ? sitesByCompany[row.companies.id] ?? [] : [];
              return (
                <Row
                  key={row.id}
                  row={row}
                  state={s}
                  sites={sites}
                  wasteTypes={wasteTypes}
                  isDirty={!statesEqual(s, initial[row.id])}
                  selected={selected.has(row.id)}
                  onToggleSelect={() => toggleOne(row.id)}
                  onChange={(field, value) => updateField(row.id, field, value)}
                  onFlagChange={(field, value) => updateField(row.id, field, value)}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* 인라인 편집 저장 바 */}
      {dirtyIds.length > 0 && (
        <div className="sticky bottom-4 z-10 mt-3 flex flex-wrap items-center gap-3 rounded-[10px] border border-warning bg-surface p-4 shadow-md">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning" strokeWidth={1.75} />
            <span className="font-semibold">{dirtyIds.length}건</span> 변경됨
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={resetEdits}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />전체 되돌리기
            </Button>
            <Button onClick={handleSave} disabled={savePending}>
              {savePending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" strokeWidth={1.75} />
              )}
              {dirtyIds.length}건 저장
            </Button>
          </div>
        </div>
      )}

      {saveResult && !saveResult.ok && saveResult.failed.length > 0 && (
        <div className="mt-2 rounded-md border border-danger/40 bg-danger-bg/60 px-3 py-2 text-xs text-danger">
          저장 실패 {saveResult.failed.length}건 — 새로고침 후 다시 시도해주세요.
        </div>
      )}

      {/* 확인 모달 */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="일보 삭제 (보관)"
        description={`${selected.size}건의 일보를 보관(archived) 상태로 변경합니다. 통계·거래명세표 집계에서 즉시 제외되며, 변경 이력에 기록됩니다.`}
      >
        <div className="space-y-4">
          <div className="rounded-md bg-warning-bg/60 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" strokeWidth={1.75} />
            보관 후 일보 상세에서 [복원] 으로 되돌릴 수 있습니다 (감사 이력 보존).
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground-secondary">
              삭제 사유 (선택, audit_logs 에 기록)
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 중복 입력 정리, 거래 취소"
              rows={2}
            />
          </div>
          {error && (
            <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={archivePending}
              className="flex-1"
            >
              {archivePending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {selected.size}건 삭제
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function Row({
  row,
  state,
  sites,
  wasteTypes,
  isDirty,
  selected,
  onToggleSelect,
  onChange,
  onFlagChange,
}: {
  row: LogRow;
  state: RowState;
  sites: Array<{ id: string; name: string }>;
  wasteTypes: Array<{ id: string; name: string }>;
  isDirty: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onChange: <K extends keyof RowState>(field: K, value: RowState[K]) => void;
  onFlagChange: (field: 'is_invoiced' | 'is_paid', value: boolean) => void;
}) {
  const isArchived = row.status === 'archived';
  const calc = calcBilling({
    billingType: row.billing_type,
    weightKg: state.weight_kg ? Number(state.weight_kg) : 0,
    unitPrice: state.unit_price ? Number(state.unit_price) : 0,
    transportFee: state.transport_fee ? Number(state.transport_fee) : 0,
  });
  const rowClass = cn(
    'transition-colors',
    selected && 'bg-info-bg/40',
    isDirty && 'bg-warning-bg/30',
    !selected && !isDirty && row.status === 'pending_review' && 'bg-warning-bg/40',
    !selected && !isDirty && isArchived && 'opacity-60',
  );

  // 상세 페이지로의 링크 — 텍스트 셀(일자/구분/현장/성상)만 적용
  const detailHref = `/logs/${row.id}`;
  const wrap = (children: React.ReactNode) => (
    <Link href={detailHref} className="block">
      {children}
    </Link>
  );

  return (
    <TableRow className={rowClass}>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          disabled={isArchived}
          className="h-3.5 w-3.5 rounded border-border"
          aria-label="선택"
        />
      </TableCell>
      <TableCell className="font-mono text-xs">{wrap(formatDate(row.log_date))}</TableCell>
      <TableCell>
        {wrap(
          <Pill tone={row.direction === 'in' ? 'info' : 'primary'}>
            {directionLabel[row.direction]}
          </Pill>,
        )}
      </TableCell>
      <TableCell
        className="font-medium"
        onClick={(e) => e.stopPropagation()}
      >
        {row.companies ? (
          <CompanySiteMenu
            companyId={row.companies.id}
            companyName={row.companies.name}
            logDate={row.log_date}
            sites={sites}
          />
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="text-foreground-secondary">
        {wrap(row.sites?.name ?? '—')}
      </TableCell>
      <TableCell
        className="text-foreground-secondary"
        onClick={(e) => e.stopPropagation()}
      >
        <select
          value={state.waste_type_id}
          onChange={(e) => onChange('waste_type_id', e.target.value)}
          disabled={isArchived}
          className={cn(
            'h-7 w-full rounded border border-transparent bg-transparent px-1.5 text-xs',
            'focus:border-foreground focus:bg-surface focus:outline-none focus:ring-1 focus:ring-foreground/30',
            'hover:border-border',
            isArchived && 'cursor-not-allowed opacity-50',
          )}
        >
          <option value="">—</option>
          {/* 현재 행에 매핑된 성상이 마스터 active 목록에 없을 수 있어 보존 옵션 추가 */}
          {row.waste_types &&
            !wasteTypes.some((w) => w.id === row.waste_types!.id) && (
              <option value={row.waste_types.id}>{row.waste_types.name}</option>
            )}
          {wasteTypes.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </TableCell>
      <CellEditable
        value={state.weight_kg}
        onChange={(v) => onChange('weight_kg', v)}
        align="right"
        mono
        disabled={isArchived}
      />
      <CellEditable
        value={state.unit_price}
        onChange={(v) => onChange('unit_price', v)}
        align="right"
        mono
        disabled={isArchived}
      />
      <CellEditable
        value={state.transport_fee}
        onChange={(v) => onChange('transport_fee', v)}
        align="right"
        mono
        disabled={isArchived}
      />
      <TableCell className="text-right font-mono text-xs">
        {isDirty ? (
          <span className="text-warning">{formatKRW(calc.totalAmount)}</span>
        ) : (
          formatKRW(row.total_amount)
        )}
      </TableCell>
      <CellEditable
        value={state.note}
        onChange={(v) => onChange('note', v)}
        disabled={isArchived}
      />
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-start gap-1">
          <Link
            href={`/logs/${row.id}/certificate`}
            className="text-xs text-foreground-secondary hover:text-foreground hover:underline"
            title="처리확인서 보기"
          >
            처리확인서
          </Link>
          <Link
            href={`/logs/${row.id}/weight-cert`}
            className="text-xs text-foreground-secondary hover:text-foreground hover:underline"
            title="계량증명서 보기"
          >
            계량증명서
          </Link>
        </div>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-start gap-1">
          <Link href={detailHref}>
            <Pill tone={statusTone(row.status)} dot>
              {statusLabelMap[row.status]}
            </Pill>
          </Link>
          <div className="flex flex-wrap gap-1">
            <FlagToggle
              id={row.id}
              field="is_invoiced"
              value={state.is_invoiced}
              onLocalChange={(v) => onFlagChange('is_invoiced', v)}
              labelOn="청구"
              labelOff="미청구"
              disabled={isArchived}
            />
            <FlagToggle
              id={row.id}
              field="is_paid"
              value={state.is_paid}
              onLocalChange={(v) => onFlagChange('is_paid', v)}
              labelOn="결재"
              labelOff="미결재"
              disabled={isArchived}
            />
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

function CellEditable({
  value,
  onChange,
  align = 'left',
  mono = false,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  align?: 'left' | 'right';
  mono?: boolean;
  disabled?: boolean;
}) {
  return (
    <TableCell onClick={(e) => e.stopPropagation()}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete="off"
        className={cn(
          'h-7 w-full rounded border border-transparent bg-transparent px-1.5 text-xs',
          'placeholder:text-foreground-dim',
          'focus:border-foreground focus:bg-surface focus:outline-none focus:ring-1 focus:ring-foreground/30',
          'hover:border-border',
          align === 'right' && 'text-right',
          mono && 'font-mono',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      />
    </TableCell>
  );
}

// 청구/결재 pill 직접 클릭 → 즉시 DB 토글 (저장 바 거치지 않음).
function FlagToggle({
  id,
  field,
  value,
  onLocalChange,
  labelOn,
  labelOff,
  disabled = false,
}: {
  id: string;
  field: 'is_invoiced' | 'is_paid';
  value: boolean;
  onLocalChange: (v: boolean) => void;
  labelOn: string;
  labelOff: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const handleClick = () => {
    if (disabled || pending) return;
    const next = !value;
    onLocalChange(next); // optimistic
    startTransition(async () => {
      const r = await toggleLogFlagAction(id, field, next);
      if (r.error) {
        // 실패 시 롤백
        onLocalChange(value);
      }
    });
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || pending}
      title={`${labelOn === '청구' ? '청구 상태' : '결재 상태'} 토글`}
      className={cn(
        'inline-flex h-[20px] cursor-pointer items-center rounded-full transition-shadow',
        'hover:ring-2 hover:ring-foreground/20',
        'focus:outline-none focus:ring-2 focus:ring-foreground/40',
        (disabled || pending) && 'cursor-not-allowed opacity-60',
      )}
    >
      <Pill tone={value ? 'info' : 'danger'}>{value ? labelOn : labelOff}</Pill>
    </button>
  );
}

// 거래처명 클릭 → 현장 선택 드롭다운. 현장 0 개면 그냥 단일 링크.
function CompanySiteMenu({
  companyId,
  companyName,
  logDate,
  sites,
}: {
  companyId: string;
  companyName: string;
  logDate: string;
  sites: Array<{ id: string; name: string }>;
}) {
  const { from, to } = monthRange(logDate);
  const baseHref = `/invoices?company=${companyId}&from=${from}&to=${to}`;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // 현장 0 개 → 드롭다운 없이 기존 단일 링크
  if (sites.length === 0) {
    return (
      <Link
        href={baseHref}
        className="text-foreground hover:underline"
        title="이 거래처 / 해당 월 거래명세표 발행"
      >
        {companyName}
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-foreground hover:underline"
        title="현장별 거래명세표 발행"
      >
        {companyName}
        <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={1.75} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[220px] rounded-md border border-border bg-surface py-1 shadow-lg">
          <Link
            href={baseHref}
            onClick={() => setOpen(false)}
            className="block px-3 py-1.5 text-xs text-foreground-secondary hover:bg-background-subtle"
          >
            전체 현장 (월별)
          </Link>
          <div className="my-1 border-t border-border" />
          {sites.map((s) => (
            <Link
              key={s.id}
              href={`${baseHref}&site=${s.id}`}
              onClick={() => setOpen(false)}
              className="block px-3 py-1.5 text-xs text-foreground hover:bg-background-subtle"
            >
              {s.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
