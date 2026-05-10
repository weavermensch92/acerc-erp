'use client';

import { useRef, useState, useTransition } from 'react';
import { Download, Upload, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  exportBackupAction,
  importBackupAction,
  type ImportResult,
} from '@/actions/backup';

const tableLabel: Record<string, string> = {
  companies: '거래처',
  waste_types: '성상',
  treatment_plants: '처리장',
  sites: '현장',
  waste_logs: '폐기물일보',
  app_settings: '자사 정보',
};

export function BackupCard() {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = () => {
    setError(null);
    setImportResult(null);
    startTransition(async () => {
      const result = await exportBackupAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const blob = new Blob([JSON.stringify(result.payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const yyyymmdd = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `acerc-erp-backup-${yyyymmdd}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImportResult(null);

    if (
      !window.confirm(
        '백업 파일을 복원하시겠습니까?\n\n동일 ID 데이터 중 백업이 더 최신인 행만 덮어씁니다. 이 작업은 되돌릴 수 없으니 진행 전 현재 데이터를 백업해두는 것을 권장합니다.',
      )
    ) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      startTransition(async () => {
        const result = await importBackupAction(text);
        setImportResult(result);
        if (!result.ok && result.error) setError(result.error);
      });
    };
    reader.onerror = () => setError('파일 읽기 실패');
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">백업 / 복원</h2>
          <p className="mt-1 text-xs text-foreground-secondary">
            전체 데이터(일보·마스터·자사 정보)를 JSON 한 파일로 저장하고, 같은 형식의 백업을 업로드해 복원합니다.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleExport} disabled={busy} size="sm">
          {busy ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1 h-3.5 w-3.5" />
          )}
          백업 다운로드
        </Button>
        <Button
          onClick={handleImportClick}
          disabled={busy}
          size="sm"
          variant="outline"
        >
          <Upload className="mr-1 h-3.5 w-3.5" />
          백업 복원
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded border border-danger/30 bg-danger-bg/40 p-2 text-xs text-danger">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {importResult?.results && (
        <div className="mt-3 rounded border border-border bg-background-subtle p-2 text-xs">
          <div className="mb-2 flex items-center gap-1 font-medium text-foreground">
            {importResult.ok ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            )}
            복원 결과
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-foreground-secondary">
                <th className="pb-1 text-left font-normal">테이블</th>
                <th className="pb-1 text-right font-normal">신규</th>
                <th className="pb-1 text-right font-normal">갱신</th>
                <th className="pb-1 text-right font-normal">건너뜀</th>
                <th className="pb-1 text-right font-normal">실패</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(importResult.results).map(([tbl, r]) => (
                <tr key={tbl} className="border-t border-border/50">
                  <td className="py-1 text-foreground">{tableLabel[tbl] ?? tbl}</td>
                  <td className="py-1 text-right font-mono">{r.inserted}</td>
                  <td className="py-1 text-right font-mono">{r.updated}</td>
                  <td className="py-1 text-right font-mono text-foreground-secondary">
                    {r.skipped}
                  </td>
                  <td className="py-1 text-right font-mono text-danger">
                    {r.failed.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
