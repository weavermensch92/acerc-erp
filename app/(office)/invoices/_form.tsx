'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Loader2, Search, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from '@/components/erp/DateRangePicker';
import { SearchableSelect } from '@/components/erp/SearchableSelect';

interface CompanyOption {
  id: string;
  name: string;
}

interface SiteOption {
  id: string;
  name: string;
  company_id: string;
}

interface Props {
  companies: CompanyOption[];
  sites: SiteOption[];
  defaultCompany?: string;
  defaultSite?: string;
  defaultFrom: string;
  defaultTo: string;
  hasPreview: boolean;
}

export function InvoiceForm({
  companies,
  sites,
  defaultCompany = '',
  defaultSite = '',
  defaultFrom,
  defaultTo,
  hasPreview,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [companyId, setCompanyId] = useState(defaultCompany);
  const [siteId, setSiteId] = useState(defaultSite);

  const siteOptions = useMemo(
    () => (companyId ? sites.filter((s) => s.company_id === companyId) : []),
    [sites, companyId],
  );

  const handleCompanyChange = (next: string) => {
    setCompanyId(next);
    setSiteId('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('company', companyId);
    if (siteId) {
      params.set('site', siteId);
    } else {
      params.delete('site');
    }
    // from/to 는 DateRangePicker 가 이미 URL 에 써둔 값을 유지
    if (!params.get('from')) params.set('from', defaultFrom);
    if (!params.get('to')) params.set('to', defaultTo);
    // 기존 period 키는 정리
    params.delete('period');
    startTransition(() => {
      router.push(`/invoices?${params.toString()}`);
    });
  };

  const handleReset = () => {
    setCompanyId('');
    setSiteId('');
    router.push('/invoices');
  };

  return (
    <div className="flex flex-wrap items-end gap-3 print:hidden">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="inv-company">거래처</Label>
          <SearchableSelect
            id="inv-company"
            value={companyId}
            onChange={handleCompanyChange}
            options={companies}
            emptyLabel="거래처 검색…"
            className="min-w-[220px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-site">현장 (선택)</Label>
          <SearchableSelect
            id="inv-site"
            value={siteId}
            onChange={setSiteId}
            options={siteOptions}
            emptyLabel={companyId ? '현장 검색 (전체)' : '거래처 먼저 선택'}
            disabled={!companyId || siteOptions.length === 0}
            className="min-w-[200px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label>기간</Label>
          <DateRangePicker from={defaultFrom} to={defaultTo} />
        </div>
        <Button type="submit" disabled={isPending || !companyId}>
          {isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-1 h-4 w-4" strokeWidth={1.75} />
          )}
          조회
        </Button>
        {(companyId || hasPreview) && (
          <Button type="button" variant="ghost" onClick={handleReset}>
            초기화
          </Button>
        )}
      </form>
      {hasPreview && (
        <Button
          type="button"
          variant="outline"
          onClick={() => window.print()}
          className="ml-auto"
        >
          <Printer className="mr-1 h-4 w-4" strokeWidth={1.75} />
          인쇄 / PDF 저장
        </Button>
      )}
    </div>
  );
}
