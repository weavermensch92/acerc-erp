import * as XLSX from 'xlsx';
import type { SelfCompanyInfo } from '@/lib/company-info';
import { cols, fmtDate, writeWorkbookToFile } from './utils';

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

  const addRow = (row: (string | number | null)[]) => aoa.push(row);
  const last = () => aoa.length - 1;
  const merge = (r: number, c1: number, c2: number) =>
    merges.push({ s: { r, c: c1 }, e: { r, c: c2 } });

  // 4 컬럼 — [라벨1, 값1, 라벨2, 값2] 또는 라벨/값 단일 (머지로 처리)
  addRow(['폐 기 물 처 리 확 인 서']);
  merge(last(), 0, 3);

  addRow([
    serial ? `제 ${serial} 호` : '제 _____ 호',
    null,
    `발급일: ${fmtDate(issuedAt)}`,
    null,
  ]);
  merge(last(), 0, 1);
  merge(last(), 2, 3);

  addRow([]);

  // ① 배출자
  addRow(['① 배출자 (Generator)']);
  merge(last(), 0, 3);
  const generator: [string, string][] = [
    ['사업장명', company.name],
    ['사업자번호', company.business_no ?? '—'],
    ['주소', company.address ?? '—'],
    [
      '담당자 / 연락처',
      [company.contact_name, company.contact_phone].filter(Boolean).join(' · ') || '—',
    ],
  ];
  for (const [k, v] of generator) {
    addRow([k, v]);
    merge(last(), 1, 3);
  }

  addRow([]);

  // ② 운반자
  addRow(['② 운반자 (Transporter)']);
  merge(last(), 0, 3);
  const transporter: [string, string][] = [
    ['상호', selfCompany.name],
    ['사업자번호', selfCompany.business_no || '—'],
    ['대표자', selfCompany.representative || '—'],
    ['주소', selfCompany.address || '—'],
    ['연락처', selfCompany.phone || '—'],
  ];
  for (const [k, v] of transporter) {
    addRow([k, v]);
    merge(last(), 1, 3);
  }

  addRow([]);

  // ③ 처리자
  addRow(['③ 처리자 (Processor)']);
  merge(last(), 0, 3);
  const processor: [string, string][] = [
    ['시설명', plant?.name ?? '—'],
    ['주소', plant?.address ?? '—'],
  ];
  for (const [k, v] of processor) {
    addRow([k, v]);
    merge(last(), 1, 3);
  }

  addRow([]);

  // ④ 폐기물 정보
  addRow(['④ 폐기물 정보']);
  merge(last(), 0, 3);
  const waste: [string, string][] = [
    ['배출일자', fmtDate(log.log_date)],
    ['종류 (성상)', wasteType.name],
    ['수량 (중량)', fmtKg(log.weight_kg)],
    ['운반차량', log.vehicle_no ?? '—'],
    ['처리방법', '소각 / 매립 / 재활용 등 (현장 기재)'],
  ];
  for (const [k, v] of waste) {
    addRow([k, v]);
    merge(last(), 1, 3);
  }

  addRow([]);
  addRow(['위 폐기물이 「폐기물관리법」에 따라 적법하게 운반·처리되었음을 확인합니다.']);
  merge(last(), 0, 3);

  addRow([]);

  // 서명 — 3 명의 서명란
  addRow(['배출자', `${company.name} (인)`, '운반자', `${selfCompany.name} (인)`]);
  addRow([
    '처리자',
    plant?.name ? `${plant.name}${selfAsProcessor ? ' (인)' : ''}` : '—',
    null,
    null,
  ]);
  merge(last(), 1, 3);

  addRow([]);
  addRow([
    `본 확인서는 ${selfCompany.name} ERP 시스템에서 자동 발급된 양식입니다.`,
  ]);
  merge(last(), 0, 3);
  addRow(['실제 법정 서식과 차이가 있을 수 있어 행정 제출 전 확인이 필요합니다.']);
  merge(last(), 0, 3);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;
  ws['!cols'] = cols([18, 26, 18, 26]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '처리확인서');
  return wb;
}

export function downloadCertificateExcel(input: CertificateExcelInput) {
  const wb = buildCertificateWorkbook(input);
  const fileName = `처리확인서_${input.company.name}_${input.log.log_date}.xlsx`;
  writeWorkbookToFile(wb, fileName);
}
