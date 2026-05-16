'use client';

import * as React from 'react';
import { useEffect, useId, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SearchableOption {
  id: string;
  name: string;
  hint?: string;
}

interface Props {
  options: SearchableOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyLabel?: string; // 입력창에 표시될 placeholder; 미선택일 때.
  disabled?: boolean;
  className?: string;
  id?: string;
  // <form> 안에서 GET/POST 로 제출할 때 ID 를 함께 보내려면 name 지정.
  name?: string;
  // onChange 가 동기적으로 부모 상태를 갱신하지 못하는 form 사용 케이스용.
  // value/onChange 만으로 충분하면 생략.
}

// 키보드 타자로 검색 가능한 셀렉트.
// HTML5 <datalist> 기반 — 브라우저가 기본으로 부분 일치 필터링을 해 주고,
// 화살표/엔터 키보드 네비도 지원. 옵션 클릭 시 onChange(id) 호출.
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  emptyLabel = '선택…',
  disabled,
  className,
  id,
  name,
}: Props) {
  const reactId = useId();
  const listId = `combo-${reactId}`;

  const idToName = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.id, o.name);
    return m;
  }, [options]);

  const nameToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.name, o.id);
    return m;
  }, [options]);

  // 입력창에 보이는 텍스트 — 선택된 id 에 해당하는 name 이 기본, 사용자 입력 시 자유롭게 바뀜.
  const selectedName = idToName.get(value) ?? '';
  const [text, setText] = useState(selectedName);

  // 외부에서 value 가 바뀌면 text 동기화 (예: 부모가 reset 호출)
  useEffect(() => {
    setText(selectedName);
  }, [selectedName]);

  const commit = (next: string) => {
    setText(next);
    if (next === '') {
      if (value !== '') onChange('');
      return;
    }
    const matchedId = nameToId.get(next);
    if (matchedId !== undefined) {
      if (matchedId !== value) onChange(matchedId);
    } else {
      // 부분 입력 중 — 부모 선택은 비움
      if (value !== '') onChange('');
    }
  };

  const handleBlur = () => {
    // blur 시 정확히 매칭되지 않으면 마지막 유효 값으로 복원, 빈 입력이면 그대로 클리어 유지
    if (text === '' || nameToId.has(text)) return;
    setText(selectedName);
  };

  // 클릭 시 전체 텍스트 선택 — 새로 검색하기 편하도록
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.select();
  };

  return (
    <>
      <input
        id={id}
        type="text"
        list={listId}
        value={text}
        onChange={(e) => commit(e.target.value)}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder ?? emptyLabel}
        disabled={disabled}
        autoComplete="off"
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-foreground-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.id} value={o.name}>
            {o.hint ?? ''}
          </option>
        ))}
      </datalist>
      {name && <input type="hidden" name={name} value={value} />}
    </>
  );
}
