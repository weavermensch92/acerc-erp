import { formatDate, formatKg } from '@/lib/format';
import type { SelfCompanyInfo } from '@/lib/company-info';

interface CompanyInfo {
  name: string;
  business_no: string | null;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
}

interface PlantInfo {
  name: string;
  address: string | null;
}

interface LogInfo {
  log_date: string;
  vehicle_no: string | null;
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
  issuedAt?: Date;
}

// PRD § 시나리오 5 — 폐기물관리법 표준 양식 (간이 버전)
// 3자(배출자/운반자/처리자) 정보 + 폐기물 정보 + 서명란.
export function CertificatePreview({
  serial,
  log,
  company,
  selfCompany,
  plant,
  wasteType,
  issuedAt = new Date(),
}: Props) {
  return (
    <div className="invoice-sheet mx-auto max-w-[820px] bg-surface text-foreground print:max-w-none print:bg-white">
      <div className="border-2 border-foreground p-8 print:border-black">
        <h1 className="text-center text-2xl font-bold tracking-[0.3em]">
          폐 기 물 처 리 확 인 서
        </h1>
        <div className="mt-3 flex items-center justify-between text-xs text-foreground-muted print:text-gray-700">
          <span>{serial ? `제 ${serial} 호` : '제 _____ 호'}</span>
          <span>발급일: {formatDate(issuedAt)}</span>
        </div>

        <div className="mt-6 space-y-4">
          <PartyTable
            title="① 배출자 (Generator)"
            rows={[
              ['사업장명', company.name],
              ['사업자번호', company.business_no ?? '—'],
              ['주소', company.address ?? '—'],
              [
                '담당자 / 연락처',
                [company.contact_name, company.contact_phone].filter(Boolean).join(' · ') || '—',
              ],
            ]}
          />
          <PartyTable
            title="② 운반자 (Transporter)"
            rows={[
              ['상호', selfCompany.name],
              ['사업자번호', selfCompany.business_no || '—'],
              ['대표자', selfCompany.representative || '—'],
              ['주소', selfCompany.address || '—'],
              ['연락처', selfCompany.phone || '—'],
            ]}
          />
          <PartyTable
            title="③ 처리자 (Processor)"
            rows={[
              ['시설명', plant?.name ?? '—'],
              ['주소', plant?.address ?? '—'],
            ]}
          />
          <PartyTable
            title="④ 폐기물 정보"
            rows={[
              ['배출일자', formatDate(log.log_date)],
              ['종류 (성상)', wasteType.name],
              ['수량 (중량)', formatKg(log.weight_kg)],
              ['운반차량', log.vehicle_no ?? '—'],
              ['처리방법', '소각 / 매립 / 재활용 등 (현장 기재)'],
            ]}
          />
        </div>

        <p className="mt-6 text-center text-sm leading-7">
          위 폐기물이 「폐기물관리법」에 따라 적법하게 운반·처리되었음을 확인합니다.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-3 text-xs">
          <SignatureBox label="배출자" name={company.name} />
          <SignatureBox label="운반자" name={selfCompany.name} />
          <SignatureBox label="처리자" name={plant?.name ?? '—'} />
        </div>

        <p className="mt-8 text-center text-[10px] text-foreground-muted print:text-gray-600">
          본 확인서는 (주)에이스알앤씨 ERP 시스템에서 자동 발급된 양식입니다.
          실제 법정 서식과 차이가 있을 수 있어 행정 제출 전 확인이 필요합니다.
        </p>
      </div>
    </div>
  );
}

function PartyTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="border border-foreground print:border-black">
      <div className="border-b border-foreground bg-background-subtle px-3 py-1.5 text-sm font-semibold print:border-black print:bg-gray-100">
        {title}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr
              key={i}
              className="border-b border-divider last:border-0 print:border-gray-300"
            >
              <th className="w-1/4 border-r border-divider bg-background-subtle p-2 text-left font-medium text-foreground-muted print:border-gray-300 print:bg-gray-50 print:text-gray-700">
                {k}
              </th>
              <td className="p-2 text-foreground">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SignatureBox({ label, name }: { label: string; name: string }) {
  return (
    <div className="border border-foreground p-3 print:border-black">
      <div className="text-[10.5px] text-foreground-muted print:text-gray-700">{label}</div>
      <div className="mt-1 text-sm font-medium">{name}</div>
      <div className="mt-8 text-right text-[10px] text-foreground-muted print:text-gray-600">
        (서명 또는 인)
      </div>
    </div>
  );
}
