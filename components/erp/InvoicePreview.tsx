import { formatKRW, formatKg, formatDate, formatNumber } from '@/lib/format';
import {
  type SelfCompanyInfo,
  DEFAULT_PROCESSING_METHOD,
} from '@/lib/company-info';
import type { Direction } from '@/lib/types/database';

export interface InvoiceLog {
  id: string;
  log_date: string;
  direction: Direction;
  vehicle_no: string | null;
  weight_kg: number | null;
  unit_price: number | null;
  transport_fee: number | null;
  supply_amount: number | null;
  vat: number | null;
  total_amount: number | null;
  is_paid: boolean;
  sites: { name: string } | null;
  waste_types: { name: string } | null;
}

export interface InvoiceCompanyInfo {
  id: string;
  name: string;
  business_no: string | null;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  // 홈택스 일괄발행에 필요한 옵셔널 필드 — UI 노출은 옵션
  representative?: string | null;
  business_type?: string | null;
  business_item?: string | null;
  email?: string | null;
}

interface Props {
  company: InvoiceCompanyInfo;
  selfCompany: SelfCompanyInfo;
  period: { from: string; to: string };
  logs: InvoiceLog[];
  // 조회 시 선택된 현장명 (전체 조회면 null) — 공급받는자 박스에 표시
  siteName?: string | null;
  issuedAt?: Date;
}

const directionLabel: Record<Direction, string> = { in: '반입', out: '반출' };

