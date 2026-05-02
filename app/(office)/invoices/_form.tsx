'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Loader2, Search, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { DateRangePicker } from '@/components/erp/DateRangePicker';

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
          <Select
            id="inv-company"
            value={companyId}
            onChange={(e) => handleCompanyChange(e.target.value)}
            className="min-w-[220px]"
          >
            <option value="">선택…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-site">현장 (선택)</Label>
          <Select
            id="inv-site"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            disabled={!companyId || siteOptions.length === 0}
            className="min-w-[200px]"
          >
            <option value="">— 전체 —</option>
            {siteOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
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
