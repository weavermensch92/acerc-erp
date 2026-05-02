'use client';

import {
  downloadWeightCertExcel,
  type WeightCertExcelInput,
} from '@/lib/excel/weight-cert';
import { ExcelButton } from '@/components/erp/ExcelButton';

export function WeightCertExcelButton(props: WeightCertExcelInput) {
  return (
    <ExcelButton
      label="엑셀 저장"
      onExport={() => downloadWeightCertExcel(props)}
    />
  );
}
