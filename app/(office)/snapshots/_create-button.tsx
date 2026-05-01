'use client';

import { useState, useTransition } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/erp/Modal';
import { createSnapshotAction } from '@/actions/snapshots';

export function CreateSnapshotButton() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleCreate = () => {
    setError(null);
    startTransition(async () => {
      const r = await createSnapshotAction(note);
      if (!r.ok) {
        setError(r.error ?? '실패');
        return;
      }
      setNote('');
      setOpen(false);
    });
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Camera className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />지금 스냅샷
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="현재 시점 스냅샷 생성"
        description="현 시점의 통계(일보 건수 / 거래처 수 / 청구 합계)를 기록합니다. 이후 이 시점으로 미리보기 가능."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="snap-note">비고 (선택)</Label>
            <Input
              id="snap-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="예: 4월 마감 직전, 단가 정정 전"
              autoFocus
            />
          </div>
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
            <Button onClick={handleCreate} disabled={isPending} className="flex-1">
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}생성
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
