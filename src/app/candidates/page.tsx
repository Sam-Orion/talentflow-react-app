'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Stage = 'applied'|'screen'|'tech'|'offer'|'hired'|'rejected';
interface Candidate { id: number; name: string; email: string; stage: Stage }
interface CandidatesResponse { data: Candidate[]; page: number; pageSize: number; total: number; pages: number }

export default function CandidatesPage() {
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(1000); // load all, we will virtualize client-side
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<CandidatesResponse | null>(null);

  const stages: Stage[] = ['applied','screen','tech','offer','hired','rejected'];

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (stage) params.set('stage', stage);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    return `/candidates?${params.toString()}`;
  }, [search, stage, page, pageSize]);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    fetch(query)
      .then(async (r) => {
        const ct = r.headers.get('content-type') || '';
        if (!r.ok || !ct.includes('application/json')) throw new Error('bad-response');
        return r.json();
      })
      .then((d: CandidatesResponse) => setResp(d))
      .catch(() => setError('Failed to load candidates'))
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    // Ensure Mirage mock API is running before first fetch to avoid HTML/JSON mismatch
    const ready = typeof window !== 'undefined' && (window as any)._mirageRunning;
    if (ready) { load(); return; }
    let attempts = 0;
    const iv = setInterval(() => {
      attempts += 1;
      if ((window as any)._mirageRunning || attempts > 60) { // ~3s max wait
        clearInterval(iv);
        load();
      }
    }, 50);
    return () => clearInterval(iv);
  }, [load]);

  // remove redundant immediate load that could race Mirage startup
  // useEffect(() => { load(); }, [load]);

  // Virtualization
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowHeight = 64; // px per row
  const overscan = 6; // rows
  const [scrollTop, setScrollTop] = useState(0);
  const totalRows = resp?.data.length ?? 0;
  const viewportHeight = 480; // fixed viewport height for list area
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  const visible = resp?.data.slice(startIndex, endIndex) ?? [];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Drag-and-drop Kanban
  const [boardOpen, setBoardOpen] = useState(false);
  const [board, setBoard] = useState<Record<Stage, Candidate[]>>({
    applied: [], screen: [], tech: [], offer: [], hired: [], rejected: [],
  });

  useEffect(() => {
    if (!resp) return;
    const grouped: Record<Stage, Candidate[]> = { applied:[], screen:[], tech:[], offer:[], hired:[], rejected:[] };
    for (const c of resp.data) grouped[c.stage].push(c);
    setBoard(grouped);
  }, [resp]);

  const onDropCandidate = async (cand: Candidate, toStage: Stage) => {
    if (cand.stage === toStage) return;
    // optimistic
    const prev = board;
    setBoard((b) => {
      const next: Record<Stage, Candidate[]> = { applied:[...b.applied], screen:[...b.screen], tech:[...b.tech], offer:[...b.offer], hired:[...b.hired], rejected:[...b.rejected] };
      next[cand.stage] = next[cand.stage].filter((x) => x.id !== cand.id);
      next[toStage] = [{ ...cand, stage: toStage }, ...next[toStage]];
      return next;
    });
    try {
      const res = await fetch(`/candidates/${cand.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: toStage }) });
      if (!res.ok) throw new Error('failed');
    } catch {
      setBoard(prev);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Candidates</h1>
        <div className="flex gap-2">
          <Button asChild size="sm"><Link href="/">Back</Link></Button>
          <Button size="sm" variant="secondary" onClick={() => { setSearch(''); setStage(''); setPage(1); }}>Reset</Button>
          <Button size="sm" variant={boardOpen ? 'default' : 'outline'} onClick={() => setBoardOpen((v) => !v)}>{boardOpen ? 'List View' : 'Kanban View'}</Button>
        </div>
      </div>

      {!boardOpen && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="Search name or email" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
            <Select value={stage} onValueChange={(v) => { setPage(1); setStage(v === 'any' ? '' : v); }}>
              <SelectTrigger>
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="applied">Applied</SelectItem>
                <SelectItem value="screen">Screen</SelectItem>
                <SelectItem value="tech">Tech</SelectItem>
                <SelectItem value="offer">Offer</SelectItem>
                <SelectItem value="hired">Hired</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Total: {resp?.total ?? '—'}</span>
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

          <div className="rounded-md border" style={{ height: viewportHeight }} ref={containerRef}>
            <div style={{ height: totalRows * rowHeight, position: 'relative' }}>
              <ul style={{ position: 'absolute', top: startIndex * rowHeight, left: 0, right: 0 }}>
                {visible.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 px-4" style={{ height: rowHeight }}>
                    <div>
                      <Link href={`/candidates/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                      <div className="text-xs text-muted-foreground">{c.email} • {c.stage}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button asChild size="sm" variant="outline"><Link href={`/candidates/${c.id}`}>Open</Link></Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      {boardOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {stages.map((st) => (
            <div key={st} className="rounded-md border bg-card">
              <div className="px-3 py-2 border-b text-sm font-medium capitalize">{st}</div>
              <div
                className="p-2 min-h-40 space-y-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const payload = e.dataTransfer.getData('application/json');
                  if (!payload) return;
                  try {
                    const cand: Candidate = JSON.parse(payload);
                    onDropCandidate(cand, st);
                  } catch {}
                }}
              >
                {board[st].slice(0, 50).map((c) => (
                  <div
                    key={c.id}
                    className="rounded border bg-background px-2 py-1 cursor-move"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify(c));
                    }}
                  >
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                  </div>
                ))}
                {board[st].length === 0 && (
                  <div className="text-xs text-muted-foreground">No candidates</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}