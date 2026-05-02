-- 처리장 마스터 삭제 시에도 일보에는 처리장 "이름"이 텍스트로 남도록 snapshot 컬럼 추가
-- 사용 흐름:
--   1) 처리장 마스터 삭제 시 affected logs 의 treatment_plant_name_snapshot 에 master.name 저장
--   2) waste_logs.treatment_plant_id = NULL 로 detach
--   3) treatment_plants row DELETE
--   4) 일보 표시 시 fallback: treatment_plants.name (FK 살아있을 때) || treatment_plant_name_snapshot

alter table public.waste_logs
  add column if not exists treatment_plant_name_snapshot text;

comment on column public.waste_logs.treatment_plant_name_snapshot is
  '처리장 마스터 삭제 시 보존되는 이름 텍스트. FK(treatment_plant_id)가 NULL 이면 이 값을 fallback 표시';
