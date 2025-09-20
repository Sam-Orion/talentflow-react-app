'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Job { id: number; title: string; slug: string; status: 'active'|'archived'; tags: string[]; order: number }
interface JobsResponse { data: Job[]; page: number; pageSize: number; total: number; pages: number }

export default function AssessmentsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [resp, setResp] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    params.set('sort', 'order');
    return `/jobs?${params.toString()}`;
  }, [search, status, page, pageSize]);

  useEffect(() => {
    setLoading(true);
    fetch(query).then((r) => r.json()).then((d: JobsResponse) => setResp(d)).finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Assessments</h1>
        <Button asChild size="sm"><Link href="/">Back</Link></Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input placeholder="Search jobs" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v === 'any' ? '' : v); }}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground flex items-center">{resp ? `Total jobs: ${resp.total}` : ' '}</div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

      <ul className="divide-y rounded-md border">
        {resp?.data.map((j) => (
          <li key={j.id} className="p-4 flex items-center justify-between gap-4">
            <div>
              <Link href={`/jobs/${j.id}`} className="font-medium hover:underline">{j.title}</Link>
              <div className="text-xs text-muted-foreground">/{j.slug} • {j.status}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm"><Link href={`/assessments/${j.id}`}>Open Builder</Link></Button>
            </div>
          </li>
        ))}
        {!loading && resp && resp.data.length === 0 && (
          <li className="p-6 text-sm text-muted-foreground">No jobs found.</li>
        )}
      </ul>

      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>Prev</Button>
        <div className="text-sm text-muted-foreground">Page {resp?.page ?? page} of {resp?.pages ?? '…'}</div>
        <Button size="sm" variant="outline" onClick={() => setPage((p) => (resp ? Math.min(resp.pages, p + 1) : p + 1))} disabled={loading || (resp ? page >= resp.pages : false)}>Next</Button>
      </div>
    </div>
  );
}