import Link from 'next/link';
import { FileSpreadsheet, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/erp/PageHeader';
import { getReviewProcessEnabled, getSelfCompanyInfo } from '@/lib/settings';
import { ReviewProcessToggle } from './_review-toggle';
import { SelfCompanyForm } from './_self-company-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [reviewEnabled, selfCompany] = await Promise.all([
    getReviewProcessEnabled(),
    getSelfCompanyInfo(),
  ]);

  return (
    <>
      <PageHeader
        title="설정"
        subtitle="앱 전역 동작 옵션"
        breadcrumb={[{ label: '에이스알앤씨' }, { label: '설정' }]}
      />
      <div className="flex-1 overflow-y-auto p-7">
        <div className="max-w-2xl space-y-5">
          <section className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
            <h3 className="text-[13px] font-semibold tracking-tight">자사 정보</h3>
            <p className="mt-1 text-xs text-foreground-muted">
              거래명세표 · 처리확인서 · 계량증명서 등 발급 문서의 <span className="text-foreground">공급자</span> 영역에 표시됩니다.
            </p>
            <div className="mt-4">
              <SelfCompanyForm initial={selfCompany} />
            </div>
          </section>

          <section className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
            <h3 className="text-[13px] font-semibold tracking-tight">검토 프로세스</h3>
            <p className="mt-1 text-xs text-foreground-muted">
              현장에서 입력된 일보를 사무직원이 검토 후 승인/반려하는 워크플로우.
              꺼두면 모든 일보가 바로 정식 등록되며 검토 대기 배너 / 승인 버튼이 숨겨집니다.
            </p>
            <div className="mt-4">
              <ReviewProcessToggle initialEnabled={reviewEnabled} />
            </div>
          </section>

          <section className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
            <h3 className="text-[13px] font-semibold tracking-tight">데이터 마이그레이션</h3>
            <p className="mt-1 text-xs text-foreground-muted">
              기존 운영 중이던 엑셀 / CSV 파일을 일괄 등록합니다. 마스터(거래처·성상·처리장·현장)에
              없는 값은 자동 추가되며, 청구 타입은 PRD 규칙에 따라 자동 추정됩니다.
            </p>
            <Link
              href="/admin/import"
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-background-subtle px-3 py-2 text-xs font-medium hover:bg-surface"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
              엑셀 마이그레이션 열기
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          </section>

          <p className="text-[11px] text-foreground-muted">
            설정값은 모든 사무직원 사용자에게 즉시 반영됩니다 (단일 회사 기준).
          </p>
        </div>
      </div>
    </>
  );
}
