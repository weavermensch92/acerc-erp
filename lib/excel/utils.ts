import * as XLSX from 'xlsx';

// 클라이언트에서 워크북을 파일로 저장 (브라우저 다운로드 트리거)
export function writeWorkbookToFile(wb: XLSX.WorkBook, fileName: string) {
  // 한글 파일명 + .xlsx — XLSX.writeFile 이 브라우저에서 다운로드 처리
  XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
}

export function fmtDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

// 동일 폭 컬럼 배열 생성
export function uniformCols(count: number, width = 12): XLSX.ColInfo[] {
  return Array.from({ length: count }, () => ({ wch: width }));
}

// 가변 폭 컬럼 (양식별로 컬럼 의미가 달라서 필요)
export function cols(widths: number[]): XLSX.ColInfo[] {
  return widths.map((wch) => ({ wch }));
}

// 행 단위 머지 헬퍼 — { startCol, endCol, row } 입력
export function mergeCells(
  rangeOrList:
    | { r: number; c1: number; c2: number }
    | { r: number; c1: number; c2: number }[],
): XLSX.Range[] {
  const list = Array.isArray(rangeOrList) ? rangeOrList : [rangeOrList];
  return list.map(({ r, c1, c2 }) => ({
    s: { r, c: Math.min(c1, c2) },
    e: { r, c: Math.max(c1, c2) },
  }));
}
