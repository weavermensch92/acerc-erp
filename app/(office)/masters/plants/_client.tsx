'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from '@/actions/masters';
import type { TreatmentPlant } from '@/lib/types/database';
import { formatNumber } from '@/lib/format';

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
                            disabled={used > 0}
                            title={
                              used > 0
                                ? `사용 중 (${used}건) — 삭제 불가`
                                : '삭제'
                            }
                          >
                            <Trash2
                              className={`h-3.5 w-3.5 ${used > 0 ? 'text-foreground-muted' : 'text-danger'}`}
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
        <DeleteDialog target={confirmDelete} onClose={() => setConfirmDelete(null)} />
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
  onClose,
}: {
  target: TreatmentPlant;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const r = await deleteTreatmentPlantAction(target.id);
      if (!r.ok) {
        setError(r.error ?? '삭제 실패');
        return;
      }
      onClose();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="처리장 삭제"
      description={`"${target.name}" 을 삭제하시겠습니까?`}
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            취소
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
            className="flex-1"
          >
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}삭제
          </Button>
        </div>
      </div>
    </Modal>
  );
}
