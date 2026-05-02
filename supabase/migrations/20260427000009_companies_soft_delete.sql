-- 거래처 soft delete — 기존 일보 보존, 신규 입력·자동완성에서만 제외
-- waste_logs.company_id FK 는 그대로 유지 (CASCADE 안 함)

alter table public.companies
  add column if not exists is_deleted boolean not null default false;

alter table public.companies
  add column if not exists deleted_at timestamptz;

-- 활성 거래처 검색 가속 (목록·자동완성)
create index if not exists idx_companies_active
  on public.companies (name) where is_deleted = false;

-- 삭제 시 share_token 도 자동 nullify 보장 (애플리케이션 레벨 + 안전망)
-- (정책상 service_role 만 update, 일반 흐름은 deleteCompanyAction 경유)
