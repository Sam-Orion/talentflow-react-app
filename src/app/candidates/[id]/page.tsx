'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface Event { id?: number; candidateId: number; type: 'stage_change'|'note'; from?: string|null; to?: string|null; note?: string; at: number }
interface Candidate { id: number; name: string; email: string; stage: string }

export default function CandidateProfile({ params }: { params: { id: string } }) {
  const cid = Number(params.id);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [timeline, setTimeline] = useState<Event[]>([]);
  const [noteText, setNoteText] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const mentionables = useMemo(() => ['hr.anne','hiring.bob','cto.alex','recruiter.sam','ops.riley'], []);

  useEffect(() => {
    // wait for Mirage to boot (max ~3s) before first fetch
    let cancelled = false;
    const load = async () => {
      if (typeof window !== 'undefined') {
        const start = Date.now();
        while (!(window as any)._mirageRunning && Date.now() - start < 3000) {
          await new Promise((r) => setTimeout(r, 50));
        }
      }
      if (cancelled) return;
      fetch(`/candidates?page=1&pageSize=1000`).then((r) => r.json()).then((d) => {
        const found = (d.data as Candidate[]).find((c) => c.id === cid) || null;
        setCandidate(found);
      }).catch(() => setCandidate(null));
      fetch(`/candidates/${cid}/timeline`).then((r) => r.json()).then((events: Event[]) => {
        // ensure newest-first in UI
        setTimeline([...events].sort((a, b) => b.at - a.at));
      }).catch(() => setTimeline([]));
    };
    load();
    return () => { cancelled = true; };
  }, [cid]);

  const query = useMemo(() => {
    const at = noteText.lastIndexOf('@');
    if (at === -1) return '';
    const fragment = noteText.slice(at + 1).trim();
    if (fragment.includes(' ') || fragment.includes('\n')) return '';
    return fragment.toLowerCase();
  }, [noteText]);

  const suggestions = useMemo(() => {
    if (!query) return [] as string[];
    return mentionables.filter((h) => h.toLowerCase().startsWith(query)).slice(0, 5);
  }, [mentionables, query]);

  const applySuggestion = (handle: string) => {
    const at = noteText.lastIndexOf('@');
    if (at === -1) return;
    const before = noteText.slice(0, at + 1);
    setNoteText(before + handle + ' ');
    setShowSuggest(false);
  };

  const submitNote = async () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    const optimistic: Event = { candidateId: cid, type: 'note', note: trimmed, at: Date.now() };
    const prev = [...timeline];
    setTimeline((t) => [optimistic, ...t]);
    setNoteText('');
    try {
      const res = await fetch(`/candidates/${cid}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: trimmed }) });
      if (!res.ok) throw new Error('failed');
      // reload timeline to ensure order
      const fresh = await fetch(`/candidates/${cid}/timeline`).then((r) => r.json());
      setTimeline([...fresh].sort((a: Event, b: Event) => b.at - a.at));
    } catch {
      setTimeline(prev);
      setNoteText(trimmed);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <Link className="underline text-sm" href="/candidates">← Back to Candidates</Link>
      {!candidate && <div className="text-sm text-muted-foreground">Loading…</div>}
      {candidate && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{candidate.name}</h1>
            <div className="text-sm text-muted-foreground">{candidate.email} • Current stage: {candidate.stage}</div>
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <div className="text-sm font-medium">Add note</div>
            <div className="relative">
              <textarea
                className="w-full rounded border bg-background p-2 text-sm min-h-24"
                placeholder="Type a note… Use @ to mention (e.g., @hr.anne)"
                value={noteText}
                onChange={(e) => { setNoteText(e.target.value); setCursorPos(e.target.selectionStart || 0); setShowSuggest(true); }}
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    submitNote();
                  }
                }}
              />
              {showSuggest && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-56 rounded-md border bg-popover text-popover-foreground shadow">
                  <ul className="max-h-48 overflow-auto py-1 text-sm">
                    {suggestions.map((h) => (
                      <li key={h}>
                        <button
                          type="button"
                          className="w-full px-2 py-1 text-left hover:bg-accent hover:text-accent-foreground"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applySuggestion(h)}
                        >@{h}</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end">
              <button className="text-xs rounded border px-2 py-1" onClick={submitNote}>Save note (⌘/Ctrl+Enter)</button>
            </div>
          </div>

          <div className="mt-2">
            <h2 className="font-medium mb-2">Timeline</h2>
            <ol className="space-y-2">
              {timeline.map((e, idx) => (
                <li key={idx} className="text-sm">
                  {e.type === 'stage_change' ? (
                    <span>Moved from <b>{e.from ?? '—'}</b> to <b>{e.to ?? '—'}</b> on {new Date(e.at).toLocaleString()}</span>
                  ) : (
                    <span>
                      Note: {e.note && (
                        <>
                          {e.note.split(/(\@[a-zA-Z0-9._-]+)/g).map((part, i) =>
                            part.startsWith('@') ? (
                              <span key={i} className="font-medium text-primary">{part}</span>
                            ) : (
                              <span key={i}>{part}</span>
                            )
                          )}
                        </>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}