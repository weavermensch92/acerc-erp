import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export function formatKRW(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('ko-KR').format(n);
}

export function formatKg(weight: number | null | undefined): string {
  if (weight === null || weight === undefined) return '—';
  return `${formatNumber(weight)}kg`;
}

// 기본 패턴: yy/MM/dd — 줄바꿈 최소화 (예: 26/04/27)
export function formatDate(date: Date | string | null | undefined, pattern = 'yy/MM/dd'): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, pattern, { locale: ko });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  return formatDate(date, 'yy/MM/dd HH:mm');
}

// 폼 제출용 ISO 일자 (YYYY-MM-DD) — DB 입력 또는 input[type=date] 호환
export function formatDateIso(date: Date | string | null | undefined): string {
  return formatDate(date, 'yyyy-MM-dd');
}

export function formatMonth(date: Date | string | null | undefined): string {
  return formatDate(date, 'yyyy년 M월');
}
