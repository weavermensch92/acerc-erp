import * as XLSX from 'xlsx-js-style';
import {
  type SelfCompanyInfo,
  DEFAULT_PROCESSING_METHOD,
} from '@/lib/company-info';
import {
  cols,
  fmtDate,
  writeWorkbookToFile,
  applyStyleRange,
  setRowHeights,
  STYLE_TITLE,
  STYLE_SECTION_HEADER,
  STYLE_LABEL,
  STYLE_VALUE,
  STYLE_FOOTER_TEXT,
} from './utils';

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

export interface CertificateExcelInput {
  serial?: string;
  log: LogInfo;
  company: CompanyInfo;
  site: SiteInfo | null;
  selfCompany: SelfCompanyInfo;
  wasteType: WasteTypeInfo;
  issuedAt?: Date;
}

function fmtKg(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${new Intl.NumberFormat('ko-KR').format(value)} kg`;
}

const NCOL = 6;

export function buildCertificateWorkbook(
  input: CertificateExcelInput,
): XLSX.WorkBook {
  const {
    serial,
    log,
    company,
    site,
    selfCompany,
    wasteType,
    issuedAt = new Date(),
  } = input;

  const aoa: (string | number | null)[][] = [];
  const merges: XLSX.Range[] = [];
  const styledRanges: Array<{
    r1: number; c1: number; r2: number; c2: number; style: Record<string, unknown>;
  }> = [];
  const rowHeightAccum: Record<number, number> = {};

  let r = 0;
  const push = (row: (string | number | null)[]) => {
    aoa[r] = row;
    return r++;
  };
  const merge = (rr: number, c1: number, c2: number) =>
    merges.push({ s: { r: rr, c: c1 }, e: { r: rr, c: c2 } });
  const stl = (r1: number, c1: number, r2: number, c2: number, style: Record<string, unknown>) =>
    styledRanges.push({ r1, c1, r2, c2, style });

  // 제목
  let row = push(['폐 기 물 처 리 확 인 서', null, null, null, null, null]);
  merge(row, 0, NCOL - 1);
  stl(row, 0, row, NCOL - 1, STYLE_TITLE);
  setRowHeightsLater(row, 32);

  // serial / 발급일
  row = push([
    serial ? `제 ${serial} 호` : '제 _____ 호',
    null,
    null,
    null,
    null,
    `발급일: ${fmtDate(issuedAt)}`,
  ]);
  merge(row, 0, 2);
  merge(row, 3, 5);
  stl(row, 0, row, 2, { ...STYLE_FOOTER_TEXT, alignment: { horizontal: 'left', vertical: 'center', indent: 1 } });
  stl(row, 3, row, 5, { ...STYLE_FOOTER_TEXT, alignment: { horizontal: 'right', vertical: 'center', indent: 1 } });

  push([]);

  const writeSection = (title: string, fields: [string, string][]) => {
    row = push([title, null, null, null, null, null]);
    merge(row, 0, NCOL - 1);
    stl(row, 0, row, NCOL - 1, STYLE_SECTION_HEADER);
    for (const [k, v] of fields) {
      row = push([k, null, v, null, null, null]);
      merge(row, 0, 1);
      merge(row, 2, NCOL - 1);
      stl(row, 0, row, 1, STYLE_LABEL);
      stl(row, 2, row, NCOL - 1, STYLE_VALUE);
    }
  };

  // ① 배출자
  writeSection('① 배출자 (Generator)', [
    ['상호', company.name],
    ['대표자', company.representative ?? '—'],
    ['주소', company.address ?? '—'],
    ['공사명', site?.name ?? '—'],
    ['배출장소', site?.address ?? '—'],
    ['일자', fmtDate(log.log_date)],
  ]);

  push([]);

  // ② 처리자 (자사)
  writeSection('② 처리자 (Processor)', [
    ['상호', selfCompany.name],
    ['주소', selfCompany.address || '—'],
    ['허가번호', selfCompany.permit_no || '—'],
    ['처리방법', selfCompany.processing_method || DEFAULT_PROCESSING_METHOD],
    ['전화번호', selfCompany.phone || '—'],
  ]);

  push([]);

  // ③ 폐기물 정보
  writeSection('③ 폐기물 정보', [
    ['배출일자', fmtDate(log.log_date)],
    ['종류 (성상)', wasteType.name],
    ['중량', fmtKg(log.weight_kg)],
    ['운반차량', log.vehicle_no ?? '—'],
  ]);

  push([]);

  row = push([
    '위 폐기물이 「폐기물관리법」에 따라 적법하게 운반·처리되었음을 확인합니다.',
    null, null, null, null, null,
  ]);
  merge(row, 0, NCOL - 1);
  stl(row, 0, row, NCOL - 1, { ...STYLE_FOOTER_TEXT, font: { name: 'Malgun Gothic', sz: 11 } });

  push([]);

  // 자사 정보 푸터
  row = push([selfCompany.name, null, null, null, null, null]);
  merge(row, 0, NCOL - 1);
  stl(row, 0, row, NCOL - 1, { ...STYLE_FOOTER_TEXT, font: { name: 'Malgun Gothic', sz: 11, bold: true } });

  if (selfCompany.address) {
    row = push([selfCompany.address, null, null, null, null, null]);
    merge(row, 0, NCOL - 1);
    stl(row, 0, row, NCOL - 1, STYLE_FOOTER_TEXT);
  }
  if (selfCompany.phone || selfCompany.fax) {
    const parts: string[] = [];
    if (selfCompany.phone) parts.push(`T.${selfCompany.phone}`);
    if (selfCompany.fax) parts.push(`F.${selfCompany.fax}`);
    row = push([parts.join('  '), null, null, null, null, null]);
    merge(row, 0, NCOL - 1);
    stl(row, 0, row, NCOL - 1, STYLE_FOOTER_TEXT);
  }

  push([]);
  row = push([
    `본 확인서는 ${selfCompany.name} ERP 시스템에서 자동 발급된 양식입니다.`,
    null, null, null, null, null,
  ]);
  merge(row, 0, NCOL - 1);
  stl(row, 0, row, NCOL - 1, { ...STYLE_FOOTER_TEXT, font: { name: 'Malgun Gothic', sz: 9, color: { rgb: '888888' } } });

  row = push([
    '실제 법정 서식과 차이가 있을 수 있어 행정 제출 전 확인이 필요합니다.',
    null, null, null, null, null,
  ]);
  merge(row, 0, NCOL - 1);
  stl(row, 0, row, NCOL - 1, { ...STYLE_FOOTER_TEXT, font: { name: 'Malgun Gothic', sz: 9, color: { rgb: '888888' } } });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;
  ws['!cols'] = cols([14, 16, 14, 16, 14, 16]);
  setRowHeights(ws, rowHeightAccum);

  for (const sr of styledRanges) {
    applyStyleRange(ws, sr, sr.style);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '처리확인서');
  return wb;

  function setRowHeightsLater(rIdx: number, hpt: number) {
    rowHeightAccum[rIdx] = hpt;
  }
}

export function downloadCertificateExcel(input: CertificateExcelInput) {
  const wb = buildCertificateWorkbook(input);
  const fileName = `처리확인서_${input.company.name}_${input.log.log_date}.xlsx`;
  writeWorkbookToFile(wb, fileName);
}
