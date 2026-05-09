import * as XLSX from 'xlsx-js-style';
import type {
  InvoiceLog,
  InvoiceCompanyInfo,
} from '@/components/erp/InvoicePreview';
import type { SelfCompanyInfo } from '@/lib/company-info';
import {
  cols,
  writeWorkbookToFile,
  applyStyleRange,
  STYLE_TABLE_HEADER,
  STYLE_TABLE_CELL,
  STYLE_TABLE_NUM,
} from './utils';

// 홈택스 전자세금계산서 일괄발행 양식 (매출) 표준 헤더 (2024 기준).
// 사용자가 홈택스에서 받은 최신 양식 헤더와 일치하지 않으면 이 배열을 수정해야 함.
const HOMETAX_HEADERS = [
  '작성일자',
  '공급자 사업자등록번호',
  '공급자 종사업장번호',
  '공급자 상호',
  '공급자 성명',
  '공급자 주소',
  '공급자 업태',
  '공급자 종목',
  '공급자 이메일',
  '공급받는자 사업자등록번호',
  '공급받는자 종사업장번호',
  '공급받는자 상호',
  '공급받는자 성명',
  '공급받는자 주소',
  '공급받는자 업태',
  '공급받는자 종목',
  '공급받는자 이메일1',
  '공급받는자 이메일2',
  '합계금액',
  '공급가액',
  '세액',
  // 품목 1 — 자재
  '품목명1',
  '규격1',
  '수량1',
  '단가1',
  '공급가액1',
  '세액1',
  '비고1',
  // 품목 2 — 운반비
  '품목명2',
  '규격2',
  '수량2',
  '단가2',
  '공급가액2',
  '세액2',
  '비고2',
  // 품목 3·4 슬롯 (빈칸)
  '품목명3',
  '규격3',
  '수량3',
  '단가3',
  '공급가액3',
  '세액3',
  '비고3',
  '품목명4',
  '규격4',
  '수량4',
  '단가4',
  '공급가액4',
  '세액4',
  '비고4',
  '현금',
  '수표',
  '어음',
  '외상미수금',
  '청구구분', // 1=청구, 2=영수
  '비고',
];

export interface HometaxSalesInput {
  // 공급자 (자사)
  selfCompany: SelfCompanyInfo;
  // 공급받는자 (거래처)
  company: InvoiceCompanyInfo & {
    representative?: string | null;
    business_type?: string | null;
    business_item?: string | null;
    email?: string | null;
    email2?: string | null;
  };
  period: { from: string; to: string };
  logs: InvoiceLog[];
  // 발행 일자 (홈택스 작성일자) — 기본값: 기간 종료일
  issuedAt?: string;
  // 청구/영수 구분 — 1: 청구 (기본), 2: 영수
  billingType?: 1 | 2;
  // 자재 품목 표기 — 우세 성상 자동 추출, 없으면 '폐기물 처리'
  goodsItemName?: string;
}

// YYYYMMDD (홈택스 작성일자 표준 포맷)
function toHometaxDate(d: string): string {
  return d.replace(/-/g, '');
}

