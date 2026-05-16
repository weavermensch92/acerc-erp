import { formatDate, formatNumber } from '@/lib/format';
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

export interface PeriodCertLog {
  log_date: string;
  weight_kg: number | null;
  waste_type_name: string;
  note: string | null;
}

interface Props {
  serial?: string;
  company: CompanyInfo;
  site: SiteInfo;
  selfCompany: SelfCompanyInfo;
  period: { from: string; to: string };
  logs: PeriodCertLog[];
  issuedAt?: Date;
  // 인쇄 시 다음 현장이 새 페이지에서 시작하도록 — 마지막 페이지에는 false
  pageBreakAfter?: boolean;
}

const MIN_ROWS = 12;

// 기간·현장 단위 처리확인서 — 거래명세표에서 발급되는 신양식.
// 상단 박스: ① 배출자/배출장소 정보 + ② 처리업체 정보 (좌우 통합 표)
// 본문: 로그를 행으로 나열, 하단에 총 대수·총처리량.
export function PeriodCertificatePreview({
  serial,
  company,
  site,
  selfCompany,
  period,
  logs,
  issuedAt = new Date(),
  pageBreakAfter = false,
}: Props) {
  const totalWeight = logs.reduce((s, l) => s + Number(l.weight_kg ?? 0), 0);
  const totalCount = logs.length;
  const periodLabel = `${formatDate(period.from, 'yyyy.MM.dd')}.~${formatDate(period.to, 'yyyy.MM.dd')}`;
  const issuedLabel = formatDate(issuedAt, 'yyyy년 M월 d일');
  const blanks = Math.max(0, MIN_ROWS - logs.length);

  return (
    <div
      className={`invoice-sheet mx-auto max-w-[820px] bg-surface text-foreground print:max-w-none print:bg-white ${
        pageBreakAfter ? 'print:break-after-page' : ''
      }`}
    >
      <div className="border-2 border-foreground p-8 print:border-black">
        <h1 className="text-center text-2xl font-bold tracking-[0.3em]">
          폐 기 물 처 리 확 인 서
        </h1>
        <div className="mt-3 flex items-center justify-between text-xs text-foreground-muted print:text-gray-700">
          <span>{serial ? `제 ${serial} 호` : '제 _____ 호'}</span>
          <span>발급일: {formatDate(issuedAt)}</span>
        </div>

        {/* 상단 — 배출자 / 처리업체 통합 표 */}
        <table className="mt-5 w-full border border-foreground text-sm print:border-black">
          <tbody>
            <tr className="border-b border-foreground print:border-black">
              <VLabel rowSpan={2}>배출</VLabel>
              <SubLabel>주　소</SubLabel>
              <Value>{company.address ?? '—'}</Value>
              <RLabel>업체명</RLabel>
              <Value>{selfCompany.name}</Value>
            </tr>
            <tr className="border-b border-foreground print:border-black">
              <SubLabel>상　호</SubLabel>
              <Value>{company.name}</Value>
              <RLabel>대표자</RLabel>
              <Value>{selfCompany.representative || '—'}</Value>
            </tr>
            <tr className="border-b border-divider print:border-gray-400">
              <VLabel rowSpan={3}>
                배<br />출<br />장<br />소
              </VLabel>
              <SubLabel>공사명</SubLabel>
              <Value>{site.name ?? '—'}</Value>
              <RLabel>소재지</RLabel>
              <Value>{selfCompany.address || '—'}</Value>
            </tr>
            <tr className="border-b border-divider print:border-gray-400">
              <SubLabel>처리기간</SubLabel>
              <Value>{periodLabel}</Value>
              <RLabel>허가번호</RLabel>
              <Value>{selfCompany.permit_no || '—'}</Value>
            </tr>
            <tr className="border-b border-foreground print:border-black">
              <SubLabel>주　소</SubLabel>
              <Value>{site.address ?? '—'}</Value>
              <RLabel>전　화</RLabel>
              <Value>{selfCompany.phone || '—'}</Value>
            </tr>
            <tr>
              <SubLabel colSpan={2}>
                총처리량
                <br />
                (kg)
              </SubLabel>
              <Value>{formatNumber(totalWeight)} (kg)</Value>
              <RLabel>처리방법</RLabel>
              <Value>
                {selfCompany.processing_method || DEFAULT_PROCESSING_METHOD}
              </Value>
            </tr>
          </tbody>
        </table>

        {/* 본문 — 로그 표 */}
        <table className="mt-4 w-full border border-foreground text-[12px] print:border-black">
          <thead>
            <tr className="border-b border-foreground bg-background-subtle print:border-black print:bg-gray-100">
              <Th>배출일자</Th>
              <Th>수집운반업소명</Th>
              <Th>처리업소명</Th>
              <Th className="w-10">단위</Th>
              <Th className="w-12">대수</Th>
              <Th>종　류</Th>
              <Th>처리량(kg)</Th>
              <Th>비　고</Th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l, i) => (
              <tr
                key={i}
                className="border-b border-divider last:border-0 print:border-gray-400"
              >
                <Td>{formatDate(l.log_date, 'yyyy-MM-dd')}</Td>
                <Td>{selfCompany.name}</Td>
                <Td>{selfCompany.name}</Td>
                <Td className="text-center">kg</Td>
                <Td className="text-center">{/* 대수 — 비워둠 */}</Td>
                <Td>{l.waste_type_name}</Td>
                <Td className="text-right font-mono">
                  {formatNumber(l.weight_kg ?? 0)}
                </Td>
                <Td>{l.note ?? ''}</Td>
              </tr>
            ))}
            {Array.from({ length: blanks }).map((_, i) => (
              <tr
                key={`empty-${i}`}
                className="border-b border-divider last:border-0 print:border-gray-400"
              >
                <Td>&nbsp;</Td>
                <Td></Td>
                <Td></Td>
                <Td></Td>
                <Td></Td>
                <Td></Td>
                <Td></Td>
                <Td></Td>
              </tr>
            ))}
            <tr className="border-t-2 border-foreground bg-background-subtle text-sm font-semibold print:border-black print:bg-gray-100">
              <Td className="text-center">총처리량</Td>
              <Td></Td>
              <Td></Td>
              <Td></Td>
              <Td className="text-center">{totalCount} 대</Td>
              <Td></Td>
              <Td className="text-right font-mono">
                {formatNumber(totalWeight)}(kg)
              </Td>
              <Td></Td>
            </tr>
          </tbody>
        </table>

        <p className="mt-6 text-center text-sm leading-7">
          상기 폐기물에 대하여 폐기물관리법에 의거 적법하게 처리하였음을 확인함.
        </p>

        <p className="mt-3 text-center text-sm">{issuedLabel}</p>

        {/* 자사 정보 + 도장 */}
        <div className="mt-6 flex items-center justify-end gap-3 pr-2 text-sm font-semibold">
          <span>
            {selfCompany.name} 대표 {selfCompany.representative || '—'}
          </span>
          {selfCompany.stamp_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selfCompany.stamp_url}
              alt="날인"
              className="h-14 w-14 object-contain opacity-90 print:opacity-100"
            />
          )}
        </div>

        {/* 수신 */}
        <p className="mt-8 text-sm font-semibold">{company.name} 귀하</p>

        <p className="mt-6 text-center text-[10px] text-foreground-muted print:text-gray-600">
          본 확인서는 {selfCompany.name} ERP 시스템에서 자동 발급된 양식입니다.
          실제 법정 서식과 차이가 있을 수 있어 행정 제출 전 확인이 필요합니다.
        </p>
      </div>
    </div>
  );
}

