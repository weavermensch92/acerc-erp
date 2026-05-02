import * as XLSX from 'xlsx';
import type { SelfCompanyInfo } from '@/lib/company-info';
import { cols, fmtDate, writeWorkbookToFile } from './utils';

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
    issuedAt = new Date(),
  } = input;

  const aoa: (string | number | null)[][] = [];
  const merges: XLSX.Range[] = [];

  const addRow = (row: (string | number | null)[]) => aoa.push(row);
  const last = () => aoa.length - 1;
  const merge = (r: number, c1: number, c2: number) =>
    merges.push({ s: { r, c: c1 }, e: { r, c: c2 } });

  // 6 columns: [label1, value1, label2, value2, label3, value3]
  // 3부 (배출자용 / 운반자용 / 처리자용) — 각 사본은 동일 정보 + 라벨만 다름
  for (let i = 0; i < COPIES.length; i++) {
    const copy = COPIES[i];

    addRow(['계 량 증 명 서', null, null, null, null, copy.label]);
    merge(last(), 0, 4);

    addRow([
      `${serial ? `제 ${serial}-${copy.code} 호` : '제 _____ 호'} · 계량일자 ${fmtDate(log.log_date)} · 발급일 ${fmtDate(issuedAt)}`,
    ]);
    merge(last(), 0, 5);

    addRow(['배출자', company.name, '처리자', plant?.name ?? '—', null, null]);
    merge(last(), 4, 5);
    addRow([
      '성상',
      wasteType.name,
      '차량번호',
      log.vehicle_no ?? '—',
      null,
      null,
    ]);
    merge(last(), 4, 5);

    addRow([
      '총중량',
      fmtKgValue(log.weight_total_kg),
      '공차중량',
      fmtKgValue(log.weight_tare_kg),
      '실중량',
      fmtKgValue(log.weight_kg),
    ]);

    addRow([
      '계량담당자',
      `${selfCompany.name} (인)`,
      '수령인',
      '_______________',
      null,
      null,
    ]);
    merge(last(), 4, 5);

    if (i < COPIES.length - 1) {
      addRow(['——————— ✂ 절취선 ———————']);
      merge(last(), 0, 5);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;
  ws['!cols'] = cols([14, 22, 14, 18, 14, 18]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '계량증명서');
  return wb;
}

export function downloadWeightCertExcel(input: WeightCertExcelInput) {
  const wb = buildWeightCertWorkbook(input);
  const fileName = `계량증명서_${input.company.name}_${input.log.log_date}.xlsx`;
  writeWorkbookToFile(wb, fileName);
}
