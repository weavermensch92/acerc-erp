'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { saveSelfCompanyInfoAction } from '@/actions/settings';
import type { SelfCompanyInfo } from '@/lib/company-info';

interface Props {
  initial: SelfCompanyInfo;
}

export function SelfCompanyForm({ initial }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

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
