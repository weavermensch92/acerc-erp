'use client';

import { useEffect, useState } from 'react';

// 자동완성 등 입력 디바운스용. PRD § 시나리오 2 : 300ms 권장.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
