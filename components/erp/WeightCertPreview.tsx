import { formatDate, formatNumber } from '@/lib/format';
import type { SelfCompanyInfo } from '@/lib/company-info';

interface CompanyInfo {
  name: string;
}

interface PlantInfo {
  name: string;
}

interface LogInfo {
  log_date: string;
  vehicle_no: string | null;
  weight_total_kg: number | null;
  weight_tare_kg: number | null;
  weight_kg: number | null;
}

interface WasteTypeInfo {
  name: string;
}

interface Props {
  serial?: string;
  log: LogInfo;
  company: CompanyInfo;
  selfCompany: SelfCompanyInfo;
  plant: PlantInfo | null;
  wasteType: WasteTypeInfo;
  siteName?: string | null;
  issuedAt?: Date;
}

const COPIES = [
  { label: '배출자용', code: 'A' },
  { label: '운반자용', code: 'B' },
  { label: '처리자용', code: 'C' },
] as const;

// PRD § 시나리오 6 — A4 1장 3부 분할 (배출자용 / 운반자용 / 처리자용)
export function WeightCertPreview({
  serial,
  log,
  company,
  selfCompany,
  plant,
  wasteType,
  siteName = null,
  issuedAt = new Date(),
}: Props) {
  return (
    <div className="invoice-sheet mx-auto max-w-[820px] bg-surface text-foreground print:max-w-none print:bg-white">
      <div className="space-y-3">
        {COPIES.map((copy, i) => (
          <div key={copy.code}>
            <CopyBlock
              copy={copy}
              serial={serial}
              log={log}
              company={company}
              selfCompany={selfCompany}
              plant={plant}
              wasteType={wasteType}
              siteName={siteName}
              issuedAt={issuedAt}
            />
            {i < COPIES.length - 1 && (
              <div className="my-3 flex items-center gap-2 text-[10px] text-foreground-muted print:text-gray-500">
                <span className="flex-1 border-t-2 border-dashed border-foreground/40 print:border-gray-500" />
                <span>✂ 절취선</span>
                <span className="flex-1 border-t-2 border-dashed border-foreground/40 print:border-gray-500" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface CopyProps {
  copy: { label: string; code: string };
  serial?: string;
  log: LogInfo;
  company: CompanyInfo;
  selfCompany: SelfCompanyInfo;
  plant: PlantInfo | null;
  wasteType: WasteTypeInfo;
  siteName: string | null;
  issuedAt: Date;
}

function CopyBlock({
  copy,
  serial,
  log,
  company,
  selfCompany,
  plant,
  wasteType,
  siteName,
  issuedAt,
}: CopyProps) {
  return (
    <div className="border-2 border-foreground p-5 print:border-black">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold tracking-widest">계 량 증 명 서</h2>
        <span className="rounded-full border border-foreground px-2.5 py-0.5 text-xs font-semibold print:border-black">
          {copy.label}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-foreground-muted print:text-gray-600">
        {serial ? `제 ${serial}-${copy.code} 호` : '제 _____ 호'} · 계량일자{' '}
        {formatDate(log.log_date)} · 발급일 {formatDate(issuedAt)}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <Field label="배출자" value={company.name} />
        <Field label="처리자" value={plant?.name ?? '—'} />
        <Field label="성상" value={wasteType.name} />
        <Field label="차량번호" value={log.vehicle_no ?? '—'} mono />
        <Field label="현장명" value={siteName ?? '—'} />
      </div>

      {/* 중량 표 */}
      <div className="mt-3 grid grid-cols-3 border-2 border-foreground print:border-black">
        <WeightCell label="총중량" value={log.weight_total_kg} />
        <WeightCell label="공차중량" value={log.weight_tare_kg} />
        <WeightCell label="실중량" value={log.weight_kg} primary last />
      </div>

      {/* 증명 문구 */}
      <p className="mt-2 text-center text-[11px] font-medium text-foreground-muted print:text-gray-700">
        * 상기와 같이 제품계량을 증명함
      </p>

      {/* 서명 */}
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <SignatureRow
          label="계량담당자"
          name={selfCompany.name}
          stampUrl={selfCompany.stamp_url ?? null}
        />
        <SignatureRow label="수령인" name="_______________" />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-14 flex-shrink-0 text-[11px] text-foreground-muted print:text-gray-600">
        {label}
      </span>
      <span
        className={`flex-1 border-b border-foreground/50 px-1 pb-0.5 print:border-gray-500 ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function WeightCell({
  label,
  value,
  primary = false,
  last = false,
}: {
  label: string;
  value: number | null;
  primary?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`p-2.5 text-center ${
        primary
          ? 'bg-foreground text-background print:bg-gray-200 print:text-black'
          : 'bg-background-subtle print:bg-gray-50'
      } ${!last ? 'border-r border-foreground print:border-black' : ''}`}
    >
      <div
        className={`text-[10.5px] ${
          primary ? 'opacity-80' : 'text-foreground-muted print:text-gray-700'
        }`}
      >
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold">
        {value !== null ? `${formatNumber(value)} kg` : '_____ kg'}
      </div>
    </div>
  );
}

function SignatureRow({
  label,
  name,
  stampUrl,
}: {
  label: string;
  name: string;
  stampUrl?: string | null;
}) {
  return (
    <div className="relative flex items-center gap-2 border border-foreground px-2 py-1.5 text-[11px] print:border-black">
      <span className="text-foreground-muted print:text-gray-700">{label}</span>
      <span className="flex-1 truncate">{name}</span>
      {stampUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={stampUrl}
          alt="날인"
          className="absolute right-12 top-1/2 h-8 w-8 -translate-y-1/2 object-contain opacity-90 print:opacity-100"
        />
      )}
    </div>
  );
}
