'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Loader2, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pill } from '@/components/erp/Pill';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Modal } from '@/components/erp/Modal';
import {
  createTreatmentPlantAction,
  updateTreatmentPlantAction,
  deleteTreatmentPlantAction,
  getTreatmentPlantUsageAction,
  type PlantUsageLog,
} from '@/actions/masters';
import type { TreatmentPlant } from '@/lib/types/database';
import { formatNumber, formatDate, formatKg } from '@/lib/format';

interface Props {
  plants: TreatmentPlant[];
  usageMap: Record<string, number>;
}

export function TreatmentPlantsClient({ plants, usageMap }: Props) {
  const [editTarget, setEditTarget] = useState<TreatmentPlant | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TreatmentPlant | null>(null);

  const formOpen = createOpen || editTarget !== null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-7 py-3">
        <span className="text-[11.5px] text-foreground-muted">
          총 {plants.length} 곳
        </span>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />새 처리장
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-7">
        {plants.length === 0 ? (
          <EmptyState onAdd={() => setCreateOpen(true)} />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>주소</TableHead>
                  <TableHead className="text-right">사용 건수</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plants.map((p) => {
                  const used = usageMap[p.id] ?? 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-foreground-secondary">
                        {p.address ?? '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-foreground-secondary">
                        {formatNumber(used)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditTarget(p)}
                          >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDelete(p)}
                            title={
                              used > 0
                                ? `사용 중 (${used}건) — 일보 확인 후 처리장 삭제`
                                : '삭제'
                            }
                          >
                            <Trash2
                              className="h-3.5 w-3.5 text-danger"
                              strokeWidth={1.75}
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {formOpen && (
        <PlantFormDialog
          existing={editTarget}
          onClose={() => {
            setCreateOpen(false);
            setEditTarget(null);
          }}
        />
      )}

      {confirmDelete && (
        <DeleteDialog
          target={confirmDelete}
          initialUsage={usageMap[confirmDelete.id] ?? 0}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
      <p className="text-sm text-foreground-muted">
        등록된 처리장이 없습니다. 일보 입력 시 새 이름을 직접 입력하면 자동 추가되며,
        여기서 직접 추가/수정할 수도 있습니다.
      </p>
      <Button size="sm" className="mt-3" onClick={onAdd}>
        <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />처리장 추가
      </Button>
    </div>
  );
}

function PlantFormDialog({
  existing,
  onClose,
}: {
  existing: TreatmentPlant | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(existing?.name ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input = {
      name: name.trim(),
      address: address.trim() || null,
    };
    startTransition(async () => {
      const r = existing
        ? await updateTreatmentPlantAction(existing.id, input)
        : await createTreatmentPlantAction(input);
      if (!r.ok) {
        setError(r.error ?? '저장 실패');
        return;
      }
      onClose();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? '처리장 수정' : '새 처리장 등록'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pl-name">
            이름<span className="ml-0.5 text-danger">*</span>
          </Label>
          <Input
            id="pl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            placeholder="예: 동해환경"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pl-addr">주소</Label>
          <Input
            id="pl-addr"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="예: 경북 포항시 남구 동해면"
          />
        </div>
        {error && (
          <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button
            type="submit"
            disabled={isPending || !name.trim()}
            className="flex-1"
          >
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {existing ? '저장' : '등록'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog({
  target,
  initialUsage,
  onClose,
}: {
  target: TreatmentPlant;
  initialUsage: number;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<PlantUsageLog[] | null>(null);
  const [total, setTotal] = useState<number>(initialUsage);
  const [usageLoading, setUsageLoading] = useState(initialUsage > 0);

  useEffect(() => {
    if (initialUsage === 0) return;
    let cancelled = false;
    (async () => {
      const r = await getTreatmentPlantUsageAction(target.id);
      if (cancelled) return;
      if (r.ok) {
        setLogs(r.logs);
        setTotal(r.total);
      } else {
        setError(r.error);
      }
      setUsageLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialUsage, target.id]);

  const handleDelete = (detachLogs: boolean) => {
    setError(null);
    startTransition(async () => {
      const r = await deleteTreatmentPlantAction(target.id, { detachLogs });
      if (!r.ok) {
        setError(r.error ?? '삭제 실패');
        return;
      }
      onClose();
    });
  };

  const hasUsage = total > 0;
  const directionLabel = (d: 'in' | 'out') => (d === 'in' ? '반입' : '반출');

  return (
    <Modal
      open
      onClose={onClose}
      title="처리장 삭제"
      description={`"${target.name}" 을 삭제하시겠습니까?`}
    >
      <div className="space-y-4">
        {hasUsage && (
          <div className="space-y-2 rounded-md border border-warning/40 bg-warning-bg/50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-warning">
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
              사용 중인 일보 {total}건
            </div>
            <p className="text-[11px] text-foreground-secondary">
              아래 일보들이 이 처리장을 사용 중입니다. 처리장을 삭제하면 해당 일보들의
              <strong className="text-foreground"> 처리장 연결이 해제(빈 값)</strong>
              되며 일보 자체는 그대로 유지됩니다.
            </p>

            {usageLoading ? (
              <p className="text-[11px] text-foreground-muted">불러오는 중...</p>
            ) : logs && logs.length > 0 ? (
              <div className="max-h-56 overflow-y-auto rounded border border-border bg-surface">
                <table className="w-full text-[11px]">
                  <thead className="bg-background-subtle">
                    <tr className="border-b border-border">
                      <th className="px-2 py-1.5 text-left text-foreground-muted">일자</th>
                      <th className="px-2 py-1.5 text-left text-foreground-muted">구분</th>
                      <th className="px-2 py-1.5 text-left text-foreground-muted">거래처</th>
                      <th className="px-2 py-1.5 text-left text-foreground-muted">성상</th>
                      <th className="px-2 py-1.5 text-right text-foreground-muted">중량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => {
                      const isArchived = l.status === 'archived';
                      return (
                        <tr
                          key={l.id}
                          className={`border-b border-divider last:border-0 ${
                            isArchived ? 'opacity-60' : ''
                          }`}
                        >
                          <td className="px-2 py-1 font-mono">
                            {formatDate(l.log_date)}
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex items-center gap-1">
                              <Pill tone={l.direction === 'in' ? 'info' : 'primary'}>
                                {directionLabel(l.direction)}
                              </Pill>
                              {isArchived && (
                                <Pill tone="neutral">보관</Pill>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-1">{l.companies?.name ?? '—'}</td>
                          <td className="px-2 py-1">{l.waste_types?.name ?? '—'}</td>
                          <td className="px-2 py-1 text-right font-mono">
                            {formatKg(l.weight_kg)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {total > logs.length && (
                  <p className="border-t border-border px-2 py-1 text-[10.5px] text-foreground-muted">
                    ...외 {total - logs.length}건 더 있음
                  </p>
                )}
              </div>
            ) : null}

            <Link
              href={`/logs?plant=${target.id}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-info hover:underline"
            >
              <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
              사용 일보 전체 보기 (새 탭)
            </Link>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isPending}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => handleDelete(hasUsage)}
              disabled={isPending}
              className="flex-1"
            >
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {hasUsage ? `${total}건 연결 해제 후 처리장 삭제` : '처리장 삭제'}
            </Button>
          </div>
          {hasUsage && (
            <p className="text-[10.5px] text-foreground-muted">
              💡 일보를 직접 수정하려면 위 &quot;사용 일보 전체 보기&quot; 링크에서 각 일보의
              처리장 필드를 변경 후 이 처리장을 삭제하세요.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
