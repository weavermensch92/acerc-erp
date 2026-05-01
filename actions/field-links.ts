'use server';

import { revalidatePath } from 'next/cache';
import { nanoid } from 'nanoid';
import { createClient } from '@/lib/supabase/server';

export interface FieldLinkResult {
  ok: boolean;
  error?: string;
  link?: { id: string; token: string; url: string };
}

export async function createFieldLinkAction(
  logId: string,
  recipientName: string,
): Promise<FieldLinkResult> {
  const trimmed = recipientName.trim();
  if (!trimmed) {
    return { ok: false, error: '기사 이름을 입력하세요' };
  }
  const supabase = createClient();

  // 기존 active 링크 회수 (한 일보당 동시 active 1개 제한)
  await supabase
    .from('field_upload_links')
    .update({ status: 'revoked' })
    .eq('waste_log_id', logId)
    .eq('status', 'active');

  const token = nanoid(20);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('field_upload_links')
    .insert({
      token,
      waste_log_id: logId,
      recipient_name: trimmed,
      status: 'active',
      expires_at: expiresAt,
      created_by: 'office',
    })
    .select('id, token')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? '생성 실패' };
  }

  // photo_required = true 자동 설정 (PRD § 시나리오 2)
  await supabase.from('waste_logs').update({ photo_required: true }).eq('id', logId);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3003';
  revalidatePath(`/logs/${logId}`);

  return {
    ok: true,
    link: {
      id: data.id as string,
      token: data.token as string,
      url: `${appUrl}/field/${data.token}`,
    },
  };
}

export async function revokeFieldLinkAction(
  linkId: string,
  logId: string,
): Promise<FieldLinkResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from('field_upload_links')
    .update({ status: 'revoked' })
    .eq('id', linkId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/logs/${logId}`);
  return { ok: true };
}
