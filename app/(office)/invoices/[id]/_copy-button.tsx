'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  url: string;
  label?: string;
}

export function CopyButton({ url, label = '복사' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleCopy}>
      <Copy className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />
      {copied ? '복사됨' : label}
    </Button>
  );
}
