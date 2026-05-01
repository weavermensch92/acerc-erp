-- 폐기물일보 ERP — RLS 정책
-- PRD § 9.2 단순 정책: 사무직원=authenticated 전체 접근 / 거래처 셀프는 service_role 우회

-- ========================================
-- RLS 활성화
-- ========================================
alter table public.companies enable row level security;
alter table public.sites enable row level security;
alter table public.waste_types enable row level security;
alter table public.treatment_plants enable row level security;
alter table public.waste_logs enable row level security;
alter table public.audit_logs enable row level security;

-- ========================================
-- 사무직원 (인증된 사용자) — 전체 접근
-- ========================================
create policy "office_full_access" on public.companies
  for all to authenticated
  using (true) with check (true);

create policy "office_full_access" on public.sites
  for all to authenticated
  using (true) with check (true);

create policy "office_full_access" on public.waste_types
  for all to authenticated
  using (true) with check (true);

create policy "office_full_access" on public.treatment_plants
  for all to authenticated
  using (true) with check (true);

create policy "office_full_access" on public.waste_logs
  for all to authenticated
  using (true) with check (true);

-- ========================================
-- audit_logs: SELECT 는 사무직원만, INSERT 는 트리거 자동 (with check true)
-- ========================================
create policy "office_read_audit" on public.audit_logs
  for select to authenticated
  using (true);

-- 트리거 함수가 SECURITY DEFINER 로 INSERT — RLS 통과 위해 정책 추가
create policy "trigger_insert_audit" on public.audit_logs
  for insert
  with check (true);

-- ========================================
-- 거래처 셀프 / 현장기사: service_role 키가 RLS 자동 우회
-- ========================================
-- 별도 정책 불필요. service_role 은 lib/supabase/admin.ts 에서만 사용.
-- 클라이언트에 노출 절대 금지 (NEXT_PUBLIC_ prefix 안 붙임).
