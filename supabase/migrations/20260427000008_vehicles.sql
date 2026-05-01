-- 차량 마스터 — 차량별 공차중량 기억
-- 일보 입력 시 차량번호 입력하면 마지막 공차 자동 채움 (수정 가능)

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  vehicle_no text not null unique,
  default_tare_kg numeric(10, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.vehicles is '차량 마스터 — vehicle_no 별 default_tare_kg(공차중량) 캐시';

create index idx_vehicles_no on public.vehicles (vehicle_no);

create trigger trg_vehicles_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

alter table public.vehicles enable row level security;

create policy "office_full_access" on public.vehicles
  for all to authenticated using (true) with check (true);

-- 기존 waste_logs 의 vehicle_no + weight_tare_kg 조합으로 vehicles 초기 채움
insert into public.vehicles (vehicle_no, default_tare_kg)
select distinct on (vehicle_no)
  vehicle_no,
  weight_tare_kg
from public.waste_logs
where vehicle_no is not null
  and trim(vehicle_no) != ''
  and weight_tare_kg is not null
order by vehicle_no, log_date desc, created_at desc
on conflict (vehicle_no) do nothing;
