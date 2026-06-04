'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Pill } from '@/components/erp/Pill';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Modal } from '@/components/erp/Modal';
import {
  createSiteAction,
  updateSiteAction,
  deleteSiteAction,
  type SiteInput,
} from '@/actions/sites';
import type { Company, Site } from '@/lib/types/database';
import { formatNumber, formatDate } from '@/lib/format';

type SiteWithCompany = Site & { companies: { id: string; name: string } | null };

interface Props {
  sites: SiteWithCompany[];
  companies: Pick<Company, 'id' | 'name'>[];
  usageMap: Record<string, number>;
}

interface FormState {
  company_id: string;
  name: string;
  address: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const emptyForm: FormState = {
  company_id: '',
  name: '',
  address: '',
  start_date: '',
  end_date: '',
  is_active: true,
};

export function SitesClient({ sites, companies, usageMap }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SiteWithCompany | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SiteWithCompany | null>(null);
  const [companyFilter, setCompanyFilter] = useState<string>('');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return sites.filter((s) => {
      if (companyFilter && s.company_id !== companyFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const inName = s.name.toLowerCase().includes(q);
        const inAddr = (s.address ?? '').toLowerCase().includes(q);
        const inCompany = (s.companies?.name ?? '').toLowerCase().includes(q);
        if (!inName && !inAddr && !inCompany) return false;
      }
      return true;
    });
  }, [sites, companyFilter, query]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-7 py-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="현장명 / 주소 / 거래처 검색…"
          className="max-w-xs"
        />
        <Select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="max-w-[200px]"
        >
          <option value="">거래처 — 전체</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <span className="ml-auto text-[11.5px] text-foreground-muted">
          총 {filtered.length} / {sites.length} 곳
        </span>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />새 현장
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-7">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
            <MapPin
              className="mx-auto h-8 w-8 text-foreground-muted"
              strokeWidth={1.5}
            />
            <p className="mt-2 text-sm text-foreground-muted">
              {sites.length === 0
                ? '등록된 공사현장이 없습니다.'
                : '검색 결과가 없습니다.'}
            </p>
            {sites.length === 0 && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-3 text-sm font-medium text-foreground underline"
              >
                새 현장 등록 →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>현장명</TableHead>
                  <TableHead>거래처</TableHead>
                  <TableHead>주소</TableHead>
                  <TableHead>기간</TableHead>
                  <TableHead className="text-right">사용 건수</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const used = usageMap[s.id] ?? 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-foreground-secondary">
                        {s.companies ? (
                          <Link
                            href={`/companies/${s.companies.id}`}
                            className="hover:underline"
                          >
                            {s.companies.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-foreground-secondary">
                        {s.address ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-foreground-secondary">
                        {s.start_date || s.end_date
                          ? `${s.start_date ? formatDate(s.start_date) : '—'} ~ ${
                              s.end_date ? formatDate(s.end_date) : '—'
                            }`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatNumber(used)}
                      </TableCell>
                      <TableCell>
                        {s.is_active ? (
                          <Pill tone="success">활성</Pill>
                        ) : (
                          <Pill tone="neutral">비활성</Pill>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditTarget(s)}
                            title="수정"
                          >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDelete(s)}
                            title={
                              used > 0
                                ? `사용 중 (${used}건) — 삭제 불가`
                                : '삭제'
                            }
                          >
                            <Trash2
                              className="h-3.5 w-3.5 text-danger"
                              strokeWidth={1.75}
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <SiteFormModal
        open={createOpen || editTarget !== null}
        onClose={() => {
          setCreateOpen(false);
          setEditTarget(null);
        }}
        target={editTarget}
        companies={companies}
      />

      <DeleteSiteModal
        target={confirmDelete}
        usage={confirmDelete ? usageMap[confirmDelete.id] ?? 0 : 0}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function SiteFormModal({
  open,
  onClose,
  target,
  companies,
}: {
  open: boolean;
  onClose: () => void;
  target: SiteWithCompany | null;
  companies: Pick<Company, 'id' | 'name'>[];
}) {
  const isEdit = target !== null;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 모달이 열릴 때마다 폼 초기화
  useEffect(() => {
    if (!open) return;
    if (target) {
      setForm({
        company_id: target.company_id,
        name: target.name,
        address: target.address ?? '',
        start_date: target.start_date ?? '',
        end_date: target.end_date ?? '',
        is_active: target.is_active,
      });
    } else {
      setForm(emptyForm);
    }
    setError(null);
  }, [open, target]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input: SiteInput = {
      company_id: form.company_id,
      name: form.name.trim(),
      address: form.address.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      is_active: form.is_active,
    };
    startTransition(async () => {
      const r = isEdit && target
        ? await updateSiteAction(target.id, input)
        : await createSiteAction(input);
      if (!r.ok) {
        setError(r.error ?? '저장 실패');
        return;
      }
      onClose();
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '현장 수정' : '새 현장 등록'}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="site-company">
            거래처<span className="ml-0.5 text-danger">*</span>
          </Label>
          <Select
            id="site-company"
            value={form.company_id}
            onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value }))}
            required
          >
            <option value="">— 선택 —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="site-name">
            현장명<span className="ml-0.5 text-danger">*</span>
          </Label>
          <Input
            id="site-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="site-addr">주소</Label>
          <Input
            id="site-addr"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="(선택) 나중에 추가 가능"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="site-start">시작일</Label>
            <Input
              id="site-start"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-end">종료일</Label>
            <Input
              id="site-end"
              type="date"
              value={form.end_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          <span>활성 (일보 입력 시 노출)</span>
        </label>

        {error && (
          <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {isEdit ? '저장' : '등록'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteSiteModal({
  target,
  usage,
  onClose,
}: {
  target: SiteWithCompany | null;
  usage: number;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!target) return null;
  const blocked = usage > 0;

  const onDelete = () => {
    setError(null);
    startTransition(async () => {
      const r = await deleteSiteAction(target.id);
      if (!r.ok) {
        setError(r.error ?? '삭제 실패');
        return;
      }
      onClose();
    });
  };

  return (
    <Modal open={target !== null} onClose={onClose} title="현장 삭제">
      <div className="space-y-3 text-sm">
        <p>
          <span className="font-medium">{target.name}</span> 현장을 삭제하시겠습니까?
        </p>
        {blocked ? (
          <div className="rounded-md bg-warning-bg px-3 py-2 text-xs text-warning">
            이 현장을 사용하는 일보가 {usage}건 있어 삭제할 수 없습니다. 먼저 일보의 현장 연결을 해제하세요.
          </div>
        ) : (
          <p className="text-xs text-foreground-muted">
            이 작업은 되돌릴 수 없습니다.
          </p>
        )}
        {error && (
          <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={blocked || isPending}
            onClick={onDelete}
          >
            {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            삭제
          </Button>
        </div>
      </div>
    </Modal>
  );
}