export function InvoicePreview({
  company,
  selfCompany,
  period,
  logs,
  siteName = null,
  issuedAt = new Date(),
}: Props) {
  const totals = {
    count: logs.length,
    weightKg: logs.reduce((s, r) => s + Number(r.weight_kg ?? 0), 0),
    transport: logs.reduce((s, r) => s + Number(r.transport_fee ?? 0), 0),
    // 운반비 제외 자재 공급가액 (= 중량 × 단가 분)
    goodsSupply: logs.reduce(
      (s, r) => s + ((r.supply_amount ?? 0) - Number(r.transport_fee ?? 0)),
      0,
    ),
    supply: logs.reduce((s, r) => s + (r.supply_amount ?? 0), 0),
    vat: logs.reduce((s, r) => s + (r.vat ?? 0), 0),
    total: logs.reduce((s, r) => s + (r.total_amount ?? 0), 0),
    unpaidTotal: logs
      .filter((r) => !r.is_paid)
      .reduce((s, r) => s + (r.total_amount ?? 0), 0),
  };

  return (
    <div className="invoice-sheet mx-auto max-w-[820px] bg-surface text-foreground print:max-w-none print:bg-white">
      <div className="border-2 border-foreground p-8 print:border-black">
        <h1 className="text-center text-3xl font-bold tracking-[0.4em]">거 래 명 세 표</h1>
        <p className="mt-2 text-center text-xs text-foreground-muted">
          {formatDate(period.from)} ~ {formatDate(period.to)} · 발급일 {formatDate(issuedAt)}
        </p>

        {/* 공급자 / 공급받는자 */}
        <div className="mt-6 grid grid-cols-2 gap-4 text-xs">
          <PartyBox
            title="공급받는자"
            rows={[
              ['상호', company.name],
              ['담당자', company.contact_name ?? '—'],
              // 현장명은 조회 시 특정 현장을 골랐을 때만 노출 (헷갈림 방지)
              ...(siteName ? ([['현장명', siteName]] as Array<[string, string]>) : []),
              ['폰번호', company.contact_phone ?? '—'],
            ]}
          />
          <PartyBox
            title="공급자"
            rows={[
              ['상호', selfCompany.name],
              ['사업자번호', selfCompany.business_no || '— (설정에서 입력)'],
              ['대표자', selfCompany.representative || '—'],
              ['주소', selfCompany.address || '—'],
              ['허가번호', selfCompany.permit_no || '—'],
              ['처리방법', selfCompany.processing_method || DEFAULT_PROCESSING_METHOD],
              ['업태', selfCompany.business_type || '—'],
              ['종목', selfCompany.business_item || '—'],
            ]}
            stampUrl={selfCompany.stamp_url ?? null}
            stampName={selfCompany.name}
          />
        </div>

        {/* 거래내역 */}
        <div className="mt-6 overflow-hidden border border-foreground print:border-black">
          <table className="w-full text-xs">
            <thead className="bg-background-subtle print:bg-gray-100">
              <tr className="border-b border-foreground print:border-black">
                <th className="border-r border-foreground p-1.5 text-center print:border-black">
                  일자
                </th>
                <th className="border-r border-foreground p-1.5 text-center print:border-black">
                  구분
                </th>
                <th className="border-r border-foreground p-1.5 text-center print:border-black">
                  현장
                </th>
                <th className="border-r border-foreground p-1.5 text-center print:border-black">
                  성상
                </th>
                <th className="border-r border-foreground p-1.5 text-center print:border-black">
                  차량
                </th>
                <th className="border-r border-foreground p-1.5 text-center print:border-black">
                  중량(kg)
                </th>
                <th className="border-r border-foreground p-1.5 text-center print:border-black">
                  단가(원)
                </th>
                <th className="border-r border-foreground p-1.5 text-center print:border-black">
                  운반비
                </th>
                <th className="border-r border-foreground p-1.5 text-center print:border-black">
                  공급가액
                </th>
                <th className="border-r border-foreground p-1.5 text-center print:border-black">
                  부가세
                </th>
                <th className="p-1.5 text-center">청구금액</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="p-6 text-center text-foreground-muted print:text-gray-500"
                  >
                    해당 기간 거래가 없습니다.
                  </td>
                </tr>
              ) : (
                logs.map((row) => {
                  const transportFee = Number(row.transport_fee ?? 0);
                  const supplyTotal = row.supply_amount ?? 0;
                  // 자재 공급가액 = 전체 supply - 운반비
                  const goodsSupply = supplyTotal - transportFee;
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-divider print:border-gray-300"
                    >
                      <td className="border-r border-divider p-1.5 text-center font-mono print:border-gray-300">
                        {formatDate(row.log_date)}
                      </td>
                      <td className="border-r border-divider p-1.5 text-center print:border-gray-300">
                        {directionLabel[row.direction]}
                      </td>
                      <td className="border-r border-divider p-1.5 print:border-gray-300">
                        {row.sites?.name ?? '—'}
                      </td>
                      <td className="border-r border-divider p-1.5 print:border-gray-300">
                        {row.waste_types?.name ?? '—'}
                      </td>
                      <td className="border-r border-divider p-1.5 text-center font-mono print:border-gray-300">
                        {row.vehicle_no ?? '—'}
                      </td>
                      <td className="border-r border-divider p-1.5 text-right font-mono print:border-gray-300">
                        {formatNumber(row.weight_kg)}
                      </td>
                      <td className="border-r border-divider p-1.5 text-right font-mono print:border-gray-300">
                        {formatNumber(row.unit_price)}
                      </td>
                      <td className="border-r border-divider p-1.5 text-right font-mono print:border-gray-300">
                        {transportFee > 0 ? formatNumber(transportFee) : '—'}
                      </td>
                      <td className="border-r border-divider p-1.5 text-right font-mono print:border-gray-300">
                        {formatNumber(goodsSupply)}
                      </td>
                      <td className="border-r border-divider p-1.5 text-right font-mono print:border-gray-300">
                        {formatNumber(row.vat)}
                      </td>
                      <td className="p-1.5 text-right font-mono">
                        {formatNumber(row.total_amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {logs.length > 0 && (
              <tfoot className="border-t-2 border-foreground bg-background-subtle text-xs print:border-black print:bg-gray-100">
                <tr>
                  <td
                    colSpan={5}
                    className="border-r border-foreground p-1.5 text-center font-semibold print:border-black"
                  >
                    합계 ({totals.count}건)
                  </td>
                  <td className="border-r border-foreground p-1.5 text-right font-mono font-semibold print:border-black">
                    {formatNumber(totals.weightKg)}
                  </td>
                  <td className="border-r border-foreground print:border-black"></td>
                  <td className="border-r border-foreground p-1.5 text-right font-mono font-semibold print:border-black">
                    {totals.transport > 0 ? formatNumber(totals.transport) : '—'}
                  </td>
                  <td className="border-r border-foreground p-1.5 text-right font-mono font-semibold print:border-black">
                    {formatNumber(totals.goodsSupply)}
                  </td>
                  <td className="border-r border-foreground p-1.5 text-right font-mono font-semibold print:border-black">
                    {formatNumber(totals.vat)}
                  </td>
                  <td className="p-1.5 text-right font-mono font-semibold">
                    {formatNumber(totals.total)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* 합계 박스 */}
        <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
          <SummaryBox label="공급가액" value={formatKRW(totals.supply)} />
          <SummaryBox label="부가세" value={formatKRW(totals.vat)} />
          <SummaryBox label="청구금액 (합계)" value={formatKRW(totals.total)} primary />
        </div>

        {totals.unpaidTotal > 0 && (
          <p className="mt-3 text-right text-xs text-danger print:text-black">
            ※ 미결제 합계: <span className="font-mono">{formatKRW(totals.unpaidTotal)}</span>
          </p>
        )}

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
          본 명세표는 {selfCompany.name} ERP 시스템에서 자동 발급됩니다 — 발급일 기준 데이터.
        </p>
      </div>
    </div>
  );
}

function PartyBox({
  title,
  rows,
  stampUrl,
  stampName,
}: {
  title: string;
  rows: Array<[string, string]>;
  stampUrl?: string | null;
  stampName?: string;
}) {
  return (
    <div className="flex flex-col border border-foreground print:border-black">
      <div className="border-b border-foreground bg-background-subtle px-2 py-1 text-center font-semibold print:border-black print:bg-gray-100">
        {title}
      </div>
      <table className="w-full">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr
              key={i}
              className="border-b border-divider last:border-0 print:border-gray-300"
            >
              <th className="w-1/3 border-r border-divider bg-background-subtle p-1.5 text-left text-foreground-muted print:border-gray-300 print:bg-gray-50 print:text-gray-700">
                {k}
              </th>
              <td className="p-1.5">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {stampName !== undefined && (
        <div className="relative mt-auto flex min-h-[72px] items-center justify-between border-t border-foreground px-3 py-3 print:border-black">
          <span className="text-foreground-muted print:text-gray-700">서명</span>
          <span className="pr-16 font-medium">{stampName} (인)</span>
          {stampUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stampUrl}
              alt="날인"
              className="absolute right-3 top-1/2 h-16 w-16 -translate-y-1/2 object-contain opacity-90 print:opacity-100"
            />
          )}
        </div>
      )}
    </div>
  );
}

function SummaryBox({
  label,
  value,
  primary = false,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <div
      className={`border p-3 ${
        primary
          ? 'border-foreground bg-foreground text-background print:border-black print:bg-gray-200 print:text-black'
          : 'border-border'
      }`}
    >
      <div
        className={`text-[10.5px] ${primary ? 'opacity-80' : 'text-foreground-muted'}`}
      >
        {label}
      </div>
      <div className="mt-1 font-mono text-base font-semibold">{value}</div>
    </div>
  );
}

