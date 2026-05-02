'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/erp/Pill';
import { formatKRW, formatKg, formatDate, formatNumber } from '@/lib/format';
import {
  markCompanyInvoicedAction,
  markLogsInvoicedAction,
} from '@/actions/pending';
import type { Direction } from '@/lib/types/database';

export interface PendingLogRow {
  id: string;
  log_date: string;
  weight_kg: number | null;
  total_amount: number | null;
  vehicle_no: string | null;
  is_paid: boolean;
  site_name: string | null;
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
  groups: CompanyGroup[];
  period: { from: string; to: string };
}

export function PendingClient({ direction, groups, period }: Props) {
  const router = useRouter();
  const isInbound = direction === 'in';
  const processLabel = isInbound ? '청구 완료 표시' : '청구서 수령 표시';
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
    startTransition(async () => {
      const r = await markCompanyInvoicedAction(g.companyId, direction, {
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
                onAfterUpdate={() => router.refresh()}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LogsTable({
  logs,
  direction,
  onAfterUpdate,
}: {
  logs: PendingLogRow[];
  direction: Direction;
  onAfterUpdate: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const allSelected = logs.length > 0 && logs.every((l) => selected.has(l.id));

  const isInbound = direction === 'in';

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
    startTransition(async () => {
      const r = await markLogsInvoicedAction([...selected]);
      if (!r.ok) {
        setError(r.error ?? '처리 실패');
        return;
      }
      setSelected(new Set());
      onAfterUpdate();
    });
  };

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
            <th className="px-2 py-1.5 text-right font-medium">중량</th>
            <th className="px-2 py-1.5 text-right font-medium">금액</th>
            <th className="px-2 py-1.5 text-center font-medium">
              {isInbound ? '입금' : '지급'}
            </th>
            <th className="px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr
              key={l.id}
              className="border-b border-divider last:border-0"
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
              <td className="px-2 py-1.5">{l.site_name ?? '—'}</td>
              <td className="px-2 py-1.5">{l.waste_type_name ?? '—'}</td>
              <td className="px-2 py-1.5 font-mono text-foreground-muted">
                {l.vehicle_no ?? '—'}
              </td>
              <td className="px-2 py-1.5 text-right font-mono">
                {formatKg(l.weight_kg)}
              </td>
              <td className="px-2 py-1.5 text-right font-mono">
                {formatKRW(l.total_amount)}
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
          ))}
        </tbody>
      </table>

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-divider bg-surface px-3 py-2">
          <span className="text-xs">
            <span className="font-semibold">{selected.size}건</span> 선택됨
          </span>
          {error && (
            <span className="text-xs text-danger">{error}</span>
          )}
          <Button
            size="sm"
            onClick={onApply}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            선택 {isInbound ? '청구 완료 표시' : '청구서 수령 표시'}
          </Button>
        </div>
      )}
    </div>
  );
}
