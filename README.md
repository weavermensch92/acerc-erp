# 폐기물일보 ERP — apps/web

(주)에이스알앤씨 폐기물 ERP 1차 MVP. PRD([../../waste-erp-prd.md](../../waste-erp-prd.md)) **시나리오 1 + 2 + 3** 구현.

## 스택

- Next.js 14 App Router + TypeScript (strict)
- Supabase (로컬 Docker — Postgres / Auth)
- Tailwind CSS + shadcn 컴포넌트
- React Hook Form + Zod, lucide-react, date-fns(ko), nanoid
- 포트: **3003**

## 8 Day Plan — 완료 상태

- [x] **Day 1**: 프로젝트 셋업 + UI 컴포넌트 (shadcn 7 + ERP 4)
- [x] **Day 2**: Supabase 마이그레이션 3 + seed (6 테이블, 인덱스, 트리거, RLS)
- [x] **Day 3**: lib 모듈 + middleware + login (Supabase Auth)
- [x] **Day 4**: dashboard (StatCard 4 + 검토 배너) + logs 목록 (필터 칩 + 테이블)
- [x] **Day 5**: logs/new — **시나리오 2** (자동완성 + 자동계산 + 인라인 거래처 등록)
- [x] **Day 6**: logs/[id] — **시나리오 1** (승인 / 반려 + 다음 pending 자동 이동)
- [x] **Day 7**: share/[token] + API Route — **시나리오 3** (모바일 반응형, 인증 X)
- [x] **Day 8**: README + 워크스루 가이드

---

## 부팅

### 1. 의존성 설치

```bash
cd apps/web
npm install                     # ~30초
```

### 2. Supabase 로컬 (Docker Desktop 필요)

```bash
npx supabase init               # Y/N → n n
npm run db:start                # 컨테이너 부팅 (첫 실행 ~5분)
                                # → ANON_KEY, SERVICE_ROLE_KEY 출력
```

**Docker Desktop 이슈** (`dockerInference` 잠금) 발생 시:
1. Docker Desktop Quit
2. PowerShell: `Rename-Item "$env:LOCALAPPDATA\Docker\run" "run_old"`
3. Docker Desktop 재실행
4. `npm run db:start` 재시도

### 3. .env.local 작성

```bash
cp .env.local.example .env.local
# 편집기로 열어 ANON_KEY / SERVICE_ROLE_KEY 채움
```

### 4. 마이그레이션 + seed 적용

```bash
npm run db:reset
```

### 5. 공용 계정 생성

