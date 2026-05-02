import * as XLSX from 'xlsx-js-style';
import type { SelfCompanyInfo } from '@/lib/company-info';
import {
  cols,
  fmtDate,
  writeWorkbookToFile,
  applyStyle,
  applyStyleRange,
  setRowHeights,
  STYLE_TITLE,
  STYLE_SUBTITLE,
  STYLE_SECTION_HEADER,
  STYLE_LABEL,
  STYLE_VALUE,
  STYLE_FOOTER_TEXT,
  STYLE_SIGN_LABEL,
  STYLE_SIGN_NAME,
  STYLE_SIGN_BOX_BOTTOM,
} from './utils';

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

export interface CertificateExcelInput {
  serial?: string;
  log: LogInfo;
  company: CompanyInfo;
  selfCompany: SelfCompanyInfo;
  plant: PlantInfo | null;
  wasteType: WasteTypeInfo;
  issuedAt?: Date;
  selfAsProcessor?: boolean;
}

function fmtKg(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${new Intl.NumberFormat('ko-KR').format(value)} kg`;
}

const NCOL = 6; // 6 columns: label = 0-1, value = 2-5; signature = 0-1, 2-3, 4-5

export function buildCertificateWorkbook(
  input: CertificateExcelInput,
): XLSX.WorkBook {
  const {
    serial,
    log,
    company,
    selfCompany,
    plant,
    wasteType,
    issuedAt = new Date(),
    selfAsProcessor = false,
  } = input;

  const aoa: (string | number | null)[][] = [];
  const merges: XLSX.Range[] = [];
  const styledRanges: Array<{ r1: number; c1: number; r2: number; c2: number; style: Record<string, unknown> }> = [];

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

  // 발급/serial
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

  push([]); // 공백

  // ① 배출자
  row = push(['① 배출자 (Generator)', null, null, null, null, null]);
  merge(row, 0, NCOL - 1);
  stl(row, 0, row, NCOL - 1, STYLE_SECTION_HEADER);
  const generatorRows: [string, string][] = [
    ['사업장명', company.name],
    ['사업자번호', company.business_no ?? '—'],
    ['주소', company.address ?? '—'],
    [
      '담당자 / 연락처',
      [company.contact_name, company.contact_phone].filter(Boolean).join(' · ') || '—',
    ],
  ];
  for (const [k, v] of generatorRows) {
    row = push([k, null, v, null, null, null]);
    merge(row, 0, 1);
    merge(row, 2, NCOL - 1);
    stl(row, 0, row, 1, STYLE_LABEL);
    stl(row, 2, row, NCOL - 1, STYLE_VALUE);
  }

  push([]);

  // ② 운반자
  row = push(['② 운반자 (Transporter)', null, null, null, null, null]);
  merge(row, 0, NCOL - 1);
  stl(row, 0, row, NCOL - 1, STYLE_SECTION_HEADER);
  const transporterRows: [string, string][] = [
    ['상호', selfCompany.name],
    ['사업자번호', selfCompany.business_no || '—'],
    ['대표자', selfCompany.representative || '—'],
    ['주소', selfCompany.address || '—'],
    ['연락처', selfCompany.phone || '—'],
  ];
  for (const [k, v] of transporterRows) {
    row = push([k, null, v, null, null, null]);
    merge(row, 0, 1);
    merge(row, 2, NCOL - 1);
    stl(row, 0, row, 1, STYLE_LABEL);
    stl(row, 2, row, NCOL - 1, STYLE_VALUE);
  }

  push([]);

  // ③ 처리자
  row = push(['③ 처리자 (Processor)', null, null, null, null, null]);
  merge(row, 0, NCOL - 1);
  stl(row, 0, row, NCOL - 1, STYLE_SECTION_HEADER);
  const processorRows: [string, string][] = [
    ['시설명', plant?.name ?? '—'],
    ['주소', plant?.address ?? '—'],
  ];
  for (const [k, v] of processorRows) {
    row = push([k, null, v, null, null, null]);
    merge(row, 0, 1);
    merge(row, 2, NCOL - 1);
    stl(row, 0, row, 1, STYLE_LABEL);
    stl(row, 2, row, NCOL - 1, STYLE_VALUE);
  }

  push([]);

  // ④ 폐기물 정보
  row = push(['④ 폐기물 정보', null, null, null, null, null]);
  merge(row, 0, NCOL - 1);
  stl(row, 0, row, NCOL - 1, STYLE_SECTION_HEADER);
  const wasteRows: [string, string][] = [
    ['배출일자', fmtDate(log.log_date)],
    ['종류 (성상)', wasteType.name],
    ['수량 (중량)', fmtKg(log.weight_kg)],
    ['운반차량', log.vehicle_no ?? '—'],
    ['처리방법', '소각 / 매립 / 재활용 등 (현장 기재)'],
  ];
  for (const [k, v] of wasteRows) {
    row = push([k, null, v, null, null, null]);
    merge(row, 0, 1);
    merge(row, 2, NCOL - 1);
    stl(row, 0, row, 1, STYLE_LABEL);
    stl(row, 2, row, NCOL - 1, STYLE_VALUE);
  }

  push([]);
  // 확인 문구
  row = push([
    '위 폐기물이 「폐기물관리법」에 따라 적법하게 운반·처리되었음을 확인합니다.',
    null,
    null,
    null,
    null,
    null,
  ]);
  merge(row, 0, NCOL - 1);
  stl(row, 0, row, NCOL - 1, { ...STYLE_FOOTER_TEXT, font: { name: 'Malgun Gothic', sz: 11 } });

  push([]);

  // 서명 — 3 boxes side by side, each box uses 2 rows (label + name)
  // box 0: cols 0-1, box 1: cols 2-3, box 2: cols 4-5
  const signRowLabel = push([
    '배출자',
    null,
    '운반자',
    null,
    '처리자',
    null,
  ]);
  merge(signRowLabel, 0, 1);
  merge(signRowLabel, 2, 3);
  merge(signRowLabel, 4, 5);
  stl(signRowLabel, 0, signRowLabel, 1, STYLE_SIGN_LABEL);
  stl(signRowLabel, 2, signRowLabel, 3, STYLE_SIGN_LABEL);
  stl(signRowLabel, 4, signRowLabel, 5, STYLE_SIGN_LABEL);

  const signRowName = push([
    company.name,
    null,
    `${selfCompany.name} (인)`,
    null,
    plant?.name ?? '—',
    null,
  ]);
  merge(signRowName, 0, 1);
  merge(signRowName, 2, 3);
  merge(signRowName, 4, 5);
  stl(signRowName, 0, signRowName, 1, STYLE_SIGN_NAME);
  stl(signRowName, 2, signRowName, 3, STYLE_SIGN_NAME);
  stl(signRowName, 4, signRowName, 5, STYLE_SIGN_NAME);

  // 서명 box 빈 공간 (높이 확보용)
  const signRowSpacer = push([null, null, null, null, null, null]);
  merge(signRowSpacer, 0, 1);
  merge(signRowSpacer, 2, 3);
  merge(signRowSpacer, 4, 5);
  stl(signRowSpacer, 0, signRowSpacer, 1, STYLE_SIGN_BOX_BOTTOM);
  stl(signRowSpacer, 2, signRowSpacer, 3, STYLE_SIGN_BOX_BOTTOM);
  stl(signRowSpacer, 4, signRowSpacer, 5, STYLE_SIGN_BOX_BOTTOM);

  push([]);
  row = push([
    `본 확인서는 ${selfCompany.name} ERP 시스템에서 자동 발급된 양식입니다.`,
    null,
    null,
    null,
    null,
    null,
  ]);
  merge(row, 0, NCOL - 1);
  stl(row, 0, row, NCOL - 1, { ...STYLE_FOOTER_TEXT, font: { name: 'Malgun Gothic', sz: 9, color: { rgb: '888888' } } });
  row = push([
    '실제 법정 서식과 차이가 있을 수 있어 행정 제출 전 확인이 필요합니다.',
    null,
    null,
    null,
    null,
    null,
  ]);
  merge(row, 0, NCOL - 1);
  stl(row, 0, row, NCOL - 1, { ...STYLE_FOOTER_TEXT, font: { name: 'Malgun Gothic', sz: 9, color: { rgb: '888888' } } });

  // sheet 생성
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;
  ws['!cols'] = cols([14, 16, 14, 16, 14, 16]);

  // 행 높이 — 제목 32pt, 서명 박스 spacer 60pt
  setRowHeights(ws, {
    0: 32,
    [signRowSpacer]: 60,
  });

  // 스타일 적용
  for (const sr of styledRanges) {
    applyStyleRange(ws, sr, sr.style);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '처리확인서');
  return wb;
}

export function downloadCertificateExcel(input: CertificateExcelInput) {
  const wb = buildCertificateWorkbook(input);
  const fileName = `처리확인서_${input.company.name}_${input.log.log_date}.xlsx`;
  writeWorkbookToFile(wb, fileName);
}
