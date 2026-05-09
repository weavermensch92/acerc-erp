import { z } from 'zod';

export const billingTypeSchema = z.enum(['weight_based', 'internal', 'flat_rate', 'tax_exempt']);
export const directionSchema = z.enum(['in', 'out']);
export const logStatusSchema = z.enum(['draft', 'pending_review', 'active', 'archived']);

const baseLogShape = {
  log_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다'),
  direction: directionSchema,
  company_id: z.string().uuid('거래처를 선택하거나 새로 등록하세요'),
  site_name: z.string().max(100).optional().nullable(),
  waste_type_name: z.string().min(1, '성상을 입력하세요').max(100),
  treatment_plant_name: z.string().max(100).optional().nullable(),
  vehicle_no: z.string().max(20).optional().nullable(),
  weight_total_kg: z.number().nonnegative().nullable().optional(),
  weight_tare_kg: z.number().nonnegative().nullable().optional(),
  weight_kg: z.number().nonnegative().nullable().optional(),
  unit_price: z.number().int().nonnegative().nullable().optional(),
  transport_fee: z.number().int().nonnegative().default(0),
  billing_type: billingTypeSchema,
  payment_method: z.string().max(50).optional().nullable(),
  is_invoiced: z.boolean().optional(),
  is_paid: z.boolean().optional(),
  note: z.string().max(500).optional().nullable(),
};

const baseLogSchema = z.object(baseLogShape);

const billingRefine = (data: { billing_type: string; weight_kg?: number | null; unit_price?: number | null }) => {
  if (data.billing_type === 'internal') return true;
  if (data.billing_type === 'flat_rate') {
    return (data.unit_price ?? 0) > 0;
  }
  return (data.weight_kg ?? 0) > 0 && (data.unit_price ?? 0) >= 0;
};

const billingError = { message: '청구 타입에 맞는 중량/단가를 입력하세요', path: ['weight_kg'] };

export const wasteLogCreateSchema = baseLogSchema.refine(billingRefine, billingError);
export type WasteLogCreateInput = z.infer<typeof wasteLogCreateSchema>;

export const wasteLogUpdateSchema = baseLogSchema
  .extend({
    change_reason: z.string().max(500).optional().nullable(),
  })
  .refine(billingRefine, billingError);
export type WasteLogUpdateInput = z.infer<typeof wasteLogUpdateSchema>;
