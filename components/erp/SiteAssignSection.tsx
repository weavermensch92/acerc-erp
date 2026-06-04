'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { MapPin, Plus, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Pill } from '@/components/erp/Pill';
import { Modal } from '@/components/erp/Modal';
import { createSiteQuickAction, reassignSiteAction } from '@/actions/sites';
import type { Site } from '@/lib/types/database';

interface OtherSite {
  id: string;
  name: string;
  company_id: string;
  company_name: string | null;
}

interface Props {
  companyId: string;
  sites: Site[];
  otherSites: OtherSite[];
}

type Mode = 'menu' | 'new' | 'existing';

export function SiteAssignSection({ companyId, sites, otherSites }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('menu');

  return (
    <section className="rounded-[10px] border border-border bg-surface p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold tracking-tight">
          공사현장 ({sites.length})
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setMode('menu');
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />현장 할당
        </Button>
      </div>
      {sites.length === 0 ? (
        <p className="text-xs text-foreground-muted">
          할당된 공사현장이 없습니다. 위 버튼으로 추가하세요.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {sites.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-md border border-border bg-background-subtle px-3 py-2 text-sm"
            >
              <MapPin
                className="h-3.5 w-3.5 text-foreground-muted"
                strokeWidth={1.75}
              />
              <span className="font-medium">{s.name}</span>
              {s.address ? (
                <span className="text-[11px] text-foreground-muted">{s.address}</span>
              ) : (
                <span className="text-[11px] italic text-foreground-muted">
                  주소 미입력
                </span>
              )}
              {!s.is_active && (
                <Pill tone="neutral" className="ml-auto">
                  비활성
                </Pill>
              )}
              <Link
                href="/sites"
                className="ml-auto text-[11px] text-foreground-muted hover:text-foreground hover:underline"
              >
                상세 →
              </Link>
            </li>
          ))}
        </ul>
      )}

      <SiteAssignModal
        open={open}
        mode={mode}
        setMode={setMode}
        onClose={() => setOpen(false)}
        companyId={companyId}
        otherSites={otherSites}
      />
    </section>
  );
}

function SiteAssignModal({
  open,
  mode,
  setMode,
  onClose,
  companyId,
  otherSites,
}: {
  open: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
  onClose: () => void;
  companyId: string;
  otherSites: OtherSite[];
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        mode === 'menu'
          ? '현장 할당'
          : mode === 'new'
            ? '신규 현장 추가'
            : '기존 현장 이관'
      }
      description={
        mode === 'menu'
          ? '신규 현장을 추가하거나, 다른 거래처에 등록된 현장을 이 거래처로 이관하세요.'
          : mode === 'new'
            ? '이름만 입력하면 등록됩니다. 주소·기간 등은 나중에 현장 관리에서 추가하세요.'
            : '선택한 현장의 소속 거래처가 이 거래처로 변경됩니다.'
      }
    >
      {mode === 'menu' ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setMode('new')}
            className="flex w-full items-center justify-between rounded-md border border-border bg-background-subtle/40 p-3 text-left text-sm hover:border-foreground/30"
          >
            <div>
              <div className="font-medium">신규 현장 추가</div>
              <div className="text-[11.5px] text-foreground-muted">
                현장명만 입력하면 등록 — 주소·기간은 나중에
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-foreground-muted" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => setMode('existing')}
            className="flex w-full items-center justify-between rounded-md border border-border bg-background-subtle/40 p-3 text-left text-sm hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={otherSites.length === 0}
          >
            <div>
              <div className="font-medium">기존 현장 선택 (이관)</div>
              <div className="text-[11.5px] text-foreground-muted">
                {otherSites.length === 0
                  ? '이관 가능한 다른 거래처 현장이 없습니다.'
                  : `다른 거래처 현장 ${otherSites.length}곳 중 선택`}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-foreground-muted" strokeWidth={1.75} />
          </button>
        </div>
      ) : mode === 'new' ? (
        <NewSiteForm companyId={companyId} onDone={onClose} onBack={() => setMode('menu')} />
      ) : (
        <ExistingSiteForm
          companyId={companyId}
          otherSites={otherSites}
          onDone={onClose}
          onBack={() => setMode('menu')}
        />
      )}
    </Modal>
  );
}

function NewSiteForm({
  companyId,
  onDone,
  onBack,
}: {
  companyId: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await createSiteQuickAction(companyId, name);
      if (!r.ok) {
        setError(r.error ?? '등록 실패');
        return;
      }
      onDone();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="quick-site-name">
          현장명<span className="ml-0.5 text-danger">*</span>
        </Label>
        <Input
          id="quick-site-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 포항 송도 신축공사"
          autoFocus
          required
        />
        <p className="text-[11px] text-foreground-muted">
          주소·시작일 등 부가 정보는 현장 관리 페이지에서 나중에 보완할 수 있습니다.
        </p>
      </div>
      {error && (
        <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}
      <div className="flex justify-between gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          ← 뒤로
        </Button>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}등록
          </Button>
        </div>
      </div>
    </form>
  );
}

function ExistingSiteForm({
  companyId,
  otherSites,
  onDone,
  onBack,
}: {
  companyId: string;
  otherSites: OtherSite[];
  onDone: () => void;
  onBack: () => void;
}) {
  const [siteId, setSiteId] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!query.trim()) return otherSites;
    const q = query.toLowerCase();
    return otherSites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.company_name ?? '').toLowerCase().includes(q),
    );
  }, [otherSites, query]);

  const selected = otherSites.find((s) => s.id === siteId);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId) {
      setError('이관할 현장을 선택하세요');
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await reassignSiteAction(siteId, companyId);
      if (!r.ok) {
        setError(r.error ?? '이관 실패');
        return;
      }
      onDone();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="exist-search">검색</Label>
        <Input
          id="exist-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="현장명 / 거래처 검색…"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="exist-site">현장 선택</Label>
        <Select
          id="exist-site"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          required
        >
          <option value="">— 선택 —</option>
          {filtered.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.company_name ?? '미상'})
            </option>
          ))}
        </Select>
        <p className="text-[11px] text-foreground-muted">
          {filtered.length === 0
            ? '검색 결과가 없습니다.'
            : `이관 가능한 현장 ${filtered.length}곳`}
        </p>
      </div>
      {selected && (
        <div className="rounded-md border border-warning bg-warning-bg/40 px-3 py-2 text-[11.5px]">
          <span className="font-medium">{selected.name}</span> 의 소속 거래처가{' '}
          <span className="font-medium">{selected.company_name ?? '미상'}</span>
          {' → '}이 거래처로 변경됩니다.
        </div>
      )}
      {error && (
        <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}
      <div className="flex justify-between gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          ← 뒤로
        </Button>
        <Button type="submit" size="sm" disabled={isPending || !siteId}>
          {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}이관
        </Button>
      </div>
    </form>
  );
}
