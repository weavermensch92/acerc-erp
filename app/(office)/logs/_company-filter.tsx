'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/erp/SearchableSelect';

interface Company {
  id: string;
  name: string;
}

interface Props {
  companies: Company[];
  defaultValue: string;
  // /logs 페이지 GET 쿼리 보존용
  preserved: Record<string, string | undefined>;
}

export function LogCompanyFilter({ companies, defaultValue, preserved }: Props) {
  const [companyId, setCompanyId] = useState(defaultValue);

  return (
    <form method="get" className="flex flex-nowrap items-center gap-1.5">
      {Object.entries(preserved).map(
        ([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />,
      )}
      <span className="whitespace-nowrap text-[12.5px] font-medium text-foreground-secondary">
        거래처
      </span>
      <SearchableSelect
        name="company"
        value={companyId}
        onChange={setCompanyId}
        options={companies}
        emptyLabel="전체"
        className="h-9 min-w-[200px] text-[13px]"
      />
      <Button type="submit" size="sm" variant="outline" className="h-7">
        적용
      </Button>
    </form>
  );
}