Studio (http://127.0.0.1:54323) → **Authentication** → **Add user**:
- Email: `office@acerc.local`
- Password: `password123`
- "Auto Confirm User" 체크

### 6. dev 서버

```bash
npm run dev                     # http://localhost:3003
```

---

## 워크스루 검증

### 시나리오 2 (일보 입력)
1. `http://localhost:3003` → `/login` 자동 이동 → `office@acerc.local` / `password123`
2. `/dashboard` → 검토 대기 배너 (2건) + StatCard 4 표시 확인
3. **[+ 새 일보 입력]** 클릭 → `/logs/new`
4. 거래처 입력란에 **"구"** 타이핑 → 300ms 후 **구국토건** 후보 표시
5. 구국토건 선택 → 단가 70 자동 채움, 공사현장에 **포항여고** 후보
6. 성상 **폐목재** 선택, 중량 **490** 입력
7. 우측 박스 — `공급가액 ₩34,300 / 부가세 ₩3,430 / 청구금액 ₩37,730` 표시 확인 (PRD § 시나리오 2 정확값)
8. **[저장]** → `/logs/[id]` 로 이동, 변경 이력에 `create` 행 자동 기록 확인

**자동완성 신규 등록**: "테스트건설" 같은 새 이름 입력 → "+ 새 거래처 등록" 클릭 → 모달에서 등록 → 즉시 폼에 반영.

### 시나리오 1 (검토 승인)
1. `/dashboard` → "검토 대기 2건" 노란 배너 → 클릭
2. `/logs?status=pending_review` → 2 건 표시 (대성건설 4/25)
3. 첫 행 클릭 → `/logs/[id]`, [승인] / [반려] 버튼 노출
4. **[승인]** → 다음 pending 으로 자동 이동
5. 마지막 [승인] → `/logs?status=pending_review` 복귀, 0 건
6. Studio `audit_logs` 테이블 → `before_data.status='pending_review'`, `after_data.status='active'` 행 확인

**반려 시나리오**: 다른 일보 → [반려] → 사유 입력 → status `archived` + audit_logs 에 `change_reason='반려: ...'` 기록.

### 시나리오 3 (거래처 셀프)
1. 시크릿 창으로 `http://localhost:3003/share/gukgo-abc123def456` 접속
2. 로그인 페이지 안 뜨고 즉시 거래내역 표시 — 헤더 "구국토건 — (주)에이스알앤씨"
3. 요약 카드 3 + 4 월분 거래 4 건 표시 (구국토건 행만)
4. 잘못된 토큰 (`/share/invalid123abc`) → 404
5. 모바일 뷰포트 (devtools, 390px) → 카드 리스트로 전환

---

## 디렉토리

```
apps/web/
├─ app/
│  ├─ (office)/                 사무직원 영역 (인증 보호)
│  │  ├─ layout.tsx             Shell (사이드바 + pendingCount 배지)
│  │  ├─ dashboard/page.tsx     검토 배너 + StatCard 4
│  │  └─ logs/
│  │     ├─ page.tsx            목록 + 필터 칩
│  │     ├─ new/                시나리오 2
│  │     │  ├─ page.tsx         RSC, masters fetch
│  │     │  └─ _form.tsx        Client, RHF + 자동완성 + 자동계산
│  │     └─ [id]/               시나리오 1
│  │        ├─ page.tsx         상세 (read-only)
│  │        └─ _actions.tsx     승인 / 반려 패널
│  ├─ (auth)/login/page.tsx     Supabase Auth 로그인
│  ├─ share/[token]/page.tsx    시나리오 3 (인증 X, 모바일 우선)
│  ├─ api/
│  │  ├─ companies/typeahead/   자동완성 GET
│  │  └─ share/[token]/         외부 PDF/엑셀 toolchain 용 (Phase 2)
│  ├─ layout.tsx                루트 (lang=ko, 폰트)
│  └─ globals.css
├─ components/
│  ├─ ui/                       shadcn 7
│  └─ erp/                      Shell, PageHeader, Pill, StatCard,
│                               Modal, CompanyTypeaheadField, CompanyCreateDialog
├─ lib/
│  ├─ supabase/{server,admin,browser}.ts
│  ├─ calc/billing.ts           PRD § 시나리오 2 공식 4 분기
│  ├─ validation/waste-log.ts   zod 스키마
│  ├─ typeahead/companies.ts    부분일치 + 빈도 정렬
│  ├─ types/database.ts
│  ├─ hooks/use-debounced-value.ts
│  ├─ format.ts                 KRW / Kg / 한국 날짜
│  └─ utils.ts
├─ actions/
│  ├─ auth.ts                   signIn / signOut
│  ├─ waste-logs.ts             create / approve / reject
│  └─ companies.ts              createCompanyInline
├─ middleware.ts                인증 보호 (share / api/share / login 우회)
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/               20260426000001~3
│  └─ seed.sql                  거래처 3, 성상 5, 처리장 2, 일보 6
└─ public/fonts/                (Phase 2 — local woff2 임베드, 현재 next/font/google)
```

---

## 알려진 한계 / Phase 2

- **수정 기능**: 정식 등록(`active`) 일보의 수정은 Phase 2 (시나리오 7 — 다운로드 이력 알림 포함)
- **PDF**: 처리확인서 / 계량증명서 / 거래명세표 (시나리오 4/5/6)
- **사진 업로드 + 일회용 링크**: 시나리오 2 의 토글 기능
- **엑셀 마이그레이션** (시나리오 8) / **일자별 스냅샷** (시나리오 9)
- **PWA / 오프라인** / **홈택스** / **팝빌**
- 자동완성 빈도 계산은 in-memory 집계 — 거래 1만+ 시 RPC 또는 materialized view 필요
- 사이트 마스터 관리 페이지 미구현 (인라인 등록은 거래처만)

## 참고

- 단일 진실의 원천: [waste-erp-prd.md](../../waste-erp-prd.md)
- 디자인 자산: [../../ERP/screens/](../../ERP/screens/)
- 구현 plan: `C:\Users\K\.claude\plans\iterative-gathering-blossom.md`
