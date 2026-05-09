import { z } from 'zod';

// 자사 정보 — 거래명세표 / 처리확인서 / 계량증명서 등 발급 문서의 공급자 정보.
// /settings 페이지에서 편집, app_settings 테이블에 저장.

export const selfCompanySchema = z.object({
  name: z.string().min(1, '회사명을 입력하세요').max(200),
  business_no: z.string().max(20).optional().nullable(),
  representative: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  fax: z.string().max(20).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  business_type: z.string().max(100).optional().nullable(),
  business_item: z.string().max(100).optional().nullable(),
  permit_no: z.string().max(50).optional().nullable(),
  processing_method: z.string().max(200).optional().nullable(),
  stamp_url: z.string().url().max(2000).optional().nullable(),
  stamp_path: z.string().max(500).optional().nullable(),
});

export type SelfCompanyInfo = z.infer<typeof selfCompanySchema>;

// 처리확인서·거래명세표 처리방법 행 디폴트 — 자사 정보 미입력 시 사용.
export const DEFAULT_PROCESSING_METHOD = '중간가공폐기물제조(재)위탁';

// 초기값 — DB 에 저장된 값 없을 때 사용
export const DEFAULT_SELF_COMPANY: SelfCompanyInfo = {
  name: '(주)에이스알앤씨',
  business_no: '',
  representative: '',
  address: '',
  phone: '',
  fax: '',
  email: '',
  business_type: '폐기물 수집운반·처리업',
  business_item: '폐기물 처리',
  permit_no: '',
  processing_method: DEFAULT_PROCESSING_METHOD,
  stamp_url: null,
  stamp_path: null,
};
