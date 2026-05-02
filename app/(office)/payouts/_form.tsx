'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { formatMonth } from '@/lib/format';

interface PlantOption {
  id: string;
  name: string;
}

interface Props {
  plants: PlantOption[];
  defaultPlant?: string;
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

export function PayoutForm({
  plants,
  defaultPlant = '',
  defaultPeriod,
  hasPreview,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [plantId, setPlantId] = useState(defaultPlant);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [period, setPeriod] = useState(defaultPeriod ?? currentMonth);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plantId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('plant', plantId);
    params.set('period', period);
    startTransition(() => {
      router.push(`/payouts?${params.toString()}`);
    });
  };

  const handleReset = () => {
    setPlantId('');
    setPeriod(currentMonth);
    router.push('/payouts');
  };

  const monthOptions = buildMonthOptions();

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="po-plant">처리장</Label>
        <Select
          id="po-plant"
          value={plantId}
          onChange={(e) => setPlantId(e.target.value)}
          className="min-w-[220px]"
        >
          <option value="">선택…</option>
          {plants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="po-period">기간 (월)</Label>
        <Select
          id="po-period"
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
      <Button type="submit" disabled={isPending || !plantId}>
        {isPending ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Search className="mr-1 h-4 w-4" strokeWidth={1.75} />
        )}
        조회
      </Button>
      {(plantId || hasPreview) && (
        <Button type="button" variant="ghost" onClick={handleReset}>
          초기화
        </Button>
      )}
    </form>
  );
}
