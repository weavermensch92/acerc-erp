'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createCompanyAction, updateCompanyAction } from '@/actions/companies';
import { cn } from '@/lib/utils';

export interface CompanyFormDefaults {
  name: string;
  business_no: string;
  address: string;
  contact_name: string;
  contact_phone: string;
  representative: string;
  business_type: string;
  business_item: string;
  email: string;
  default_unit_price: number | '';
  is_internal: boolean;
}

interface BaseProps {
  defaults: CompanyFormDefaults;
}

export type CompanyFormProps = BaseProps &
  ({ mode: 'create' } | { mode: 'edit'; companyId: string });

export function CompanyForm(props: CompanyFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLDivElement | null>(null);

  // 모바일에서 결과(에러/성공)가 화면 밖에 있을 때 보이게 스크롤
  useEffect(() => {
    if ((error || savedNotice) && noticeRef.current) {
      noticeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error, savedNotice]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyFormDefaults>({ defaultValues: props.defaults });

  const onSubmit = handleSubmit((data) => {
    setError(null);
    setSavedNotice(null);
    // valueAsNumber 가 빈 입력에서 NaN 을 반환 → 스키마 검증 실패 원인.
    // 명시적으로 null 변환.
    const rawUnit = data.default_unit_price as number | '' | null | undefined;
    const unit =
      rawUnit === '' ||
      rawUnit === null ||
      rawUnit === undefined ||
      Number.isNaN(rawUnit)
        ? null
        : Number(rawUnit);
    const input = {
      name: data.name.trim(),
      business_no: data.business_no?.trim() || null,
      address: data.address?.trim() || null,
      contact_name: data.contact_name?.trim() || null,
      contact_phone: data.contact_phone?.trim() || null,
      representative: data.representative?.trim() || null,
      business_type: data.business_type?.trim() || null,
      business_item: data.business_item?.trim() || null,
      email: data.email?.trim() || null,
      default_unit_price: unit,
      is_internal: data.is_internal,
    };

    startTransition(async () => {
      if (props.mode === 'create') {
        const r = await createCompanyAction(input);
        if (!r.ok) setError(r.error ?? '저장 실패');
        // 성공 시 server 가 redirect
      } else {
        const r = await updateCompanyAction(props.companyId, input);
        if (!r.ok) {
          setError(r.error ?? '저장 실패');
          return;
        }
        setSavedNotice('저장되었습니다');
        router.refresh();
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Section title="기본정보">
        <div className="space-y-1.5">
          <Label htmlFor="cf-name">
            거래처명<span className="ml-0.5 text-danger">*</span>
          </Label>
          <Input
            id="cf-name"
            {...register('name', { required: '거래처명' })}
            autoFocus
          />
          {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cf-bizno">사업자번호</Label>
            <Input
              id="cf-bizno"
              {...register('business_no')}
              placeholder="123-45-67890"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-unit">기본단가 (원/kg)</Label>
            <Input
              id="cf-unit"
              type="number"
              inputMode="numeric"
              className="font-mono"
              {...register('default_unit_price', { valueAsNumber: true })}
              placeholder="비워두면 성상 단가 사용"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-addr">주소</Label>
          <Input id="cf-addr" {...register('address')} />
        </div>
      </Section>

      <Section title="담당자">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cf-cname">담당자명</Label>
            <Input id="cf-cname" {...register('contact_name')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-cphone">연락처</Label>
            <Input
              id="cf-cphone"
              {...register('contact_phone')}
              placeholder="010-1234-5678"
            />
          </div>
        </div>
      </Section>

      <Section title="세금계산서 (홈택스 일괄발행용)">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cf-rep">대표자명</Label>
            <Input id="cf-rep" {...register('representative')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-email">이메일 (수신용)</Label>
            <Input
              id="cf-email"
              type="email"
              {...register('email')}
              placeholder="contact@example.com"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cf-bt">업태</Label>
            <Input id="cf-bt" {...register('business_type')} placeholder="제조업" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-bi">종목</Label>
            <Input id="cf-bi" {...register('business_item')} placeholder="폐기물 처리" />
          </div>
        </div>
        <p className="text-[11px] text-foreground-muted">
          홈택스 전자세금계산서 일괄발행 양식에 들어가는 필드입니다. 비워두면 빈칸으로 출력됩니다.
        </p>
      </Section>

      <Section title="구분">
        <Controller
          control={control}
          name="is_internal"
          render={({ field }) => (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border text-foreground focus:ring-2 focus:ring-ring"
              />
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium">자사 (사급)</span>
                <span className="text-[11px] text-foreground-muted">
                  체크 시 청구 타입을 "사급"으로 입력하면 자동 0원 처리됩니다.
                </span>
              </div>
            </label>
          )}
        />
      </Section>

      <div ref={noticeRef}>
        {error && (
          <div className="rounded-md bg-danger-bg px-3 py-2 text-sm font-medium text-danger">
            {error}
          </div>
        )}
        {savedNotice && (
          <div className="rounded-md bg-success-bg px-3 py-2 text-sm font-medium text-success">
            {savedNotice}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="flex-1"
        >
          취소
        </Button>
        <Button type="submit" disabled={isPending} className="flex-1">
          {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          {props.mode === 'create' ? '등록' : '저장'}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={cn('rounded-[10px] border border-border bg-surface p-5 shadow-sm')}>
      <h3 className="mb-4 text-[13px] font-semibold tracking-tight">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
