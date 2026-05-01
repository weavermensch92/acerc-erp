'use client';

import { useState, useEffect, useRef } from 'react';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import type { CompanyTypeaheadResult } from '@/lib/typeahead/companies';

interface Props {
  label?: string;
  required?: boolean;
  placeholder?: string;
  selectedName?: string | null;
  onSelect: (item: CompanyTypeaheadResult) => void;
  onCreateNew?: (query: string) => void;
  error?: string;
  disabled?: boolean;
}

export function CompanyTypeaheadField({
  label,
  required,
  placeholder,
  selectedName,
  onSelect,
  onCreateNew,
  error,
  disabled,
}: Props) {
  const [query, setQuery] = useState(selectedName ?? '');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CompanyTypeaheadResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  // 외부에서 selectedName 변경 시 input 동기화
  useEffect(() => {
    if (selectedName !== undefined && selectedName !== null) setQuery(selectedName);
  }, [selectedName]);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length === 0) {
      setResults([]);
      return;
    }
    if (trimmed === selectedName) {
      // 이미 선택된 항목 — 재 fetch 불필요
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/companies/typeahead?q=${encodeURIComponent(trimmed)}`)
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((data) => {
        if (!cancelled) setResults(data.results ?? []);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, selectedName]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showCreate = !!onCreateNew && debouncedQuery.trim().length > 0;
  const showDropdown = open && (results.length > 0 || loading || debouncedQuery.trim().length > 0);

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && (
        <label className="text-sm font-medium leading-none text-foreground-secondary">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? '거래처명 입력 (한 글자 이상)'}
          disabled={disabled}
          autoComplete="off"
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm',
            'ring-offset-background placeholder:text-foreground-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
        {showDropdown && (
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-md">
            {loading && (
              <div className="px-3 py-2 text-xs text-foreground-muted">검색 중…</div>
            )}
            {!loading && results.length === 0 && debouncedQuery.trim().length > 0 && (
              <div className="px-3 py-2 text-xs text-foreground-muted">
                일치하는 거래처가 없습니다
              </div>
            )}
            {!loading &&
              results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setQuery(r.name);
                    setOpen(false);
                    onSelect(r);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-background-subtle"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{r.name}</span>
                    {r.business_no && (
                      <span className="text-[11px] text-foreground-muted">{r.business_no}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-foreground-muted">
                    {r.is_internal && (
                      <span className="rounded-full bg-background-subtle px-1.5 py-px">자사</span>
                    )}
                    <span className="font-mono">{r.freq}건</span>
                  </div>
                </button>
              ))}
            {!loading && showCreate && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onCreateNew!(debouncedQuery.trim());
                }}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-background-subtle"
              >
                <span className="text-foreground-muted">+</span>
                <span>“{debouncedQuery.trim()}” 새 거래처 등록</span>
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
