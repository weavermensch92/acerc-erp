-- 일자별 스냅샷 (시나리오 9)
-- 메타데이터만 저장. 실제 시점 데이터는 created_at 기준 fetch.
-- 자동 cron 은 Phase B (Vercel Cron 또는 Supabase Edge Function).

create table public.snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  log_count int not null default 0,
  company_count int not null default 0,
  total_amount bigint not null default 0,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);

comment on table public.snapshots is '일자별 스냅샷 메타 — 그 시점 통계';
comment on column public.snapshots.snapshot_date is '스냅샷 기준일 (일반적으로 created_at 의 날짜)';

create index idx_snapshots_date on public.snapshots (snapshot_date desc);
create index idx_snapshots_created_at on public.snapshots (created_at desc);

alter table public.snapshots enable row level security;

create policy "office_full_access" on public.snapshots
  for all to authenticated using (true) with check (true);
