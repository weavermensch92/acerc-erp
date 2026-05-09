# Single Source of Truth — `waste_logs`

이 ERP 의 모든 거래·매출·매입·미수금/미지급·일보·인쇄 양식은 단일 테이블 `waste_logs` 를 출처로 합니다.

## 원칙

1. **`waste_logs` 가 모든 거래 데이터의 단일 진실 원천 (SSOT) 이다.**
   - 거래명세표 / 처리확인서 / 계량증명서 / 대시보드 / 지급관리 / 미수금/미지급 정리 — 모두 `waste_logs` 를 라이브 SELECT 한다.
   - 마스터 데이터 (`companies`, `sites`, `waste_types`, `treatment_plants`, 자사정보) 도 라이브 참조.

2. **모든 페이지는 SSR + `force-dynamic`.**
   - 매 요청마다 DB 에서 직접 조회 → 일보 편집 즉시 모든 화면 반영.

3. **소프트 삭제만 사용 (`status='archived'`).**
   - 모든 라이브 SELECT 는 `.neq('status', 'archived')` 필터.
   - 감사 이력 (`audit_logs`) 보존, 복원 가능.

4. **편집 경로:**
   - **일보 단건**: `/logs/[id]/edit` — 모든 필드 (날짜, 거래처, 현장, 성상, 처리장, 차량, 중량, 단가, 운반비, 청구타입, **결제수단, 청구·결제 플래그**, 비고).
   - **인라인 일괄**: `/invoices` 와 `/payouts` 의 EditableInvoiceTable — 가격·중량·청구·결제·비고.
   - **/pending**: 거래처 단위 일괄 청구·결제 처리.

5. **Cascade revalidation:**
   - `actions/waste-logs.ts` 의 모든 mutation 액션은 `revalidateAllAffectedByLog(id?)` 호출.
   - 무효화 대상: `/logs`, `/logs/[id]`, `/dashboard`, `/invoices`, `/payouts`, `/pending`, `/snapshots`.

## 의도적 예외 (스냅샷 / denormalization)

- **이미 발급되어 다운로드된 PDF / Excel 파일** — 발급 시점 스냅샷. 사후 일보 편집에 영향 없음 (회계 표준).
- **`waste_logs.treatment_plant_name_snapshot`** — 처리장 마스터 삭제(detach) 시 일보의 처리장 이름 보존용. FK 가 정상이면 NULL.
- **`pdf_downloads`, `invoice_batches`, `snapshots`** 테이블 — 발급/스냅샷 이력. 일보가 변경되어도 과거 발급 기록은 유지.

## 마스터 정보 변경의 파급

- `companies.name` 등 변경 → 모든 화면에 즉시 반영 (라이브 JOIN).
- `companies` 동일 이름 활성 등록은 부분 UNIQUE INDEX 로 차단 (`uniq_companies_name_active`).
- `companies` 소프트 삭제 시 `share_token` 도 nullify, 일보는 보존.
