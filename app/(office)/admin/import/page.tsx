import { PageHeader } from '@/components/erp/PageHeader';
import { ImportClient } from './_client';

export const dynamic = 'force-dynamic';

export default function AdminImportPage() {
  return (
    <>
      <PageHeader
        title="엑셀 마이그레이션"
        subtitle="기존 엑셀(.xlsx / .csv) 일괄 등록 — 시나리오 8"
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '설정', href: '/settings' },
          { label: '데이터 마이그레이션' },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-7">
        <ImportClient />
      </div>
    </>
  );
}
