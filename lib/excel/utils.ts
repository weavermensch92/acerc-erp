import * as XLSX from 'xlsx-js-style';

// 클라이언트에서 워크북을 파일로 저장 (브라우저 다운로드 트리거)
export function writeWorkbookToFile(wb: XLSX.WorkBook, fileName: string) {
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

export function cols(widths: number[]): XLSX.ColInfo[] {
  return widths.map((wch) => ({ wch }));
}

// ──────────────────────────────────────────
// Style 정의 — 화면 양식과 동일한 톤 (테두리 + 음영)
// ──────────────────────────────────────────

const BORDER_BLACK = { style: 'thin' as const, color: { rgb: '000000' } };
const BORDER_THICK = { style: 'medium' as const, color: { rgb: '000000' } };
const BORDER_LIGHT = { style: 'thin' as const, color: { rgb: 'D0D0D0' } };

export const ALL_BORDER = {
  top: BORDER_BLACK,
  bottom: BORDER_BLACK,
  left: BORDER_BLACK,
  right: BORDER_BLACK,
};

export const LIGHT_BORDER = {
  top: BORDER_LIGHT,
  bottom: BORDER_LIGHT,
  left: BORDER_LIGHT,
  right: BORDER_LIGHT,
};

export const BASE_FONT = { name: 'Malgun Gothic', sz: 10 };

export const STYLE_TITLE = {
  font: { ...BASE_FONT, sz: 18, bold: true },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
};

export const STYLE_SUBTITLE = {
  font: { ...BASE_FONT, sz: 10, color: { rgb: '666666' } },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
};

export const STYLE_SECTION_HEADER = {
  font: { ...BASE_FONT, sz: 11, bold: true },
  alignment: { horizontal: 'left' as const, vertical: 'center' as const, indent: 1 },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'F2F2F2' } },
  border: ALL_BORDER,
};

export const STYLE_LABEL = {
  font: { ...BASE_FONT, sz: 10, color: { rgb: '555555' } },
  alignment: { horizontal: 'left' as const, vertical: 'center' as const, indent: 1 },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'FAFAFA' } },
  border: ALL_BORDER,
};

export const STYLE_VALUE = {
  font: BASE_FONT,
  alignment: { horizontal: 'left' as const, vertical: 'center' as const, indent: 1 },
  border: ALL_BORDER,
};

export const STYLE_VALUE_MONO = {
  font: { name: 'Consolas', sz: 10 },
  alignment: { horizontal: 'left' as const, vertical: 'center' as const, indent: 1 },
  border: ALL_BORDER,
};

export const STYLE_TABLE_HEADER = {
  font: { ...BASE_FONT, sz: 10, bold: true },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'F2F2F2' } },
  border: ALL_BORDER,
};

export const STYLE_TABLE_CELL = {
  font: BASE_FONT,
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  border: ALL_BORDER,
};

export const STYLE_TABLE_NUM = {
  font: { name: 'Consolas', sz: 10 },
  alignment: { horizontal: 'right' as const, vertical: 'center' as const },
  numFmt: '#,##0',
  border: ALL_BORDER,
};

export const STYLE_TFOOT = {
  font: { ...BASE_FONT, sz: 10, bold: true },
  alignment: { horizontal: 'right' as const, vertical: 'center' as const },
  numFmt: '#,##0',
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'F2F2F2' } },
  border: { ...ALL_BORDER, top: BORDER_THICK },
};

export const STYLE_TFOOT_CENTER = {
  font: { ...BASE_FONT, sz: 10, bold: true },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'F2F2F2' } },
  border: { ...ALL_BORDER, top: BORDER_THICK },
};

export const STYLE_FOOTER_TEXT = {
  font: { ...BASE_FONT, sz: 10 },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
};

export const STYLE_FOOTER_BOLD = {
  font: { ...BASE_FONT, sz: 11, bold: true },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
};

export const STYLE_SUMMARY_LABEL = {
  font: { ...BASE_FONT, sz: 10, color: { rgb: '666666' } },
  alignment: { horizontal: 'left' as const, vertical: 'center' as const, indent: 1 },
  fill: { patternType: 'solid' as const, fgColor: { rgb: 'FAFAFA' } },
  border: ALL_BORDER,
};

export const STYLE_SUMMARY_VALUE = {
  font: { name: 'Consolas', sz: 12, bold: true },
  alignment: { horizontal: 'right' as const, vertical: 'center' as const, indent: 1 },
  numFmt: '"₩"#,##0',
  border: ALL_BORDER,
};

export const STYLE_SUMMARY_PRIMARY_LABEL = {
  font: { ...BASE_FONT, sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
  alignment: { horizontal: 'left' as const, vertical: 'center' as const, indent: 1 },
  fill: { patternType: 'solid' as const, fgColor: { rgb: '111111' } },
  border: ALL_BORDER,
};

export const STYLE_SUMMARY_PRIMARY_VALUE = {
  font: { name: 'Consolas', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
  alignment: { horizontal: 'right' as const, vertical: 'center' as const, indent: 1 },
  numFmt: '"₩"#,##0',
  fill: { patternType: 'solid' as const, fgColor: { rgb: '111111' } },
  border: ALL_BORDER,
};

export const STYLE_SIGN_LABEL = {
  font: { ...BASE_FONT, sz: 9, color: { rgb: '666666' } },
  alignment: { horizontal: 'left' as const, vertical: 'top' as const, indent: 1 },
  border: ALL_BORDER,
};

export const STYLE_SIGN_NAME = {
  font: { ...BASE_FONT, sz: 11, bold: true },
  alignment: { horizontal: 'left' as const, vertical: 'center' as const, indent: 1 },
  border: ALL_BORDER,
};

export const STYLE_SIGN_BOX_BOTTOM = {
  border: ALL_BORDER,
};

// 셀 스타일 적용 — addr (e.g. 'A1'), style 객체
export function applyStyle(
  ws: XLSX.WorkSheet,
  addr: string,
  style: Record<string, unknown>,
) {
  if (ws[addr]) {
    ws[addr].s = style;
  } else {
    // 빈 셀이라도 스타일 적용 위해 placeholder 생성
    ws[addr] = { t: 's', v: '', s: style };
  }
}

// 범위에 같은 스타일 적용 — { r1, c1, r2, c2 } (inclusive)
export function applyStyleRange(
  ws: XLSX.WorkSheet,
  range: { r1: number; c1: number; r2: number; c2: number },
  style: Record<string, unknown>,
) {
  for (let r = range.r1; r <= range.r2; r++) {
    for (let c = range.c1; c <= range.c2; c++) {
      applyStyle(ws, XLSX.utils.encode_cell({ r, c }), style);
    }
  }
}

// 행 높이 설정
export function setRowHeights(ws: XLSX.WorkSheet, heights: Record<number, number>) {
  if (!ws['!rows']) ws['!rows'] = [];
  for (const [rIdx, hpt] of Object.entries(heights)) {
    const r = Number(rIdx);
    ws['!rows'][r] = { hpt };
  }
}
