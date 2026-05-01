'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CompanyTypeaheadField } from '@/components/erp/CompanyTypeaheadField';
import { CompanyCreateDialog } from '@/components/erp/CompanyCreateDialog';
import { ComboboxField, type ComboboxOption } from '@/components/erp/ComboboxField';
import {
  wasteLogCreateSchema,
  wasteLogUpdateSchema,
} from '@/lib/validation/waste-log';
import { calcBilling } from '@/lib/calc/billing';
import { formatKRW } from '@/lib/format';
import { createLogAction, updateLogAction } from '@/actions/waste-logs';
import type { CompanyTypeaheadResult } from '@/lib/typeahead/companies';
import type {
  Site,
  WasteType,
  TreatmentPlant,
  BillingType,
  Direction,
} from '@/lib/types/database';
import { cn } from '@/lib/utils';

export interface LogFormDefaults {
  log_date: string;
  direction: Direction;
  company_id: string;
  company_name: string;
  site_name: string;
  waste_type_name: string;
  treatment_plant_name: string;
  vehicle_no: string;
  weight_total_kg: number | '';
  weight_tare_kg: number | '';
  weight_kg: number | '';
  unit_price: number | '';
  transport_fee: number | '';
  billing_type: BillingType;
  note: string;
}

interface FormValues extends LogFormDefaults {
  change_reason: string;
}

interface BaseProps {
  wasteTypes: WasteType[];
  treatmentPlants: TreatmentPlant[];
  allSites: Site[];
  defaults: LogFormDefaults;
}

export type LogFormProps = BaseProps &
  ({ mode: 'create' } | { mode: 'edit'; logId: string });

const billingOptions: Array<{ v: BillingType; label: string; hint: string }> = [
  { v: 'weight_based', label: '중량기준', hint: 'Kg×단가+VAT' },
  { v: 'flat_rate', label: '정액', hint: '건당+VAT' },
  { v: 'internal', label: '사급', hint: '0원' },
  { v: 'tax_exempt', label: '면세', hint: 'VAT 0' },
];

