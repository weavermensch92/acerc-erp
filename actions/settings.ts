'use server';

import { revalidatePath } from 'next/cache';
import { setReviewProcessEnabled, setSelfCompanyInfo } from '@/lib/settings';
import { selfCompanySchema, type SelfCompanyInfo } from '@/lib/company-info';

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
