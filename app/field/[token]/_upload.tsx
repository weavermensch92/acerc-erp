'use client';

import { useState, useTransition, useRef } from 'react';
import { Camera, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { uploadFromFieldAction } from '@/actions/attachments';
import { formatDateTime } from '@/lib/format';

interface Props {
  token: string;
  expiresAt: string;
}

export function FieldUploadForm({ token, expiresAt }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError('파일을 선택하세요');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    setError(null);
    startTransition(async () => {
      const r = await uploadFromFieldAction(token, fd);
      if (!r.ok) {
        setError(r.error ?? '업로드 실패');
        return;
      }
      setSuccess(true);
    });
  };

  if (success) {
    return (
      <div className="rounded-[10px] border border-success/40 bg-success-bg/60 p-5 text-success">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" strokeWidth={1.75} />
          <span className="text-sm font-semibold">업로드 완료</span>
        </div>
        <p className="mt-2 text-xs">
          사진이 정상 접수되었습니다. 사무실에 별도 연락은 필요 없습니다.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-[10px] border border-border bg-surface p-4 shadow-sm"
    >
      <div>
        <h3 className="text-sm font-semibold">사진 업로드</h3>
        <p className="mt-0.5 text-[11px] text-foreground-muted">
          만료: {formatDateTime(expiresAt)} · 한번 업로드 후 링크 자동 폐기
        </p>
      </div>

      {previewUrl && (
        <div className="overflow-hidden rounded-md border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="미리보기" className="block h-auto w-full" />
        </div>
      )}

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-background-subtle p-6 hover:bg-background-subtle/70">
        <Camera className="h-8 w-8 text-foreground-muted" strokeWidth={1.5} />
        <span className="text-sm font-medium">
          {previewUrl ? '다른 사진으로 변경' : '사진 촬영 / 선택'}
        </span>
        <span className="text-[11px] text-foreground-muted">
          jpg / png / webp · 최대 10MB
        </span>
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
          required
        />
      </label>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-danger-bg/60 px-3 py-2 text-xs text-danger">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !previewUrl}
        className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        제출
      </button>
    </form>
  );
}
