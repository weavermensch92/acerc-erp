import type { BillingType } from '@/lib/types/database';

export interface CalcInput {
  billingType: BillingType;
  weightKg: number | null | undefined;
  unitPrice: number | null | undefined;
  transportFee: number | null | undefined;
}

export interface CalcResult {
  supplyAmount: number;
  vat: number;
  totalAmount: number;
}

// PRD § 7 시나리오 2 자동계산 공식 4 분기.
// 모든 출력은 정수 (Math.round).
export function calcBilling(input: CalcInput): CalcResult {
  const w = Number(input.weightKg ?? 0);
  const p = Number(input.unitPrice ?? 0);
  const t = Number(input.transportFee ?? 0);

  switch (input.billingType) {
    case 'weight_based': {
      const supply = Math.round(w * p + t);
      const vat = Math.round(supply * 0.1);
      return { supplyAmount: supply, vat, totalAmount: supply + vat };
    }
    case 'internal': {
      return { supplyAmount: 0, vat: 0, totalAmount: 0 };
    }
    case 'flat_rate': {
      const supply = Math.round(p);
      const vat = Math.round(supply * 0.1);
      return { supplyAmount: supply, vat, totalAmount: supply + vat };
    }
    case 'tax_exempt': {
      const supply = Math.round(w * p + t);
      return { supplyAmount: supply, vat: 0, totalAmount: supply };
    }
  }
}
