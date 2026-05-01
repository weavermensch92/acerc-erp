'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

export interface UploadResult {
  ok: boolean;
  error?: string;
  attachmentId?: string;
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

// 현장기사 업로드 — token 검증 후 admin client 로 RLS 우회 INSERT
export async function uploadFromFieldAction(
  token: string,
  formData: FormData,
): Promise<UploadResult> {
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { ok: false, error: '파일이 없습니다' };
  }
  if (file.size === 0) {
    return { ok: false, error: '빈 파일입니다' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `파일이 너무 큽니다 (최대 10MB)` };
  }
  if (file.type && !ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: `허용되지 않는 형식: ${file.type}` };
  }

  const admin = createAdminClient();

  // 토큰 검증
  const { data: link } = await admin
    .from('field_upload_links')
    .select('id, waste_log_id, status, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!link) return { ok: false, error: '잘못된 링크입니다' };
  if (link.status !== 'active') {
    return { ok: false, error: `링크 상태: ${link.status}` };
  }
  if (new Date(link.expires_at).getTime() < Date.now()) {
    await admin
      .from('field_upload_links')
      .update({ status: 'expired' })
      .eq('id', link.id);
    return { ok: false, error: '링크가 만료되었습니다 (24시간 경과)' };
  }

  // 파일 path: <waste_log_id>/<timestamp>-<random>.<ext>
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filePath = `${link.waste_log_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await admin.storage
    .from('attachments')
    .upload(filePath, buffer, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
  if (uploadErr) {
    return { ok: false, error: `업로드 실패: ${uploadErr.message}` };
  }

  const { data: pub } = admin.storage.from('attachments').getPublicUrl(filePath);

  // attachments INSERT
  const { data: att, error: insErr } = await admin
    .from('attachments')
    .insert({
      waste_log_id: link.waste_log_id,
      file_url: pub.publicUrl,
      file_path: filePath,
      file_type: 'site_photo',
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || 'image/jpeg',
      uploaded_by: 'field',
    })
    .select('id')
    .single();

  if (insErr || !att) {
    // rollback storage
    await admin.storage.from('attachments').remove([filePath]);
    return { ok: false, error: insErr?.message ?? 'DB 저장 실패' };
  }

  // 링크 used 처리
  await admin
    .from('field_upload_links')
    .update({ status: 'used', used_at: new Date().toISOString() })
    .eq('id', link.id);

  revalidatePath(`/logs/${link.waste_log_id}`);
  return { ok: true, attachmentId: att.id as string };
}

// 사무직원 측에서 사진 삭제
export async function deleteAttachmentAction(
  attachmentId: string,
  logId: string,
): Promise<UploadResult> {
  const admin = createAdminClient();

  const { data: att } = await admin
    .from('attachments')
    .select('file_path')
    .eq('id', attachmentId)
    .maybeSingle();
  if (!att) return { ok: false, error: '첨부 파일이 없습니다' };

  await admin.storage.from('attachments').remove([att.file_path]);
  const { error } = await admin.from('attachments').delete().eq('id', attachmentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/logs/${logId}`);
  return { ok: true };
}
