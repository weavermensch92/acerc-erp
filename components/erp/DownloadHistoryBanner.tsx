import { FileDown } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/format';

interface DownloadHistory {
  id: string;
  downloaded_at: string;
  period_from: string | null;
  period_to: string | null;
  downloaded_by: string | null;
}

interface Props {
  histories: DownloadHistory[];
  companyName?: string;
}

const sourceLabel: Record<string, string> = {
  office_batch: '사무실 일괄',
  office_single: '사무실 단건',
  company_self: '거래처 셀프',
};

export function DownloadHistoryBanner({ histories, companyName }: Props) {
  if (histories.length === 0) return null;
  const latest = histories[0];
  const sourceCounts = histories.reduce(
    (acc, h) => {
      const k = h.downloaded_by ?? 'unknown';
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="flex items-start gap-3 rounded-[10px] border border-warning/40 bg-warning-bg/60 px-4 py-3 text-warning">
      <FileDown className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
      <div className="flex-1 text-sm">
        <p className="font-semibold">
          📄 이미 다운로드된 거래처
          {companyName && <span className="ml-1">— {companyName}</span>}
        </p>
        <p className="mt-1 text-[12.5px]">
          {latest.period_from && latest.period_to
            ? `${formatDate(latest.period_from)} ~ ${formatDate(latest.period_to)} 명세표`
            : '거래명세표'}
          를{' '}
          <strong>{formatDateTime(latest.downloaded_at)}</strong>에 다운로드 (
          {sourceLabel[latest.downloaded_by ?? ''] ?? '?'}).
        </p>
        <p className="mt-1.5 text-[11px] opacity-90">
          총 {histories.length}회 발급 ·{' '}
          {Object.entries(sourceCounts)
            .map(([k, v]) => `${sourceLabel[k] ?? k} ${v}`)
            .join(' / ')}{' '}
          · 단가 / 금액 수정 시 거래처에게 변경 안내 권장 (카톡 알림은 Phase 2)
        </p>
      </div>
    </div>
  );
}
