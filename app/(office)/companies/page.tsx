import Link from 'next/link';
import { Plus, Link2, Building2 } from 'lucide-react';
import { PageHeader } from '@/components/erp/PageHeader';
import { Pill } from '@/components/erp/Pill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { createClient } from '@/lib/supabase/server';
import { formatNumber, formatKRW } from '@/lib/format';
import type { Company } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  deleted?: string;
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const q = searchParams.q?.trim() ?? '';
  const showDeleted = searchParams.deleted === '1';

  let query = supabase.from('companies').select('*').order('name');
  if (showDeleted) {
    query = query.eq('is_deleted', true);
  } else {
    query = query.eq('is_deleted', false);
  }
  if (q) query = query.ilike('name', `%${q}%`);
  const { data: companiesData } = await query;
  const companies = (companiesData ?? []) as Company[];

  // 거래 건수 (active + pending_review)
  const ids = companies.map((c) => c.id);
  const freqMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: counts } = await supabase
      .from('waste_logs')
      .select('company_id')
      .in('company_id', ids)
      .neq('status', 'archived');
    for (const r of (counts ?? []) as { company_id: string }[]) {
      freqMap.set(r.company_id, (freqMap.get(r.company_id) ?? 0) + 1);
    }
  }

  return (
    <>
      <PageHeader
        title="거래처"
        subtitle="배출자 마스터"
        breadcrumb={[{ label: '에이스알앤씨' }, { label: '거래처' }]}
        actions={
          <>
            {showDeleted ? (
              <Link href="/companies">
                <Button size="sm" variant="outline">
                  활성 거래처 보기
                </Button>
              </Link>
            ) : (
              <Link href="/companies?deleted=1">
                <Button size="sm" variant="outline">
                  삭제된 거래처
                </Button>
              </Link>
            )}
            <Link href="/companies/new">
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />새 거래처
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-border bg-surface px-7 py-3">
          <form method="get" className="flex flex-1 items-center gap-2">
            <Input
              name="q"
              defaultValue={q}
              placeholder="거래처명 검색…"
              className="max-w-sm"
            />
            <Button type="submit" variant="outline" size="sm">
              검색
            </Button>
            {q && (
              <Link href="/companies">
                <Button type="button" variant="ghost" size="sm">
                  초기화
                </Button>
              </Link>
            )}
          </form>
          <span className="text-[11px] text-foreground-muted">
            {showDeleted ? '삭제됨' : '활성'} {companies.length}곳
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-7">
          {companies.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
              <Building2
                className="mx-auto h-8 w-8 text-foreground-muted"
                strokeWidth={1.5}
              />
              <p className="mt-2 text-sm text-foreground-muted">
                {q ? '검색 결과가 없습니다.' : '등록된 거래처가 없습니다.'}
              </p>
              <Link
                href="/companies/new"
                className="mt-3 inline-block text-sm font-medium text-foreground underline"
              >
                새 거래처 등록 →
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>사업자번호</TableHead>
                    <TableHead>담당자</TableHead>
                    <TableHead className="text-right">기본단가</TableHead>
                    <TableHead className="text-right">거래 건수</TableHead>
                    <TableHead>공유링크</TableHead>
                    <TableHead>구분</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((c) => {
                    const wrap = (children: React.ReactNode) => (
                      <Link href={`/companies/${c.id}`} className="block">
                        {children}
                      </Link>
                    );
                    return (
                      <TableRow key={c.id} className="cursor-pointer">
                        <TableCell className="font-medium">
                          {wrap(c.name)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {wrap(c.business_no ?? '—')}
                        </TableCell>
                        <TableCell className="text-foreground-secondary">
                          {wrap(
                            c.contact_name ? (
                              <span>
                                {c.contact_name}
                                {c.contact_phone && (
                                  <span className="ml-1.5 text-[11px] text-foreground-muted">
                                    {c.contact_phone}
                                  </span>
                                )}
                              </span>
                            ) : (
                              '—'
                            ),
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {wrap(
                            c.default_unit_price !== null
                              ? formatKRW(c.default_unit_price)
                              : '—',
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {wrap(formatNumber(freqMap.get(c.id) ?? 0))}
                        </TableCell>
                        <TableCell>
                          {wrap(
                            c.share_token ? (
                              <Pill tone="info" dot>
                                <Link2 className="mr-0.5 h-3 w-3" strokeWidth={1.75} />
                                활성
                              </Pill>
                            ) : (
                              <Pill tone="neutral">미발급</Pill>
                            ),
                          )}
                        </TableCell>
                        <TableCell>
                          {wrap(
                            c.is_internal ? (
                              <Pill tone="primary">자사</Pill>
                            ) : (
                              <Pill tone="neutral">외부</Pill>
                            ),
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
