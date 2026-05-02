'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Loader2, Search, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { formatMonth } from '@/lib/format';

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
  defaultPeriod?: string;
  hasPreview: boolean;
}

function buildMonthOptions() {
  const now = new Date();
  const options: Array<{ value: string; label: string }> = [];
  for (let i = -12; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    options.push({ value, label: formatMonth(d) });
  }
  return options.reverse();
}

export function InvoiceForm({
  companies,
  sites,
  defaultCompany = '',
  defaultSite = '',
  defaultPeriod,
  hasPreview,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [companyId, setCompanyId] = useState(defaultCompany);
  const [siteId, setSiteId] = useState(defaultSite);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [period, setPeriod] = useState(defaultPeriod ?? currentMonth);

  const siteOptions = useMemo(
    () => (companyId ? sites.filter((s) => s.company_id === companyId) : []),
    [sites, companyId],
  );

  const handleCompanyChange = (next: string) => {
    setCompanyId(next);
    // 거래처가 바뀌면 기존 site 선택 무효화
    setSiteId('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('company', companyId);
    params.set('period', period);
    if (siteId) {
      params.set('site', siteId);
    } else {
      params.delete('site');
    }
    startTransition(() => {
      router.push(`/invoices?${params.toString()}`);
    });
  };

  const handleReset = () => {
    setCompanyId('');
    setSiteId('');
    setPeriod(currentMonth);
    router.push('/invoices');
  };

  const monthOptions = buildMonthOptions();

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
          <Label htmlFor="inv-period">기간 (월)</Label>
          <Select
            id="inv-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="min-w-[160px]"
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
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
