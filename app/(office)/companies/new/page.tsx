import { PageHeader } from '@/components/erp/PageHeader';
import { CompanyForm } from '@/components/erp/CompanyForm';

export const dynamic = 'force-dynamic';

export default function NewCompanyPage() {
  return (
    <>
      <PageHeader
        title="새 거래처 등록"
        breadcrumb={[
          { label: '에이스알앤씨' },
          { label: '거래처', href: '/companies' },
          { label: '신규' },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-7">
        <div className="max-w-2xl">
          <CompanyForm
            mode="create"
            defaults={{
              name: '',
              business_no: '',
              address: '',
              contact_name: '',
              contact_phone: '',
              representative: '',
              business_type: '',
              business_item: '',
              email: '',
              default_unit_price: '',
              is_internal: false,
            }}
          />
        </div>
      </div>
    </>
  );
}
