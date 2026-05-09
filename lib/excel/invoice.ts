import * as XLSX from 'xlsx-js-style';
import type {
  InvoiceLog,
  InvoiceCompanyInfo,
} from '@/components/erp/InvoicePreview';
import type { SelfCompanyInfo } from '@/lib/company-info';
import {
  cols,
  fmtDate,
  writeWorkbookToFile,
  applyStyleRange,
  setRowHeights,
  STYLE_TITLE,
  STYLE_SUBTITLE,
  STYLE_SECTION_HEADER,
  STYLE_LABEL,
  STYLE_VALUE,
  STYLE_TABLE_HEADER,
  STYLE_TABLE_CELL,
  STYLE_TABLE_NUM,
  STYLE_TFOOT,
  STYLE_TFOOT_CENTER,
  STYLE_FOOTER_TEXT,
  STYLE_FOOTER_BOLD,
  STYLE_SUMMARY_LABEL,
  STYLE_SUMMARY_VALUE,
  STYLE_SUMMARY_PRIMARY_LABEL,
  STYLE_SUMMARY_PRIMARY_VALUE,
} from './utils';

interface InvoiceExcelInput {
  company: InvoiceCompanyInfo;
  selfCompany: SelfCompanyInfo;
  period: { from: string; to: string };
  logs: InvoiceLog[];
  siteName?: string | null;
  issuedAt?: Date;
}

const directionLabel: Record<string, string> = { in: '반입', out: '반출' };
const NCOL = 11; // 일자/구분/현장/성상/차량/중량/단가/운반비/공급가액/부가세/청구금액

