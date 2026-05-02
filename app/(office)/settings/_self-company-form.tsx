'use client';

import { useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  saveSelfCompanyInfoAction,
  uploadStampAction,
  removeStampAction,
} from '@/actions/settings';
import type { SelfCompanyInfo } from '@/lib/company-info';

interface Props {
  initial: SelfCompanyInfo;
}

export function SelfCompanyForm({ initial }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isStampPending, startStampTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stampError, setStampError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [stampUrl, setStampUrl] = useState<string | null>(initial.stamp_url ?? null);
  const [stampPath, setStampPath] = useState<string | null>(initial.stamp_path ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<SelfCompanyInfo>({
    defaultValues: initial,
  });

  const onSubmit = handleSubmit((data) => {
    setError(null);
    setSavedNotice(null);
    const input: SelfCompanyInfo = {
      name: data.name?.trim() ?? '',
      business_no: data.business_no?.trim() || null,
      representative: data.representative?.trim() || null,
      address: data.address?.trim() || null,
      phone: data.phone?.trim() || null,
      business_type: data.business_type?.trim() || null,
      business_item: data.business_item?.trim() || null,
      stamp_url: stampUrl,
      stamp_path: stampPath,
    };
    startTransition(async () => {
      const r = await saveSelfCompanyInfoAction(input);
      if (!r.ok) {
        setError(r.error ?? '저장 실패');
        return;
      }
      setSavedNotice('저장되었습니다 — 거래명세표·처리확인서에 즉시 반영');
    });
  });

  const onStampUpload = (file: File) => {
    setStampError(null);
    const fd = new FormData();
    fd.append('file', file);
    startStampTransition(async () => {
      const r = await uploadStampAction(fd);
      if (!r.ok) {
        setStampError(r.error ?? '업로드 실패');
        return;
      }
      setStampUrl(r.url ?? null);
      setStampPath(r.path ?? null);
    });
  };

  const onStampRemove = () => {
    setStampError(null);
    startStampTransition(async () => {
      const r = await removeStampAction();
      if (!r.ok) {
        setStampError(r.error ?? '삭제 실패');
        return;
      }
      setStampUrl(null);
      setStampPath(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="sc-name">
          회사명<span className="ml-0.5 text-danger">*</span>
        </Label>
        <Input id="sc-name" {...register('name', { required: '회사명' })} />
        {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sc-bizno">사업자번호</Label>
          <Input
            id="sc-bizno"
            {...register('business_no')}
            placeholder="123-45-67890"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sc-rep">대표자</Label>
          <Input id="sc-rep" {...register('representative')} placeholder="홍길동" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sc-addr">주소</Label>
        <Input id="sc-addr" {...register('address')} placeholder="경북 포항시 ..." />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sc-phone">전화</Label>
          <Input id="sc-phone" {...register('phone')} placeholder="054-000-0000" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sc-bt">업태</Label>
          <Input id="sc-bt" {...register('business_type')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sc-bi">종목</Label>
          <Input id="sc-bi" {...register('business_item')} />
        </div>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-background-subtle/40 p-3">
        <div className="flex items-baseline justify-between">
          <Label className="text-[12px] font-semibold">회사 날인 (도장)</Label>
          <span className="text-[10.5px] text-foreground-muted">
            PNG · 투명배경 · 정사각형 권장 (200~500px) · 최대 5MB
          </span>
        </div>
        <p className="text-[11px] text-foreground-muted">
          업로드하면 거래명세표 / 처리확인서 / 계량증명서의 자사 서명란에 자동 표시됩니다.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-surface">
            {stampUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={stampUrl}
                alt="회사 도장"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-[10px] text-foreground-muted">미업로드</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onStampUpload(f);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isStampPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {isStampPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              {stampUrl ? '교체' : '업로드'}
            </Button>
            {stampUrl && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isStampPending}
                onClick={onStampRemove}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />삭제
              </Button>
            )}
          </div>
        </div>
        {stampError && (
          <div className="rounded-md bg-danger-bg px-2.5 py-1.5 text-[11px] text-danger">
            {stampError}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}
      {savedNotice && (
        <div className="rounded-md bg-success-bg px-3 py-2 text-xs text-success">
          {savedNotice}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}저장
        </Button>
      </div>
    </form>
  );
}
