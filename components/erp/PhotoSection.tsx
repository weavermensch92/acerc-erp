'use client';

import { useState, useTransition } from 'react';
import { Camera, Copy, Loader2, Trash2, AlertTriangle, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/erp/Modal';
import { Pill } from '@/components/erp/Pill';
import {
  createFieldLinkAction,
  revokeFieldLinkAction,
} from '@/actions/field-links';
import { deleteAttachmentAction } from '@/actions/attachments';
import { formatDateTime } from '@/lib/format';
import type { Attachment, FieldUploadLink } from '@/lib/types/database';

interface Props {
  logId: string;
  attachments: Attachment[];
  activeLink: FieldUploadLink | null;
  appUrl: string;
}

export function PhotoSection({ logId, attachments, activeLink, appUrl }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createdLinkUrl, setCreatedLinkUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeUrl = activeLink ? `${appUrl}/field/${activeLink.token}` : null;
  const expired =
    activeLink && new Date(activeLink.expires_at).getTime() < Date.now();

  const handleCreate = () => {
    setError(null);
    startTransition(async () => {
      const r = await createFieldLinkAction(logId, recipient);
      if (!r.ok || !r.link) {
        setError(r.error ?? '실패');
        return;
      }
      setCreatedLinkUrl(r.link.url);
      setRecipient('');
    });
  };

  const handleRevoke = () => {
    if (!activeLink) return;
    setError(null);
    startTransition(async () => {
      const r = await revokeFieldLinkAction(activeLink.id, logId);
      if (!r.ok) setError(r.error ?? '실패');
    });
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('복사 실패');
    }
  };

  const handleDelete = (attId: string) => {
    if (!confirm('이 사진을 삭제하시겠습니까?')) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteAttachmentAction(attId, logId);
      if (!r.ok) setError(r.error ?? '실패');
    });
  };

  return (
    <section className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight">
          사진 증빙 ({attachments.length})
        </h3>
        {!activeLink && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Link2 className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />일회용 링크 생성
          </Button>
        )}
      </div>

      {/* 활성 링크 */}
      {activeLink && (
        <div className="mt-3 rounded-md border border-warning/40 bg-warning-bg/60 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="text-[12.5px] font-semibold">
                {expired ? '링크 만료됨' : '사진 업로드 대기중'}
              </span>
              {activeLink.recipient_name && (
                <span className="text-[11px]">— {activeLink.recipient_name} 기사</span>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRevoke}
              disabled={isPending}
              className="text-warning"
            >
              회수
            </Button>
          </div>
          {activeUrl && !expired && (
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded border border-warning/30 bg-surface px-2 py-1 text-[10.5px] font-mono">
                {activeUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(activeUrl)}
              >
                <Copy className="mr-1 h-3 w-3" strokeWidth={1.75} />
                {copied ? '복사됨' : '복사'}
              </Button>
            </div>
          )}
          <p className="mt-1.5 text-[10.5px] text-warning/80">
            만료: {formatDateTime(activeLink.expires_at)}
          </p>
        </div>
      )}

      {/* 사진 grid */}
      {attachments.length === 0 ? (
        <p className="mt-3 text-xs text-foreground-muted">
          등록된 사진이 없습니다. 일회용 링크를 발급해 현장 기사에게 공유하세요.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="group relative aspect-square overflow-hidden rounded-md border border-border bg-background-subtle"
            >
              <a href={a.file_url} target="_blank" rel="noopener" className="block h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.file_url}
                  alt={a.file_name ?? '사진'}
                  className="h-full w-full object-cover"
                />
              </a>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-foreground/70 px-1.5 py-1 text-[10px] text-background opacity-0 transition-opacity group-hover:opacity-100">
                <Pill tone="neutral" className="bg-surface/80">
                  {a.uploaded_by === 'field' ? '기사' : '사무실'}
                </Pill>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(a.id);
                  }}
                  className="pointer-events-auto rounded p-0.5 hover:bg-danger"
                  title="삭제"
                >
                  <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md bg-danger-bg/60 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {/* 링크 생성 모달 */}
      <Modal
        open={createOpen && !createdLinkUrl}
        onClose={() => {
          setCreateOpen(false);
          setRecipient('');
        }}
        title="현장기사 일회용 링크 발급"
        description="24시간 만료. 한번 업로드되면 자동 폐기됩니다."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fl-name">기사 이름</Label>
            <Input
              id="fl-name"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="예: 김기사"
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
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setRecipient('');
              }}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isPending || !recipient.trim()}
              className="flex-1"
            >
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              생성
            </Button>
          </div>
        </div>
      </Modal>

      {/* 생성 완료 모달 */}
      <Modal
        open={!!createdLinkUrl}
        onClose={() => {
          setCreateOpen(false);
          setCreatedLinkUrl(null);
        }}
        title="일회용 링크 생성 완료"
        description="이 URL 을 카톡 / 문자로 기사에게 전달하세요. 24시간 만료."
      >
        <div className="space-y-4">
          {createdLinkUrl && (
            <>
              <code className="block break-all rounded-md border border-border bg-background-subtle p-3 text-xs">
                {createdLinkUrl}
              </code>
              <Button
                onClick={() => handleCopy(createdLinkUrl)}
                className="w-full"
              >
                <Copy className="mr-1 h-4 w-4" strokeWidth={1.75} />
                {copied ? '복사됨' : '링크 복사'}
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setCreateOpen(false);
              setCreatedLinkUrl(null);
            }}
            className="w-full"
          >
            닫기
          </Button>
        </div>
      </Modal>
    </section>
  );
}
