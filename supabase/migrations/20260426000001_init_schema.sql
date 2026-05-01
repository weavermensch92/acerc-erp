-- 폐기물일보 ERP — 초기 스키마
-- PRD § 5.2 컬럼 정의 그대로. 1차 MVP 6 테이블만.

-- ========================================
-- 1) companies (거래처)
-- ========================================
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_no text,
  address text,
  contact_name text,
  contact_phone text,
  share_token text unique,
  default_unit_price int,
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.companies is '거래처 (폐기물 배출자)';
comment on column public.companies.share_token is '거래처 셀프 조회 URL 토큰 (nanoid 12자 이상)';
comment on column public.companies.default_unit_price is '거래처별 기본단가 (성상 단가보다 우선)';
comment on column public.companies.is_internal is '자사(사급용) 여부';

-- ========================================
-- 2) sites (공사현장)
-- ========================================
create table public.sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  address text,
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sites is '거래처별 공사현장';

-- ========================================
-- 3) waste_types (성상 마스터)
-- ========================================
create table public.waste_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_unit_price int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.waste_types is '폐기물 성상 마스터 (폐목재 / 폐합성수지 등)';

-- ========================================
-- 4) treatment_plants (처리장 마스터)
-- ========================================
create table public.treatment_plants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.treatment_plants is '폐기물 최종 처리장 마스터';

-- ========================================
-- 5) waste_logs (폐기물일보 — 본체)
-- ========================================
create table public.waste_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  direction text not null check (direction in ('in', 'out')),
  company_id uuid not null references public.companies(id),
  site_id uuid references public.sites(id),
  waste_type_id uuid not null references public.waste_types(id),
  treatment_plant_id uuid references public.treatment_plants(id),
  vehicle_no text,
  weight_kg numeric(10, 2),
  weight_total_kg numeric(10, 2),
  weight_tare_kg numeric(10, 2),
  unit_price int,
  transport_fee int default 0,
  billing_type text not null default 'weight_based'
    check (billing_type in ('weight_based', 'internal', 'flat_rate', 'tax_exempt')),
  supply_amount int default 0,
  vat int default 0,
  total_amount int default 0,
  is_invoiced boolean not null default false,
  is_paid boolean not null default false,
  payment_method text,
  status text not null default 'active'
    check (status in ('draft', 'pending_review', 'active', 'archived')),
  photo_required boolean not null default false,
  note text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.waste_logs is '폐기물 반입/반출 일보 — 일자별 1건 1행';
comment on column public.waste_logs.direction is 'in: 반입(배출자→자사) / out: 반출(자사→처리장)';
comment on column public.waste_logs.weight_kg is '실중량 (보통 total - tare)';
comment on column public.waste_logs.billing_type is 'weight_based(기본) / internal(사급, 0원) / flat_rate(정액) / tax_exempt(면세)';
comment on column public.waste_logs.status is 'draft / pending_review(검토대기) / active(정식) / archived(보관)';

-- ========================================
-- 6) audit_logs (변경이력 — 트리거 자동 기록)
-- ========================================
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('create', 'update', 'delete', 'restore')),
  before_data jsonb,
  after_data jsonb,
  change_reason text,
  changed_by text,
  changed_at timestamptz not null default now()
);

comment on table public.audit_logs is '데이터 변경 이력 (waste_logs 트리거 자동 기록)';

-- audit_logs 는 immutable (UPDATE/DELETE 막음, INSERT 만 허용)
revoke update, delete on public.audit_logs from public, anon, authenticated;
