// DB 타입 정의 — supabase gen types typescript 결과 대신 수동 작성
// (CLI 가용 시 `supabase gen types typescript --local > lib/types/database.generated.ts` 권장)

export type Direction = 'in' | 'out';
export type BillingType = 'weight_based' | 'internal' | 'flat_rate' | 'tax_exempt';
export type LogStatus = 'draft' | 'pending_review' | 'active' | 'archived';
export type AuditAction = 'create' | 'update' | 'delete' | 'restore';

export interface Company {
  id: string;
  name: string;
  business_no: string | null;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  representative: string | null;
  business_type: string | null;
  business_item: string | null;
  email: string | null;
  share_token: string | null;
  default_unit_price: number | null;
  is_internal: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WasteType {
  id: string;
  name: string;
  default_unit_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface TreatmentPlant {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface WasteLog {
  id: string;
  log_date: string;
  direction: Direction;
  company_id: string;
  site_id: string | null;
  waste_type_id: string;
  treatment_plant_id: string | null;
  treatment_plant_name_snapshot: string | null;
  vehicle_no: string | null;
  weight_kg: number | null;
  weight_total_kg: number | null;
  weight_tare_kg: number | null;
  unit_price: number | null;
  transport_fee: number | null;
  billing_type: BillingType;
  supply_amount: number | null;
  vat: number | null;
  total_amount: number | null;
  is_invoiced: boolean;
  is_paid: boolean;
  payment_method: string | null;
  status: LogStatus;
  photo_required: boolean;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  waste_log_id: string;
  file_url: string;
  file_path: string;
  file_type: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export type FieldLinkStatus = 'active' | 'used' | 'expired' | 'revoked';

export interface FieldUploadLink {
  id: string;
  token: string;
  waste_log_id: string;
  recipient_name: string | null;
  status: FieldLinkStatus;
  expires_at: string;
  used_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Snapshot {
  id: string;
  snapshot_date: string;
  log_count: number;
  company_count: number;
  total_amount: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  change_reason: string | null;
  changed_by: string | null;
  changed_at: string;
}

export type DownloadType = 'invoice' | 'cert' | 'weight_cert' | 'excel';

export interface InvoiceBatch {
  id: string;
  period_from: string;
  period_to: string;
  company_count: number;
  total_amount: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PdfDownload {
  id: string;
  company_id: string;
  download_type: DownloadType;
  period_from: string | null;
  period_to: string | null;
  waste_log_id: string | null;
  batch_id: string | null;
  downloaded_at: string;
  downloaded_by: string | null;
  share_token_used: string | null;
}
