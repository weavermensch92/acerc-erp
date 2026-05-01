'use client';

import { useEffect, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/erp/Modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { createCompanyInline } from '@/actions/companies';

interface Props {
  open: boolean;
  onClose: () => void;
  initialName: string;
  onCreated: (company: { id: string; name: string; default_unit_price: number | null }) => void;
}

export function CompanyCreateDialog({ open, onClose, initialName, onCreated }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initialName);
  const [businessNo, setBusinessNo] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [defaultUnitPrice, setDefaultUnitPrice] = useState<string>('');

  useEffect(() => {
    if (open) {
      setName(initialName);
      setError(null);
    }
  }, [open, initialName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await createCompanyInline({
        name: name.trim(),
        business_no: businessNo.trim() || null,
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        default_unit_price: defaultUnitPrice ? Number(defaultUnitPrice) : null,
      });
      if (!r.ok || !r.company) {
        setError(r.error ?? '저장 실패');
        return;
      }
      setBusinessNo('');
      setContactName('');
      setContactPhone('');
      setDefaultUnitPrice('');
      onCreated(r.company);
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="새 거래처 등록"
      description="최소 정보만 입력 — 상세는 거래처 마스터에서 보완"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cc-name">
            거래처명<span className="ml-0.5 text-danger">*</span>
          </Label>
          <Input
            id="cc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cc-bizno">사업자번호</Label>
            <Input
              id="cc-bizno"
              value={businessNo}
              onChange={(e) => setBusinessNo(e.target.value)}
              placeholder="123-45-67890"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-unit">기본단가 (원/kg)</Label>
            <Input
              id="cc-unit"
              type="number"
              inputMode="numeric"
              value={defaultUnitPrice}
              onChange={(e) => setDefaultUnitPrice(e.target.value)}
              placeholder="비워두면 성상 단가"
              className="font-mono"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cc-cname">담당자</Label>
            <Input
              id="cc-cname"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-cphone">연락처</Label>
            <Input
              id="cc-cphone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="010-1234-5678"
            />
          </div>
        </div>
        {error && (
          <div className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">{error}</div>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button type="submit" disabled={isPending || !name.trim()} className="flex-1">
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}등록
          </Button>
        </div>
      </form>
    </Modal>
  );
}
