import { formatDate, formatKg } from '@/lib/format';
import {
  type SelfCompanyInfo,
  DEFAULT_PROCESSING_METHOD,
} from '@/lib/company-info';

interface CompanyInfo {
  name: string;
  representative: string | null;
  address: string | null;
}

interface SiteInfo {
  name: string | null;
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
  site: SiteInfo | null;
  selfCompany: SelfCompanyInfo;
  wasteType: WasteTypeInfo;
  issuedAt?: Date;
}

// PRD § 시나리오 5 — 폐기물관리법 표준 양식 (간이 버전)
// ① 배출자 + ② 처리자(자사 고정) + ③ 폐기물 정보. ② 운반자 섹션·하단 3박스 서명 제거.
// 자사정보 footer + ②처리자 박스 우측 상단에 도장.
export function CertificatePreview({
  serial,
  log,
  company,
  site,
  selfCompany,
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
              ['상호', company.name],
              ['대표자', company.representative ?? '—'],
              ['주소', company.address ?? '—'],
              ['공사명', site?.name ?? '—'],
              ['배출장소', site?.address ?? '—'],
              ['일자', formatDate(log.log_date)],
            ]}
          />
          <PartyTable
            title="② 처리자 (Processor)"
            rows={[
              ['상호', selfCompany.name],
              ['주소', selfCompany.address || '—'],
              ['허가번호', selfCompany.permit_no || '—'],
              ['처리방법', selfCompany.processing_method || DEFAULT_PROCESSING_METHOD],
              ['전화번호', selfCompany.phone || '—'],
            ]}
            stampUrl={selfCompany.stamp_url ?? null}
          />
          <PartyTable
            title="③ 폐기물 정보"
            rows={[
              ['배출일자', formatDate(log.log_date)],
              ['종류 (성상)', wasteType.name],
              ['중량', formatKg(log.weight_kg)],
              ['운반차량', log.vehicle_no ?? '—'],
            ]}
          />
        </div>

        <p className="mt-6 text-center text-sm leading-7">
          위 폐기물이 「폐기물관리법」에 따라 적법하게 운반·처리되었음을 확인합니다.
        </p>

        {/* 자사 정보 푸터 */}
        <div className="mt-8 text-center text-xs leading-6">
          <div className="font-semibold">{selfCompany.name}</div>
          {selfCompany.address && <div>{selfCompany.address}</div>}
          {(selfCompany.phone || selfCompany.fax) && (
            <div>
              {selfCompany.phone && <span>T.{selfCompany.phone}</span>}
              {selfCompany.phone && selfCompany.fax && <span>{'  '}</span>}
              {selfCompany.fax && <span>F.{selfCompany.fax}</span>}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[10px] text-foreground-muted print:text-gray-600">
          본 확인서는 {selfCompany.name} ERP 시스템에서 자동 발급된 양식입니다.
          실제 법정 서식과 차이가 있을 수 있어 행정 제출 전 확인이 필요합니다.
        </p>
      </div>
    </div>
  );
}

function PartyTable({
  title,
  rows,
  stampUrl,
}: {
  title: string;
  rows: Array<[string, string]>;
  stampUrl?: string | null;
}) {
  return (
    <div className="relative border border-foreground print:border-black">
      <div className="flex items-center justify-between border-b border-foreground bg-background-subtle px-3 py-1.5 print:border-black print:bg-gray-100">
        <span className="text-sm font-semibold">{title}</span>
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
      {stampUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={stampUrl}
          alt="날인"
          className="absolute right-3 top-2 h-16 w-16 object-contain opacity-90 print:opacity-100"
        />
      )}
    </div>
  );
}
