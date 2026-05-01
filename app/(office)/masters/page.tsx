import Link from 'next/link';
import { Box, MapPin, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/erp/PageHeader';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function MastersPage() {
  const supabase = createClient();
  const [wasteTypesRes, plantsRes] = await Promise.all([
    supabase.from('waste_types').select('id', { count: 'exact', head: true }),
    supabase.from('treatment_plants').select('id', { count: 'exact', head: true }),
  ]);

  const cards = [
    {
      href: '/masters/waste-types',
      label: '성상',
      hint: '폐목재 / 폐합성수지 등 — 일보의 성상 + 기본단가',
      Icon: Box,
      count: wasteTypesRes.count ?? 0,
      unit: '종',
    },
    {
      href: '/masters/plants',
      label: '처리장',
      hint: '폐기물 최종 처리 시설 — 반출 일보의 도착지',
      Icon: MapPin,
      count: plantsRes.count ?? 0,
      unit: '곳',
    },
  ] as const;

  return (
    <>
      <PageHeader
        title="마스터"
        subtitle="성상 / 처리장 등 분류 데이터 관리"
        breadcrumb={[{ label: '에이스알앤씨' }, { label: '마스터' }]}
      />
      <div className="flex-1 overflow-y-auto p-7">
        <div className="grid max-w-3xl grid-cols-1 gap-3 md:grid-cols-2">
          {cards.map((c) => {
            const Icon = c.Icon;
            return (
              <Link
                key={c.href}
                href={c.href}
                className="group flex items-start gap-3 rounded-[10px] border border-border bg-surface p-5 shadow-sm transition-colors hover:bg-background-subtle"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-background-subtle">
                  <Icon className="h-5 w-5 text-foreground-secondary" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-tight">{c.label}</h3>
                    <ChevronRight
                      className="h-4 w-4 text-foreground-muted transition-transform group-hover:translate-x-0.5"
                      strokeWidth={1.75}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-foreground-muted">{c.hint}</p>
                  <p className="mt-2 font-mono text-xs text-foreground-secondary">
                    등록 {c.count}
                    {c.unit}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        <p className="mt-5 text-[11px] text-foreground-muted">
          * 거래처는 별도 메뉴 (좌측 <span className="text-foreground">거래처</span>) 에서 관리합니다.
          <br />* 공사현장은 거래처 종속 데이터로 — 거래처 상세 페이지에서 자동 추가됩니다 (일보 입력 시).
        </p>
      </div>
    </>
  );
}
