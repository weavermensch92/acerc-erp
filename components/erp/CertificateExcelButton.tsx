'use client';

import {
  downloadCertificateExcel,
  type CertificateExcelInput,
} from '@/lib/excel/certificate';
import { ExcelButton } from '@/components/erp/ExcelButton';

export function CertificateExcelButton(props: CertificateExcelInput) {
  return (
    <ExcelButton
      label="엑셀 저장"
      onExport={() => downloadCertificateExcel(props)}
    />
  );
}