function VLabel({
  children,
  rowSpan,
}: {
  children: React.ReactNode;
  rowSpan?: number;
}) {
  return (
    <th
      rowSpan={rowSpan}
      className="w-8 border-r border-foreground bg-background-subtle px-1 py-2 text-center text-xs font-medium align-middle leading-tight print:border-black print:bg-gray-50"
    >
      {children}
    </th>
  );
}

function SubLabel({
  children,
  colSpan,
}: {
  children: React.ReactNode;
  colSpan?: number;
}) {
  return (
    <th
      colSpan={colSpan}
      className="w-24 border-r border-divider bg-background-subtle px-2 py-1.5 text-center text-xs font-medium text-foreground-muted print:border-gray-400 print:bg-gray-50 print:text-gray-700"
    >
      {children}
    </th>
  );
}

function RLabel({ children }: { children: React.ReactNode }) {
  return (
    <th className="w-20 border-l border-r border-divider bg-background-subtle px-2 py-1.5 text-center text-xs font-medium text-foreground-muted print:border-gray-400 print:bg-gray-50 print:text-gray-700">
      {children}
    </th>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1.5 text-foreground">{children}</td>;
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`border-r border-divider px-2 py-1.5 text-center text-[11px] font-semibold text-foreground last:border-0 print:border-gray-400 ${
        className ?? ''
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`h-7 border-r border-divider px-2 py-1 align-middle last:border-0 print:border-gray-400 ${
        className ?? ''
      }`}
    >
      {children}
    </td>
  );
}
