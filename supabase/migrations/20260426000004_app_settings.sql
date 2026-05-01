-- 앱 전역 설정 (key/value)
-- 첫 항목: review_process_enabled (기본 false — 추가 저장 없으면 OFF)

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;

create policy "office_full_access" on public.app_settings
  for all to authenticated using (true) with check (true);