export function buildHometaxSalesWorkbook(
  input: HometaxSalesInput,
): XLSX.WorkBook {
  const { selfCompany, company, period, logs, issuedAt, billingType = 1 } = input;

  // 합계 계산 — 자재 분 (운반비 제외) / 운반비 분 분리
  let goodsSupply = 0;
  let goodsVat = 0;
  let transportFee = 0;
  let transportVat = 0;
  let totalWeight = 0;
  const wasteTypeCounts: Record<string, number> = {};

  for (const log of logs) {
    const supplyTotal = log.supply_amount ?? 0;
    const tf = Number(log.transport_fee ?? 0);
    const vatTotal = log.vat ?? 0;

    const goodsPart = supplyTotal - tf;
    // 부가세 비례 분리 (정확한 분배는 어려우므로 비례 배분)
    const tVat =
      tf > 0 && supplyTotal > 0
        ? Math.round(vatTotal * (tf / supplyTotal))
        : 0;
    goodsSupply += goodsPart;
    goodsVat += vatTotal - tVat;
    transportFee += tf;
    transportVat += tVat;
    totalWeight += Number(log.weight_kg ?? 0);

    const wt = log.waste_types?.name;
    if (wt) wasteTypeCounts[wt] = (wasteTypeCounts[wt] ?? 0) + 1;
  }

  const supply = goodsSupply + transportFee;
  const vat = goodsVat + transportVat;
  const total = supply + vat;

  // 자재 품목명 — 가장 빈도 높은 성상
  const dominantWasteType = Object.entries(wasteTypeCounts).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];
  const goodsItem =
    input.goodsItemName ?? (dominantWasteType ? `폐기물 처리(${dominantWasteType})` : '폐기물 처리');

  const writeDate = toHometaxDate(issuedAt ?? period.to);

  // 한 행 (하나의 거래처에 대한 한 장의 세금계산서)
  const dataRow: (string | number | null)[] = [
    writeDate,
    selfCompany.business_no ?? '',
    '', // 공급자 종사업장번호
    selfCompany.name,
    selfCompany.representative ?? '',
    selfCompany.address ?? '',
    selfCompany.business_type ?? '',
    selfCompany.business_item ?? '',
    selfCompany.email ?? '',
    company.business_no ?? '',
    '', // 공급받는자 종사업장번호
    company.name,
    company.representative ?? '',
    company.address ?? '',
    company.business_type ?? '',
    company.business_item ?? '',
    company.email ?? '',
    company.email2 ?? '',
    total,
    supply,
    vat,
    // 품목 1 — 자재
    goodsItem,
    '',
    totalWeight > 0 ? totalWeight : null,
    null, // 단가 — 합산이라 평균 의미가 약함, 비워둠
    goodsSupply,
    goodsVat,
    `${period.from} ~ ${period.to} (${logs.length}건)`,
    // 품목 2 — 운반비
    transportFee > 0 ? '운반비' : '',
    '',
    transportFee > 0 ? 1 : null,
    transportFee > 0 ? transportFee : null,
    transportFee > 0 ? transportFee : null,
    transportFee > 0 ? transportVat : null,
    '',
    // 품목 3·4 빈칸
    '', '', null, null, null, null, '',
    '', '', null, null, null, null, '',
    null, // 현금
    null, // 수표
    null, // 어음
    total, // 외상미수금 — 미수금 기준이면 총액 (사용자가 홈택스에서 조정 가능)
    billingType,
    '',
  ];

  const aoa = [HOMETAX_HEADERS, dataRow];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols(HOMETAX_HEADERS.map(() => 14));

  // 헤더 스타일
  applyStyleRange(
    ws,
    { r1: 0, c1: 0, r2: 0, c2: HOMETAX_HEADERS.length - 1 },
    STYLE_TABLE_HEADER,
  );
  // 데이터 행 스타일 (텍스트 셀 vs 숫자 셀)
  // 18~20: 합계/공급가액/세액 (숫자), 25~26: 공급가액1/세액1 (숫자), 32~33: 공급가액2/세액2 (숫자)
  // 22~24: 수량1/단가1 (숫자), 30~32 도 숫자 가능. 간단히 전체를 텍스트 셀로 두고 숫자 컬럼만 right-align
  applyStyleRange(
    ws,
    { r1: 1, c1: 0, r2: 1, c2: HOMETAX_HEADERS.length - 1 },
    STYLE_TABLE_CELL,
  );
  // 숫자 셀 (right-align + numFmt) — 인덱스 매핑
  const numericCols = [18, 19, 20, 23, 24, 25, 26, 30, 31, 32, 33, 49, 50, 51, 52];
  for (const c of numericCols) {
    applyStyleRange(ws, { r1: 1, c1: c, r2: 1, c2: c }, STYLE_TABLE_NUM);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '매출_일괄발행');
  return wb;
}

export function downloadHometaxSalesExcel(input: HometaxSalesInput) {
  const wb = buildHometaxSalesWorkbook(input);
  const fileName = `홈택스_일괄발행_매출_${input.company.name}_${input.period.from}_${input.period.to}.xlsx`;
  writeWorkbookToFile(wb, fileName);
}
