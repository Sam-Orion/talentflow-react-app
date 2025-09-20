'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface JobsResponse {
  data: Array<{ id: number; title: string; slug: string; status: 'active'|'archived'; tags: string[]; order: number }>; 
  page: number; pageSize: number; total: number; pages: number;
}

export default function JobsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [tags, setTags] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<JobsResponse | null>(null);

  // Create/Edit modal state
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ id?: number; title: string; slug: string; tags: string }>(() => ({ title: '', slug: '', tags: '' }));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // DnD local state
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (tags.trim()) params.set('tags', tags.split(',').map(t => t.trim()).filter(Boolean).join(','));
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    params.set('sort', 'order');
    return `/jobs?${params.toString()}`;
  }, [search, status, tags, page, pageSize]);

  const load = () => {
    setLoading(true); setError(null);
    fetch(query)
      .then((r) => r.json())
      .then((d: JobsResponse) => setResp(d))
      .catch(() => setError('Failed to load jobs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Wait until Mirage (mock API) is running to avoid fetching the /jobs page HTML
    if (typeof window !== 'undefined' && !(window as any)._mirageRunning) {
      let tries = 0;
      const id = setInterval(() => {
        if ((window as any)._mirageRunning || tries++ > 60) { // ~3s max
          clearInterval(id);
          load();
        }
      }, 50);
      return () => clearInterval(id);
    }
    load();
  }, [query]);

  function toSlug(v: string) {
    return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  const openCreate = () => {
    setForm({ title: '', slug: '', tags: '' });
    setSaveError(null);
    setOpen(true);
  };

  const openEdit = (j: JobsResponse['data'][number]) => {
    setForm({ id: j.id, title: j.title, slug: j.slug, tags: j.tags.join(', ') });
    setSaveError(null);
    setOpen(true);
  };

  const submitForm = async () => {
    if (!form.title.trim()) { setSaveError('Title is required'); return; }
    if (!form.slug.trim()) { setSaveError('Slug is required'); return; }
    setSaving(true); setSaveError(null);
    try {
      const body = { title: form.title.trim(), slug: form.slug.trim(), tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) };
      const res = await fetch(form.id ? `/jobs/${form.id}` : '/jobs', { method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg.message || 'Save failed');
      }
      setOpen(false);
      // Reload first page to show new ordering
      setPage(1);
      load();
    } catch (e: any) {
      setSaveError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (j: JobsResponse['data'][number]) => {
    const prev = resp;
    try {
      // optimistic update
      if (resp) {
        const next = { ...resp, data: resp.data.map(x => x.id === j.id ? { ...x, status: j.status === 'active' ? 'archived' : 'active' } : x) } as JobsResponse;
        setResp(next);
      }
      const res = await fetch(`/jobs/${j.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: j.status === 'active' ? 'archived' : 'active' }) });
      if (!res.ok) throw new Error('Archive failed');
    } catch {
      // rollback
      setResp(prev ?? null);
    }
  };

  const move = async (j: JobsResponse['data'][number], direction: -1 | 1) => {
    if (!resp) return;
    const list = [...resp.data].sort((a, b) => a.order - b.order);
    const idx = list.findIndex(x => x.id === j.id);
    const to = idx + direction;
    if (to < 0 || to >= list.length) return;
    const prev = resp;
    // optimistic local re-order
    const swapped = [...list];
    const [item] = swapped.splice(idx, 1);
    swapped.splice(to, 0, item);
    const remapped = swapped.map((x, i) => ({ ...x, order: i }));
    setResp({ ...resp, data: remapped } as JobsResponse);
    try {
      const res = await fetch(`/jobs/${j.id}/reorder`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromOrder: idx, toOrder: to }) });
      if (!res.ok) throw new Error('Reorder failed');
    } catch {
      // rollback
      setResp(prev);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <div className="flex gap-2">
          <Button asChild size="sm"><Link href="/">Back</Link></Button>
          <Button size="sm" variant="secondary" onClick={() => { setSearch(''); setStatus(''); setTags(''); setPage(1); }}>Reset</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Input placeholder="Search title or slug" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
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
        <Input
          placeholder="Filter tags (comma separated)"
          value={tags}
          onChange={(e) => { setPage(1); setTags(e.target.value); }}
        />
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>New Job</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{form.id ? 'Edit Job' : 'Create Job'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm">Title</label>
                  <Input
                    value={form.title}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({ ...f, title: v, slug: f.id ? f.slug : toSlug(v) }));
                    }}
                    placeholder="e.g. Senior Frontend Engineer"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm">Slug</label>
                  <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: toSlug(e.target.value) }))} placeholder="unique-slug" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm">Tags (comma separated)</label>
                  <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="remote, full-time" />
                </div>
                {saveError && <div className="text-sm text-red-600">{saveError}</div>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                <Button onClick={submitForm} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <span className="text-sm text-muted-foreground">{resp ? `Total ${resp.total}` : ' '}</span>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

      <ul className="divide-y rounded-md border">
        {resp?.data.map((j, idx) => (
          <li
            key={j.id}
            className="p-4 flex items-center justify-between gap-4"
            draggable
            onDragStart={() => setDragIndex(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              if (dragIndex === null || dragIndex === idx || !resp) return;
              const from = dragIndex;
              const to = idx;
              const prev = resp;
              // optimistic reorder for current page view
              const pageList = [...resp.data];
              const [item] = pageList.splice(from, 1);
              pageList.splice(to, 0, item);
              const remapped = pageList.map((x, i) => ({ ...x, order: (resp.data[0]?.order ?? 0) + i }));
              setResp({ ...resp, data: remapped } as JobsResponse);
              setDragIndex(null);
              try {
                const res = await fetch(`/jobs/${item.id}/reorder`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fromOrder: from, toOrder: to }),
                });
                if (!res.ok) throw new Error('Reorder failed');
              } catch {
                setResp(prev);
              }
            }}
            onDragEnd={() => setDragIndex(null)}
          >
            <div>
              <Link href={`/jobs/${j.id}`} className="font-medium hover:underline">{j.title}</Link>
              <div className="text-xs text-muted-foreground">/{j.slug} • {j.status}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {j.tags.map((t) => (
                  <span key={t} className="text-[10px] rounded bg-muted px-2 py-0.5">{t}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => move(j, -1)} title="Move up">↑</Button>
              <Button size="sm" variant="ghost" onClick={() => move(j, 1)} title="Move down">↓</Button>
              <Button size="sm" variant="secondary" onClick={() => openEdit(j)}>Edit</Button>
              <Button size="sm" variant="outline" onClick={() => toggleArchive(j)}>{j.status === 'active' ? 'Archive' : 'Unarchive'}</Button>
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