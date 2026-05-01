'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// ID 만 입력해도 OK — 자동으로 @acerc.kr 부착 (단일 회사 운영)
const DEFAULT_DOMAIN = '@acerc.kr';

const signInSchema = z.object({
  email: z.string().min(1, 'ID 를 입력하세요'),
  password: z.string().min(6, '비밀번호는 6자 이상'),
});

function normalizeEmail(input: string): string {
  const trimmed = input.trim();
  return trimmed.includes('@') ? trimmed : `${trimmed}${DEFAULT_DOMAIN}`;
}

export interface SignInState {
  error?: string | null;
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
}

export async function signInAction(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(parsed.data.email),
    password: parsed.data.password,
  });

  if (error) {
    // PRD § 9.4 — 사용자 열거 방지: 동일 메시지
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
  }

  redirect('/dashboard');
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
