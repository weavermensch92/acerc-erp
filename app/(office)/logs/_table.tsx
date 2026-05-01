'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Trash2, Loader2, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { bulkArchiveLogsAction } from '@/actions/waste-logs';
import { formatKRW, formatKg, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LogStatus, Direction } from '@/lib/types/database';

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

export interface LogRow {
  id: string;
  log_date: string;
  direction: Direction;
  vehicle_no: string | null;
  weight_kg: number | null;
  total_amount: number | null;
  status: LogStatus;
  is_invoiced: boolean;
  is_paid: boolean;
  companies: { name: string } | null;
  sites: { name: string } | null;
  waste_types: { name: string } | null;
}

interface Props {
  rows: LogRow[];
}

export function LogsTable({ rows }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

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
    startTransition(async () => {
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

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
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
              <TableHead className="text-right">중량</TableHead>
              <TableHead className="text-right">청구금액</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <Row
                key={row.id}
                row={row}
                selected={selected.has(row.id)}
                onToggle={() => toggleOne(row.id)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

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
              disabled={isPending}
              className="flex-1"
            >
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
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
  selected,
  onToggle,
}: {
  row: LogRow;
  selected: boolean;
  onToggle: () => void;
}) {
  const href = `/logs/${row.id}`;
  const wrap = (children: React.ReactNode) => (
    <Link href={href} className="block">
      {children}
    </Link>
  );
  const isArchived = row.status === 'archived';
  const rowClass = cn(
    'transition-colors',
    selected && 'bg-info-bg/40',
    !selected && row.status === 'pending_review' && 'bg-warning-bg/40 hover:bg-warning-bg/60',
    !selected && isArchived && 'opacity-60',
  );
  return (
    <TableRow className={rowClass}>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
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
      <TableCell className="font-medium">{wrap(row.companies?.name ?? '—')}</TableCell>
      <TableCell className="text-foreground-secondary">
        {wrap(row.sites?.name ?? '—')}
      </TableCell>
      <TableCell className="text-foreground-secondary">
        {wrap(row.waste_types?.name ?? '—')}
      </TableCell>
      <TableCell className="text-right font-mono text-xs">
        {wrap(formatKg(row.weight_kg))}
      </TableCell>
      <TableCell className="text-right font-mono text-xs">
        {wrap(formatKRW(row.total_amount))}
      </TableCell>
      <TableCell>
        {wrap(
          <Pill tone={statusTone(row.status)} dot>
            {statusLabelMap[row.status]}
          </Pill>,
        )}
      </TableCell>
    </TableRow>
  );
}
