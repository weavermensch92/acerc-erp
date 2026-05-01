'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Search, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { formatMonth } from '@/lib/format';

interface CompanyOption {
  id: string;
  name: string;
}

interface Props {
  companies: CompanyOption[];
  defaultCompany?: string;
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
  defaultCompany = '',
  defaultPeriod,
  hasPreview,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [companyId, setCompanyId] = useState(defaultCompany);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [period, setPeriod] = useState(defaultPeriod ?? currentMonth);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('company', companyId);
    params.set('period', period);
    startTransition(() => {
      router.push(`/invoices?${params.toString()}`);
    });
  };

  const handleReset = () => {
    setCompanyId('');
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
            onChange={(e) => setCompanyId(e.target.value)}
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
