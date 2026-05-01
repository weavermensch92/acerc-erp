import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchCompanies } from '@/lib/typeahead/companies';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  if (q.trim().length === 0) {
    return NextResponse.json({ results: [] });
  }
  const supabase = createClient();
  const results = await searchCompanies(supabase, q, 10);
  return NextResponse.json({ results });
}
