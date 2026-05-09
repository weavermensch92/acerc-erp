import * as XLSX from 'xlsx-js-style';
import type { SelfCompanyInfo } from '@/lib/company-info';
import {
  cols,
  fmtDate,
  writeWorkbookToFile,
  applyStyleRange,
  setRowHeights,
  STYLE_TITLE,
  STYLE_SUBTITLE,
  STYLE_LABEL,
  STYLE_VALUE,
  STYLE_VALUE_MONO,
  STYLE_FOOTER_TEXT,
  STYLE_TABLE_HEADER,
  STYLE_SUMMARY_PRIMARY_LABEL,
  STYLE_SUMMARY_PRIMARY_VALUE,
} from './utils';

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

export interface WeightCertExcelInput {
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

function fmtKgValue(v: number | null): string {
  if (v === null || Number.isNaN(v)) return '_____ kg';
  return `${new Intl.NumberFormat('ko-KR').format(v)} kg`;
}

const NCOL = 6; // 6 cols: weight 3-cell row uses 0-1 / 2-3 / 4-5

export function buildWeightCertWorkbook(
  input: WeightCertExcelInput,
): XLSX.WorkBook {
  const {
    serial,
    log,
    company,
    selfCompany,
    plant,
    wasteType,
    siteName = null,
    issuedAt = new Date(),
  } = input;

  const aoa: (string | number | null)[][] = [];
  const merges: XLSX.Range[] = [];
  const styledRanges: Array<{ r1: number; c1: number; r2: number; c2: number; style: Record<string, unknown> }> = [];
  const rowHeights: Record<number, number> = {};

  let r = 0;
  const push = (row: (string | number | null)[]) => {
    aoa[r] = row;
    return r++;
  };
  const merge = (rr: number, c1: number, c2: number) =>
    merges.push({ s: { r: rr, c: c1 }, e: { r: rr, c: c2 } });
  const stl = (r1: number, c1: number, r2: number, c2: number, style: Record<string, unknown>) =>
    styledRanges.push({ r1, c1, r2, c2, style });

  for (let i = 0; i < COPIES.length; i++) {
    const copy = COPIES[i];

    // 제목
    let row = push(['계 량 증 명 서', null, null, null, null, copy.label]);
    merge(row, 0, 4);
    stl(row, 0, row, 4, STYLE_TITLE);
    stl(row, 5, row, 5, {
      ...STYLE_LABEL,
      font: { name: 'Malgun Gothic', sz: 10, bold: true },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
    rowHeights[row] = 30;

    // 부제 (제 X-A 호 · 계량일자 · 발급일)
    row = push([
      `${serial ? `제 ${serial}-${copy.code} 호` : '제 _____ 호'} · 계량일자 ${fmtDate(log.log_date)} · 발급일 ${fmtDate(issuedAt)}`,
    ]);
    merge(row, 0, NCOL - 1);
    stl(row, 0, row, NCOL - 1, STYLE_SUBTITLE);

    push([]);

    // 4개 필드 (배출자, 처리자, 성상, 차량) — 2 행 x 2쌍
    row = push(['배출자', null, company.name, null, null, null]);
    merge(row, 0, 1);
    merge(row, 2, 5);
    stl(row, 0, row, 1, STYLE_LABEL);
    stl(row, 2, row, 5, STYLE_VALUE);

    row = push(['처리자', null, plant?.name ?? '—', null, null, null]);
    merge(row, 0, 1);
    merge(row, 2, 5);
    stl(row, 0, row, 1, STYLE_LABEL);
    stl(row, 2, row, 5, STYLE_VALUE);

    row = push(['성상', null, wasteType.name, null, null, null]);
    merge(row, 0, 1);
    merge(row, 2, 5);
    stl(row, 0, row, 1, STYLE_LABEL);
    stl(row, 2, row, 5, STYLE_VALUE);

    row = push(['차량번호', null, log.vehicle_no ?? '—', null, null, null]);
    merge(row, 0, 1);
    merge(row, 2, 5);
    stl(row, 0, row, 1, STYLE_LABEL);
    stl(row, 2, row, 5, STYLE_VALUE_MONO);

    row = push(['현장명', null, siteName ?? '—', null, null, null]);
    merge(row, 0, 1);
    merge(row, 2, 5);
    stl(row, 0, row, 1, STYLE_LABEL);
    stl(row, 2, row, 5, STYLE_VALUE);

    push([]);

    // 중량 표 — 3 칸 (총중량 / 공차중량 / 실중량(primary))
    const weightHeaderRow = push(['총중량', null, '공차중량', null, '실중량', null]);
    merge(weightHeaderRow, 0, 1);
    merge(weightHeaderRow, 2, 3);
    merge(weightHeaderRow, 4, 5);
    stl(weightHeaderRow, 0, weightHeaderRow, 1, STYLE_TABLE_HEADER);
    stl(weightHeaderRow, 2, weightHeaderRow, 3, STYLE_TABLE_HEADER);
    stl(weightHeaderRow, 4, weightHeaderRow, 5, STYLE_SUMMARY_PRIMARY_LABEL);

    const weightValueRow = push([
      fmtKgValue(log.weight_total_kg),
      null,
      fmtKgValue(log.weight_tare_kg),
      null,
      fmtKgValue(log.weight_kg),
      null,
    ]);
    merge(weightValueRow, 0, 1);
    merge(weightValueRow, 2, 3);
    merge(weightValueRow, 4, 5);
    stl(weightValueRow, 0, weightValueRow, 1, {
      ...STYLE_VALUE_MONO,
      alignment: { horizontal: 'center', vertical: 'center' },
      font: { name: 'Consolas', sz: 12, bold: true },
    });
    stl(weightValueRow, 2, weightValueRow, 3, {
      ...STYLE_VALUE_MONO,
      alignment: { horizontal: 'center', vertical: 'center' },
      font: { name: 'Consolas', sz: 12, bold: true },
    });
    stl(weightValueRow, 4, weightValueRow, 5, {
      ...STYLE_SUMMARY_PRIMARY_VALUE,
      alignment: { horizontal: 'center', vertical: 'center' },
      numFmt: 'General',
    });
    rowHeights[weightValueRow] = 28;

    // 증명 문구
    const certifyRow = push([
      '* 상기와 같이 제품계량을 증명함',
      null,
      null,
      null,
      null,
      null,
    ]);
    merge(certifyRow, 0, NCOL - 1);
    stl(certifyRow, 0, certifyRow, NCOL - 1, {
      font: { name: 'Malgun Gothic', sz: 10, bold: true, color: { rgb: '555555' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });

    push([]);

    // 서명 박스 (계량담당자 / 수령인)
    row = push([
      '계량담당자',
      null,
      `${selfCompany.name} (인)`,
      '수령인',
      null,
      '_______________',
    ]);
    merge(row, 0, 0);
    merge(row, 1, 2);
    merge(row, 3, 3);
    merge(row, 4, 5);
    stl(row, 0, row, 0, STYLE_LABEL);
    stl(row, 1, row, 2, STYLE_VALUE);
    stl(row, 3, row, 3, STYLE_LABEL);
    stl(row, 4, row, 5, STYLE_VALUE);

    if (i < COPIES.length - 1) {
      row = push(['——————— ✂ 절취선 ———————']);
      merge(row, 0, NCOL - 1);
      stl(row, 0, row, NCOL - 1, {
        ...STYLE_FOOTER_TEXT,
        font: { name: 'Malgun Gothic', sz: 9, color: { rgb: '888888' } },
      });
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;
  ws['!cols'] = cols([13, 13, 14, 14, 14, 14]);
  setRowHeights(ws, rowHeights);

  for (const sr of styledRanges) {
    applyStyleRange(ws, sr, sr.style);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '계량증명서');
  return wb;
}

export function downloadWeightCertExcel(input: WeightCertExcelInput) {
  const wb = buildWeightCertWorkbook(input);
  const fileName = `계량증명서_${input.company.name}_${input.log.log_date}.xlsx`;
  writeWorkbookToFile(wb, fileName);
}