export function LogForm(props: LogFormProps) {
  const { wasteTypes, treatmentPlants, allSites, defaults } = props;
  const isEdit = props.mode === 'edit';
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSeed, setCreateSeed] = useState('');

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { ...defaults, change_reason: '' },
  });

  const watched = watch();

  const siteOptions: ComboboxOption[] = useMemo(
    () =>
      allSites
        .filter((s) => s.company_id === watched.company_id)
        .map((s) => ({ id: s.id, name: s.name })),
    [allSites, watched.company_id],
  );

  const wasteTypeOptions: ComboboxOption[] = useMemo(
    () =>
      wasteTypes.map((w) => ({
        id: w.id,
        name: w.name,
        hint:
          w.default_unit_price !== null && w.default_unit_price !== undefined
            ? `${w.default_unit_price}원/kg`
            : undefined,
      })),
    [wasteTypes],
  );

  const treatmentPlantOptions: ComboboxOption[] = useMemo(
    () => treatmentPlants.map((t) => ({ id: t.id, name: t.name })),
    [treatmentPlants],
  );

  // 차량번호 → 공차중량 자동 채움 (vehicles 마스터 lookup)
  const debouncedVehicleNo = useDebouncedValue(watched.vehicle_no, 500);
  const [tareLookupHint, setTareLookupHint] = useState<string | null>(null);
  useEffect(() => {
    const v = debouncedVehicleNo?.trim();
    if (!v) {
      setTareLookupHint(null);
      return;
    }
    // 이미 공차 입력값 있으면 자동 채움 안 함
    if (watched.weight_tare_kg !== '' && watched.weight_tare_kg !== 0) {
      return;
    }
    let cancelled = false;
    fetch(`/api/vehicles/${encodeURIComponent(v)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { tare_kg: number | null } | null) => {
        if (cancelled) return;
        if (data && data.tare_kg !== null && data.tare_kg !== undefined) {
          setValue('weight_tare_kg', Number(data.tare_kg), { shouldDirty: true });
          setTareLookupHint(`${v} 차의 마지막 공차 ${data.tare_kg}kg 자동 채움`);
        } else {
          setTareLookupHint(`${v} — 등록된 공차 없음 (이번 입력값이 다음에 자동 채워집니다)`);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedVehicleNo]);

  // 총중량 + 공차중량 → 실중량 자동 계산
  useEffect(() => {
    const total =
      watched.weight_total_kg === '' ? null : Number(watched.weight_total_kg);
    const tare = watched.weight_tare_kg === '' ? null : Number(watched.weight_tare_kg);
    if (total !== null && !Number.isNaN(total) && tare !== null && !Number.isNaN(tare)) {
      const net = Math.max(0, total - tare);
      setValue('weight_kg', net, { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched.weight_total_kg, watched.weight_tare_kg]);

  const calc = calcBilling({
    billingType: watched.billing_type,
    weightKg: watched.weight_kg === '' ? 0 : Number(watched.weight_kg),
    unitPrice: watched.unit_price === '' ? 0 : Number(watched.unit_price),
    transportFee: watched.transport_fee === '' ? 0 : Number(watched.transport_fee),
  });

  const handleCompanySelect = (company: CompanyTypeaheadResult) => {
    setValue('company_id', company.id);
    setValue('company_name', company.name);
    // 거래처 변경 시 site_name 초기화 (단, edit 모드에서 같은 회사면 유지)
    if (company.id !== defaults.company_id) {
      setValue('site_name', '');
    }
    if (company.default_unit_price !== null && company.default_unit_price !== undefined) {
      setValue('unit_price', company.default_unit_price);
    }
  };

  const handleCreateCompany = (q: string) => {
    setCreateSeed(q);
    setCreateOpen(true);
  };

  const handleCompanyCreated = (c: {
    id: string;
    name: string;
    default_unit_price: number | null;
  }) => {
    setValue('company_id', c.id);
    setValue('company_name', c.name);
    setValue('site_name', '');
    if (c.default_unit_price !== null) setValue('unit_price', c.default_unit_price);
    setCreateOpen(false);
  };

  const handleWasteTypeChange = (name: string) => {
    setValue('waste_type_name', name);
    const wt = wasteTypes.find((w) => w.name === name.trim());
    const cur = watched.unit_price;
    if (wt && wt.default_unit_price !== null && (cur === '' || cur === 0)) {
      setValue('unit_price', wt.default_unit_price);
    }
  };

  const onSubmit = handleSubmit((data) => {
    setSubmitError(null);
    const baseInput = {
      log_date: data.log_date,
      direction: data.direction,
      company_id: data.company_id,
      site_name: data.site_name?.trim() || null,
      waste_type_name: data.waste_type_name?.trim() ?? '',
      treatment_plant_name: data.treatment_plant_name?.trim() || null,
      vehicle_no: data.vehicle_no?.trim() || null,
      weight_total_kg: data.weight_total_kg === '' ? null : Number(data.weight_total_kg),
      weight_tare_kg: data.weight_tare_kg === '' ? null : Number(data.weight_tare_kg),
      weight_kg: data.weight_kg === '' ? null : Number(data.weight_kg),
      unit_price: data.unit_price === '' ? null : Number(data.unit_price),
      transport_fee: data.transport_fee === '' ? 0 : Number(data.transport_fee),
      billing_type: data.billing_type,
      note: data.note?.trim() || null,
    };

    if (props.mode === 'create') {
      const parsed = wasteLogCreateSchema.safeParse(baseInput);
      if (!parsed.success) {
        setSubmitError(parsed.error.issues.map((i) => i.message).join(', '));
        return;
      }
      startTransition(async () => {
        const result = await createLogAction(parsed.data);
        if (result?.error) setSubmitError(result.error);
      });
    } else {
      const updateInput = {
        ...baseInput,
        change_reason: data.change_reason?.trim() || null,
      };
      const parsed = wasteLogUpdateSchema.safeParse(updateInput);
      if (!parsed.success) {
        setSubmitError(parsed.error.issues.map((i) => i.message).join(', '));
        return;
      }
      startTransition(async () => {
        const result = await updateLogAction(props.logId, parsed.data);
        if (result?.error) setSubmitError(result.error);
      });
    }
  });

  return (
    <>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Section title="거래정보">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="log_date">
                  일자<span className="ml-0.5 text-danger">*</span>
                </Label>
                <Input
                  id="log_date"
                  type="date"
                  {...register('log_date', { required: '일자' })}
                />
                {errors.log_date && (
                  <p className="text-xs text-danger">{errors.log_date.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>
                  구분<span className="ml-0.5 text-danger">*</span>
                </Label>
                <Controller
                  control={control}
                  name="direction"
                  render={({ field }) => (
                    <div className="flex gap-2">
                      {(['in', 'out'] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => field.onChange(d)}
                          className={cn(
                            'h-10 flex-1 rounded-md border text-sm font-medium transition-colors',
                            field.value === d
                              ? 'border-foreground bg-foreground text-background'
                              : 'border-border bg-surface text-foreground-secondary hover:bg-background-subtle',
                          )}
                        >
                          {d === 'in' ? '반입' : '반출'}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>
            </div>
            <Controller
              control={control}
              name="company_id"
              render={({ field }) => (
                <CompanyTypeaheadField
                  label="거래처"
                  required
                  selectedName={watched.company_name}
                  onSelect={handleCompanySelect}
                  onCreateNew={handleCreateCompany}
                  error={!field.value && submitError ? '거래처를 선택하세요' : undefined}
                />
              )}
            />
            <Controller
              control={control}
              name="site_name"
              render={({ field }) => (
                <ComboboxField
                  label="공사현장"
                  inputId="site_name"
                  listId="site-options"
                  value={field.value}
                  onChange={field.onChange}
                  options={siteOptions}
                  disabled={!watched.company_id}
                  hint={
                    watched.company_id
                      ? '목록에 없으면 직접 입력 — 저장 시 이 거래처의 현장으로 자동 추가'
                      : '먼저 거래처를 선택하세요'
                  }
                />
              )}
            />
          </Section>

          <Section title="폐기물정보">
            <div className="grid grid-cols-2 gap-3">
              <Controller
                control={control}
                name="waste_type_name"
                render={({ field }) => (
                  <ComboboxField
                    label="성상"
                    required
                    inputId="waste_type_name"
                    listId="waste-type-options"
                    value={field.value}
                    onChange={handleWasteTypeChange}
                    options={wasteTypeOptions}
                    hint="목록에 없으면 직접 입력 — 성상 마스터에 자동 추가"
                  />
                )}
              />
              <Controller
                control={control}
                name="treatment_plant_name"
                render={({ field }) => (
                  <ComboboxField
                    label="처리장"
                    inputId="treatment_plant_name"
                    listId="treatment-plant-options"
                    value={field.value}
                    onChange={field.onChange}
                    options={treatmentPlantOptions}
                    hint="목록에 없으면 직접 입력 — 처리장 마스터에 자동 추가"
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle_no">차량번호</Label>
              <Input
                id="vehicle_no"
                {...register('vehicle_no')}
                placeholder="예: 경북80바1234"
              />
            </div>
          </Section>

          <Section title="금액정보">
            <div className="space-y-1.5">
              <Label>청구 타입</Label>
              <Controller
                control={control}
                name="billing_type"
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {billingOptions.map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => field.onChange(opt.v)}
                        className={cn(
                          'flex flex-col items-center gap-0.5 rounded-md border p-2 text-xs transition-colors',
                          field.value === opt.v
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border bg-surface text-foreground-secondary hover:bg-background-subtle',
                        )}
                      >
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-[10.5px] opacity-80">{opt.hint}</span>
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>
            {/* 중량 — 총 / 공차 / 실 (자동) */}
            <div className="space-y-1.5">
              <Label>중량 (kg)</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Input
                    id="weight_total_kg"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    className="font-mono"
                    placeholder="총중량"
                    {...register('weight_total_kg', { valueAsNumber: true })}
                  />
                  <span className="block text-[10.5px] text-foreground-muted">총중량</span>
                </div>
                <div className="space-y-1">
                  <Input
                    id="weight_tare_kg"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    className="font-mono"
                    placeholder="공차"
                    {...register('weight_tare_kg', { valueAsNumber: true })}
                  />
                  <span className="block text-[10.5px] text-foreground-muted">
                    공차중량 (차량별 자동)
                  </span>
                </div>
                <div className="space-y-1">
                  <Input
                    id="weight_kg"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    className="font-mono"
                    placeholder="실중량"
                    {...register('weight_kg', { valueAsNumber: true })}
                  />
                  <span className="block text-[10.5px] text-foreground-muted">
                    실중량 (총−공차 자동, 직접 수정 가능)
                  </span>
                </div>
              </div>
              {tareLookupHint && (
                <p className="text-[11px] text-info">{tareLookupHint}</p>
              )}
            </div>

            {/* 단가 + 운반비 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="unit_price">단가 (원)</Label>
                <Input
                  id="unit_price"
                  type="number"
                  step="1"
                  inputMode="numeric"
                  className="font-mono"
                  {...register('unit_price', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="transport_fee">운반비 (원)</Label>
                <Input
                  id="transport_fee"
                  type="number"
                  step="1"
                  inputMode="numeric"
                  className="font-mono"
                  {...register('transport_fee', { valueAsNumber: true })}
                />
              </div>
            </div>
          </Section>

          <Section title="비고">
            <Textarea {...register('note')} placeholder="메모 (선택)" rows={3} />
          </Section>

          {isEdit && (
            <Section title="수정 사유 (선택)">
              <Textarea
                {...register('change_reason')}
                placeholder="예: 단가 정정, 거래처 확인 후 수정"
                rows={2}
              />
              <p className="text-[11px] text-foreground-muted">
                입력하면 변경 이력에 별도 기록됩니다 (audit_logs.change_reason).
              </p>
            </Section>
          )}
        </div>

        <aside>
          <div className="sticky top-4 space-y-4">
            <div className="rounded-[10px] border border-border bg-surface p-4 shadow-sm">
              <h3 className="text-[13px] font-semibold tracking-tight">자동 계산</h3>
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-foreground-muted">공급가액</dt>
                  <dd className="font-mono">{formatKRW(calc.supplyAmount)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-foreground-muted">부가세</dt>
                  <dd className="font-mono">{formatKRW(calc.vat)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-divider pt-2.5">
                  <dt className="font-medium">청구금액</dt>
                  <dd className="font-mono text-base font-semibold">
                    {formatKRW(calc.totalAmount)}
                  </dd>
                </div>
              </dl>
            </div>
            {submitError && (
              <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
                {submitError}
              </div>
            )}
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
                {isEdit ? '수정 저장' : '저장'}
              </Button>
            </div>
          </div>
        </aside>
      </form>

      <CompanyCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initialName={createSeed}
        onCreated={handleCompanyCreated}
      />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
      <h3 className="mb-4 text-[13px] font-semibold tracking-tight">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
