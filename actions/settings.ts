'use server';

import { revalidatePath } from 'next/cache';
import {
  getSelfCompanyInfo,
  setReviewProcessEnabled,
  setSelfCompanyInfo,
} from '@/lib/settings';
import { selfCompanySchema, type SelfCompanyInfo } from '@/lib/company-info';
import { createAdminClient } from '@/lib/supabase/admin';

export interface SettingsActionResult {
  ok: boolean;
  error?: string;
}

export async function toggleReviewProcessAction(
  enabled: boolean,
): Promise<SettingsActionResult> {
  try {
    await setReviewProcessEnabled(enabled);
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '저장 실패' };
  }
}

export async function saveSelfCompanyInfoAction(
  input: SelfCompanyInfo,
): Promise<SettingsActionResult> {
  const parsed = selfCompanySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  try {
    await setSelfCompanyInfo(parsed.data);
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '저장 실패' };
  }
}

// ========================================
// 회사 도장(날인) PNG 업로드 / 삭제
// 거래명세표 / 처리확인서 / 계량증명서의 자사 서명란에 자동 표시
// ========================================
const STAMP_ALLOWED_MIME = ['image/png', 'image/webp'];
const STAMP_MAX_BYTES = 5 * 1024 * 1024; // 5MB

export async function uploadStampAction(
  formData: FormData,
): Promise<SettingsActionResult & { url?: string; path?: string }> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: '파일이 없습니다' };
  }
  if (file.size > STAMP_MAX_BYTES) {
    return { ok: false, error: '파일이 너무 큽니다 (최대 5MB)' };
  }
  if (file.type && !STAMP_ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: 'PNG 또는 WEBP 파일만 가능합니다' };
  }

  const admin = createAdminClient();

  // 기존 도장 삭제 후 새로 업로드
  const current = await getSelfCompanyInfo();
  if (current.stamp_path) {
    await admin.storage.from('attachments').remove([current.stamp_path]);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const filePath = `_branding/stamp-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await admin.storage
    .from('attachments')
    .upload(filePath, buffer, {
      contentType: file.type || 'image/png',
      upsert: true,
    });
  if (uploadErr) {
    return { ok: false, error: `업로드 실패: ${uploadErr.message}` };
  }

  const { data: pub } = admin.storage.from('attachments').getPublicUrl(filePath);

  try {
    await setSelfCompanyInfo({
      ...current,
      stamp_url: pub.publicUrl,
      stamp_path: filePath,
    });
  } catch (e) {
    await admin.storage.from('attachments').remove([filePath]);
    return { ok: false, error: e instanceof Error ? e.message : '저장 실패' };
  }

  revalidatePath('/', 'layout');
  return { ok: true, url: pub.publicUrl, path: filePath };
}

export async function removeStampAction(): Promise<SettingsActionResult> {
  const admin = createAdminClient();
  const current = await getSelfCompanyInfo();
  if (current.stamp_path) {
    await admin.storage.from('attachments').remove([current.stamp_path]);
  }
  try {
    await setSelfCompanyInfo({ ...current, stamp_url: null, stamp_path: null });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '삭제 실패' };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}
