-- 1) 거래처(companies) 활성 행에 한해 이름 중복 방지 (소프트 삭제된 동명은 허용)
create unique index if not exists uniq_companies_name_active
  on public.companies (lower(trim(name)))
  where is_deleted = false;

comment on index public.uniq_companies_name_active is
  '활성 거래처의 동일 이름 중복 등록 차단 (소프트 삭제된 거래처는 제외)';

-- 2) 처리확인서 ②처리자(자사) 표시용 자사정보 보강
-- self_company_info 는 app_settings 의 jsonb 값으로 저장됨 — 스키마는 lib/company-info.ts 의 zod 로 강제.
-- 별도 컬럼 추가는 필요 없음. (이 마이그레이션은 거래처 unique 만 담당.)
