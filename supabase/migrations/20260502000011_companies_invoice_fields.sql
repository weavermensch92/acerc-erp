-- 홈택스 전자세금계산서 일괄발행 양식에 필요한 거래처(공급받는자) 보완 필드
-- 모두 nullable — 기존 데이터/입력 흐름 유지 (필요시 사용자가 채움).

alter table public.companies
  add column if not exists representative text,
  add column if not exists business_type text,
  add column if not exists business_item text,
  add column if not exists email text;

comment on column public.companies.representative is '대표자명 (홈택스 세금계산서 공급받는자 성명)';
comment on column public.companies.business_type is '업태 (예: 제조업)';
comment on column public.companies.business_item is '종목 (예: 폐기물 처리)';
comment on column public.companies.email is '세금계산서 수신용 이메일';
