'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { signInAction, type SignInState } from '@/actions/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const initialState: SignInState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? '로그인 중…' : '로그인'}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(signInAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-5 rounded-lg border border-border bg-surface p-6 shadow-sm"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-base font-bold text-primary-foreground">
            A
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold tracking-tight">에이스알앤씨</span>
            <span className="text-[11px] text-foreground-muted">폐기물일보 ERP</span>
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-base font-semibold">로그인</h1>
          <p className="text-xs text-foreground-muted">사무직원 공용 계정</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">ID</Label>
          <Input
            id="email"
            name="email"
            type="text"
            autoComplete="username"
            required
            placeholder="사무실에서 받은 ID"
          />
          <p className="text-[10.5px] text-foreground-muted">
            ID 만 입력 — 도메인 자동 부착
          </p>
          {state.fieldErrors?.email && (
            <p className="text-xs text-danger">{state.fieldErrors.email[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">비밀번호</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {state.fieldErrors?.password && (
            <p className="text-xs text-danger">{state.fieldErrors.password[0]}</p>
          )}
        </div>

        {state.error && (
          <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
            {state.error}
          </div>
        )}

        <SubmitButton />
      </form>
    </div>
  );
}
