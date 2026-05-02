import * as XLSX from 'xlsx';
import type {
  InvoiceLog,
  InvoiceCompanyInfo,
} from '@/components/erp/InvoicePreview';
import type { SelfCompanyInfo } from '@/lib/company-info';
import { cols, fmtDate, writeWorkbookToFile } from './utils';

interface InvoiceExcelInput {
  company: InvoiceCompanyInfo;
  selfCompany: SelfCompanyInfo;
  period: { from: string; to: string };
  logs: InvoiceLog[];
  issuedAt?: Date;
}

const directionLabel: Record<string, string> = { in: '반입', out: '반출' };

export function buildInvoiceWorkbook({
  company,
  selfCompany,
  period,
  logs,
  issuedAt = new Date(),
}: InvoiceExcelInput): XLSX.WorkBook {
  // 11 cols 기준 — 표 컬럼: 일자/구분/현장/성상/차량/중량/단가/운반비/공급가액/부가세/청구금액
  const aoa: (string | number | null)[][] = [];
  const merges: XLSX.Range[] = [];

  const addRow = (row: (string | number | null)[]) => aoa.push(row);
  const last = () => aoa.length - 1;
  const merge = (r: number, c1: number, c2: number) =>
    merges.push({ s: { r, c: c1 }, e: { r, c: c2 } });

  // 제목
  addRow(['거 래 명 세 표']);
  merge(last(), 0, 10);

  addRow([
    `${fmtDate(period.from)} ~ ${fmtDate(period.to)} · 발급일 ${fmtDate(issuedAt)}`,
  ]);
  merge(last(), 0, 10);

  addRow([]);

  // 공급받는자
  addRow(['공급받는자']);
  merge(last(), 0, 10);
  const recvRows: [string, string][] = [
    ['상호', company.name],
    ['사업자번호', company.business_no ?? '—'],
    ['주소', company.address ?? '—'],
    [
      '담당자',
      company.contact_name
        ? `${company.contact_name}${company.contact_phone ? ` · ${company.contact_phone}` : ''}`
        : '—',
    ],
  ];
  for (const [k, v] of recvRows) {
    addRow([k, v]);
    merge(last(), 1, 10); // value 셀 머지
  }

  addRow([]);

  // 공급자
  addRow(['공급자']);
  merge(last(), 0, 10);
  const supRows: [string, string][] = [
    ['상호', selfCompany.name],
    ['사업자번호', selfCompany.business_no || '—'],
    ['대표자', selfCompany.representative || '—'],
    ['주소', selfCompany.address || '—'],
    ['업태', selfCompany.business_type || '—'],
    ['종목', selfCompany.business_item || '—'],
    ['서명', `${selfCompany.name} (인)`],
  ];
  for (const [k, v] of supRows) {
    addRow([k, v]);
    merge(last(), 1, 10);
  }

  addRow([]);

  // 거래내역 헤더
  addRow([
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

  // 정렬: 일자 asc → 반입(in) → 반출(out) → 현장 가나다 (InvoicePreview 와 동일)
  const directionRank: Record<string, number> = { in: 0, out: 1 };
  const sortedLogs = [...logs].sort((a, b) => {
    if (a.log_date !== b.log_date) return a.log_date < b.log_date ? -1 : 1;
    const da = directionRank[a.direction] ?? 99;
    const db = directionRank[b.direction] ?? 99;
    if (da !== db) return da - db;
    return (a.sites?.name ?? '').localeCompare(b.sites?.name ?? '', 'ko');
  });

  if (sortedLogs.length === 0) {
    addRow(['해당 기간 거래가 없습니다.']);
    merge(last(), 0, 10);
  } else {
    for (const row of sortedLogs) {
      const transportFee = Number(row.transport_fee ?? 0);
      const supplyTotal = row.supply_amount ?? 0;
      const goodsSupply = supplyTotal - transportFee;
      addRow([
        fmtDate(row.log_date),
        directionLabel[row.direction] ?? row.direction,
        row.sites?.name ?? '—',
        row.waste_types?.name ?? '—',
        row.vehicle_no ?? '—',
        row.weight_kg ?? null,
        row.unit_price ?? null,
        transportFee > 0 ? transportFee : null,
        goodsSupply,
        row.vat ?? null,
        row.total_amount ?? null,
      ]);
    }
  }

  // 합계
  if (sortedLogs.length > 0) {
    const totals = sortedLogs.reduce(
      (acc, r) => {
        const tf = Number(r.transport_fee ?? 0);
        acc.weight += Number(r.weight_kg ?? 0);
        acc.transport += tf;
        acc.goods += (r.supply_amount ?? 0) - tf;
        acc.vat += r.vat ?? 0;
        acc.total += r.total_amount ?? 0;
        return acc;
      },
      { weight: 0, transport: 0, goods: 0, vat: 0, total: 0 },
    );
    addRow([
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
    merge(last(), 0, 4);
  }

  addRow([]);

  // 합계 박스 (공급가액 / 부가세 / 청구금액)
  if (sortedLogs.length > 0) {
    const sums = sortedLogs.reduce(
      (acc, r) => {
        acc.supply += r.supply_amount ?? 0;
        acc.vat += r.vat ?? 0;
        acc.total += r.total_amount ?? 0;
        return acc;
      },
      { supply: 0, vat: 0, total: 0 },
    );
    addRow(['공급가액', sums.supply, null, '부가세', sums.vat, null, null, '청구금액 (합계)', null, null, sums.total]);
    merge(last(), 1, 2);
    merge(last(), 4, 6);
    merge(last(), 7, 9);
    addRow([]);
  }

  // 자사 정보 푸터
  addRow([selfCompany.name]);
  merge(last(), 0, 10);
  if (selfCompany.address) {
    addRow([selfCompany.address]);
    merge(last(), 0, 10);
  }
  if (selfCompany.phone || selfCompany.fax) {
    const parts: string[] = [];
    if (selfCompany.phone) parts.push(`T.${selfCompany.phone}`);
    if (selfCompany.fax) parts.push(`F.${selfCompany.fax}`);
    addRow([parts.join('  ')]);
    merge(last(), 0, 10);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;
  ws['!cols'] = cols([14, 10, 16, 14, 12, 12, 12, 12, 14, 12, 14]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '거래명세표');
  return wb;
}

export function downloadInvoiceExcel(input: InvoiceExcelInput) {
  const wb = buildInvoiceWorkbook(input);
  const fileName = `거래명세표_${input.company.name}_${input.period.from}_${input.period.to}.xlsx`;
  writeWorkbookToFile(wb, fileName);
}
