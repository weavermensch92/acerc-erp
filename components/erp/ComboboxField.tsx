'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export interface ComboboxOption {
  id: string;
  name: string;
  hint?: string;
}

interface Props {
  label?: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  listId: string;
  disabled?: boolean;
  hint?: string;
  error?: string;
  inputId?: string;
}

// datalist 기반 콤보박스 — 기존 옵션 선택 또는 새 값 직접 입력 가능.
// 새 값은 서버 createLogAction 에서 자동으로 마스터(waste_types/treatment_plants/sites)에 추가됨.
export function ComboboxField({
  label,
  required,
  placeholder,
  value,
  onChange,
  options,
  listId,
  disabled,
  hint,
  error,
  inputId,
}: Props) {
  return (
    <div className="space-y-1.5">
      {label && (
        <Label htmlFor={inputId}>
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </Label>
      )}
      <Input
        id={inputId}
        type="text"
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '입력하거나 목록에서 선택'}
        disabled={disabled}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.id} value={o.name}>
            {o.hint ?? ''}
          </option>
        ))}
      </datalist>
      {hint && <p className="text-[11px] text-foreground-muted">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
