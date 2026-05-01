'use client';

import { useState, useTransition } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/erp/Modal';
import { deleteSnapshotAction } from '@/actions/snapshots';

interface Props {
  id: string;
}

export function DeleteSnapshotButton({ id }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const r = await deleteSnapshotAction(id);
      if (!r.ok) {
        setError(r.error ?? '실패');
        return;
      }
      setOpen(false);
    });
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} title="삭제">
        <Trash2 className="h-3.5 w-3.5 text-danger" strokeWidth={1.75} />
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="스냅샷 삭제"
        description="이 스냅샷 메타를 삭제합니다 (실 데이터는 영향 없음)."
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
              onClick={() => setOpen(false)}
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
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}삭제
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
