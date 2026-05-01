'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-lg',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-foreground-muted hover:bg-background-subtle"
          aria-label="닫기"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-xs text-foreground-muted">{description}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
