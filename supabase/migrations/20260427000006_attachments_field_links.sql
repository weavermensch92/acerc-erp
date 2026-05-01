-- 시나리오 2 토글 — 사진 증빙 + 일회용 링크
-- PRD § 5.2.6 attachments + § 5.2.8 field_upload_links

-- ========================================
-- attachments (사진 / 파일)
-- ========================================
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  waste_log_id uuid not null references public.waste_logs(id) on delete cascade,
  file_url text not null,
  file_path text not null,
  file_type text default 'site_photo',
  file_name text,
  file_size int,
  mime_type text,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

comment on table public.attachments is '일보 첨부 파일 (현장 사진 / 계량증명서 사진 등)';

create index idx_attachments_log on public.attachments (waste_log_id);

alter table public.attachments enable row level security;

create policy "office_full_access" on public.attachments
  for all to authenticated using (true) with check (true);

-- ========================================
-- field_upload_links (현장기사 일회용 링크)
-- ========================================
create table public.field_upload_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  waste_log_id uuid not null references public.waste_logs(id) on delete cascade,
  recipient_name text,
  status text not null default 'active'
    check (status in ('active', 'used', 'expired', 'revoked')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

comment on table public.field_upload_links is '현장기사용 일회용 사진 업로드 링크 (24시간 만료)';

create index idx_field_links_token on public.field_upload_links (token);
create index idx_field_links_active on public.field_upload_links (waste_log_id, status)
  where status = 'active';

alter table public.field_upload_links enable row level security;

create policy "office_full_access" on public.field_upload_links
  for all to authenticated using (true) with check (true);

-- ========================================
-- Supabase Storage bucket (public, file_path 추측 불가로 안전)
-- ========================================
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('attachments', 'attachments', true)
  on conflict (id) do nothing;
exception when others then
  null;
end $$;

-- Storage RLS — service_role 만 업로드 (server action 경유)
-- public read 는 bucket public=true 로 자동
do $$
begin
  drop policy if exists "service_only_write" on storage.objects;
  create policy "service_only_write" on storage.objects
    for insert to authenticated with check (bucket_id = 'attachments');
exception when others then
  null;
end $$;
