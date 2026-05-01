-- 시나리오 4 풀 — 거래명세표 일괄 발급 + 다운로드 이력 (시나리오 7 의존)
-- PRD § 5.2.9 pdf_downloads + invoice_batches (PRD 보완)

-- ========================================
-- invoice_batches — 일괄 발급 그룹
-- ========================================
create table public.invoice_batches (
  id uuid primary key default gen_random_uuid(),
  period_from date not null,
  period_to date not null,
  company_count int not null default 0,
  total_amount bigint not null default 0,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);

comment on table public.invoice_batches is '거래명세표 일괄 발급 그룹 (다중 거래처 묶음)';

create index idx_batches_created on public.invoice_batches (created_at desc);

alter table public.invoice_batches enable row level security;
create policy "office_full_access" on public.invoice_batches
  for all to authenticated using (true) with check (true);

-- ========================================
-- pdf_downloads — 발급/다운로드 이력 (시나리오 4 batch + 시나리오 7 알림)
-- ========================================
create table public.pdf_downloads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  download_type text not null
    check (download_type in ('invoice', 'cert', 'weight_cert', 'excel')),
  period_from date,
  period_to date,
  waste_log_id uuid references public.waste_logs(id) on delete set null,
  batch_id uuid references public.invoice_batches(id) on delete set null,
  downloaded_at timestamptz not null default now(),
  downloaded_by text,
  share_token_used text
);

comment on table public.pdf_downloads is '거래명세표 / 처리확인서 등 발급 + 다운로드 이력';
comment on column public.pdf_downloads.downloaded_by is 'office_batch | office_single | company_self';

create index idx_pdf_downloads_company_period
  on public.pdf_downloads (company_id, period_from, period_to);
create index idx_pdf_downloads_batch on public.pdf_downloads (batch_id);
create index idx_pdf_downloads_recent
  on public.pdf_downloads (company_id, downloaded_at desc);

alter table public.pdf_downloads enable row level security;
create policy "office_full_access" on public.pdf_downloads
  for all to authenticated using (true) with check (true);
-- service_role (share 페이지 셀프 다운로드용) 은 RLS 우회 자동
