-- 폐기물일보 ERP — 인덱스 + 트리거
-- PRD § 5.3 인덱스 + § 5.4 트리거

-- ========================================
-- 인덱스
-- ========================================
create index idx_waste_logs_date on public.waste_logs (log_date desc);
create index idx_waste_logs_company on public.waste_logs (company_id, log_date desc);
create index idx_waste_logs_status on public.waste_logs (status) where status != 'archived';
create index idx_waste_logs_pending on public.waste_logs (status, log_date desc)
  where status = 'pending_review';
create index idx_companies_share_token on public.companies (share_token) where share_token is not null;
create index idx_sites_company on public.sites (company_id);
create index idx_audit_logs_record on public.audit_logs (table_name, record_id, changed_at desc);

-- ========================================
-- updated_at 자동 갱신 함수 + 트리거 5종
-- ========================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

create trigger trg_sites_updated_at
  before update on public.sites
  for each row execute function public.set_updated_at();

create trigger trg_waste_types_updated_at
  before update on public.waste_types
  for each row execute function public.set_updated_at();

create trigger trg_treatment_plants_updated_at
  before update on public.treatment_plants
  for each row execute function public.set_updated_at();

create trigger trg_waste_logs_updated_at
  before update on public.waste_logs
  for each row execute function public.set_updated_at();

-- ========================================
-- waste_logs 변경이력 자동 기록 (audit_logs)
-- ========================================
create or replace function public.audit_waste_logs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
begin
  -- Supabase Auth JWT 의 email claim 추출 시도 (없으면 'system' fallback)
  actor := coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    'system'
  );

  if (tg_op = 'INSERT') then
    insert into public.audit_logs (table_name, record_id, action, after_data, changed_by)
    values ('waste_logs', new.id, 'create', to_jsonb(new), actor);
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_logs (table_name, record_id, action, before_data, after_data, changed_by)
    values ('waste_logs', new.id, 'update', to_jsonb(old), to_jsonb(new), actor);
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.audit_logs (table_name, record_id, action, before_data, changed_by)
    values ('waste_logs', old.id, 'delete', to_jsonb(old), actor);
    return old;
  end if;
  return null;
end;
$$;

create trigger trg_waste_logs_audit
  after insert or update or delete on public.waste_logs
  for each row execute function public.audit_waste_logs();