export function buildInvoiceWorkbook({
  company,
  selfCompany,
  period,
  logs,
  siteName = null,
  issuedAt = new Date(),
}: InvoiceExcelInput): XLSX.WorkBook {
  const aoa: (string | number | null)[][] = [];
  const merges: XLSX.Range[] = [];
  const styledRanges: Array<{
    r1: number;
    c1: number;
    r2: number;
    c2: number;
    style: Record<string, unknown>;
  }> = [];

  let r = 0;
  const push = (row: (string | number | null)[]) => {
    aoa[r] = row;
    return r++;
  };
  const merge = (rr: number, c1: number, c2: number) =>
    merges.push({ s: { r: rr, c: c1 }, e: { r: rr, c: c2 } });
  const stl = (
    r1: number,
    c1: number,
    r2: number,
    c2: number,
    style: Record<string, unknown>,
  ) => styledRanges.push({ r1, c1, r2, c2, style });

  // 제목 + 부제
  let row = push(['거 래 명 세 표']);
  merge(row, 0, NCOL - 1);
  stl(row, 0, row, NCOL - 1, STYLE_TITLE);
  const titleRow = row;

  row = push([
    `${fmtDate(period.from)} ~ ${fmtDate(period.to)} · 발급일 ${fmtDate(issuedAt)}`,
  ]);
  merge(row, 0, NCOL - 1);
  stl(row, 0, row, NCOL - 1, STYLE_SUBTITLE);

  push([]);

  // 공급받는자 — 11 cols 사용. label 0-2, value 3-10 (or full block)
  // 더 깔끔하게: 좌측 박스(공급받는자, col 0-4) / 우측 박스(공급자, col 6-10)
  // 두 박스의 행 수가 다르니 (받는자 4행, 공급자 6행) 짧은 쪽 패딩
  const recvRows: [string, string][] = [
    ['상호', company.name],
    ['담당자', company.contact_name ?? '—'],
    ['현장명', siteName ?? '—'],
    ['폰번호', company.contact_phone ?? '—'],
  ];
  const supRows: [string, string][] = [
    ['상호', selfCompany.name],
    ['사업자번호', selfCompany.business_no || '—'],
    ['대표자', selfCompany.representative || '—'],
    ['주소', selfCompany.address || '—'],
    ['업태', selfCompany.business_type || '—'],
    ['종목', selfCompany.business_item || '—'],
  ];
  // header
  row = push(['공급받는자', null, null, null, null, null, '공급자', null, null, null, null]);
  merge(row, 0, 4);
  merge(row, 6, NCOL - 1);
  stl(row, 0, row, 4, { ...STYLE_SECTION_HEADER, alignment: { horizontal: 'center', vertical: 'center' } });
  stl(row, 6, row, NCOL - 1, { ...STYLE_SECTION_HEADER, alignment: { horizontal: 'center', vertical: 'center' } });

  const maxRows = Math.max(recvRows.length, supRows.length) + 1; // +1 for 서명
  for (let i = 0; i < maxRows; i++) {
    const recv = recvRows[i];
    const sup = supRows[i];
    const isSignRow = i === maxRows - 1;
    const left = recv ? recv : isSignRow ? ['서명', `${company.name} (인)`] : ['', ''];
    const right = sup ? sup : isSignRow ? ['서명', `${selfCompany.name} (인)`] : ['', ''];
    row = push([
      left[0], null, left[1], null, null,
      null, // gap col 5
      right[0], null, right[1], null, null,
    ]);
    merge(row, 0, 1); // left label
    merge(row, 2, 4); // left value
    merge(row, 6, 7); // right label
    merge(row, 8, NCOL - 1); // right value
    stl(row, 0, row, 1, STYLE_LABEL);
    stl(row, 2, row, 4, STYLE_VALUE);
    stl(row, 6, row, 7, STYLE_LABEL);
    stl(row, 8, row, NCOL - 1, STYLE_VALUE);
  }

  push([]);

  // 거래내역 헤더
  const tableHeaderRow = push([
    '일자',
    '구분',
    '현장',
    '성상',
    '차량',
    '중량(kg)',
    '단가(원)',
    '운반비',
    '공급가액',
    '부가세',
    '청구금액',
  ]);
  stl(tableHeaderRow, 0, tableHeaderRow, NCOL - 1, STYLE_TABLE_HEADER);

  // 정렬 (인쇄 양식과 동일)
  const directionRank: Record<string, number> = { in: 0, out: 1 };
  const sortedLogs = [...logs].sort((a, b) => {
    if (a.log_date !== b.log_date) return a.log_date < b.log_date ? -1 : 1;
    const da = directionRank[a.direction] ?? 99;
    const db = directionRank[b.direction] ?? 99;
    if (da !== db) return da - db;
    return (a.sites?.name ?? '').localeCompare(b.sites?.name ?? '', 'ko');
  });

  if (sortedLogs.length === 0) {
    row = push(['해당 기간 거래가 없습니다.']);
    merge(row, 0, NCOL - 1);
    stl(row, 0, row, NCOL - 1, {
      ...STYLE_TABLE_CELL,
      font: { name: 'Malgun Gothic', sz: 10, color: { rgb: '999999' } },
    });
  } else {
    for (const log of sortedLogs) {
      const transportFee = Number(log.transport_fee ?? 0);
      const supplyTotal = log.supply_amount ?? 0;
      const goodsSupply = supplyTotal - transportFee;
      row = push([
        fmtDate(log.log_date),
        directionLabel[log.direction] ?? log.direction,
        log.sites?.name ?? '—',
        log.waste_types?.name ?? '—',
        log.vehicle_no ?? '—',
        log.weight_kg ?? null,
        log.unit_price ?? null,
        transportFee > 0 ? transportFee : null,
        goodsSupply,
        log.vat ?? null,
        log.total_amount ?? null,
      ]);
      // 좌측 5컬럼: 텍스트 셀, 우측 6컬럼: 숫자 셀
      stl(row, 0, row, 4, STYLE_TABLE_CELL);
      stl(row, 5, row, NCOL - 1, STYLE_TABLE_NUM);
    }
  }

  // 합계 tfoot
  let summaryStartRow = -1;
  if (sortedLogs.length > 0) {
    const totals = sortedLogs.reduce(
      (acc, l) => {
        const tf = Number(l.transport_fee ?? 0);
        acc.weight += Number(l.weight_kg ?? 0);
        acc.transport += tf;
        acc.goods += (l.supply_amount ?? 0) - tf;
        acc.vat += l.vat ?? 0;
        acc.total += l.total_amount ?? 0;
        acc.supply += l.supply_amount ?? 0;
        return acc;
      },
      { weight: 0, transport: 0, goods: 0, vat: 0, total: 0, supply: 0 },
    );
    row = push([
      `합계 (${sortedLogs.length}건)`,
      null,
      null,
      null,
      null,
      totals.weight,
      null,
      totals.transport > 0 ? totals.transport : null,
      totals.goods,
      totals.vat,
      totals.total,
    ]);
    merge(row, 0, 4);
    stl(row, 0, row, 4, STYLE_TFOOT_CENTER);
    stl(row, 5, row, NCOL - 1, STYLE_TFOOT);

    push([]);

    // 합계 박스 — 공급가액(자재+운반비) / 부가세 / 청구금액 (3 박스)
    summaryStartRow = r;
    row = push([
      '공급가액',
      totals.supply,
      null,
      null,
      '부가세',
      totals.vat,
      null,
      null,
      '청구금액 (합계)',
      totals.total,
      null,
    ]);
    merge(row, 0, 0);
    merge(row, 1, 3);
    merge(row, 4, 4);
    merge(row, 5, 7);
    merge(row, 8, 8);
    merge(row, 9, NCOL - 1);
    stl(row, 0, row, 0, STYLE_SUMMARY_LABEL);
    stl(row, 1, row, 3, STYLE_SUMMARY_VALUE);
    stl(row, 4, row, 4, STYLE_SUMMARY_LABEL);
    stl(row, 5, row, 7, STYLE_SUMMARY_VALUE);
    stl(row, 8, row, 8, STYLE_SUMMARY_PRIMARY_LABEL);
    stl(row, 9, row, NCOL - 1, STYLE_SUMMARY_PRIMARY_VALUE);
  }

  push([]);

  // 자사 정보 푸터
  row = push([selfCompany.name]);
  merge(row, 0, NCOL - 1);
  stl(row, 0, row, NCOL - 1, STYLE_FOOTER_BOLD);
  if (selfCompany.address) {
    row = push([selfCompany.address]);
    merge(row, 0, NCOL - 1);
    stl(row, 0, row, NCOL - 1, STYLE_FOOTER_TEXT);
  }
  if (selfCompany.phone || selfCompany.fax) {
    const parts: string[] = [];
    if (selfCompany.phone) parts.push(`T.${selfCompany.phone}`);
    if (selfCompany.fax) parts.push(`F.${selfCompany.fax}`);
    row = push([parts.join('  ')]);
    merge(row, 0, NCOL - 1);
    stl(row, 0, row, NCOL - 1, STYLE_FOOTER_TEXT);
  }

  // 시트 생성
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;
  ws['!cols'] = cols([12, 8, 18, 14, 11, 11, 11, 11, 13, 11, 14]);

  // 행 높이 (제목 큼직, 합계 박스 더 큼)
  const rowHeights: Record<number, number> = { [titleRow]: 36 };
  if (summaryStartRow >= 0) rowHeights[summaryStartRow] = 30;
  setRowHeights(ws, rowHeights);

  for (const sr of styledRanges) {
    applyStyleRange(ws, sr, sr.style);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '거래명세표');
  return wb;
}

export function downloadInvoiceExcel(input: InvoiceExcelInput) {
  const wb = buildInvoiceWorkbook(input);
  const fileName = `거래명세표_${input.company.name}_${input.period.from}_${input.period.to}.xlsx`;
  writeWorkbookToFile(wb, fileName);
}
